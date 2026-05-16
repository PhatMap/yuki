import {
  extractAnalysisResult,
  extractJsonObjectFromText,
} from "@/lib/ai/story-analysis-result-validation";
import type {
  GeminiProxyAdapter,
  GeminiProxyKeyPool,
  GeminiProxyServerConfig,
} from "@/lib/ai/gemini-proxy-adapter-types";
import type {
  GeminiProxyRequestBody,
  GeminiProxyRuntimeOptions,
} from "@/lib/ai/gemini-proxy-request-types";
import type { StoryAnalysisResult } from "@/lib/types";

type GeminiProxyServerErrorKind = "config" | "upstream";

export class GeminiProxyServerError extends Error {
  kind: GeminiProxyServerErrorKind;

  constructor(kind: GeminiProxyServerErrorKind, message: string) {
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

export function getGeminiProxyServerConfig(): GeminiProxyServerConfig {
  const adapter = getGeminiProxyAdapterFromEnv();
  const keyPool = readServerKeyPoolFromEnv(adapter);

  if (adapter === "google-generative-language") {
    return {
      adapter,
      configured: keyPool.keyCount > 0,
      keyCount: keyPool.keyCount,
      modelSource: "static",
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
  const strictJsonInstruction = [
    "",
    "Return ONLY a valid JSON object. Do not return markdown. Do not return prose.",
    "The JSON object must match StoryAnalysisResult exactly with fields:",
    "storyId, characters, events, items, terms, locations, writingStyleProfiles, updatedAt.",
    `storyId must be exactly: ${body.input.storyId}`,
  ].join("\n");

  return `${body.prompt}\n${strictJsonInstruction}`;
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

    const modelId = entry.id;
    const modelName = entry.name;
    const modelModel = entry.model;
    const values = [modelId, modelName, modelModel];

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

function toServerError(
  kind: GeminiProxyServerErrorKind,
  message: string,
): GeminiProxyServerError {
  return new GeminiProxyServerError(kind, message);
}

function isServerError(error: unknown): error is GeminiProxyServerError {
  return error instanceof GeminiProxyServerError;
}

async function runGoogleGenerativeLanguageCall({
  model,
  finalPrompt,
  generationConfig,
  apiKey,
}: {
  model: string;
  finalPrompt: string;
  generationConfig: ReturnType<typeof normalizeGenerationConfig>;
  apiKey: string;
}) {
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
    throw toServerError(
      "upstream",
      error instanceof Error
        ? `Gemini request failed: ${error.message}`
        : "Gemini request failed.",
    );
  }

  if (!response.ok) {
    throw toServerError(
      "upstream",
      `Gemini request failed with HTTP ${response.status}.`,
    );
  }

  let payload: unknown;

  try {
    payload = (await response.json()) as unknown;
  } catch (error) {
    throw toServerError(
      "upstream",
      error instanceof Error
        ? `Gemini response JSON parse failed: ${error.message}`
        : "Gemini response JSON parse failed.",
    );
  }

  let analysisResult = extractAnalysisResult(payload);
  const text = extractGoogleResponseText(payload);

  if (!analysisResult && text) {
    analysisResult = extractAnalysisResultFromText(text);
  }

  if (!analysisResult) {
    throw toServerError(
      "upstream",
      "Gemini response did not include a valid StoryAnalysisResult.",
    );
  }

  return analysisResult;
}

async function runOpenAiCompatibleCall({
  model,
  finalPrompt,
  generationConfig,
  apiKey,
  baseUrl,
}: {
  model: string;
  finalPrompt: string;
  generationConfig: ReturnType<typeof normalizeGenerationConfig>;
  apiKey: string;
  baseUrl: string;
}) {
  const endpoint = createOpenAiCompatibleChatEndpoint(baseUrl);
  if (!endpoint) {
    throw toServerError(
      "config",
      "GEMINI_PROXY_BASE_URL is not configured on the server.",
    );
  }

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
    throw toServerError(
      "upstream",
      error instanceof Error
        ? `Gemini proxy upstream request failed: ${error.message}`
        : "Gemini proxy upstream request failed.",
    );
  }

  if (!response.ok) {
    throw toServerError(
      "upstream",
      `Gemini proxy upstream request failed with HTTP ${response.status}.`,
    );
  }

  let payload: unknown;

  try {
    payload = (await response.json()) as unknown;
  } catch (error) {
    throw toServerError(
      "upstream",
      error instanceof Error
        ? `Gemini proxy upstream JSON parse failed: ${error.message}`
        : "Gemini proxy upstream JSON parse failed.",
    );
  }

  let analysisResult = extractAnalysisResult(payload);
  const text = extractOpenAiCompatibleResponseText(payload);

  if (!analysisResult && text) {
    analysisResult = extractAnalysisResultFromText(text);
  }

  if (!analysisResult) {
    throw toServerError(
      "upstream",
      "Gemini response did not include a valid StoryAnalysisResult.",
    );
  }

  return analysisResult;
}

export function isGeminiProxyConfigError(error: unknown) {
  return isServerError(error) && error.kind === "config";
}

export async function callGeminiGenerateContent({
  body,
}: {
  body: GeminiProxyRequestBody;
}): Promise<StoryAnalysisResult> {
  const config = getGeminiProxyServerConfig();
  const keyPool = readServerKeyPoolFromEnv(config.adapter);
  const selectedKey = selectGeminiProxyKey(keyPool.keys, body.input.storyId);

  if (!config.configured || !selectedKey) {
    throw toServerError("config", config.message);
  }

  const model = normalizeGeminiModel(body.model);
  const generationConfig = normalizeGenerationConfig(body.runtime);
  const finalPrompt = buildGeminiStoryAnalysisPrompt(body);

  if (config.adapter === "google-generative-language") {
    return runGoogleGenerativeLanguageCall({
      model,
      finalPrompt,
      generationConfig,
      apiKey: selectedKey,
    });
  }

  if (config.adapter === "openai-compatible") {
    const baseUrl = config.baseUrl;
    if (!baseUrl) {
      throw toServerError(
        "config",
        "GEMINI_PROXY_BASE_URL is not configured on the server.",
      );
    }

    return runOpenAiCompatibleCall({
      model,
      finalPrompt,
      generationConfig,
      apiKey: selectedKey,
      baseUrl,
    });
  }

  throw toServerError("config", "Unsupported Gemini proxy adapter.");
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

  return {
    provider: typeof value.provider === "string" ? value.provider : undefined,
    task: "story-analysis",
    model: value.model,
    runtime,
    prompt: value.prompt,
    promptTemplate: validatedPromptTemplate,
    input: validatedInput,
  };
}
