import { createStableContentHash } from "@/lib/ai/jobs/cache-key";
import {
  type StoryAnalysisSourceItem,
  planStoryAnalysisJob,
} from "@/lib/ai/jobs/story-analysis-job-planner";
import type {
  AiJob,
  AiJobProgress,
  AiJobRuntimeTarget,
  AiJobTask,
} from "@/lib/ai/jobs/types";
import {
  type LocalJobRunnerResult,
  runLocalAiJob,
} from "@/lib/ai/jobs/local/local-job-runner";
import type { MockJobTaskResult } from "@/lib/ai/jobs/local/mock-job-task-handler";
import { IndexedDbJobCacheStore } from "@/lib/ai/jobs/local/indexed-db-job-cache-store";
import { IndexedDbJobStore } from "@/lib/ai/jobs/local/indexed-db-job-store";
import { getPromptTemplateById } from "@/lib/prompts/prompt-runtime";
import {
  getActiveRuntimeEndpoint,
  getActiveRuntimeModel,
  type AiRuntimeSettings,
} from "@/lib/settings/ai-runtime-settings";
import type { ChapterChunk, ImportedChapter, Story } from "@/lib/types";

interface LocalStoryAnalysisProviderTarget {
  providerId: string;
  model: string;
  endpoint?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface RunLocalStoryAnalysisJobInput {
  storyId: string;
  story?: Story;
  chapters: ImportedChapter[];
  chunks: ChapterChunk[];
  runtimeSettings?: AiRuntimeSettings;
  providerTarget?: LocalStoryAnalysisProviderTarget;
  runtimeTarget?: AiJobRuntimeTarget;
  batchSize?: number;
  onProgress?: (progress: AiJobProgress, tasks: AiJobTask[]) => void;
}

export interface LocalStoryAnalysisJobResult {
  job: AiJob;
  tasks: AiJobTask[];
  progress: AiJobProgress;
  runnerResult: LocalJobRunnerResult;
  skippedTasks: number;
  completedTasks: number;
  failedTasks: number;
}

const DEFAULT_PROMPT_TEMPLATE_ID = "import-analysis";

function createChunkSourceItems(
  storyId: string,
  chunks: ChapterChunk[],
): StoryAnalysisSourceItem[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    storyId,
    chapterId: chunk.chapterId,
    chunkId: chunk.id,
    chapterNumber: chunk.chapterNumber,
    chunkIndex: chunk.chunkIndex,
    title: `Chapter ${chunk.chapterNumber} chunk ${chunk.chunkIndex + 1}`,
    wordCount: chunk.wordCount,
    contentHash: createStableContentHash({
      chapterId: chunk.chapterId,
      chapterNumber: chunk.chapterNumber,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      wordCount: chunk.wordCount,
    }),
  }));
}

function createChapterSourceItems(
  storyId: string,
  chapters: ImportedChapter[],
): StoryAnalysisSourceItem[] {
  return chapters.map((chapter) => ({
    id: chapter.id,
    storyId,
    chapterId: chapter.id,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    wordCount: chapter.wordCount,
    contentHash: createStableContentHash({
      chapterId: chapter.id,
      chapterNumber: chapter.chapterNumber,
      content: chapter.cleanContent || chapter.rawContent,
      wordCount: chapter.wordCount,
    }),
  }));
}

function createPromptVersionHash(
  template: {
    id: string;
    updatedAt: string;
    editablePrompt: string;
    lockedContract: string;
  } | undefined,
) {
  return createStableContentHash({
    templateId: template?.id ?? DEFAULT_PROMPT_TEMPLATE_ID,
    updatedAt: template?.updatedAt ?? "1970-01-01T00:00:00.000Z",
    editablePrompt: template?.editablePrompt ?? "",
    lockedContract: template?.lockedContract ?? "",
  });
}

function toProviderTarget(input: RunLocalStoryAnalysisJobInput) {
  if (input.providerTarget) {
    return input.providerTarget;
  }

  const settings = input.runtimeSettings;

  return {
    providerId: settings?.providerId ?? "mock",
    model: settings ? getActiveRuntimeModel(settings) : "mock-local",
    endpoint: settings ? getActiveRuntimeEndpoint(settings) : "local mock runtime",
    temperature: settings?.temperature,
    maxOutputTokens: settings?.maxOutputTokens,
  };
}

export async function runLocalStoryAnalysisJob(
  input: RunLocalStoryAnalysisJobInput,
): Promise<LocalStoryAnalysisJobResult> {
  if (typeof globalThis.indexedDB === "undefined") {
    throw new Error(
      "Local story analysis jobs require IndexedDB in this runtime.",
    );
  }

  const providerTarget = toProviderTarget(input);
  const promptTemplate = await getPromptTemplateById(DEFAULT_PROMPT_TEMPLATE_ID);
  const promptVersionHash = createPromptVersionHash(promptTemplate);
  const items =
    input.chunks.length > 0
      ? createChunkSourceItems(input.storyId, input.chunks)
      : createChapterSourceItems(input.storyId, input.chapters);
  const batchSize = Math.max(
    1,
    Math.min(50, Math.round(input.batchSize ?? (items.length > 300 ? 25 : 10))),
  );
  const plan = planStoryAnalysisJob({
    storyId: input.storyId,
    items,
    batchSize,
    prompt: {
      templateId: DEFAULT_PROMPT_TEMPLATE_ID,
      versionHash: promptVersionHash,
    },
    providerTarget,
    runtimeTarget: input.runtimeTarget ?? "local-browser",
    plannedAt: new Date().toISOString(),
  });
  const jobStore = new IndexedDbJobStore();
  const cacheStore = new IndexedDbJobCacheStore<MockJobTaskResult>();
  const runnerResult = await runLocalAiJob<MockJobTaskResult>(
    plan.job as unknown as AiJob,
    plan.tasks as unknown as AiJobTask[],
    {
      store: jobStore,
      cacheStore,
      onProgress: input.onProgress,
    },
  );
  const skippedTasks = runnerResult.tasks.filter(
    (task) => task.status === "skipped",
  ).length;
  const completedTasks = runnerResult.tasks.filter(
    (task) => task.status === "completed",
  ).length;
  const failedTasks = runnerResult.tasks.filter(
    (task) => task.status === "failed",
  ).length;

  return {
    job: runnerResult.job,
    tasks: runnerResult.tasks,
    progress: runnerResult.job.progress,
    runnerResult,
    skippedTasks,
    completedTasks,
    failedTasks,
  };
}
