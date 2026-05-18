export type ChapterScoutPriority = "low" | "medium" | "high" | "critical";
export type ChapterScoutRecommendation = "skip" | "light_load" | "deep_load";

export interface ChapterScoutResultItem {
  chapterIndex: number;
  priority: ChapterScoutPriority;
  recommendation: ChapterScoutRecommendation;
  detectedSignals: string[];
  reason: string;
  confidence: number;
}

export interface ChapterScoutOutput {
  results: ChapterScoutResultItem[];
}

export interface ArcMapItem {
  id: string;
  title: string;
  chapterStart: number;
  chapterEnd: number;
  summary: string;
  importance: string;
  whyLoad: string;
  recommendedDeepChapters: number[];
}

export interface ArcMapOutput {
  arcs: ArcMapItem[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

const validPriorities = new Set<ChapterScoutPriority>([
  "low",
  "medium",
  "high",
  "critical",
]);
const validRecommendations = new Set<ChapterScoutRecommendation>([
  "skip",
  "light_load",
  "deep_load",
]);

export function validateChapterScoutOutput(value: unknown): ChapterScoutOutput {
  if (!isObject(value) || !Array.isArray(value.results)) {
    throw new Error("Chapter Scout output must include results array.");
  }

  const results = value.results.map((item, index) => {
    if (!isObject(item)) {
      throw new Error(`Chapter Scout result[${index}] must be an object.`);
    }

    if (typeof item.chapterIndex !== "number") {
      throw new Error(`Chapter Scout result[${index}].chapterIndex is required.`);
    }
    if (!validPriorities.has(item.priority as ChapterScoutPriority)) {
      throw new Error(`Chapter Scout result[${index}].priority is invalid.`);
    }
    if (!validRecommendations.has(item.recommendation as ChapterScoutRecommendation)) {
      throw new Error(`Chapter Scout result[${index}].recommendation is invalid.`);
    }
    if (!isStringArray(item.detectedSignals)) {
      throw new Error(`Chapter Scout result[${index}].detectedSignals must be string[].`);
    }
    if (typeof item.reason !== "string" || !item.reason.trim()) {
      throw new Error(`Chapter Scout result[${index}].reason is required.`);
    }
    if (typeof item.confidence !== "number") {
      throw new Error(`Chapter Scout result[${index}].confidence is required.`);
    }

    return {
      chapterIndex: item.chapterIndex,
      priority: item.priority,
      recommendation: item.recommendation,
      detectedSignals: item.detectedSignals,
      reason: item.reason,
      confidence: item.confidence,
    } as ChapterScoutResultItem;
  });

  return { results };
}

export function validateArcMapOutput(value: unknown): ArcMapOutput {
  if (!isObject(value) || !Array.isArray(value.arcs)) {
    throw new Error("Arc Map output must include arcs array.");
  }

  const arcs = value.arcs.map((item, index) => {
    if (!isObject(item)) {
      throw new Error(`Arc Map arc[${index}] must be an object.`);
    }

    const requiredStringFields: Array<keyof ArcMapItem> = [
      "id",
      "title",
      "summary",
      "importance",
      "whyLoad",
    ];
    for (const field of requiredStringFields) {
      if (typeof item[field] !== "string" || !(item[field] as string).trim()) {
        throw new Error(`Arc Map arc[${index}].${field} is required.`);
      }
    }
    if (typeof item.chapterStart !== "number") {
      throw new Error(`Arc Map arc[${index}].chapterStart is required.`);
    }
    if (typeof item.chapterEnd !== "number") {
      throw new Error(`Arc Map arc[${index}].chapterEnd is required.`);
    }
    if (!isNumberArray(item.recommendedDeepChapters)) {
      throw new Error(
        `Arc Map arc[${index}].recommendedDeepChapters must be number[].`,
      );
    }

    return {
      id: item.id,
      title: item.title,
      chapterStart: item.chapterStart,
      chapterEnd: item.chapterEnd,
      summary: item.summary,
      importance: item.importance,
      whyLoad: item.whyLoad,
      recommendedDeepChapters: item.recommendedDeepChapters,
    } as ArcMapItem;
  });

  return { arcs };
}
