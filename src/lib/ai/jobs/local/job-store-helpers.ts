import { calculateAiJobProgress } from "@/lib/ai/jobs/progress";
import type {
  AiJob,
  AiJobProgress,
  AiJobStatus,
  AiJobTask,
  AiJobTaskStatus,
} from "@/lib/ai/jobs/types";

export function createJobStoreTimestamp() {
  return new Date().toISOString();
}

export function cloneStoredJob(job: AiJob): AiJob {
  return {
    ...job,
    progress: { ...job.progress },
    providerTarget: { ...job.providerTarget },
    retryPolicy: {
      ...job.retryPolicy,
      retryableStatuses: job.retryPolicy.retryableStatuses
        ? [...job.retryPolicy.retryableStatuses]
        : undefined,
    },
    taskIds: [...job.taskIds],
    metadata: job.metadata ? { ...job.metadata } : undefined,
  };
}

export function cloneStoredTask(task: AiJobTask): AiJobTask {
  return {
    ...task,
    retryPolicy: {
      ...task.retryPolicy,
      retryableStatuses: task.retryPolicy.retryableStatuses
        ? [...task.retryPolicy.retryableStatuses]
        : undefined,
    },
    dependsOnTaskIds: [...task.dependsOnTaskIds],
    metadata: task.metadata ? { ...task.metadata } : undefined,
  };
}

export function applyJobProgress(
  job: AiJob,
  progress: AiJobProgress,
): AiJob {
  return {
    ...cloneStoredJob(job),
    progress: { ...progress },
    updatedAt: createJobStoreTimestamp(),
  };
}

export function applyJobStatus(job: AiJob, status: AiJobStatus): AiJob {
  const updatedAt = createJobStoreTimestamp();

  return {
    ...cloneStoredJob(job),
    status,
    updatedAt,
    startedAt:
      job.startedAt ?? (status === "running" ? updatedAt : undefined),
    completedAt:
      status === "completed" || status === "failed" || status === "cancelled"
        ? updatedAt
        : job.completedAt,
  };
}

export function applyTaskStatus(
  task: AiJobTask,
  status: AiJobTaskStatus,
  errorMessage?: string,
): AiJobTask {
  const updatedAt = createJobStoreTimestamp();

  return {
    ...cloneStoredTask(task),
    status,
    updatedAt,
    startedAt:
      task.startedAt ?? (status === "running" ? updatedAt : undefined),
    completedAt:
      status === "completed" || status === "failed" || status === "skipped"
        ? updatedAt
        : task.completedAt,
    errorMessage,
  };
}

export function applyTaskRetryMetadata(
  task: AiJobTask,
  attempts: number,
  errorMessage?: string,
): AiJobTask {
  return {
    ...cloneStoredTask(task),
    attempts: Math.max(0, Math.round(attempts)),
    errorMessage,
    updatedAt: createJobStoreTimestamp(),
  };
}

export function mergeJobProgressFromTasks(
  job: AiJob,
  tasks: AiJobTask[],
  message?: string,
): AiJob {
  return applyJobProgress(job, calculateAiJobProgress(tasks, message));
}
