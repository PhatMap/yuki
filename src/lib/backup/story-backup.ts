import { IndexedDbJobCacheStore } from "@/lib/ai/jobs/local/indexed-db-job-cache-store";
import { IndexedDbJobStore } from "@/lib/ai/jobs/local/indexed-db-job-store";
import type { AiJobCacheEntry } from "@/lib/ai/jobs/cache-store-types";
import type { AiJob, AiJobTask } from "@/lib/ai/jobs/types";
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

export interface StoryBackupManifest {
  schemaVersion: 1;
  exportedAt: string;
  storyId: string;
  storyTitle?: string;
  counts: {
    chapters: number;
    chunks: number;
    branches: number;
    branchChanges: number;
    continuityIssues: number;
    rewriteDrafts: number;
    aiJobs: number;
    aiJobTasks: number;
    aiJobCacheEntries: number;
  };
}

export interface StoryBackupPayload {
  manifest: StoryBackupManifest;
  data: {
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
    aiJobs: AiJob[];
    aiJobTasks: AiJobTask[];
    aiJobCacheEntries: AiJobCacheEntry[];
  };
}

function sanitizeFileNamePart(value: string | undefined) {
  if (!value) return "story";

  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u1EF9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "story"
  );
}

export async function createStoryBackupPayload(
  storyId: string,
): Promise<StoryBackupPayload> {
  const jobStore = new IndexedDbJobStore();
  const cacheStore = new IndexedDbJobCacheStore();

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
    aiJobs,
    aiJobCacheEntries,
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
    jobStore.listJobsByStory(storyId),
    cacheStore.listByStory(storyId),
  ]);

  const aiJobTasks = aiJobs.length
    ? (await Promise.all(aiJobs.map((job) => jobStore.listTasksByJob(job.id)))).flat()
    : [];

  return {
    manifest: {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      storyId,
      storyTitle: story?.title,
      counts: {
        chapters: chapters.length,
        chunks: chunks.length,
        branches: branches.length,
        branchChanges: branchChanges.length,
        continuityIssues: continuityIssues.length,
        rewriteDrafts: rewriteDrafts.length,
        aiJobs: aiJobs.length,
        aiJobTasks: aiJobTasks.length,
        aiJobCacheEntries: aiJobCacheEntries.length,
      },
    },
    data: {
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
      aiJobs,
      aiJobTasks,
      aiJobCacheEntries,
    },
  };
}

export function createStoryBackupFileName(payload: StoryBackupPayload) {
  const title = sanitizeFileNamePart(payload.manifest.storyTitle);
  const timestamp = payload.manifest.exportedAt
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");

  return `yuki-backup-${title}-${payload.manifest.storyId}-${timestamp}.json`;
}

export function downloadStoryBackup(payload: StoryBackupPayload) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("Story backup download is only available in the browser.");
  }

  const fileName = createStoryBackupFileName(payload);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return fileName;
}
