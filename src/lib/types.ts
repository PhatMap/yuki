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

export type StoryBranchType =
  | "canon"
  | "alternate"
  | "rewrite"
  | "continuation"
  | "what-if";

export type BranchStatus = "draft" | "active" | "archived";

export type BranchChangeType =
  | "event_change"
  | "relationship_change"
  | "character_state_change"
  | "item_change"
  | "term_change"
  | "location_change"
  | "timeline_change"
  | "chapter_rewrite"
  | "continuation";

export type ImpactScope =
  | "single_scene"
  | "single_chapter"
  | "chapter_range"
  | "from_chapter_forward"
  | "entire_branch";

export interface StoryBranchV2 {
  id: string;
  storyId: string;
  name: string;
  type: StoryBranchType;
  status: BranchStatus;
  baseBranchId?: string;
  divergesFromChapter?: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchChange {
  id: string;
  storyId: string;
  branchId: string;
  type: BranchChangeType;
  title: string;
  description: string;
  targetName?: string;
  originalValue?: string;
  newValue?: string;
  chapterNumber?: number;
  chapterRangeStart?: number;
  chapterRangeEnd?: number;
  impactScope: ImpactScope;
  affectedCharacters: string[];
  affectedItems: string[];
  affectedTerms: string[];
  affectedLocations: string[];
  affectedChapterNumbers: number[];
  status: "draft" | "applied" | "needs_review";
  createdAt: string;
  updatedAt: string;
}

export interface BranchChapter {
  id: string;
  storyId: string;
  branchId: string;
  sourceChapterId?: string;
  chapterNumber: number;
  title: string;
  content: string;
  changeIds: string[];
  status: "draft" | "rewritten" | "generated" | "approved";
  createdAt: string;
  updatedAt: string;
}

export interface RewriteDraft {
  id: string;
  storyId: string;
  branchChangeId: string;
  targetChapterId: string;
  title: string;
  originalText: string;
  rewrittenText: string;
  notes: string;
  status: "draft" | "reviewed" | "accepted";
  createdAt: string;
  updatedAt: string;
}

export interface StoryLocalSettings {
  storyId: string;
  fontSize: "small" | "medium" | "large";
  readingWidth: "compact" | "comfortable" | "wide";
  density: "compact" | "comfortable";
  showMetadata: boolean;
  autoSaveDrafts: boolean;
  mockAiMode: "conservative" | "balanced" | "creative";
  updatedAt: string;
}

export type PromptTemplateCategory =
  | "system"
  | "analysis"
  | "planning"
  | "rewrite"
  | "generation";

export interface GlobalPromptTemplate {
  id: string;
  title: string;
  description: string;
  category: PromptTemplateCategory;
  editablePrompt: string;
  lockedContract: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BranchContinuityIssue {
  id: string;
  storyId: string;
  branchId: string;
  changeId?: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  affectedChapterNumbers: number[];
  suggestedFix?: string;
  status: "open" | "resolved" | "ignored";
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
