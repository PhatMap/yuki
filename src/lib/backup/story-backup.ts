import { IndexedDbJobCacheStore } from "@/lib/ai/jobs/local/indexed-db-job-cache-store";
import { IndexedDbJobStore } from "@/lib/ai/jobs/local/indexed-db-job-store";
import type { AiJobCacheEntry } from "@/lib/ai/jobs/cache-store-types";
import type { AiJob, AiJobTask } from "@/lib/ai/jobs/types";
import {
  db,
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

export interface StoryBackupRestoreSummary {
  restoredAt: string;
  storyId: string;
  counts: StoryBackupManifest["counts"];
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

export async function restoreStoryBackupPayload(
  payload: StoryBackupPayload,
  expectedStoryId: string,
): Promise<StoryBackupRestoreSummary> {
  const { data, manifest } = payload;
  const storyId = manifest.storyId;

  if (manifest.schemaVersion !== 1) {
    throw new Error(
      `Unsupported backup schema version: ${manifest.schemaVersion}.`,
    );
  }

  if (storyId !== expectedStoryId) {
    throw new Error(
      `Backup storyId (${storyId}) does not match current storyId (${expectedStoryId}).`,
    );
  }

  if (!data.story) {
    throw new Error("Backup data is missing story metadata.");
  }

  if (data.story.id !== storyId) {
    throw new Error(
      `Backup story metadata id (${data.story.id}) does not match manifest storyId (${storyId}).`,
    );
  }
  const storyRecord: Story = data.story;

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
      db.aiJobs,
      db.aiJobTasks,
      db.aiJobCacheEntries,
    ],
    async () => {
      const existingJobs = await db.aiJobs.where("storyId").equals(storyId).toArray();
      const existingJobIds = existingJobs.map((job) => job.id);

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
      await db.aiJobs.where("storyId").equals(storyId).delete();
      await db.aiJobCacheEntries.where("storyId").equals(storyId).delete();

      if (existingJobIds.length > 0) {
        await db.aiJobTasks.where("jobId").anyOf(existingJobIds).delete();
      }

      await db.stories.put({
        ...storyRecord,
        id: storyId,
      });

      if (data.setup) {
        await db.storySetups.put({
          ...data.setup,
          storyId,
        });
      }

      if (data.chapters.length > 0) {
        await db.importedChapters.bulkPut(
          data.chapters.map((chapter) => ({
            ...chapter,
            storyId,
          })),
        );
      }

      if (data.chunks.length > 0) {
        await db.chapterChunks.bulkPut(
          data.chunks.map((chunk) => ({
            ...chunk,
            storyId,
          })),
        );
      }

      if (data.analysisStatus) {
        await db.analysisStatuses.put({
          ...data.analysisStatus,
          storyId,
        });
      }

      if (data.analysisResult) {
        await db.analysisResults.put({
          ...data.analysisResult,
          storyId,
        });
      }

      if (data.branches.length > 0) {
        await db.branches.bulkPut(
          data.branches.map((branch) => ({
            ...branch,
            storyId,
          })),
        );
      }

      if (data.branchChanges.length > 0) {
        await db.branchChanges.bulkPut(
          data.branchChanges.map((change) => ({
            ...change,
            storyId,
          })),
        );
      }

      if (data.continuityIssues.length > 0) {
        await db.continuityIssues.bulkPut(
          data.continuityIssues.map((issue) => ({
            ...issue,
            storyId,
          })),
        );
      }

      if (data.rewriteDrafts.length > 0) {
        await db.rewriteDrafts.bulkPut(
          data.rewriteDrafts.map((draft) => ({
            ...draft,
            storyId,
          })),
        );
      }

      if (data.aiJobs.length > 0) {
        await db.aiJobs.bulkPut(
          data.aiJobs.map((job) => ({
            ...job,
            storyId,
          })),
        );
      }

      if (data.aiJobTasks.length > 0) {
        await db.aiJobTasks.bulkPut(data.aiJobTasks);
      }

      if (data.aiJobCacheEntries.length > 0) {
        await db.aiJobCacheEntries.bulkPut(
          data.aiJobCacheEntries.map((entry) => ({
            ...entry,
            storyId,
          })),
        );
      }
    },
  );

  return {
    restoredAt: new Date().toISOString(),
    storyId,
    counts: manifest.counts,
  };
}
