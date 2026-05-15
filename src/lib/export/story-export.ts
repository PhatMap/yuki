import {
  getAnalysisResult,
  getAnalysisStatus,
  getBranches,
  getBranchChanges,
  getChapterChunks,
  getContinuityIssues,
  getImportedChapters,
  getRewriteDrafts,
  getStoryById,
  getStorySetup,
  type StorySetupData,
} from "@/lib/db/indexed-db";
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

export interface StoryExportSnapshot {
  exportVersion: 1;
  exportedAt: string;
  app: {
    name: "yuki";
    storage: "indexeddb";
  };
  storyId: string;
  story?: Story;
  setup?: StorySetupData;
  chapters: ImportedChapter[];
  chunks: ChapterChunk[];
  analysisStatus?: AnalysisStatus;
  analysisResult?: StoryAnalysisResult;
  branches: StoryBranchV2[];
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
  rewriteDrafts: RewriteDraft[];
  summary: {
    hasStory: boolean;
    hasSetup: boolean;
    chapterCount: number;
    chunkCount: number;
    hasAnalysisStatus: boolean;
    hasAnalysisResult: boolean;
    branchCount: number;
    branchChangeCount: number;
    continuityIssueCount: number;
    rewriteDraftCount: number;
    totalWordCount: number;
  };
}

export async function buildStoryExportSnapshot(
  storyId: string,
): Promise<StoryExportSnapshot> {
  const [
    story,
    setup,
    chapters,
    chunks,
    analysisStatus,
    analysisResult,
    branches,
    branchChanges,
    continuityIssues,
    rewriteDrafts,
  ] = await Promise.all([
    getStoryById(storyId),
    getStorySetup(storyId),
    getImportedChapters(storyId),
    getChapterChunks(storyId),
    getAnalysisStatus(storyId),
    getAnalysisResult(storyId),
    getBranches(storyId),
    getBranchChanges(storyId),
    getContinuityIssues(storyId),
    getRewriteDrafts(storyId),
  ]);

  const totalWordCount = chapters.reduce(
    (total, chapter) => total + chapter.wordCount,
    0,
  );

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    app: {
      name: "yuki",
      storage: "indexeddb",
    },
    storyId,
    story,
    setup,
    chapters,
    chunks,
    analysisStatus,
    analysisResult,
    branches,
    branchChanges,
    continuityIssues,
    rewriteDrafts,
    summary: {
      hasStory: Boolean(story),
      hasSetup: Boolean(setup),
      chapterCount: chapters.length,
      chunkCount: chunks.length,
      hasAnalysisStatus: Boolean(analysisStatus),
      hasAnalysisResult: Boolean(analysisResult),
      branchCount: branches.length,
      branchChangeCount: branchChanges.length,
      continuityIssueCount: continuityIssues.length,
      rewriteDraftCount: rewriteDrafts.length,
      totalWordCount,
    },
  };
}

export function createStoryExportFilename(snapshot: StoryExportSnapshot) {
  const safeTitle =
    snapshot.story?.title
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u1EF9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || snapshot.storyId;

  const date = snapshot.exportedAt.slice(0, 10);

  return `yuki-${safeTitle}-${date}.json`;
}

export function stringifyStoryExportSnapshot(snapshot: StoryExportSnapshot) {
  return JSON.stringify(snapshot, null, 2);
}
