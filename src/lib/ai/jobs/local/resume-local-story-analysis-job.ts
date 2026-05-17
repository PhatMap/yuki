import {
  type StoryAnalysisTaskInput,
} from "@/lib/ai/jobs/story-analysis-job-planner";
import { aggregateLocalStoryAnalysisResult } from "@/lib/ai/jobs/local/aggregate-local-story-analysis-result";
import type { AiJob, AiJobProgress, AiJobTask } from "@/lib/ai/jobs/types";
import {
  type LocalStoryAnalysisTaskOutput,
  runLocalStoryAnalysisTask,
} from "@/lib/ai/jobs/local/local-story-analysis-task-handler";
import {
  runLocalAiJob,
} from "@/lib/ai/jobs/local/local-job-runner";
import { IndexedDbJobCacheStore } from "@/lib/ai/jobs/local/indexed-db-job-cache-store";
import { IndexedDbJobStore } from "@/lib/ai/jobs/local/indexed-db-job-store";
import {
  type AiRuntimeSettings,
} from "@/lib/settings/ai-runtime-settings";
import type {
  ChapterChunk,
  ImportedChapter,
  Story,
  StoryAnalysisResult,
} from "@/lib/types";
import { applyTaskStatus } from "@/lib/ai/jobs/local/job-store-helpers";
import { calculateAiJobProgress } from "@/lib/ai/jobs/progress";

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

function toTimestamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function toReusableTaskOutput(
  value: unknown,
): LocalStoryAnalysisTaskOutput | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const output = value as Partial<LocalStoryAnalysisTaskOutput>;

  if (
    typeof output.taskId !== "string" ||
    typeof output.jobId !== "string" ||
    typeof output.kind !== "string" ||
    !output.partialResult ||
    typeof output.partialResult !== "object"
  ) {
    return undefined;
  }

  return output as LocalStoryAnalysisTaskOutput;
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
    const storyAnalysisJobs = allJobs
      .filter((j) => j.kind === "story-analysis")
      .sort((left, right) => {
        return toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
      });
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
    const storedTaskOutput = toReusableTaskOutput(task.output);
    const cachedOutput = task.cacheKey
      ? await cacheStore.get(task.cacheKey)
      : undefined;
    const reusableOutput = cachedOutput ?? storedTaskOutput;
    const isCompletedOrSkipped =
      task.status === "completed" || task.status === "skipped";
    const isRetryableStatus =
      task.status === "failed" ||
      task.status === "pending" ||
      task.status === "queued" ||
      task.status === "running";

    if (reusableOutput) {
      outputs.set(task.id, reusableOutput);
      if (cachedOutput) {
        reusedCachedTasks++;
      }
    }

    if (isCompletedOrSkipped && !reusableOutput) {
      const retryTask = applyTaskStatus(task, "pending");
      tasksToRetry.push(retryTask);
      tasksAfter.push(retryTask);
    } else if (isRetryableStatus) {
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

  for (const task of finalTasks) {
    if (outputs.has(task.id)) continue;

    const storedTaskOutput = toReusableTaskOutput(task.output);
    if (storedTaskOutput) {
      outputs.set(task.id, storedTaskOutput);
      continue;
    }

    if (!task.cacheKey) continue;

    const cachedOutput = await cacheStore.get(task.cacheKey);
    if (cachedOutput) {
      outputs.set(task.id, cachedOutput);
      reusedCachedTasks++;
    }
  }

  const skippedTasks = finalTasks.filter((t) => t.status === "skipped").length;
  const completedTasks = finalTasks.filter(
    (t) => t.status === "completed",
  ).length;
  const failedTasks = finalTasks.filter((t) => t.status === "failed").length;
  const incompleteTasks = finalTasks.filter(
    (t) =>
      t.status === "pending" || t.status === "queued" || t.status === "running",
  ).length;
  const terminalTasks = finalTasks.filter(
    (t) => t.status === "completed" || t.status === "skipped",
  );
  const missingOutputTaskCount = terminalTasks.filter(
    (task) => !outputs.has(task.id),
  ).length;

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
    incompleteTasks === 0 &&
    completedTasks + skippedTasks === finalTasks.length;
  const canSaveAggregatedResult =
    Boolean(analysisResult) &&
    hasCompletedAllTasks &&
    missingOutputTaskCount === 0;

  const mergedProgress = calculateAiJobProgress(
    finalTasks,
    runnerResult.cancelled
      ? "Local resume job cancelled."
      : canSaveAggregatedResult
        ? "Local resume job finished."
        : "Local resume job incomplete.",
  );
  const mergedJobStatus: AiJob["status"] = runnerResult.cancelled
    ? "cancelled"
    : failedTasks > 0
      ? "failed"
      : incompleteTasks > 0
        ? "queued"
        : "completed";
  const persistedJob = await jobStore.getJob(job.id);
  const mergedJob: AiJob = {
    ...(persistedJob ?? runnerResult.job),
    status: mergedJobStatus,
    progress: mergedProgress,
    taskIds: finalTasks.map((task) => task.id),
    updatedAt: new Date().toISOString(),
    completedAt:
      mergedJobStatus === "completed" ||
      mergedJobStatus === "failed" ||
      mergedJobStatus === "cancelled"
        ? new Date().toISOString()
        : undefined,
  };

  await jobStore.saveJob(mergedJob);

  return {
    job: mergedJob,
    tasks: finalTasks,
    progress: mergedProgress,
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
