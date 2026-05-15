import { readJsonFromLocalStorage } from "@/lib/storage/safe-local-storage";
import type { Story } from "@/lib/types";

export const legacyStoriesStorageKey = "ai-story-app:stories";

export type LegacyStorySource = "indexeddb" | "legacy-local" | "mock";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isLegacyStoryMetadata(value: unknown): value is Story {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export function isLegacyStoryMetadataArray(value: unknown): value is Story[] {
  return Array.isArray(value) && value.every(isLegacyStoryMetadata);
}

export function readLegacyStoryMetadataSnapshot() {
  return readJsonFromLocalStorage<Story[]>(
    legacyStoriesStorageKey,
    [],
    isLegacyStoryMetadataArray,
  );
}

export function sortStoriesByUpdatedAtDesc(storyItems: Story[]) {
  return [...storyItems].sort((firstStory, secondStory) => {
    return (
      new Date(secondStory.updatedAt).getTime() -
      new Date(firstStory.updatedAt).getTime()
    );
  });
}

export function findLegacyStoryMetadata(storyId: string) {
  return readLegacyStoryMetadataSnapshot().find(
    (story) => story.id === storyId,
  );
}

export function getLegacyStorySourceLabel(source: LegacyStorySource) {
  if (source === "indexeddb") return "IndexedDB";
  if (source === "legacy-local") return "Legacy";

  return "Starter";
}
