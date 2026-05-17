import type { AiJob, AiJobTask } from "@/lib/ai/jobs/types";
import { IndexedDbJobStore } from "@/lib/ai/jobs/local/indexed-db-job-store";

export interface ResumableStoryAnalysisJobSummary {
  jobId: string;
  storyId: string;
  status: AiJob["status"];
  createdAt?: string;
  updatedAt?: string;
  totalTasks: number;
  completedTasks: number;
  skippedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  runningTasks: number;
  retryableTasks: number;
  providerId?: string;
  model?: string;
  endpoint?: string;
  canResume: boolean;
  message: string;
}

export function summarizeStoryAnalysisJob(
  job: AiJob,
  tasks: AiJobTask[],
): ResumableStoryAnalysisJobSummary {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const skippedTasks = tasks.filter((t) => t.status === "skipped").length;
  const failedTasks = tasks.filter((t) => t.status === "failed").length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;
  const runningTasks = tasks.filter((t) => t.status === "running").length;
  const queuedTasks = tasks.filter((t) => t.status === "queued").length;
  const retryableTasks =
    failedTasks + pendingTasks + runningTasks + queuedTasks;
  const hasRetryableTasks = retryableTasks > 0;
  const canResume = hasRetryableTasks;

  let message = "";
  if (canResume) {
    message = `${retryableTasks} tasks can be retried (${failedTasks} failed, ${pendingTasks} pending, ${runningTasks} running, ${queuedTasks} queued).`;
  } else {
    message = "Job is complete or cancelled.";
  }

  return {
    jobId: job.id,
    storyId: job.storyId,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    totalTasks,
    completedTasks,
    skippedTasks,
    failedTasks,
    pendingTasks,
    runningTasks,
    retryableTasks,
    providerId: job.providerTarget?.providerId,
    model: job.providerTarget?.model,
    endpoint: job.providerTarget?.endpoint,
    canResume,
    message,
  };
}

export async function listResumableStoryAnalysisJobs(
  storyId: string,
): Promise<ResumableStoryAnalysisJobSummary[]> {
  const store = new IndexedDbJobStore();
  const jobs = await store.listJobsByStory(storyId);

  const summaries: ResumableStoryAnalysisJobSummary[] = [];

  for (const job of jobs) {
    if (job.kind !== "story-analysis") continue;

    const tasks = await store.listTasksByJob(job.id);
    const summary = summarizeStoryAnalysisJob(job, tasks);

    if (summary.canResume) {
      summaries.push(summary);
    }
  }

  return summaries.sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? "");
    const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? "");
    const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
    const safeRight = Number.isFinite(rightTime) ? rightTime : 0;

    return safeRight - safeLeft;
  });
}

export async function getLatestResumableStoryAnalysisJob(
  storyId: string,
): Promise<ResumableStoryAnalysisJobSummary | undefined> {
  const resumable = await listResumableStoryAnalysisJobs(storyId);
  return resumable.length > 0 ? resumable[0] : undefined;
}
