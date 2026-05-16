import type { AiJobQueue } from "@/lib/ai/jobs/adapters";
import { calculateAiJobProgress } from "@/lib/ai/jobs/progress";
import type { AiJob, AiJobTask, AiJobTaskStatus } from "@/lib/ai/jobs/types";

export interface LocalJobQueueSnapshot {
  job?: AiJob;
  tasks: AiJobTask[];
}

function nowIso() {
  return new Date().toISOString();
}

function cloneTask(task: AiJobTask): AiJobTask {
  return {
    ...task,
    dependsOnTaskIds: [...task.dependsOnTaskIds],
    metadata: task.metadata ? { ...task.metadata } : undefined,
  };
}

function cloneJob(job: AiJob): AiJob {
  return {
    ...job,
    progress: { ...job.progress },
    taskIds: [...job.taskIds],
    metadata: job.metadata ? { ...job.metadata } : undefined,
  };
}

function isRunnableStatus(status: AiJobTaskStatus) {
  return status === "pending" || status === "queued";
}

export class LocalJobQueue implements AiJobQueue {
  private jobs = new Map<string, AiJob>();
  private tasks = new Map<string, AiJobTask>();
  private taskOrder: string[] = [];

  async enqueue(job: AiJob, tasks: AiJobTask[]): Promise<void> {
    const queuedAt = nowIso();
    const queuedTasks = tasks.map((task) => ({
      ...cloneTask(task),
      status: task.status === "pending" ? "queued" : task.status,
      updatedAt: queuedAt,
    }));
    const queuedJob: AiJob = {
      ...cloneJob(job),
      status: job.status === "planned" ? "queued" : job.status,
      progress: calculateAiJobProgress(queuedTasks, "Queued local job tasks."),
      taskIds: queuedTasks.map((task) => task.id),
      updatedAt: queuedAt,
    };

    this.jobs.set(job.id, queuedJob);

    for (const task of queuedTasks) {
      this.tasks.set(task.id, task);

      if (!this.taskOrder.includes(task.id)) {
        this.taskOrder.push(task.id);
      }
    }
  }

  async claimNextTask(jobId?: string): Promise<AiJobTask | undefined> {
    const task = this.findNextRunnableTask(jobId);

    if (!task) return undefined;

    return this.markTaskRunning(task.id);
  }

  async markTaskRunning(taskId: string): Promise<AiJobTask | undefined> {
    const task = this.tasks.get(taskId);

    if (!task) return undefined;

    const updatedAt = nowIso();
    const runningTask: AiJobTask = {
      ...cloneTask(task),
      status: "running",
      attempts: task.attempts + 1,
      startedAt: task.startedAt ?? updatedAt,
      updatedAt,
      errorMessage: undefined,
    };

    this.tasks.set(taskId, runningTask);
    this.updateJobFromTasks(runningTask.jobId, `Running task ${runningTask.id}.`);

    return cloneTask(runningTask);
  }

  async completeTask(taskId: string, output?: unknown): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) return;

    const completedAt = nowIso();
    const completedTask: AiJobTask = {
      ...cloneTask(task),
      status: "completed",
      output,
      completedAt,
      updatedAt: completedAt,
      errorMessage: undefined,
    };

    this.tasks.set(taskId, completedTask);
    this.updateJobFromTasks(task.jobId, `Completed task ${task.id}.`);
  }

  async skipTask(taskId: string, output?: unknown): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) return;

    const completedAt = nowIso();
    const skippedTask: AiJobTask = {
      ...cloneTask(task),
      status: "skipped",
      output,
      completedAt,
      updatedAt: completedAt,
      errorMessage: undefined,
    };

    this.tasks.set(taskId, skippedTask);
    this.updateJobFromTasks(task.jobId, `Skipped cached task ${task.id}.`);
  }

  async failTask(taskId: string, errorMessage: string): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) return;

    const updatedAt = nowIso();
    const canRetry = task.attempts < task.retryPolicy.maxAttempts;
    const failedTask: AiJobTask = {
      ...cloneTask(task),
      status: canRetry ? "queued" : "failed",
      updatedAt,
      completedAt: canRetry ? undefined : updatedAt,
      errorMessage,
    };

    this.tasks.set(taskId, failedTask);
    this.updateJobFromTasks(
      task.jobId,
      canRetry
        ? `Retry queued for task ${task.id}.`
        : `Task ${task.id} failed after ${task.attempts} attempt(s).`,
    );
  }

  async listTasksByJob(jobId: string): Promise<AiJobTask[]> {
    return this.taskOrder
      .map((taskId) => this.tasks.get(taskId))
      .filter((task): task is AiJobTask => Boolean(task))
      .filter((task) => task.jobId === jobId)
      .map(cloneTask);
  }

  async listTasksByStatus(
    jobId: string,
    status: AiJobTaskStatus,
  ): Promise<AiJobTask[]> {
    const tasks = await this.listTasksByJob(jobId);

    return tasks.filter((task) => task.status === status);
  }

  async getSnapshot(jobId: string): Promise<LocalJobQueueSnapshot> {
    const job = this.jobs.get(jobId);
    const tasks = await this.listTasksByJob(jobId);

    return {
      job: job ? cloneJob(job) : undefined,
      tasks,
    };
  }

  private findNextRunnableTask(jobId?: string) {
    for (const taskId of this.taskOrder) {
      const task = this.tasks.get(taskId);

      if (!task || (jobId && task.jobId !== jobId)) continue;
      if (!isRunnableStatus(task.status)) continue;
      if (!this.areDependenciesComplete(task)) continue;

      return task;
    }

    return undefined;
  }

  private areDependenciesComplete(task: AiJobTask) {
    return task.dependsOnTaskIds.every((dependencyId) => {
      const dependency = this.tasks.get(dependencyId);

      return (
        dependency?.status === "completed" || dependency?.status === "skipped"
      );
    });
  }

  private updateJobFromTasks(jobId: string, message: string) {
    const job = this.jobs.get(jobId);

    if (!job) return;

    const jobTasks = this.taskOrder
      .map((taskId) => this.tasks.get(taskId))
      .filter((task): task is AiJobTask => Boolean(task))
      .filter((task) => task.jobId === jobId);
    const hasRunningTasks = jobTasks.some((task) => task.status === "running");
    const hasQueuedTasks = jobTasks.some(
      (task) => task.status === "queued" || task.status === "pending",
    );
    const hasFailedTasks = jobTasks.some((task) => task.status === "failed");
    const isFinished =
      jobTasks.length > 0 &&
      jobTasks.every(
        (task) =>
          task.status === "completed" ||
          task.status === "failed" ||
          task.status === "skipped",
      );
    const updatedAt = nowIso();

    this.jobs.set(jobId, {
      ...cloneJob(job),
      status: isFinished
        ? hasFailedTasks
          ? "failed"
          : "completed"
        : hasRunningTasks
          ? "running"
          : hasQueuedTasks
            ? "queued"
            : job.status,
      progress: calculateAiJobProgress(jobTasks, message),
      updatedAt,
      startedAt: job.startedAt ?? (hasRunningTasks ? updatedAt : undefined),
      completedAt: isFinished ? updatedAt : undefined,
    });
  }
}
