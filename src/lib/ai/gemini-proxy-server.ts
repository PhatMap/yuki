import {
  extractAnalysisResult,
  extractJsonObjectFromText,
} from "@/lib/ai/story-analysis-result-validation";
import type {
  GeminiProxyRequestBody,
  GeminiProxyRuntimeOptions,
} from "@/lib/ai/gemini-proxy-request-types";
import type { StoryAnalysisResult } from "@/lib/types";

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

export function normalizeGeminiModel(model: string): string {
  const normalized = model.trim();

  return normalized || "gemini-2.5-flash";
}

export function normalizeGenerationConfig(runtime?: GeminiProxyRuntimeOptions) {
  const temperature = clamp(
    toNumberOrDefault(runtime?.temperature, 0.7),
    0,
    2,
  );
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

function extractGeminiText(payload: unknown) {
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

export async function callGeminiGenerateContent({
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
    throw new Error(
      error instanceof Error
        ? `Gemini request failed: ${error.message}`
        : "Gemini request failed.",
    );
  }

  if (!response.ok) {
    throw new Error(`Gemini request failed with HTTP ${response.status}.`);
  }

  let payload: unknown;

  try {
    payload = (await response.json()) as unknown;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Gemini response JSON parse failed: ${error.message}`
        : "Gemini response JSON parse failed.",
    );
  }

  let analysisResult = extractAnalysisResult(payload);
  const text = extractGeminiText(payload);

  if (!analysisResult && text) {
    analysisResult = extractAnalysisResult(text);
  }

  if (!analysisResult && text) {
    const parsedJson = extractJsonObjectFromText(text);
    analysisResult = parsedJson ? extractAnalysisResult(parsedJson) : undefined;
  }

  if (!analysisResult) {
    throw new Error(
      "Gemini response did not include a valid StoryAnalysisResult.",
    );
  }

  return analysisResult;
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
