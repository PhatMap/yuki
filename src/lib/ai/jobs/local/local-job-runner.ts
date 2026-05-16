import { calculateAiJobProgress } from "@/lib/ai/jobs/progress";
import type { AiJob, AiJobProgress, AiJobTask } from "@/lib/ai/jobs/types";
import { LocalJobQueue } from "@/lib/ai/jobs/local/local-job-queue";
import {
  type MockJobTaskResult,
  runMockJobTask,
} from "@/lib/ai/jobs/local/mock-job-task-handler";

export interface LocalJobRunnerOptions<Output = MockJobTaskResult> {
  concurrency?: number;
  signal?: AbortSignal;
  queue?: LocalJobQueue;
  onProgress?: (progress: AiJobProgress, tasks: AiJobTask[]) => void;
  handler?: (
    task: AiJobTask,
    job: AiJob,
    signal?: AbortSignal,
  ) => Promise<Output>;
  isTaskCached?: (task: AiJobTask, job: AiJob) => boolean | Promise<boolean>;
  createCachedResult?: (
    task: AiJobTask,
    job: AiJob,
  ) => Output | Promise<Output>;
}

export interface LocalJobRunnerResult<Output = MockJobTaskResult> {
  job: AiJob;
  tasks: AiJobTask[];
  outputs: Map<string, Output>;
  cancelled: boolean;
}

function normalizeConcurrency(concurrency: number | undefined) {
  if (!Number.isFinite(concurrency)) return 2;

  return Math.max(1, Math.min(8, Math.round(concurrency ?? 2)));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException && error.name === "AbortError"
  );
}

async function defaultCachedResult<Output>(
  task: AiJobTask,
  job: AiJob,
): Promise<Output> {
  return {
    taskId: task.id,
    jobId: job.id,
    kind: task.kind,
    cacheKey: task.cacheKey,
    processedAt: "1970-01-01T00:00:00.000Z",
    summary: `Cached mock result for ${task.kind} task ${task.sequence}.`,
    inputEcho: task.input,
  } as Output;
}

export async function runLocalAiJob<Output = MockJobTaskResult>(
  job: AiJob,
  tasks: AiJobTask[],
  options: LocalJobRunnerOptions<Output> = {},
): Promise<LocalJobRunnerResult<Output>> {
  const queue = options.queue ?? new LocalJobQueue();
  const concurrency = normalizeConcurrency(options.concurrency);
  const handler =
    options.handler ??
    ((task: AiJobTask, currentJob: AiJob, signal?: AbortSignal) =>
      runMockJobTask(task, currentJob, undefined, signal) as Promise<Output>);
  const outputs = new Map<string, Output>();
  let cancelled = false;

  await queue.enqueue(job, tasks);
  await reportProgress(queue, job.id, options.onProgress, "Queued local job.");

  async function runWorker() {
    while (!options.signal?.aborted) {
      const task = await queue.claimNextTask(job.id);

      if (!task) break;

      await reportProgress(
        queue,
        job.id,
        options.onProgress,
        `Running task ${task.id}.`,
      );

      try {
        if (await options.isTaskCached?.(task, job)) {
          const cachedOutput = options.createCachedResult
            ? await options.createCachedResult(task, job)
            : await defaultCachedResult<Output>(task, job);

          outputs.set(task.id, cachedOutput);
          await queue.skipTask(task.id, cachedOutput);
        } else {
          const output = await handler(task, job, options.signal);

          outputs.set(task.id, output);
          await queue.completeTask(task.id, output);
        }

        await reportProgress(queue, job.id, options.onProgress);
      } catch (error) {
        if (isAbortError(error) || options.signal?.aborted) {
          cancelled = true;
          break;
        }

        await queue.failTask(task.id, getErrorMessage(error));
        await reportProgress(queue, job.id, options.onProgress);
      }
    }

    if (options.signal?.aborted) {
      cancelled = true;
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      await runWorker();
    }),
  );

  const snapshot = await queue.getSnapshot(job.id);
  const finalTasks = snapshot.tasks;
  const finalJob: AiJob = snapshot.job
    ? {
        ...snapshot.job,
        status: cancelled ? "cancelled" : snapshot.job.status,
        progress: calculateAiJobProgress(
          finalTasks,
          cancelled ? "Local job cancelled." : "Local job finished.",
        ),
      }
    : {
        ...job,
        status: cancelled ? "cancelled" : job.status,
        progress: calculateAiJobProgress(finalTasks),
      };

  options.onProgress?.(finalJob.progress, finalTasks);

  return {
    job: finalJob,
    tasks: finalTasks,
    outputs,
    cancelled,
  };
}

async function reportProgress(
  queue: LocalJobQueue,
  jobId: string,
  onProgress:
    | ((progress: AiJobProgress, tasks: AiJobTask[]) => void)
    | undefined,
  message?: string,
) {
  if (!onProgress) return;

  const tasks = await queue.listTasksByJob(jobId);

  onProgress(calculateAiJobProgress(tasks, message), tasks);
}
