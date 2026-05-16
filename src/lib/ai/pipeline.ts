import { geminiProxyAiPipelineProvider } from "@/lib/ai/gemini-proxy-pipeline";
import { mockAiPipelineProvider } from "@/lib/ai/mock-pipeline";
import { ollamaAiPipelineProvider } from "@/lib/ai/ollama-pipeline";
import type {
  AiPipelineExecutionContext,
  AiPipelineInput,
  AiPipelineProgress,
  AiPipelineProvider,
  AiPipelineResult,
  AiPipelineRuntimeContext,
} from "@/lib/ai/types";
import { renderPromptTemplate } from "@/lib/prompts/prompt-runtime";
import {
  getActiveRuntimeEndpoint,
  getActiveRuntimeModel,
  getAiRuntimeProviderLabel,
  getAiRuntimeSettings,
  type AiRuntimeProviderId,
  type AiRuntimeSettings,
} from "@/lib/settings/ai-runtime-settings";

const providers = {
  "gemini-proxy": geminiProxyAiPipelineProvider,
  mock: mockAiPipelineProvider,
  ollama: ollamaAiPipelineProvider,
} satisfies Record<string, AiPipelineProvider>;

export type AiPipelineProviderId = keyof typeof providers;

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

function createFailedResult({
  startedAt,
  runtime,
  context,
  message,
}: {
  startedAt: string;
  runtime: AiPipelineRuntimeContext;
  context: AiPipelineExecutionContext;
  message: string;
}): AiPipelineResult {
  return {
    providerId: runtime.providerId,
    providerLabel: runtime.providerLabel,
    status: "failed",
    errorMessage: message,
    steps: createProgress("failed", message),
    startedAt,
    completedAt: new Date().toISOString(),
    runtime,
    promptContext: toPromptContext(context),
  };
}

function mapRuntimeProviderToPipelineProviderId(
  providerId: AiRuntimeProviderId,
): AiPipelineProviderId | undefined {
  if (providerId === "mock") return "mock";
  if (providerId === "gemini-proxy") return "gemini-proxy";
  if (providerId === "ollama") return "ollama";

  return undefined;
}

function compactChapterForPrompt(chapter: {
  chapterNumber: number;
  title: string;
  cleanContent: string;
  wordCount: number;
}) {
  const contentPreview = chapter.cleanContent.trim().slice(0, 1800);

  return [
    `Chapter ${chapter.chapterNumber}: ${chapter.title}`,
    `Word count: ${chapter.wordCount}`,
    "Content preview:",
    contentPreview,
  ].join("\n");
}

function createChapterRangeLabel(input: AiPipelineInput) {
  if (input.chapters.length === 0) return "No chapters";

  const chapterNumbers = input.chapters.map((chapter) => chapter.chapterNumber);
  const firstChapter = Math.min(...chapterNumbers);
  const lastChapter = Math.max(...chapterNumbers);

  if (firstChapter === lastChapter) return `Chapter ${firstChapter}`;

  return `Chapter ${firstChapter} to ${lastChapter}`;
}

function createImportAnalysisPromptVariables(input: AiPipelineInput) {
  const chaptersForPrompt = input.chapters
    .slice(0, 20)
    .map(compactChapterForPrompt)
    .join("\n\n---\n\n");

  const chunksForPrompt =
    input.chunks
      ?.slice(0, 30)
      .map((chunk) =>
        [
          `Chunk ${chunk.chunkIndex}`,
          `Chapter ${chunk.chapterNumber}`,
          `Words: ${chunk.wordCount}`,
          chunk.content.trim().slice(0, 1200),
        ].join("\n"),
      )
      .join("\n\n---\n\n") ?? "";

  return {
    storyTitle: input.story?.title ?? "Untitled Story",
    storyGenre: input.story?.genre ?? "",
    storyTone: input.story?.tone ?? "",
    authorIntent: input.story?.description ?? "",
    chapterRange: createChapterRangeLabel(input),
    chapterCount: input.chapters.length,
    chunkCount: input.chunks?.length ?? 0,
    chapters: chaptersForPrompt,
    chunks: chunksForPrompt,
  };
}

async function createExecutionContext(
  input: AiPipelineInput,
  settings: AiRuntimeSettings,
): Promise<AiPipelineExecutionContext> {
  const providerLabel = getAiRuntimeProviderLabel(settings.providerId);
  const endpoint = getActiveRuntimeEndpoint(settings);
  const model = getActiveRuntimeModel(settings);

  const renderedPrompt = await renderPromptTemplate({
    templateId: "import-analysis",
    includeSystemIdentity: true,
    variables: createImportAnalysisPromptVariables(input),
  });

  return {
    runtime: {
      settings,
      providerId: settings.providerId,
      providerLabel,
      endpoint,
      model,
      temperature: settings.temperature,
      maxOutputTokens: settings.maxOutputTokens,
    },
    renderedPrompt,
  };
}

export function getAiPipelineProvider(
  providerId: AiPipelineProviderId = "mock",
) {
  return providers[providerId];
}

export function listAiPipelineProviders() {
  return Object.values(providers);
}

export async function runAiPipeline(
  input: AiPipelineInput,
  providerId?: AiPipelineProviderId,
): Promise<AiPipelineResult> {
  const startedAt = new Date().toISOString();
  const storedSettings = await getAiRuntimeSettings();
  const runtimeProviderId = providerId ?? storedSettings.providerId;

  const effectiveSettings: AiRuntimeSettings = {
    ...storedSettings,
    providerId: runtimeProviderId,
  };

  const context = await createExecutionContext(input, effectiveSettings);
  const pipelineProviderId = mapRuntimeProviderToPipelineProviderId(
    effectiveSettings.providerId,
  );

  if (!pipelineProviderId) {
    return createFailedResult({
      startedAt,
      runtime: context.runtime,
      context,
      message: `${context.runtime.providerLabel} is saved in runtime settings but is not wired into the browser analysis pipeline yet. Use Mock Local or Gemini Proxy for analysis.`,
    });
  }

  const provider = getAiPipelineProvider(pipelineProviderId);

  return provider.run(input, context);
}
