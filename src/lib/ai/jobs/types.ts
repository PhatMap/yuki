export type AiJobKind =
  | "story-analysis"
  | "rewrite-impact-planner"
  | "rewrite-draft";

export type AiJobStatus =
  | "planned"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AiJobTaskStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type AiJobRuntimeTarget =
  | "local-browser"
  | "local-worker"
  | "serverless"
  | "edge-worker";

export type AiJobCacheKey = string;

export interface AiJobRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
  retryableStatuses?: number[];
}

export interface AiJobProviderTarget {
  providerId: string;
  model: string;
  endpoint?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AiJobProgress {
  totalTasks: number;
  pendingTasks: number;
  queuedTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  percentComplete: number;
  currentTaskId?: string;
  message?: string;
}

export interface AiJobTask<Input = unknown, Output = unknown> {
  id: string;
  jobId: string;
  kind: AiJobKind;
  status: AiJobTaskStatus;
  sequence: number;
  input: Input;
  output?: Output;
  cacheKey?: AiJobCacheKey;
  attempts: number;
  retryPolicy: AiJobRetryPolicy;
  dependsOnTaskIds: string[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AiJob<Metadata = Record<string, unknown>> {
  id: string;
  storyId: string;
  kind: AiJobKind;
  status: AiJobStatus;
  runtimeTarget: AiJobRuntimeTarget;
  providerTarget: AiJobProviderTarget;
  progress: AiJobProgress;
  retryPolicy: AiJobRetryPolicy;
  taskIds: string[];
  cacheNamespace: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  metadata?: Metadata;
}

export const defaultAiJobRetryPolicy: AiJobRetryPolicy = {
  maxAttempts: 2,
  backoffMs: 1000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
};
