import type { AiJobStore } from "@/lib/ai/jobs/adapters";
import type {
  AiJob,
  AiJobProgress,
  AiJobStatus,
  AiJobTask,
  AiJobTaskStatus,
} from "@/lib/ai/jobs/types";
import { db, type AiStoryDatabase } from "@/lib/db/indexed-db";
import {
  applyJobProgress,
  applyJobStatus,
  applyTaskRetryMetadata,
  applyTaskStatus,
  cloneStoredJob,
  cloneStoredTask,
  mergeJobProgressFromTasks,
} from "@/lib/ai/jobs/local/job-store-helpers";

function assertIndexedDbAvailable() {
  if (typeof globalThis.indexedDB === "undefined") {
    throw new Error("IndexedDB job store is not available in this runtime.");
  }
}

export class IndexedDbJobStore implements AiJobStore {
  constructor(private readonly database: AiStoryDatabase = db) {}

  async getJob(jobId: string): Promise<AiJob | undefined> {
    assertIndexedDbAvailable();

    const job = await this.database.aiJobs.get(jobId);

    return job ? cloneStoredJob(job) : undefined;
  }

  async listJobsByStory(storyId: string): Promise<AiJob[]> {
    assertIndexedDbAvailable();

    const jobs = await this.database.aiJobs
      .where("storyId")
      .equals(storyId)
      .reverse()
      .sortBy("updatedAt");

    return jobs.map(cloneStoredJob);
  }

  async listRecentJobs(limit = 20): Promise<AiJob[]> {
    assertIndexedDbAvailable();

    const jobs = await this.database.aiJobs
      .orderBy("updatedAt")
      .reverse()
      .limit(Math.max(1, Math.round(limit)))
      .toArray();

    return jobs.map(cloneStoredJob);
  }

  async saveJob(job: AiJob): Promise<void> {
    assertIndexedDbAvailable();

    await this.database.aiJobs.put(cloneStoredJob(job));
  }

  async updateJobProgress(
    jobId: string,
    progress: AiJobProgress,
  ): Promise<void> {
    assertIndexedDbAvailable();

    const job = await this.database.aiJobs.get(jobId);

    if (!job) return;

    await this.database.aiJobs.put(applyJobProgress(job, progress));
  }

  async updateJobStatus(jobId: string, status: AiJobStatus): Promise<void> {
    assertIndexedDbAvailable();

    const job = await this.database.aiJobs.get(jobId);

    if (!job) return;

    await this.database.aiJobs.put(applyJobStatus(job, status));
  }

  async saveTasks(tasks: AiJobTask[]): Promise<void> {
    assertIndexedDbAvailable();

    if (tasks.length === 0) return;

    await this.database.aiJobTasks.bulkPut(tasks.map(cloneStoredTask));
  }

  async getTask(taskId: string): Promise<AiJobTask | undefined> {
    assertIndexedDbAvailable();

    const task = await this.database.aiJobTasks.get(taskId);

    return task ? cloneStoredTask(task) : undefined;
  }

  async listTasksByJob(jobId: string): Promise<AiJobTask[]> {
    assertIndexedDbAvailable();

    const tasks = await this.database.aiJobTasks
      .where("jobId")
      .equals(jobId)
      .sortBy("sequence");

    return tasks.map(cloneStoredTask);
  }

  async updateTask(task: AiJobTask): Promise<void> {
    assertIndexedDbAvailable();

    await this.database.aiJobTasks.put(cloneStoredTask(task));
  }

  async updateTaskStatus(
    taskId: string,
    status: AiJobTaskStatus,
    errorMessage?: string,
  ): Promise<void> {
    assertIndexedDbAvailable();

    const task = await this.database.aiJobTasks.get(taskId);

    if (!task) return;

    await this.database.aiJobTasks.put(
      applyTaskStatus(task, status, errorMessage),
    );
  }

  async updateTaskRetryMetadata(
    taskId: string,
    attempts: number,
    errorMessage?: string,
  ): Promise<void> {
    assertIndexedDbAvailable();

    const task = await this.database.aiJobTasks.get(taskId);

    if (!task) return;

    await this.database.aiJobTasks.put(
      applyTaskRetryMetadata(task, attempts, errorMessage),
    );
  }

  async refreshJobProgress(jobId: string, message?: string): Promise<void> {
    assertIndexedDbAvailable();

    const [job, tasks] = await Promise.all([
      this.database.aiJobs.get(jobId),
      this.database.aiJobTasks.where("jobId").equals(jobId).toArray(),
    ]);

    if (!job) return;

    await this.database.aiJobs.put(mergeJobProgressFromTasks(job, tasks, message));
  }

  async clearCompletedJobs(olderThanIso?: string): Promise<void> {
    assertIndexedDbAvailable();

    const completedStatuses: AiJobStatus[] = ["completed", "failed", "cancelled"];
    const jobs = await this.database.aiJobs
      .where("status")
      .anyOf(completedStatuses)
      .toArray();
    const jobsToDelete = olderThanIso
      ? jobs.filter((job) => job.updatedAt < olderThanIso)
      : jobs;
    const jobIds = jobsToDelete.map((job) => job.id);

    if (jobIds.length === 0) return;

    await this.database.transaction(
      "rw",
      this.database.aiJobs,
      this.database.aiJobTasks,
      async () => {
        await this.database.aiJobs.bulkDelete(jobIds);
        await this.database.aiJobTasks.where("jobId").anyOf(jobIds).delete();
      },
    );
  }
}
