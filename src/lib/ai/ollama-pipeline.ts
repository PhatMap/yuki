import {
  extractAnalysisResult,
  extractJsonObjectFromText,
} from "@/lib/ai/story-analysis-result-validation";
import type {
  AiPipelineExecutionContext,
  AiPipelineInput,
  AiPipelineProgress,
  AiPipelineProvider,
  AiPipelineResult,
} from "@/lib/ai/types";

const providerId = "ollama";
const providerLabel = "Ollama local";

function createFailedProgress(message: string): AiPipelineProgress[] {
  return [
    {
      status: "failed",
      currentStep: "call-provider",
      message,
      completedSteps: [],
      totalSteps: 3,
    },
  ];
}

function createCompletedProgress(message: string): AiPipelineProgress[] {
  return [
    {
      status: "running",
      currentStep: "call-provider",
      message: "Calling local Ollama provider.",
      completedSteps: ["call-provider"],
      totalSteps: 3,
    },
    {
      status: "running",
      currentStep: "validate-output",
      message: "Validating StoryAnalysisResult payload.",
      completedSteps: ["call-provider", "validate-output"],
      totalSteps: 3,
    },
    {
      status: "completed",
      currentStep: "complete",
      message,
      completedSteps: ["call-provider", "validate-output", "complete"],
      totalSteps: 3,
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

function normalizeEndpoint(value: string) {
  return value.trim().replace(/\/+$/g, "");
}

function createFailureResult({
  startedAt,
  context,
  message,
}: {
  startedAt: string;
  context: AiPipelineExecutionContext;
  message: string;
}): AiPipelineResult {
  return {
    providerId,
    providerLabel,
    status: "failed",
    errorMessage: message,
    steps: createFailedProgress(message),
    startedAt,
    completedAt: new Date().toISOString(),
    runtime: context.runtime,
    promptContext: toPromptContext(context),
  };
}

function buildOllamaPrompt(input: AiPipelineInput, renderedPrompt: string) {
  const constraints = [
    "",
    "Return ONLY a valid JSON object. Do not return markdown. Do not return prose.",
    "The JSON object must match StoryAnalysisResult exactly with fields:",
    "storyId, characters, events, items, terms, locations, writingStyleProfiles, updatedAt.",
    `storyId must be exactly: ${input.storyId}`,
  ].join("\n");

  return `${renderedPrompt}\n${constraints}`;
}

export const ollamaAiPipelineProvider: AiPipelineProvider = {
  id: providerId,
  label: providerLabel,
  description:
    "Provider that sends rendered prompt and story context to local Ollama /api/generate.",
  isConfigured() {
    return true;
  },
  async run(
    input: AiPipelineInput,
    context: AiPipelineExecutionContext,
  ): Promise<AiPipelineResult> {
    const startedAt = new Date().toISOString();
    const endpoint = normalizeEndpoint(context.runtime.endpoint);
    const model = context.runtime.model.trim();

    if (!endpoint || endpoint === "not configured") {
      return createFailureResult({
        startedAt,
        context,
        message:
          "Ollama endpoint is not configured. Open /settings and set a valid Ollama URL.",
      });
    }

    if (!model || model === "custom-model-not-set") {
      return createFailureResult({
        startedAt,
        context,
        message:
          "Ollama model is not configured. Open /settings and set a valid Ollama model.",
      });
    }

    try {
      const response = await fetch(`${endpoint}/api/generate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: buildOllamaPrompt(input, context.renderedPrompt.prompt),
          stream: false,
          format: "json",
          options: {
            temperature: context.runtime.temperature,
            num_predict: context.runtime.maxOutputTokens,
          },
        }),
      });

      if (!response.ok) {
        return createFailureResult({
          startedAt,
          context,
          message: `Ollama request failed with HTTP ${response.status}.`,
        });
      }

      const payload = (await response.json()) as unknown;
      let analysisResult = extractAnalysisResult(payload);

      if (!analysisResult && payload && typeof payload === "object") {
        const responseText = (payload as Record<string, unknown>).response;

        if (typeof responseText === "string") {
          analysisResult = extractAnalysisResult(responseText);

          if (!analysisResult) {
            const parsedObject = extractJsonObjectFromText(responseText);
            analysisResult = parsedObject
              ? extractAnalysisResult(parsedObject)
              : undefined;
          }
        }
      }

      if (!analysisResult) {
        return createFailureResult({
          startedAt,
          context,
          message:
            "Ollama response did not include a valid StoryAnalysisResult.",
        });
      }

      return {
        providerId,
        providerLabel,
        status: "completed",
        analysisResult,
        steps: createCompletedProgress("Ollama analysis completed."),
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
            ? `Ollama request failed: ${error.message}`
            : "Ollama request failed.",
      });
    }
  },
};
