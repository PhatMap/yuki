import type {
  ExtractedEntity,
  StoryAnalysisResult,
  StoryEvent,
  WritingStyleProfile,
} from "@/lib/types";
import type { LocalStoryAnalysisTaskOutput } from "@/lib/ai/jobs/local/local-story-analysis-task-handler";

function entityKey(entity: ExtractedEntity) {
  return `${entity.type}:${entity.name.toLocaleLowerCase("vi-VN")}`;
}

function mergeChapterNumbers(left: number[], right: number[]) {
  return Array.from(new Set([...left, ...right])).sort(
    (a, b) => a - b,
  );
}

function mergeEntities(items: ExtractedEntity[]) {
  const merged = new Map<string, ExtractedEntity>();

  for (const item of items) {
    const key = entityKey(item);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...item,
        relatedChapterNumbers: [...item.relatedChapterNumbers],
        aliases: item.aliases ? [...item.aliases] : undefined,
      });
      continue;
    }

    const existingFirstSeen = existing.firstSeenChapter ?? Number.POSITIVE_INFINITY;
    const itemFirstSeen = item.firstSeenChapter ?? Number.POSITIVE_INFINITY;
    const mergedFirstSeen = Math.min(existingFirstSeen, itemFirstSeen);
    const existingLastSeen = existing.lastSeenChapter ?? 0;
    const itemLastSeen = item.lastSeenChapter ?? 0;

    merged.set(key, {
      ...existing,
      description:
        existing.description.length >= item.description.length
          ? existing.description
          : item.description,
      firstSeenChapter:
        mergedFirstSeen === Number.POSITIVE_INFINITY
          ? undefined
          : mergedFirstSeen,
      lastSeenChapter: Math.max(existingLastSeen, itemLastSeen) || undefined,
      relatedChapterNumbers: mergeChapterNumbers(
        existing.relatedChapterNumbers,
        item.relatedChapterNumbers,
      ),
      confidence: Math.max(existing.confidence ?? 0, item.confidence ?? 0),
    });
  }

  return Array.from(merged.values()).map((entity, index) => ({
    ...entity,
    id: `${entity.storyId}-${entity.type}-aggregated-${index + 1}`,
  }));
}

function mergeEvents(events: StoryEvent[]) {
  const byChapterAndTitle = new Map<string, StoryEvent>();

  for (const event of events) {
    const key = `${event.chapterNumber}:${event.title.toLocaleLowerCase("vi-VN")}`;

    if (!byChapterAndTitle.has(key)) {
      byChapterAndTitle.set(key, {
        ...event,
        charactersInvolved: [...event.charactersInvolved],
        locationsInvolved: [...event.locationsInvolved],
        consequences: [...event.consequences],
      });
    }
  }

  return Array.from(byChapterAndTitle.values())
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
    .map((event, index) => ({
      ...event,
      id: `${event.storyId}-aggregated-event-${index + 1}`,
    }));
}

function mergeWritingStyles(
  storyId: string,
  profiles: WritingStyleProfile[],
): WritingStyleProfile[] {
  if (profiles.length === 0) return [];

  const chapterStarts = profiles
    .map((profile) => profile.chapterRangeStart)
    .filter((value): value is number => typeof value === "number");
  const chapterEnds = profiles
    .map((profile) => profile.chapterRangeEnd)
    .filter((value): value is number => typeof value === "number");
  const firstChapter = chapterStarts.length > 0 ? Math.min(...chapterStarts) : undefined;
  const lastChapter = chapterEnds.length > 0 ? Math.max(...chapterEnds) : undefined;
  const firstProfile = profiles[0];

  if (!firstProfile) return [];

  return [
    {
      ...firstProfile,
      id: `${storyId}-style-aggregated`,
      storyId,
      scope: "story",
      chapterRangeStart: Number.isFinite(firstChapter) ? firstChapter : undefined,
      chapterRangeEnd: Number.isFinite(lastChapter) ? lastChapter : undefined,
      narrationStyle:
        "Aggregated local mock profile from batch-level story analysis outputs.",
      commonPatterns: Array.from(
        new Set(profiles.flatMap((profile) => profile.commonPatterns)),
      ).slice(0, 12),
      tabooPatterns: Array.from(
        new Set(profiles.flatMap((profile) => profile.tabooPatterns)),
      ).slice(0, 12),
    },
  ];
}

export function aggregateLocalStoryAnalysisResult({
  storyId,
  outputs,
}: {
  storyId: string;
  outputs: LocalStoryAnalysisTaskOutput[];
}): StoryAnalysisResult {
  const partialResults = outputs.map((output) => output.partialResult);

  return {
    storyId,
    characters: mergeEntities(
      partialResults.flatMap((result) => result.characters),
    ),
    events: mergeEvents(partialResults.flatMap((result) => result.events)),
    items: mergeEntities(partialResults.flatMap((result) => result.items)),
    terms: mergeEntities(partialResults.flatMap((result) => result.terms)),
    locations: mergeEntities(
      partialResults.flatMap((result) => result.locations),
    ),
    writingStyleProfiles: mergeWritingStyles(
      storyId,
      partialResults.flatMap((result) => result.writingStyleProfiles),
    ),
    updatedAt: new Date().toISOString(),
  };
}
