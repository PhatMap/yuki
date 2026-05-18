import type {
  AiPipelineExecutionContext,
  AiPipelineInput,
  AiPipelineProgress,
  AiPipelineProvider,
  AiPipelineResult,
} from "@/lib/ai/types";
import { extractAnalysisResult } from "@/lib/ai/story-analysis-result-validation";

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
          promptPackage: {
            promptId: context.renderedPrompt.package.promptId,
            promptVersion: context.renderedPrompt.package.promptVersion,
            category: context.renderedPrompt.package.category,
            scope: context.renderedPrompt.package.scope,
            storyId: context.renderedPrompt.package.storyId,
            outputSchemaId: context.renderedPrompt.package.outputSchemaId,
            estimatedTokens: context.renderedPrompt.package.estimatedTokens,
          },
          input,
        }),
      });

      if (!response.ok) {
        let errorMessage: string | undefined;

        try {
          const errorPayload = (await response.json()) as unknown;

          if (
            errorPayload &&
            typeof errorPayload === "object" &&
            "errorMessage" in errorPayload &&
            typeof errorPayload.errorMessage === "string"
          ) {
            errorMessage = errorPayload.errorMessage;
          }
        } catch {
          // Keep HTTP status fallback below.
        }

        return createFailureResult({
          startedAt,
          context,
          message:
            errorMessage ??
            `Gemini proxy request failed with HTTP ${response.status}.`,
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
