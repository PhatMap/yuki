import type { AiJobCacheKey } from "./types";

export interface AiJobCacheKeyInput {
  storyId: string;
  chapterId?: string;
  chunkId?: string;
  contentHash: string;
  promptTemplateId: string;
  promptVersionHash: string;
  provider: string;
  model: string;
  namespace?: string;
}

function normalizeCachePart(value: string | undefined) {
  return (value ?? "none").trim().toLowerCase();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;

  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

// Non-cryptographic FNV-1a hash. It is intended for stable cache keys, not
// security boundaries or content authenticity checks.
export function createNonCryptographicHash(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createStableContentHash(value: unknown) {
  return createNonCryptographicHash(stableStringify(value));
}

export function createAiJobCacheKey(input: AiJobCacheKeyInput): AiJobCacheKey {
  const namespace = normalizeCachePart(input.namespace ?? "ai-job");
  const parts = {
    storyId: normalizeCachePart(input.storyId),
    chapterId: normalizeCachePart(input.chapterId),
    chunkId: normalizeCachePart(input.chunkId),
    contentHash: normalizeCachePart(input.contentHash),
    promptTemplateId: normalizeCachePart(input.promptTemplateId),
    promptVersionHash: normalizeCachePart(input.promptVersionHash),
    provider: normalizeCachePart(input.provider),
    model: normalizeCachePart(input.model),
  };
  const digest = createStableContentHash(parts);

  return [
    namespace,
    parts.storyId,
    parts.chapterId,
    parts.chunkId,
    parts.promptTemplateId,
    parts.provider,
    parts.model,
    digest,
  ].join(":");
}
