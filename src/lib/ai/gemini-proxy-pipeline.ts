import type {
  AiPipelineExecutionContext,
  AiPipelineInput,
  AiPipelineProgress,
  AiPipelineProvider,
  AiPipelineResult,
} from "@/lib/ai/types";
import type { StoryAnalysisResult } from "@/lib/types";

const providerId = "gemini-proxy";
const providerLabel = "Gemini proxy";

function createProgress(
  status: AiPipelineProgress["status"],
  message: string,
): AiPipelineProgress[] {
  return [
    {
      status,
      currentStep: status === "completed" ? "complete" : "call-provider",
      message,
      completedSteps:
        status === "completed" ? ["call-provider", "complete"] : [],
      totalSteps: 2,
    },
  ];
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
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

function extractAnalysisResult(
  value: unknown,
): StoryAnalysisResult | undefined {
  if (isStoryAnalysisResult(value)) return value;

  if (!value || typeof value !== "object") return undefined;

  const maybePipelineResult = value as Record<string, unknown>;

  if (isStoryAnalysisResult(maybePipelineResult.analysisResult)) {
    return maybePipelineResult.analysisResult;
  }

  return undefined;
}

function toPromptContext(context: AiPipelineExecutionContext) {
  return {
    templateId: context.renderedPrompt.template.id,
    templateTitle: context.renderedPrompt.template.title,
    systemIdentityTitle: context.renderedPrompt.systemIdentity?.title,
    prompt: context.renderedPrompt.prompt,
    missingVariables: context.renderedPrompt.missingVariables,
    usedVariables: context.renderedPrompt.usedVariables,
  };
}

function createFailureResult({
  startedAt,
  message,
  context,
}: {
  startedAt: string;
  message: string;
  context: AiPipelineExecutionContext;
}): AiPipelineResult {
  return {
    providerId,
    providerLabel,
    status: "failed",
    errorMessage: message,
    steps: createProgress("failed", message),
    startedAt,
    completedAt: new Date().toISOString(),
    runtime: context.runtime,
    promptContext: toPromptContext(context),
  };
}

export const geminiProxyAiPipelineProvider: AiPipelineProvider = {
  id: providerId,
  label: providerLabel,
  description:
    "Provider that sends rendered prompt and IndexedDB story context to the configured Gemini proxy endpoint.",
  isConfigured() {
    return true;
  },
  async run(
    input: AiPipelineInput,
    context: AiPipelineExecutionContext,
  ): Promise<AiPipelineResult> {
    const startedAt = new Date().toISOString();
    const endpoint = context.runtime.endpoint.trim();

    if (!endpoint || endpoint === "not configured") {
      return createFailureResult({
        startedAt,
        context,
        message:
          "Gemini proxy endpoint is not configured. Open /settings and set a valid proxy endpoint.",
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
          model: context.runtime.model,
          runtime: {
            temperature: context.runtime.temperature,
            maxOutputTokens: context.runtime.maxOutputTokens,
          },
          prompt: context.renderedPrompt.prompt,
          promptTemplate: {
            id: context.renderedPrompt.template.id,
            title: context.renderedPrompt.template.title,
            missingVariables: context.renderedPrompt.missingVariables,
            usedVariables: context.renderedPrompt.usedVariables,
          },
          input,
        }),
      });

      if (!response.ok) {
        return createFailureResult({
          startedAt,
          context,
          message: `Gemini proxy request failed with HTTP ${response.status}.`,
        });
      }

      const payload = (await response.json()) as unknown;
      const analysisResult = extractAnalysisResult(payload);

      if (!analysisResult) {
        return createFailureResult({
          startedAt,
          context,
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
        runtime: context.runtime,
        promptContext: toPromptContext(context),
      };
    } catch (error) {
      return createFailureResult({
        startedAt,
        context,
        message:
          error instanceof Error
            ? `Gemini proxy request failed: ${error.message}`
            : "Gemini proxy request failed.",
      });
    }
  },
};
