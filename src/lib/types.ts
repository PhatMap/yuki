export type StoryGenre =
  | "fantasy"
  | "xianxia"
  | "romance"
  | "action"
  | "horror"
  | "mystery"
  | "school"
  | "sci-fi"
  | "adventure"
  | "comedy"
  | "tragedy";

export type StoryTone =
  | "funny"
  | "dark"
  | "romantic"
  | "tragic"
  | "dramatic"
  | "soft"
  | "epic";

export type CanonAdherence =
  | "very-close"
  | "moderate"
  | "inspired-only"
  | "completely-different";

export interface Story {
  id: string;
  title: string;
  description: string;
  author?: string;
  genre: StoryGenre;
  tone: StoryTone;
  canonAdherence: CanonAdherence;
  isFanwork: boolean;
  source?: "manual" | "import";
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  storyId: string;
  name: string;
  role: string;
  personality: string;
  goal: string;
  relationshipNotes?: string;
}

export interface Chapter {
  id: string;
  storyId: string;
  branchId?: string;
  title: string;
  content: string;
  order: number;
  createdAt: string;
}

export interface ImportedChapter {
  id: string;
  storyId: string;
  chapterNumber: number;
  title: string;
  rawContent: string;
  cleanContent: string;
  wordCount: number;
  status: "imported" | "parsed" | "analyzed" | "failed";
  createdAt: string;
}

export interface ChapterChunk {
  id: string;
  storyId: string;
  chapterId: string;
  chapterNumber: number;
  chunkIndex: number;
  content: string;
  wordCount: number;
  startOffset?: number;
  endOffset?: number;
  status: "created" | "embedded" | "analyzed";
}

export type ExtractedEntityType =
  | "character"
  | "item"
  | "term"
  | "location"
  | "faction"
  | "power-system"
  | "event";

export interface ExtractedEntity {
  id: string;
  storyId: string;
  type: ExtractedEntityType;
  name: string;
  aliases?: string[];
  description: string;
  firstSeenChapter?: number;
  lastSeenChapter?: number;
  relatedChapterNumbers: number[];
  confidence?: number;
}

export interface StoryEvent {
  id: string;
  storyId: string;
  chapterNumber: number;
  title: string;
  description: string;
  charactersInvolved: string[];
  locationsInvolved: string[];
  consequences: string[];
  importance: "low" | "medium" | "high" | "critical";
}

export interface WritingStyleProfile {
  id: string;
  storyId: string;
  scope: "story" | "arc" | "chapter";
  chapterRangeStart?: number;
  chapterRangeEnd?: number;
  narrationStyle: string;
  sentenceStyle: string;
  dialogueStyle: string;
  pacing: string;
  tone: string;
  commonPatterns: string[];
  tabooPatterns: string[];
}

export interface StoryAnalysisResult {
  storyId: string;
  characters: ExtractedEntity[];
  events: StoryEvent[];
  items: ExtractedEntity[];
  terms: ExtractedEntity[];
  locations: ExtractedEntity[];
  writingStyleProfiles: WritingStyleProfile[];
  updatedAt: string;
}

export interface CharacterState {
  id: string;
  storyId: string;
  characterName: string;
  chapterNumber: number;
  location?: string;
  status?: string;
  powerLevel?: string;
  itemsOwned?: string[];
  currentGoal?: string;
  emotionalState?: string;
  relationshipNotes?: string;
}

export interface AnalysisStatus {
  storyId: string;
  totalChapters: number;
  parsedChapters: number;
  chunkedChapters: number;
  analyzedChapters: number;
  totalChunks: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryBranch {
  id: string;
  storyId: string;
  name: string;
  description: string;
  divergencePoint: string;
}

export interface WorldNote {
  id: string;
  storyId: string;
  title: string;
  content: string;
  category: "lore" | "timeline" | "location" | "power-system" | "rule";
}
