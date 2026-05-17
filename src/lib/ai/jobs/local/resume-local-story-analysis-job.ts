import { createStableContentHash } from "@/lib/ai/jobs/cache-key";
import {
  type StoryAnalysisSourceItem,
  type StoryAnalysisTaskInput,
  planStoryAnalysisJob,
} from "@/lib/ai/jobs/story-analysis-job-planner";
import { aggregateLocalStoryAnalysisResult } from "@/lib/ai/jobs/local/aggregate-local-story-analysis-result";
import type { AiJob, AiJobProgress, AiJobTask } from "@/lib/ai/jobs/types";
import {
  type LocalStoryAnalysisTaskOutput,
  runLocalStoryAnalysisTask,
} from "@/lib/ai/jobs/local/local-story-analysis-task-handler";
import {
  type LocalJobRunnerResult,
  runLocalAiJob,
} from "@/lib/ai/jobs/local/local-job-runner";
import { IndexedDbJobCacheStore } from "@/lib/ai/jobs/local/indexed-db-job-cache-store";
import { IndexedDbJobStore } from "@/lib/ai/jobs/local/indexed-db-job-store";
import { getPromptTemplateById } from "@/lib/prompts/prompt-runtime";
import {
  getActiveRuntimeEndpoint,
  getActiveRuntimeModel,
  type AiRuntimeSettings,
} from "@/lib/settings/ai-runtime-settings";
import type {
  ChapterChunk,
  ImportedChapter,
  Story,
  StoryAnalysisResult,
} from "@/lib/types";
import { applyTaskStatus } from "@/lib/ai/jobs/local/job-store-helpers";

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

export interface ResumeLocalStoryAnalysisJobInput {
  storyId: string;
  jobId?: string;
  story?: Story;
  chapters: ImportedChapter[];
  chunks: ChapterChunk[];
  runtimeSettings?: AiRuntimeSettings;
  signal?: AbortSignal;
  onProgress?: (progress: AiJobProgress, tasks: AiJobTask[]) => void;
}

export interface ResumeLocalStoryAnalysisJobResult {
  job: AiJob;
  tasks: AiJobTask[];
  progress: AiJobProgress;
  outputs: LocalStoryAnalysisTaskOutput[];
  analysisResult?: StoryAnalysisResult;
  skippedTasks: number;
  completedTasks: number;
  failedTasks: number;
  retriedTasks: number;
  reusedCachedTasks: number;
  hasFailedTasks: boolean;
  hasCompletedAllTasks: boolean;
  canSaveAggregatedResult: boolean;
}

export async function resumeLocalStoryAnalysisJob(
  input: ResumeLocalStoryAnalysisJobInput,
): Promise<ResumeLocalStoryAnalysisJobResult> {
  if (typeof globalThis.indexedDB === "undefined") {
    throw new Error(
      "Resume story analysis jobs require IndexedDB in this runtime.",
    );
  }

  const jobStore = new IndexedDbJobStore();
  const cacheStore = new IndexedDbJobCacheStore<LocalStoryAnalysisTaskOutput>();

  let job: AiJob | undefined;
  let tasksBefore: AiJobTask[] = [];

  if (input.jobId) {
    job = await jobStore.getJob(input.jobId);
    if (!job) {
      throw new Error(
        `Resume job not found: ${input.jobId}. Job may have been cleared.`,
      );
    }
    tasksBefore = await jobStore.listTasksByJob(input.jobId);
  } else {
    const allJobs = await jobStore.listJobsByStory(input.storyId);
    const storyAnalysisJobs = allJobs.filter(
      (j) => j.kind === "story-analysis",
    );
    if (storyAnalysisJobs.length === 0) {
      throw new Error(
        "No story analysis jobs found for this story. Run analysis first.",
      );
    }
    job = storyAnalysisJobs[0];
    tasksBefore = await jobStore.listTasksByJob(job.id);
  }

  if (job.storyId !== input.storyId) {
    throw new Error(
      "Resume job belongs to a different story. Job may have been created for another story.",
    );
  }

  const supportedProviders = ["mock", "gemini-proxy"];
  const providerId = job.providerTarget?.providerId ?? "mock";
  if (!supportedProviders.includes(providerId)) {
    throw new Error(
      `Provider ${providerId} is not supported by resume. Only mock and gemini-proxy are supported.`,
    );
  }

  const outputs = new Map<string, LocalStoryAnalysisTaskOutput>();
  let reusedCachedTasks = 0;
  const tasksToRetry: AiJobTask[] = [];
  const tasksAfter: AiJobTask[] = [];

  for (const task of tasksBefore) {
    if (task.status === "completed" || task.status === "skipped") {
      tasksAfter.push(task);
      if (task.cacheKey) {
        const cachedOutput = await cacheStore.get(task.cacheKey);
        if (cachedOutput) {
          outputs.set(task.id, cachedOutput);
          reusedCachedTasks++;
        }
      }
    } else if (
      task.status === "failed" ||
      task.status === "pending" ||
      task.status === "queued" ||
      task.status === "running"
    ) {
      const retryTask = applyTaskStatus(task, "pending");
      tasksToRetry.push(retryTask);
      tasksAfter.push(retryTask);
    } else {
      tasksAfter.push(task);
    }
  }

  const retriedTasksCount = tasksToRetry.length;

  if (tasksToRetry.length === 0) {
    throw new Error(
      "No failed or incomplete tasks found to resume. All tasks already completed or skipped.",
    );
  }

  await jobStore.saveTasks(tasksAfter);

  const runnerResult = await runLocalAiJob<LocalStoryAnalysisTaskOutput>(
    job,
    tasksToRetry,
    {
      store: jobStore,
      cacheStore,
      concurrency:
        job.providerTarget?.providerId === "gemini-proxy"
          ? input.runtimeSettings?.geminiBatchConcurrency
          : undefined,
      signal: input.signal,
      onProgress: input.onProgress,
      handler: (task, currentJob, signal) =>
        runLocalStoryAnalysisTask(
          task as AiJobTask<StoryAnalysisTaskInput>,
          currentJob,
          {
            storyId: input.storyId,
            story: input.story,
            chapters: input.chapters,
            chunks: input.chunks,
            runtimeSettings: input.runtimeSettings,
          },
          signal,
        ),
    },
  );

  for (const [taskId, output] of runnerResult.outputs) {
    outputs.set(taskId, output);
  }

  const finalTasks = await jobStore.listTasksByJob(job.id);
  const skippedTasks = finalTasks.filter((t) => t.status === "skipped").length;
  const completedTasks = finalTasks.filter(
    (t) => t.status === "completed",
  ).length;
  const failedTasks = finalTasks.filter((t) => t.status === "failed").length;

  const analysisResult =
    outputs.size > 0
      ? aggregateLocalStoryAnalysisResult({
          storyId: input.storyId,
          outputs: Array.from(outputs.values()),
        })
      : undefined;

  const hasFailedTasks = failedTasks > 0;
  const hasCompletedAllTasks =
    !runnerResult.cancelled &&
    failedTasks === 0 &&
    completedTasks + skippedTasks === finalTasks.length;
  const canSaveAggregatedResult =
    Boolean(analysisResult) && hasCompletedAllTasks;

  return {
    job: runnerResult.job,
    tasks: finalTasks,
    progress: runnerResult.job.progress,
    outputs: Array.from(outputs.values()),
    analysisResult,
    skippedTasks,
    completedTasks,
    failedTasks,
    retriedTasks: retriedTasksCount,
    reusedCachedTasks,
    hasFailedTasks,
    hasCompletedAllTasks,
    canSaveAggregatedResult,
  };
}
