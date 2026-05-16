import type { AiJob, AiJobCacheKey, AiJobProgress, AiJobTask } from "./types";

export interface AiJobStore {
  getJob(jobId: string): Promise<AiJob | undefined>;
  listJobsByStory(storyId: string): Promise<AiJob[]>;
  saveJob(job: AiJob): Promise<void>;
  updateJobProgress(jobId: string, progress: AiJobProgress): Promise<void>;
  saveTasks(tasks: AiJobTask[]): Promise<void>;
  getTask(taskId: string): Promise<AiJobTask | undefined>;
  listTasksByJob(jobId: string): Promise<AiJobTask[]>;
  updateTask(task: AiJobTask): Promise<void>;
}

export interface AiJobQueue {
  enqueue(job: AiJob, tasks: AiJobTask[]): Promise<void>;
  claimNextTask(jobId?: string): Promise<AiJobTask | undefined>;
  completeTask(taskId: string): Promise<void>;
  failTask(taskId: string, errorMessage: string): Promise<void>;
}

export interface AiJobCacheStore<Value = unknown> {
  get(cacheKey: AiJobCacheKey): Promise<Value | undefined>;
  set(
    cacheKey: AiJobCacheKey,
    value: Value,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void>;
  has(cacheKey: AiJobCacheKey): Promise<boolean>;
  delete(cacheKey: AiJobCacheKey): Promise<void>;
}

export interface AiJobRunner<Input = unknown, Output = unknown> {
  canRun(task: AiJobTask<Input, Output>, job: AiJob): boolean;
  runTask(task: AiJobTask<Input, Output>, job: AiJob): Promise<Output>;
}

/*
 * Intended adapter implementations:
 * - AiJobStore: IndexedDB for local jobs, Supabase tables for shared jobs.
 * - AiJobQueue: in-memory local queue first, Cloudflare Queues later.
 * - AiJobCacheStore: IndexedDB locally, Redis/Upstash for cache or locks later.
 * - AiJobRunner: browser/local worker now, Worker or Edge Function runner later.
 *
 * These interfaces intentionally do not import SDKs or require cloud services.
 */
