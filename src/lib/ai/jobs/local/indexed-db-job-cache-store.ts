import type { AiJobCacheStore } from "@/lib/ai/jobs/adapters";
import type {
  AiJobCacheEntry,
  JsonValue,
} from "@/lib/ai/jobs/cache-store-types";
import type { AiJobCacheKey } from "@/lib/ai/jobs/types";
import { db, type AiStoryDatabase } from "@/lib/db/indexed-db";

type CacheMetadata = Record<string, string | number | boolean | null>;

interface ParsedCacheKeyParts {
  namespace: string;
  storyId?: string;
  promptTemplateId?: string;
  providerId?: string;
  model?: string;
}

function assertIndexedDbAvailable() {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new Error("IndexedDB cache store is only available in the browser.");
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeCachePart(value: string | undefined) {
  if (!value || value === "none") return undefined;

  return value;
}

function parseCacheKey(cacheKey: string): ParsedCacheKeyParts {
  const parts = cacheKey.split(":");

  return {
    namespace: parts[0] ?? "ai-job",
    storyId: normalizeCachePart(parts[1]),
    promptTemplateId: normalizeCachePart(parts[4]),
    providerId: normalizeCachePart(parts[5]),
    model: normalizeCachePart(parts[6]),
  };
}

function normalizeJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneEntry<Value>(entry: AiJobCacheEntry<Value>): AiJobCacheEntry<Value> {
  return {
    ...entry,
    value: normalizeJsonValue(entry.value),
    metadata: entry.metadata ? { ...entry.metadata } : undefined,
  };
}

function toStringOrUndefined(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (value.trim().length === 0) return undefined;

  return value;
}

function toMetadataValue(value: unknown) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  return undefined;
}

function toNumberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mergeEntryMetadata(
  cacheKey: AiJobCacheKey,
  metadata: CacheMetadata | undefined,
  existing?: AiJobCacheEntry,
) {
  const parsed = parseCacheKey(cacheKey);

  return {
    namespace:
      toStringOrUndefined(metadata?.namespace) ??
      existing?.namespace ??
      parsed.namespace,
    storyId:
      toStringOrUndefined(metadata?.storyId) ??
      existing?.storyId ??
      parsed.storyId,
    jobId: toStringOrUndefined(metadata?.jobId) ?? existing?.jobId,
    taskId: toStringOrUndefined(metadata?.taskId) ?? existing?.taskId,
    providerId:
      toStringOrUndefined(metadata?.providerId) ??
      existing?.providerId ??
      parsed.providerId,
    model:
      toStringOrUndefined(metadata?.model) ?? existing?.model ?? parsed.model,
    promptTemplateId:
      toStringOrUndefined(metadata?.promptTemplateId) ??
      existing?.promptTemplateId ??
      parsed.promptTemplateId,
    promptVersionHash:
      toStringOrUndefined(metadata?.promptVersionHash) ??
      existing?.promptVersionHash,
    contentHash:
      toStringOrUndefined(metadata?.contentHash) ?? existing?.contentHash,
  };
}

export class IndexedDbJobCacheStore<Value = JsonValue>
  implements AiJobCacheStore<Value>
{
  constructor(private readonly database: AiStoryDatabase = db) {}

  async get(cacheKey: AiJobCacheKey): Promise<Value | undefined> {
    assertIndexedDbAvailable();

    const entry = await this.database.aiJobCacheEntries.get(cacheKey);

    if (!entry) return undefined;

    const hitAt = nowIso();
    await this.database.aiJobCacheEntries.put({
      ...entry,
      lastHitAt: hitAt,
      updatedAt: hitAt,
      hitCount: entry.hitCount + 1,
    });

    return normalizeJsonValue(entry.value as Value);
  }

  async set(
    cacheKey: AiJobCacheKey,
    value: Value,
    metadata?: CacheMetadata,
  ): Promise<void> {
    assertIndexedDbAvailable();

    const now = nowIso();
    const existing = await this.database.aiJobCacheEntries.get(cacheKey);
    const merged = mergeEntryMetadata(cacheKey, metadata, existing);
    const nextEntry: AiJobCacheEntry<Value> = {
      cacheKey,
      ...merged,
      value: normalizeJsonValue(value),
      metadata: metadata ? { ...metadata } : existing?.metadata,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastHitAt: existing?.lastHitAt ?? now,
      hitCount: existing?.hitCount ?? 0,
    };

    await this.database.aiJobCacheEntries.put(nextEntry as AiJobCacheEntry);
  }

  async has(cacheKey: AiJobCacheKey): Promise<boolean> {
    assertIndexedDbAvailable();

    return Boolean(await this.database.aiJobCacheEntries.get(cacheKey));
  }

  async delete(cacheKey: AiJobCacheKey): Promise<void> {
    assertIndexedDbAvailable();

    await this.database.aiJobCacheEntries.delete(cacheKey);
  }

  async listByStory(storyId: string): Promise<AiJobCacheEntry<Value>[]> {
    assertIndexedDbAvailable();

    const entries = await this.database.aiJobCacheEntries
      .where("storyId")
      .equals(storyId)
      .reverse()
      .sortBy("updatedAt");

    return entries.map((entry) => cloneEntry(entry as AiJobCacheEntry<Value>));
  }

  async clearByStory(storyId: string): Promise<void> {
    assertIndexedDbAvailable();

    await this.database.aiJobCacheEntries.where("storyId").equals(storyId).delete();
  }

  async clearNamespace(namespace: string): Promise<void> {
    assertIndexedDbAvailable();

    await this.database.aiJobCacheEntries
      .where("namespace")
      .equals(namespace)
      .delete();
  }

  async clearOlderThan(isoDate: string): Promise<void> {
    assertIndexedDbAvailable();

    const entries = await this.database.aiJobCacheEntries.toArray();
    const oldKeys = entries
      .filter((entry) => entry.updatedAt < isoDate)
      .map((entry) => entry.cacheKey);

    if (oldKeys.length === 0) return;

    await this.database.aiJobCacheEntries.bulkDelete(oldKeys);
  }

  async getEntry(
    cacheKey: AiJobCacheKey,
  ): Promise<AiJobCacheEntry<Value> | undefined> {
    assertIndexedDbAvailable();

    const entry = await this.database.aiJobCacheEntries.get(cacheKey);

    return entry
      ? cloneEntry(entry as AiJobCacheEntry<Value>)
      : undefined;
  }

  async upsertEntry(entry: AiJobCacheEntry<Value>): Promise<void> {
    assertIndexedDbAvailable();

    const now = nowIso();
    const normalizedMetadata = entry.metadata
      ? (Object.fromEntries(
          Object.entries(entry.metadata).map(([key, value]) => [
            key,
            toMetadataValue(value) ?? null,
          ]),
        ) as CacheMetadata)
      : undefined;
    await this.database.aiJobCacheEntries.put({
      ...entry,
      value: normalizeJsonValue(entry.value),
      metadata: normalizedMetadata,
      createdAt: entry.createdAt || now,
      updatedAt: entry.updatedAt || now,
      lastHitAt: entry.lastHitAt || now,
      hitCount: toNumberOrUndefined(entry.hitCount) ?? 0,
    } as AiJobCacheEntry);
  }
}

export function createCacheMetadataFromTask(
  task: {
    id: string;
    jobId: string;
    cacheKey?: string;
    input?: unknown;
  },
  job: {
    storyId: string;
    cacheNamespace: string;
    providerTarget: { providerId: string; model: string };
    metadata?: Record<string, unknown>;
  },
): CacheMetadata {
  const taskInput = (task.input ?? {}) as Record<string, unknown>;
  const promptTemplateId =
    toStringOrUndefined(taskInput.promptTemplateId) ??
    toStringOrUndefined(job.metadata?.promptTemplateId);
  const promptVersionHash =
    toStringOrUndefined(taskInput.promptVersionHash) ??
    toStringOrUndefined(job.metadata?.promptVersionHash);
  const contentHash = toStringOrUndefined(taskInput.contentHash);

  return {
    namespace: job.cacheNamespace,
    storyId: job.storyId,
    jobId: task.jobId,
    taskId: task.id,
    providerId: job.providerTarget.providerId,
    model: job.providerTarget.model,
    promptTemplateId: promptTemplateId ?? null,
    promptVersionHash: promptVersionHash ?? null,
    contentHash: contentHash ?? null,
  };
}
