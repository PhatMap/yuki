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
  genre: StoryGenre;
  tone: StoryTone;
  canonAdherence: CanonAdherence;
  isFanwork: boolean;
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
