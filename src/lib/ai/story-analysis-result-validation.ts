import type { StoryAnalysisResult } from "@/lib/types";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isEntityArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;

      const entity = item as Record<string, unknown>;

      return (
        typeof entity.id === "string" &&
        typeof entity.storyId === "string" &&
        typeof entity.type === "string" &&
        typeof entity.name === "string" &&
        typeof entity.description === "string" &&
        Array.isArray(entity.relatedChapterNumbers)
      );
    })
  );
}

function isEventArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;

      const event = item as Record<string, unknown>;

      return (
        typeof event.id === "string" &&
        typeof event.storyId === "string" &&
        typeof event.chapterNumber === "number" &&
        typeof event.title === "string" &&
        typeof event.description === "string" &&
        isStringArray(event.charactersInvolved) &&
        isStringArray(event.locationsInvolved) &&
        isStringArray(event.consequences) &&
        typeof event.importance === "string"
      );
    })
  );
}

function isWritingStyleProfileArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;

      const profile = item as Record<string, unknown>;

      return (
        typeof profile.id === "string" &&
        typeof profile.storyId === "string" &&
        typeof profile.scope === "string" &&
        typeof profile.narrationStyle === "string" &&
        typeof profile.sentenceStyle === "string" &&
        typeof profile.dialogueStyle === "string" &&
        typeof profile.pacing === "string" &&
        typeof profile.tone === "string" &&
        isStringArray(profile.commonPatterns) &&
        isStringArray(profile.tabooPatterns)
      );
    })
  );
}

export function isStoryAnalysisResult(
  value: unknown,
): value is StoryAnalysisResult {
  if (!value || typeof value !== "object") return false;

  const result = value as Record<string, unknown>;

  return (
    typeof result.storyId === "string" &&
    isEntityArray(result.characters) &&
    isEventArray(result.events) &&
    isEntityArray(result.items) &&
    isEntityArray(result.terms) &&
    isEntityArray(result.locations) &&
    isWritingStyleProfileArray(result.writingStyleProfiles) &&
    typeof result.updatedAt === "string"
  );
}

export function extractJsonObjectFromText(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    // Continue to fenced/sub-string extraction.
  }

  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // Continue to brace extraction.
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return undefined;
  }

  const candidate = text.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

export function extractAnalysisResult(
  value: unknown,
): StoryAnalysisResult | undefined {
  if (isStoryAnalysisResult(value)) return value;

  if (typeof value === "string") {
    const parsed = extractJsonObjectFromText(value);

    return parsed ? extractAnalysisResult(parsed) : undefined;
  }

  if (!value || typeof value !== "object") return undefined;

  const maybePipelineResult = value as Record<string, unknown>;

  if (isStoryAnalysisResult(maybePipelineResult.analysisResult)) {
    return maybePipelineResult.analysisResult;
  }

  return undefined;
}
