import type { AiJobCacheKey } from "@/lib/ai/jobs/types";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
  [key: string]: JsonValue;
};

export interface AiJobCacheEntry<Value = JsonValue> {
  cacheKey: AiJobCacheKey;
  namespace: string;
  storyId?: string;
  jobId?: string;
  taskId?: string;
  providerId?: string;
  model?: string;
  promptTemplateId?: string;
  promptVersionHash?: string;
  contentHash?: string;
  value: Value;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
  lastHitAt: string;
  hitCount: number;
}
