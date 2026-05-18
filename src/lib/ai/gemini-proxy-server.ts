import {
  extractAnalysisResult,
  extractJsonObjectFromText,
} from "@/lib/ai/story-analysis-result-validation";
import type {
  GeminiProxyAdapter,
  GeminiProxyKeyPool,
  GeminiProxyRetryPolicy,
  GeminiProxyServerConfig,
  GeminiProxyUpstreamError,
} from "@/lib/ai/gemini-proxy-adapter-types";
import type {
  GeminiProxyRequestBody,
  GeminiProxyRuntimeOptions,
} from "@/lib/ai/gemini-proxy-request-types";
import type { StoryAnalysisResult } from "@/lib/types";

const retryableStatuses = [408, 409, 425, 429, 500, 502, 503, 504];

class GeminiProxyAttemptError extends Error {
  upstream: GeminiProxyUpstreamError;

  constructor(upstream: GeminiProxyUpstreamError) {
    super(upstream.message);
    this.name = "GeminiProxyAttemptError";
    this.upstream = upstream;
  }
}

export class GeminiProxyServerError extends Error {
  kind: "config" | "upstream";

  constructor(kind: "config" | "upstream", message: string) {
    super(message);
    this.name = "GeminiProxyServerError";
    this.kind = kind;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasUsableContent(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumberOrDefault(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;

  return value;
}

function splitKeyPool(rawValue: string | undefined) {
  if (!rawValue) return [];

  return rawValue
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizeBaseUrl(baseUrl: string | undefined) {
  const normalized = baseUrl?.trim() ?? "";
  if (!normalized) return undefined;

  return normalized.replace(/\/+$/g, "");
}

function createOpenAiCompatibleChatEndpoint(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";

  return normalized.endsWith("/v1")
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;
}

export function createOpenAiCompatibleModelsEndpoint(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";

  return normalized.endsWith("/v1")
    ? `${normalized}/models`
    : `${normalized}/v1/models`;
}

function stableHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function toAttemptError(upstream: GeminiProxyUpstreamError): GeminiProxyAttemptError {
  return new GeminiProxyAttemptError(upstream);
}

export function createSanitizedUpstreamError(error: unknown): GeminiProxyUpstreamError {
  if (error instanceof GeminiProxyAttemptError) {
    return error.upstream;
  }

  if (error instanceof GeminiProxyServerError) {
    return {
      message: error.message,
      retryable: false,
      source: error.kind === "config" ? "config" : "network",
    };
  }

  if (isAbortError(error)) {
    return {
      message: "Provider request timed out.",
      retryable: true,
      source: "network",
    };
  }

  if (error instanceof Error) {
    return {
      message: `Provider request failed: ${error.message}`,
      retryable: true,
      source: "network",
    };
  }

  return {
    message: "Provider request failed.",
    retryable: true,
    source: "network",
  };
}

export function getGeminiProxyAdapterFromEnv(): GeminiProxyAdapter {
  const envValue = process.env.GEMINI_PROXY_ADAPTER?.trim();

  if (envValue === "openai-compatible") return "openai-compatible";
  if (envValue === "google-generative-language") {
    return "google-generative-language";
  }

  return "google-generative-language";
}

export function readServerKeyPoolFromEnv(
  adapter: GeminiProxyAdapter,
): GeminiProxyKeyPool {
  const keys =
    adapter === "google-generative-language"
      ? splitKeyPool(process.env.GEMINI_API_KEY)
      : splitKeyPool(process.env.GEMINI_PROXY_API_KEYS).length > 0
        ? splitKeyPool(process.env.GEMINI_PROXY_API_KEYS)
        : splitKeyPool(process.env.AI_PROVIDER_API_KEY);

  return {
    keys,
    keyCount: keys.length,
  };
}

export function selectGeminiProxyKey(keys: string[], storyId?: string) {
  if (keys.length === 0) return undefined;

  if (!storyId) return keys[0];

  const index = stableHash(storyId) % keys.length;

  return keys[index];
}

export function getGeminiProxyKeyAttemptOrder(keys: string[], storyId?: string) {
  if (keys.length === 0) return [];

  const firstKey = selectGeminiProxyKey(keys, storyId);
  if (!firstKey) return [...keys];

  return [firstKey, ...keys.filter((key) => key !== firstKey)];
}

export function getGeminiProxyMaxAttemptsFromEnv(keyCount: number) {
  const envValue = Number(process.env.GEMINI_PROXY_MAX_ATTEMPTS);
  const defaultValue =
    keyCount <= 1 ? 1 : Math.min(Math.max(keyCount, 1), 3);

  if (!Number.isFinite(envValue)) return defaultValue;

  return clamp(Math.round(envValue), 1, 10);
}

export function isRetryableStatus(status: number): boolean {
  return retryableStatuses.includes(status);
}

export function getGeminiProxyRetryPolicy(
  keyCount: number,
): GeminiProxyRetryPolicy {
  return {
    maxAttempts: getGeminiProxyMaxAttemptsFromEnv(keyCount),
    retryableStatuses,
    keyFailoverEnabled: keyCount > 1,
  };
}

export function getGeminiProxyServerConfig(): GeminiProxyServerConfig {
  const adapter = getGeminiProxyAdapterFromEnv();
  const keyPool = readServerKeyPoolFromEnv(adapter);
  const retryPolicy = getGeminiProxyRetryPolicy(keyPool.keyCount);

  if (adapter === "google-generative-language") {
    return {
      adapter,
      configured: keyPool.keyCount > 0,
      keyCount: keyPool.keyCount,
      modelSource: "static",
      retryPolicy,
      message:
        keyPool.keyCount > 0
          ? "Google Gemini adapter is configured."
          : "GEMINI_API_KEY is missing for Google Gemini adapter.",
    };
  }

  const baseUrl = normalizeBaseUrl(process.env.GEMINI_PROXY_BASE_URL);
  const baseUrlConfigured = Boolean(baseUrl);
  const configured = Boolean(baseUrlConfigured && keyPool.keyCount > 0);

  return {
    adapter,
    configured,
    keyCount: keyPool.keyCount,
    baseUrl,
    modelSource: configured ? "remote" : "unavailable",
    retryPolicy,
    message: configured
      ? "OpenAI-compatible Gemini proxy adapter is configured."
      : !baseUrlConfigured
        ? "GEMINI_PROXY_BASE_URL is missing for openai-compatible adapter."
        : "No server-side key is configured for openai-compatible adapter.",
  };
}

export function normalizeGeminiModel(model: string): string {
  const normalized = model.trim();

  return normalized || "gemini-2.5-flash";
}

export function normalizeGenerationConfig(runtime?: GeminiProxyRuntimeOptions) {
  const temperature = clamp(toNumberOrDefault(runtime?.temperature, 0.7), 0, 2);
  const maxOutputTokens = clamp(
    Math.round(toNumberOrDefault(runtime?.maxOutputTokens, 8192)),
    512,
    65536,
  );

  return {
    temperature,
    maxOutputTokens,
  };
}

export function buildGeminiStoryAnalysisPrompt(body: GeminiProxyRequestBody) {
  const chapterContext = body.input.chapters
    .slice(0, 24)
    .map((chapter) =>
      [
        `Chapter ${chapter.chapterNumber}: ${chapter.title || "Không có tiêu đề"}`,
        `Word count: ${chapter.wordCount}`,
        chapter.cleanContent.trim().slice(0, 2400),
      ].join("\n"),
    )
    .join("\n\n---\n\n");
  const chunkContext =
    body.input.chunks
      ?.slice(0, 36)
      .map((chunk) =>
        [
          `Chunk ${chunk.chunkIndex} / Chapter ${chunk.chapterNumber}`,
          `Words: ${chunk.wordCount}`,
          chunk.content.trim().slice(0, 1600),
        ].join("\n"),
      )
      .join("\n\n---\n\n") ?? "";
  const structuredContext = [
    "",
    "INPUT_CONTEXT_JSON:",
    JSON.stringify(
      {
        storyId: body.input.storyId,
        chapterCount: body.input.chapters.length,
        chunkCount: body.input.chunks?.length ?? 0,
      },
      null,
      2,
    ),
    "",
    "CHAPTER_CONTEXT:",
    chapterContext || "(empty)",
    "",
    "CHUNK_CONTEXT:",
    chunkContext || "(empty)",
  ].join("\n");
  const strictJsonInstruction = [
    "",
    "Return ONLY a valid JSON object. Do not return markdown. Do not return prose.",
    "The JSON object must match StoryAnalysisResult exactly with fields:",
    "storyId, characters, events, items, terms, locations, writingStyleProfiles, updatedAt.",
    `storyId must be exactly: ${body.input.storyId}`,
  ].join("\n");

  return `${body.prompt}\n${structuredContext}\n${strictJsonInstruction}`;
}

function extractGoogleResponseText(payload: unknown) {
  if (!isObject(payload)) return "";

  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";

  const firstCandidate = candidates[0];
  if (!isObject(firstCandidate)) return "";

  const content = firstCandidate.content;
  if (!isObject(content)) return "";

  const parts = content.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => {
      if (!isObject(part)) return "";
      return typeof part.text === "string" ? part.text : "";
    })
    .join("\n")
    .trim();
}

function extractOpenAiCompatibleResponseText(payload: unknown) {
  if (!isObject(payload)) return "";

  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";

  const firstChoice = choices[0];
  if (!isObject(firstChoice)) return "";

  const message = firstChoice.message;
  if (!isObject(message)) return "";

  const content = message.content;
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!isObject(part)) return "";
        return typeof part.text === "string" ? part.text : "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function extractAnalysisResultFromText(text: string) {
  const byText = extractAnalysisResult(text);
  if (byText) return byText;

  const parsedJson = extractJsonObjectFromText(text);
  if (!parsedJson) return undefined;

  return extractAnalysisResult(parsedJson);
}

function parseModelNamesFromModelsPayload(payload: unknown): string[] {
  const modelSet = new Set<string>();

  if (!isObject(payload)) return [];

  const candidates: unknown[] = [];
  if (Array.isArray(payload.data)) candidates.push(...payload.data);
  if (Array.isArray(payload.models)) candidates.push(...payload.models);

  candidates.forEach((entry) => {
    if (!isObject(entry)) return;

    const values = [entry.id, entry.name, entry.model];

    values.forEach((value) => {
      if (typeof value !== "string") return;

      const normalizedValue = value.trim();
      if (!normalizedValue) return;

      modelSet.add(normalizedValue);
    });
  });

  return Array.from(modelSet).sort((left, right) => left.localeCompare(right));
}

export function extractGeminiProxyModelNames(payload: unknown): string[] {
  return parseModelNamesFromModelsPayload(payload);
}

function configError(message: string) {
  return new GeminiProxyServerError("config", message);
}

function upstreamError(error: GeminiProxyUpstreamError) {
  return toAttemptError(error);
}

export function isGeminiProxyConfigError(error: unknown) {
  return error instanceof GeminiProxyServerError && error.kind === "config";
}

export async function callGoogleGeminiGenerateContentOnce({
  apiKey,
  body,
}: {
  apiKey: string;
  body: GeminiProxyRequestBody;
}): Promise<StoryAnalysisResult> {
  const model = normalizeGeminiModel(body.model);
  const generationConfig = normalizeGenerationConfig(body.runtime);
  const finalPrompt = buildGeminiStoryAnalysisPrompt(body);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        generationConfig: {
          temperature: generationConfig.temperature,
          maxOutputTokens: generationConfig.maxOutputTokens,
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [{ text: finalPrompt }],
          },
        ],
      }),
    });
  } catch (error) {
    throw upstreamError(createSanitizedUpstreamError(error));
  }

  if (!response.ok) {
    throw upstreamError({
      message: `Gemini request failed with HTTP ${response.status}.`,
      status: response.status,
      retryable: isRetryableStatus(response.status),
      source: "http",
    });
  }

  let payload: unknown;

  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw upstreamError({
      message: "Gemini response JSON parse failed.",
      retryable: true,
      source: "parse",
    });
  }

  let analysisResult = extractAnalysisResult(payload);
  const text = extractGoogleResponseText(payload);

  if (!analysisResult && text) {
    analysisResult = extractAnalysisResultFromText(text);
  }

  if (!analysisResult) {
    throw upstreamError({
      message: "Provider response did not include a valid StoryAnalysisResult.",
      retryable: true,
      source: "validation",
    });
  }

  return analysisResult;
}

export async function callOpenAiCompatibleGenerateContentOnce({
  apiKey,
  baseUrl,
  body,
}: {
  apiKey: string;
  baseUrl: string;
  body: GeminiProxyRequestBody;
}): Promise<StoryAnalysisResult> {
  const endpoint = createOpenAiCompatibleChatEndpoint(baseUrl);
  if (!endpoint) {
    throw configError("GEMINI_PROXY_BASE_URL is not configured on the server.");
  }

  const model = normalizeGeminiModel(body.model);
  const generationConfig = normalizeGenerationConfig(body.runtime);
  const finalPrompt = buildGeminiStoryAnalysisPrompt(body);
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Return only valid JSON matching StoryAnalysisResult.",
          },
          {
            role: "user",
            content: finalPrompt,
          },
        ],
        temperature: generationConfig.temperature,
        max_tokens: generationConfig.maxOutputTokens,
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    throw upstreamError(createSanitizedUpstreamError(error));
  }

  if (!response.ok) {
    throw upstreamError({
      message: `Gemini proxy upstream request failed with HTTP ${response.status}.`,
      status: response.status,
      retryable: isRetryableStatus(response.status),
      source: "http",
    });
  }

  let payload: unknown;

  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw upstreamError({
      message: "Gemini proxy upstream JSON parse failed.",
      retryable: true,
      source: "parse",
    });
  }

  let analysisResult = extractAnalysisResult(payload);
  const text = extractOpenAiCompatibleResponseText(payload);

  if (!analysisResult && text) {
    analysisResult = extractAnalysisResultFromText(text);
  }

  if (!analysisResult) {
    throw upstreamError({
      message: "Provider response did not include a valid StoryAnalysisResult.",
      retryable: true,
      source: "validation",
    });
  }

  return analysisResult;
}

export async function callGeminiGenerateContent({
  body,
}: {
  body: GeminiProxyRequestBody;
}): Promise<StoryAnalysisResult> {
  const config = getGeminiProxyServerConfig();
  if (!config.configured) {
    throw configError(config.message);
  }

  const keyPool = readServerKeyPoolFromEnv(config.adapter);
  const keyAttemptOrder = getGeminiProxyKeyAttemptOrder(
    keyPool.keys,
    body.input.storyId,
  );

  if (keyAttemptOrder.length === 0) {
    throw configError("No server-side Gemini proxy key is configured.");
  }

  const maxAttempts = Math.min(config.retryPolicy.maxAttempts, keyAttemptOrder.length);
  let lastError: GeminiProxyUpstreamError | undefined;

  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
    const apiKey = keyAttemptOrder[attemptIndex];

    try {
      if (config.adapter === "google-generative-language") {
        return await callGoogleGeminiGenerateContentOnce({
          apiKey,
          body,
        });
      }

      if (config.adapter === "openai-compatible") {
        if (!config.baseUrl) {
          throw configError("GEMINI_PROXY_BASE_URL is not configured on the server.");
        }

        return await callOpenAiCompatibleGenerateContentOnce({
          apiKey,
          baseUrl: config.baseUrl,
          body,
        });
      }

      throw configError("Unsupported Gemini proxy adapter.");
    } catch (error) {
      if (isGeminiProxyConfigError(error)) {
        throw error;
      }

      const upstream = createSanitizedUpstreamError(error);
      lastError = upstream;
      const hasMoreAttempts = attemptIndex < maxAttempts - 1;

      if (!upstream.retryable || !hasMoreAttempts) {
        break;
      }
    }
  }

  const lastMessage = lastError?.message ?? "Provider request failed.";

  throw new GeminiProxyServerError(
    "upstream",
    `Gemini proxy failed after ${maxAttempts} attempt(s): ${lastMessage}`,
  );
}

export function validateGeminiProxyRequestBody(
  value: unknown,
): GeminiProxyRequestBody {
  if (!isObject(value)) {
    throw new Error("Request body must be a JSON object.");
  }

  if (value.task !== "story-analysis") {
    throw new Error("Request task must be story-analysis.");
  }

  if (typeof value.model !== "string") {
    throw new Error("Request model must be a string.");
  }

  if (typeof value.prompt !== "string" || !value.prompt.trim()) {
    throw new Error("Request prompt must be a non-empty string.");
  }

  if (!isObject(value.input)) {
    throw new Error("Request input must be an object.");
  }

  if (
    typeof value.input.storyId !== "string" ||
    !value.input.storyId.trim()
  ) {
    throw new Error("Request input.storyId must be a non-empty string.");
  }

  if (!Array.isArray(value.input.chapters)) {
    throw new Error("Request input.chapters must be an array.");
  }

  const promptTemplate = value.promptTemplate;
  if (promptTemplate !== undefined) {
    if (!isObject(promptTemplate)) {
      throw new Error("Request promptTemplate must be an object when provided.");
    }

    if (typeof promptTemplate.id !== "string") {
      throw new Error("Request promptTemplate.id must be a string.");
    }

    if (typeof promptTemplate.title !== "string") {
      throw new Error("Request promptTemplate.title must be a string.");
    }

    if (!isStringArray(promptTemplate.missingVariables)) {
      throw new Error(
        "Request promptTemplate.missingVariables must be a string array.",
      );
    }

    if (!isStringArray(promptTemplate.usedVariables)) {
      throw new Error(
        "Request promptTemplate.usedVariables must be a string array.",
      );
    }
  }
  const promptPackage = value.promptPackage;
  if (promptPackage !== undefined) {
    if (!isObject(promptPackage)) {
      throw new Error("Request promptPackage must be an object when provided.");
    }
    if (typeof promptPackage.promptId !== "string") {
      throw new Error("Request promptPackage.promptId must be a string.");
    }
    if (typeof promptPackage.promptVersion !== "number") {
      throw new Error("Request promptPackage.promptVersion must be a number.");
    }
    if (typeof promptPackage.category !== "string") {
      throw new Error("Request promptPackage.category must be a string.");
    }
    if (promptPackage.scope !== "global" && promptPackage.scope !== "story-specific") {
      throw new Error(
        "Request promptPackage.scope must be global or story-specific.",
      );
    }
    if (typeof promptPackage.outputSchemaId !== "string") {
      throw new Error("Request promptPackage.outputSchemaId must be a string.");
    }
  }

  const runtime = isObject(value.runtime)
    ? {
        temperature:
          typeof value.runtime.temperature === "number"
            ? value.runtime.temperature
            : undefined,
        maxOutputTokens:
          typeof value.runtime.maxOutputTokens === "number"
            ? value.runtime.maxOutputTokens
            : undefined,
      }
    : undefined;
  const validatedPromptTemplate = isObject(promptTemplate)
    ? {
        id: promptTemplate.id as string,
        title: promptTemplate.title as string,
        missingVariables: promptTemplate.missingVariables as string[],
        usedVariables: promptTemplate.usedVariables as string[],
      }
    : undefined;
  const input = value.input as Record<string, unknown>;
  const validatedInput: GeminiProxyRequestBody["input"] = {
    storyId: input.storyId as string,
    chapters: input.chapters as GeminiProxyRequestBody["input"]["chapters"],
    chunks: Array.isArray(input.chunks)
      ? (input.chunks as GeminiProxyRequestBody["input"]["chunks"])
      : undefined,
  };
  const hasChapterContext = validatedInput.chapters.some((chapter) =>
    hasUsableContent(chapter.cleanContent),
  );
  const hasChunkContext =
    validatedInput.chunks?.some((chunk) => hasUsableContent(chunk.content)) ??
    false;

  if (!hasChapterContext && !hasChunkContext) {
    throw new Error(
      "Request input has no usable chapter/chunk content for import-analysis.",
    );
  }

  return {
    provider: typeof value.provider === "string" ? value.provider : undefined,
    task: "story-analysis",
    model: value.model,
    runtime,
    prompt: value.prompt,
    promptTemplate: validatedPromptTemplate,
    promptPackage: isObject(promptPackage)
      ? {
          promptId: promptPackage.promptId as string,
          promptVersion: promptPackage.promptVersion as number,
          category: promptPackage.category as string,
          scope: promptPackage.scope as "global" | "story-specific",
          storyId:
            typeof promptPackage.storyId === "string"
              ? promptPackage.storyId
              : undefined,
          outputSchemaId: promptPackage.outputSchemaId as string,
          estimatedTokens:
            typeof promptPackage.estimatedTokens === "number"
              ? promptPackage.estimatedTokens
              : undefined,
        }
      : undefined,
    input: validatedInput,
  };
}
