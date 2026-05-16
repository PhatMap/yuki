import {
  createAiJobCacheKey,
  createStableContentHash,
} from "@/lib/ai/jobs/cache-key";
import type {
  AiJob,
  AiJobProgress,
  AiJobProviderTarget,
  AiJobRetryPolicy,
  AiJobRuntimeTarget,
  AiJobTask,
} from "@/lib/ai/jobs/types";
import { defaultAiJobRetryPolicy } from "@/lib/ai/jobs/types";

export interface StoryAnalysisSourceItem {
  id: string;
  storyId?: string;
  chapterId?: string;
  chunkId?: string;
  chapterNumber?: number;
  chunkIndex?: number;
  title?: string;
  wordCount?: number;
  contentHash?: string;
  updatedAt?: string;
}

export interface StoryAnalysisPromptTarget {
  templateId: string;
  versionHash: string;
}

export interface StoryAnalysisJobPlannerInput {
  storyId: string;
  items: StoryAnalysisSourceItem[];
  batchSize: number;
  prompt: StoryAnalysisPromptTarget;
  providerTarget: AiJobProviderTarget;
  runtimeTarget?: AiJobRuntimeTarget;
  retryPolicy?: AiJobRetryPolicy;
  plannedAt?: string;
}

export interface StoryAnalysisTaskInput {
  storyId: string;
  batchIndex: number;
  itemIds: string[];
  chapterIds: string[];
  chunkIds: string[];
  chapterNumbers: number[];
  promptTemplateId: string;
  promptVersionHash: string;
}

export interface StoryAnalysisJobMetadata {
  promptTemplateId: string;
  promptVersionHash: string;
  batchSize: number;
  itemCount: number;
}

export interface StoryAnalysisJobPlan {
  job: AiJob<StoryAnalysisJobMetadata>;
  tasks: AiJobTask<StoryAnalysisTaskInput>[];
  progress: AiJobProgress;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function normalizeBatchSize(batchSize: number) {
  if (!Number.isFinite(batchSize)) return 10;

  return Math.max(1, Math.min(100, Math.round(batchSize)));
}

function createInitialProgress(totalTasks: number): AiJobProgress {
  return {
    totalTasks,
    pendingTasks: totalTasks,
    queuedTasks: 0,
    runningTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    skippedTasks: 0,
    percentComplete: 0,
    message:
      totalTasks > 0
        ? `Planned ${totalTasks} story analysis task(s).`
        : "No story analysis tasks planned.",
  };
}

function createBatchContentHash(items: StoryAnalysisSourceItem[]) {
  return createStableContentHash(
    items.map((item) => ({
      id: item.id,
      chapterId: item.chapterId,
      chunkId: item.chunkId,
      chapterNumber: item.chapterNumber,
      chunkIndex: item.chunkIndex,
      contentHash: item.contentHash,
      updatedAt: item.updatedAt,
      wordCount: item.wordCount,
    })),
  );
}

export function planStoryAnalysisJob({
  storyId,
  items,
  batchSize,
  prompt,
  providerTarget,
  runtimeTarget = "local-browser",
  retryPolicy = defaultAiJobRetryPolicy,
  plannedAt = "1970-01-01T00:00:00.000Z",
}: StoryAnalysisJobPlannerInput): StoryAnalysisJobPlan {
  const normalizedBatchSize = normalizeBatchSize(batchSize);
  const batches = chunkItems(items, normalizedBatchSize);
  const jobFingerprint = createStableContentHash({
    storyId,
    itemIds: items.map((item) => item.id),
    contentHashes: items.map((item) => item.contentHash ?? ""),
    prompt,
    providerId: providerTarget.providerId,
    model: providerTarget.model,
    batchSize: normalizedBatchSize,
  });
  const jobId = `story-analysis:${storyId}:${jobFingerprint}`;
  const progress = createInitialProgress(batches.length);
  const tasks: AiJobTask<StoryAnalysisTaskInput>[] = batches.map(
    (batch, batchIndex) => {
      const batchContentHash = createBatchContentHash(batch);
      const chapterIds = batch
        .map((item) => item.chapterId)
        .filter((value): value is string => Boolean(value));
      const chunkIds = batch
        .map((item) => item.chunkId)
        .filter((value): value is string => Boolean(value));
      const chapterNumbers = Array.from(
        new Set(
          batch
            .map((item) => item.chapterNumber)
            .filter((value): value is number => typeof value === "number"),
        ),
      ).sort((left, right) => left - right);
      const cacheKey = createAiJobCacheKey({
        namespace: "story-analysis",
        storyId,
        chapterId: chapterIds.join("+") || undefined,
        chunkId: chunkIds.join("+") || undefined,
        contentHash: batchContentHash,
        promptTemplateId: prompt.templateId,
        promptVersionHash: prompt.versionHash,
        provider: providerTarget.providerId,
        model: providerTarget.model,
      });

      return {
        id: `${jobId}:task:${batchIndex + 1}`,
        jobId,
        kind: "story-analysis",
        status: "pending",
        sequence: batchIndex + 1,
        input: {
          storyId,
          batchIndex,
          itemIds: batch.map((item) => item.id),
          chapterIds,
          chunkIds,
          chapterNumbers,
          promptTemplateId: prompt.templateId,
          promptVersionHash: prompt.versionHash,
        },
        cacheKey,
        attempts: 0,
        retryPolicy,
        dependsOnTaskIds: [],
        createdAt: plannedAt,
        updatedAt: plannedAt,
        metadata: {
          itemCount: batch.length,
          firstChapterNumber: chapterNumbers[0] ?? null,
          lastChapterNumber: chapterNumbers.at(-1) ?? null,
          wordCount: batch.reduce(
            (total, item) => total + (item.wordCount ?? 0),
            0,
          ),
        },
      };
    },
  );
  const job: AiJob<StoryAnalysisJobMetadata> = {
    id: jobId,
    storyId,
    kind: "story-analysis",
    status: "planned",
    runtimeTarget,
    providerTarget,
    progress,
    retryPolicy,
    taskIds: tasks.map((task) => task.id),
    cacheNamespace: "story-analysis",
    createdAt: plannedAt,
    updatedAt: plannedAt,
    metadata: {
      promptTemplateId: prompt.templateId,
      promptVersionHash: prompt.versionHash,
      batchSize: normalizedBatchSize,
      itemCount: items.length,
    },
  };

  return {
    job,
    tasks,
    progress,
  };
}
