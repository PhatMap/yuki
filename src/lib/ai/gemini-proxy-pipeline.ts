import type {
  AiPipelineInput,
  AiPipelineProgress,
  AiPipelineProvider,
  AiPipelineResult,
} from "@/lib/ai/types";
import type { StoryAnalysisResult } from "@/lib/types";

const providerId = "gemini-proxy";
const providerLabel = "Gemini proxy";

function getProxyEndpoint() {
  return process.env.NEXT_PUBLIC_AI_PROXY_ENDPOINT?.trim();
}

function createProgress(
  status: AiPipelineProgress["status"],
  message: string,
): AiPipelineProgress[] {
  return [
    {
      status,
      currentStep: status === "completed" ? "complete" : "prepare-input",
      message,
      completedSteps: status === "completed" ? ["complete"] : [],
      totalSteps: 1,
    },
  ];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isEntityArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;

      const entity = item as Record<string, unknown>;

      return (
        typeof entity.id === "string" &&
        typeof entity.storyId === "string" &&
        typeof entity.type === "string" &&
        typeof entity.name === "string" &&
        typeof entity.description === "string" &&
        Array.isArray(entity.relatedChapterNumbers)
      );
    })
  );
}

function isEventArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;

      const event = item as Record<string, unknown>;

      return (
        typeof event.id === "string" &&
        typeof event.storyId === "string" &&
        typeof event.chapterNumber === "number" &&
        typeof event.title === "string" &&
        typeof event.description === "string" &&
        isStringArray(event.charactersInvolved) &&
        isStringArray(event.locationsInvolved) &&
        isStringArray(event.consequences) &&
        typeof event.importance === "string"
      );
    })
  );
}

function isWritingStyleProfileArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;

      const profile = item as Record<string, unknown>;

      return (
        typeof profile.id === "string" &&
        typeof profile.storyId === "string" &&
        typeof profile.scope === "string" &&
        typeof profile.narrationStyle === "string" &&
        typeof profile.sentenceStyle === "string" &&
        typeof profile.dialogueStyle === "string" &&
        typeof profile.pacing === "string" &&
        typeof profile.tone === "string" &&
        isStringArray(profile.commonPatterns) &&
        isStringArray(profile.tabooPatterns)
      );
    })
  );
}

function isStoryAnalysisResult(value: unknown): value is StoryAnalysisResult {
  if (!value || typeof value !== "object") return false;

  const result = value as Record<string, unknown>;

  return (
    typeof result.storyId === "string" &&
    isEntityArray(result.characters) &&
    isEventArray(result.events) &&
    isEntityArray(result.items) &&
    isEntityArray(result.terms) &&
    isEntityArray(result.locations) &&
    isWritingStyleProfileArray(result.writingStyleProfiles) &&
    typeof result.updatedAt === "string"
  );
}

function extractAnalysisResult(value: unknown): StoryAnalysisResult | undefined {
  if (isStoryAnalysisResult(value)) return value;

  if (!value || typeof value !== "object") return undefined;

  const maybePipelineResult = value as Record<string, unknown>;

  if (isStoryAnalysisResult(maybePipelineResult.analysisResult)) {
    return maybePipelineResult.analysisResult;
  }

  return undefined;
}

function createFailureResult({
  startedAt,
  message,
}: {
  startedAt: string;
  message: string;
}): AiPipelineResult {
  return {
    providerId,
    providerLabel,
    status: "failed",
    errorMessage: message,
    steps: createProgress("failed", message),
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

export const geminiProxyAiPipelineProvider: AiPipelineProvider = {
  id: providerId,
  label: providerLabel,
  description:
    "Draft provider that calls a configured proxy endpoint instead of calling Gemini directly from the browser.",
  isConfigured() {
    return Boolean(getProxyEndpoint());
  },
  async run(input: AiPipelineInput): Promise<AiPipelineResult> {
    const startedAt = new Date().toISOString();
    const endpoint = getProxyEndpoint();

    if (!endpoint) {
      return createFailureResult({
        startedAt,
        message:
          "Gemini proxy is disabled because NEXT_PUBLIC_AI_PROXY_ENDPOINT is not configured.",
      });
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          provider: providerId,
          task: "story-analysis",
          input,
        }),
      });

      if (!response.ok) {
        return createFailureResult({
          startedAt,
          message: `Gemini proxy request failed with HTTP ${response.status}.`,
        });
      }

      const payload = (await response.json()) as unknown;
      const analysisResult = extractAnalysisResult(payload);

      if (!analysisResult) {
        return createFailureResult({
          startedAt,
          message:
            "Gemini proxy response did not include a valid StoryAnalysisResult.",
        });
      }

      return {
        providerId,
        providerLabel,
        status: "completed",
        analysisResult,
        steps: createProgress("completed", "Gemini proxy analysis completed."),
        startedAt,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      return createFailureResult({
        startedAt,
        message:
          error instanceof Error
            ? `Gemini proxy request failed: ${error.message}`
            : "Gemini proxy request failed.",
      });
    }
  },
};
