import Dexie, { type Table } from "dexie";

import type {
  AnalysisStatus,
  BranchChange,
  BranchContinuityIssue,
  ChapterChunk,
  ImportedChapter,
  RewriteDraft,
  Story,
  StoryAnalysisResult,
  StoryBranchV2,
} from "@/lib/types";

export interface StorySetupData {
  storyId: string;
  originalTitle: string;
  originalAuthor: string;
  mustKeep: string;
  mustChange: string;
  updatedAt: string;
}

interface SaveImportedStoryDataParams {
  story: Story;
  chapters: ImportedChapter[];
  chunks: ChapterChunk[];
  analysisStatus: AnalysisStatus;
}

export class AiStoryDatabase extends Dexie {
  stories!: Table<Story, string>;
  storySetups!: Table<StorySetupData, string>;
  importedChapters!: Table<ImportedChapter, string>;
  chapterChunks!: Table<ChapterChunk, string>;
  analysisStatuses!: Table<AnalysisStatus, string>;
  analysisResults!: Table<StoryAnalysisResult, string>;
  branches!: Table<StoryBranchV2, string>;
  branchChanges!: Table<BranchChange, string>;
  continuityIssues!: Table<BranchContinuityIssue, string>;
  rewriteDrafts!: Table<RewriteDraft, string>;

  constructor() {
    super("ai-story-app-db");

    this.version(1).stores({
      stories:
        "id, title, author, source, genre, tone, canonAdherence, isFanwork, createdAt, updatedAt",
      importedChapters: "id, storyId, chapterNumber, title, wordCount, status",
      chapterChunks:
        "id, storyId, chapterId, chapterNumber, chunkIndex, wordCount, status",
      analysisStatuses:
        "storyId, totalChapters, parsedChapters, chunkedChapters, analyzedChapters, totalChunks, updatedAt",
      analysisResults: "storyId, updatedAt",
      branches: "id, storyId, type, status, divergesFromChapter, updatedAt",
      branchChanges:
        "id, storyId, branchId, type, chapterNumber, impactScope, status, updatedAt",
      continuityIssues: "id, storyId, branchId, changeId, severity, status",
    });

    this.version(2).stores({
      stories:
        "id, title, author, source, genre, tone, canonAdherence, isFanwork, createdAt, updatedAt",
      importedChapters: "id, storyId, chapterNumber, title, wordCount, status",
      chapterChunks:
        "id, storyId, chapterId, chapterNumber, chunkIndex, wordCount, status",
      analysisStatuses:
        "storyId, totalChapters, parsedChapters, chunkedChapters, analyzedChapters, totalChunks, updatedAt",
      analysisResults: "storyId, updatedAt",
      branches: "id, storyId, type, status, divergesFromChapter, updatedAt",
      branchChanges:
        "id, storyId, branchId, type, chapterNumber, impactScope, status, updatedAt",
      continuityIssues: "id, storyId, branchId, changeId, severity, status",
      rewriteDrafts:
        "id, storyId, branchChangeId, targetChapterId, status, updatedAt",
    });

    this.version(3).stores({
      stories:
        "id, title, author, source, genre, tone, canonAdherence, isFanwork, createdAt, updatedAt",
      storySetups: "storyId, updatedAt",
      importedChapters: "id, storyId, chapterNumber, title, wordCount, status",
      chapterChunks:
        "id, storyId, chapterId, chapterNumber, chunkIndex, wordCount, status",
      analysisStatuses:
        "storyId, totalChapters, parsedChapters, chunkedChapters, analyzedChapters, totalChunks, updatedAt",
      analysisResults: "storyId, updatedAt",
      branches: "id, storyId, type, status, divergesFromChapter, updatedAt",
      branchChanges:
        "id, storyId, branchId, type, chapterNumber, impactScope, status, updatedAt",
      continuityIssues: "id, storyId, branchId, changeId, severity, status",
      rewriteDrafts:
        "id, storyId, branchChangeId, targetChapterId, status, updatedAt",
    });
  }
}

export const db = new AiStoryDatabase();

export async function saveStory(story: Story, setup?: StorySetupData) {
  await db.transaction("rw", db.stories, db.storySetups, async () => {
    await db.stories.put(story);

    if (setup) {
      await db.storySetups.put(setup);
    }
  });
}

export async function saveStorySetup(setup: StorySetupData) {
  await db.storySetups.put(setup);
}

export async function getStorySetup(storyId: string) {
  return db.storySetups.get(storyId);
}

export async function saveImportedStoryData({
  story,
  chapters,
  chunks,
  analysisStatus,
}: SaveImportedStoryDataParams) {
  await db.transaction(
    "rw",
    db.stories,
    db.importedChapters,
    db.chapterChunks,
    db.analysisStatuses,
    async () => {
      await db.stories.put(story);
      await db.importedChapters.bulkPut(chapters);
      await db.chapterChunks.bulkPut(chunks);
      await db.analysisStatuses.put(analysisStatus);
    },
  );
}

export async function getStoryById(storyId: string) {
  return db.stories.get(storyId);
}

export async function getAllStories() {
  return db.stories.orderBy("updatedAt").reverse().toArray();
}

export async function getImportedChapters(storyId: string) {
  return db.importedChapters
    .where("storyId")
    .equals(storyId)
    .sortBy("chapterNumber");
}

export async function getChapterChunks(storyId: string) {
  return db.chapterChunks.where("storyId").equals(storyId).sortBy("chunkIndex");
}

export async function getAnalysisStatus(storyId: string) {
  return db.analysisStatuses.get(storyId);
}

export async function getAnalysisResult(storyId: string) {
  return db.analysisResults.get(storyId);
}

export async function saveAnalysisResult(
  storyId: string,
  result: StoryAnalysisResult,
  status: AnalysisStatus,
) {
  await db.transaction(
    "rw",
    db.analysisResults,
    db.analysisStatuses,
    async () => {
      await db.analysisResults.put({
        ...result,
        storyId,
      });
      await db.analysisStatuses.put({
        ...status,
        storyId,
      });
    },
  );
}

export async function getBranches(storyId: string) {
  return db.branches.where("storyId").equals(storyId).toArray();
}

export async function saveBranches(storyId: string, branches: StoryBranchV2[]) {
  await db.transaction("rw", db.branches, async () => {
    await db.branches.where("storyId").equals(storyId).delete();
    await db.branches.bulkPut(
      branches.map((branch) => ({
        ...branch,
        storyId,
      })),
    );
  });
}

export async function getBranchChanges(storyId: string) {
  return db.branchChanges.where("storyId").equals(storyId).toArray();
}

export async function saveBranchChanges(
  storyId: string,
  changes: BranchChange[],
) {
  await db.transaction("rw", db.branchChanges, async () => {
    await db.branchChanges.where("storyId").equals(storyId).delete();
    await db.branchChanges.bulkPut(
      changes.map((change) => ({
        ...change,
        storyId,
      })),
    );
  });
}

export async function getContinuityIssues(storyId: string) {
  return db.continuityIssues.where("storyId").equals(storyId).toArray();
}

export async function saveContinuityIssues(
  storyId: string,
  issues: BranchContinuityIssue[],
) {
  await db.transaction("rw", db.continuityIssues, async () => {
    await db.continuityIssues.where("storyId").equals(storyId).delete();
    await db.continuityIssues.bulkPut(
      issues.map((issue) => ({
        ...issue,
        storyId,
      })),
    );
  });
}

export async function getRewriteDrafts(storyId: string) {
  return db.rewriteDrafts.where("storyId").equals(storyId).toArray();
}

export async function saveRewriteDraft(draft: RewriteDraft) {
  await db.rewriteDrafts.put(draft);
}

export async function clearStoryData(storyId: string) {
  await db.transaction(
    "rw",
    [
      db.stories,
      db.storySetups,
      db.importedChapters,
      db.chapterChunks,
      db.analysisStatuses,
      db.analysisResults,
      db.branches,
      db.branchChanges,
      db.continuityIssues,
      db.rewriteDrafts,
    ],
    async () => {
      await db.stories.delete(storyId);
      await db.storySetups.delete(storyId);
      await db.importedChapters.where("storyId").equals(storyId).delete();
      await db.chapterChunks.where("storyId").equals(storyId).delete();
      await db.analysisStatuses.delete(storyId);
      await db.analysisResults.delete(storyId);
      await db.branches.where("storyId").equals(storyId).delete();
      await db.branchChanges.where("storyId").equals(storyId).delete();
      await db.continuityIssues.where("storyId").equals(storyId).delete();
      await db.rewriteDrafts.where("storyId").equals(storyId).delete();
    },
  );
}
