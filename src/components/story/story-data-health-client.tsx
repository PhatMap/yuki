"use client";

import Link from "next/link";
import { type ChangeEvent, type ReactNode, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clipboard,
  Database,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IndexedDbJobStore } from "@/lib/ai/jobs/local/indexed-db-job-store";
import { IndexedDbJobCacheStore } from "@/lib/ai/jobs/local/indexed-db-job-cache-store";
import {
  createStoryBackupPayload,
  downloadStoryBackup,
  restoreStoryBackupPayload,
} from "@/lib/backup/story-backup";
import {
  readStoryBackupFile,
  type StoryBackupValidationResult,
} from "@/lib/backup/story-backup-validation";
import type { AiJob, AiJobTask } from "@/lib/ai/jobs/types";
import type { AiJobCacheEntry } from "@/lib/ai/jobs/cache-store-types";
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
  saveLegacyStoryMigrationData,
  type StorySetupData,
} from "@/lib/db/indexed-db";
import { stories } from "@/lib/mock-data";
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
  StoryLocalSettings,
} from "@/lib/types";

interface StoryDataHealthClientProps {
  storyId: string;
}

type HealthState = "healthy" | "missing" | "partial" | "error";

interface ParsedLegacyFallbackValue<T> {
  key: string;
  exists: boolean;
  status: HealthState;
  value: T | null;
  error?: string;
}

interface DataHealthInspection {
  inspectedAt: string;
  indexedDbError?: string;
  indexedDb: {
    story?: Story;
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
  legacyFallback: {
    stories: ParsedLegacyFallbackValue<Story[]>;
    chapters: ParsedLegacyFallbackValue<ImportedChapter[]>;
    chunks: ParsedLegacyFallbackValue<ChapterChunk[]>;
    analysisStatus: ParsedLegacyFallbackValue<AnalysisStatus>;
    analysisResult: ParsedLegacyFallbackValue<StoryAnalysisResult>;
    branches: ParsedLegacyFallbackValue<StoryBranchV2[]>;
    branchChanges: ParsedLegacyFallbackValue<BranchChange[]>;
    continuityIssues: ParsedLegacyFallbackValue<BranchContinuityIssue[]>;
    rewriteDrafts: ParsedLegacyFallbackValue<RewriteDraft[]>;
    settings: ParsedLegacyFallbackValue<StoryLocalSettings>;
    storySetup: ParsedLegacyFallbackValue<unknown>;
  };
  warnings: string[];
}

const legacyFallbackKeys = {
  stories: "ai-story-app:stories",
  chapters: (storyId: string) => `ai-story-app:chapters:${storyId}`,
  chunks: (storyId: string) => `ai-story-app:chunks:${storyId}`,
  analysisStatus: (storyId: string) =>
    `ai-story-app:analysis-status:${storyId}`,
  analysisResult: (storyId: string) =>
    `ai-story-app:analysis-result:${storyId}`,
  branches: (storyId: string) => `ai-story-app:branches:${storyId}`,
  branchChanges: (storyId: string) => `ai-story-app:branch-changes:${storyId}`,
  continuityIssues: (storyId: string) =>
    `ai-story-app:continuity-issues:${storyId}`,
  rewriteDrafts: (storyId: string) => `ai-story-app:rewrite-drafts:${storyId}`,
  settings: (storyId: string) => `ai-story-app:settings:${storyId}`,
  storySetup: (storyId: string) => `ai-story-app:story-setup:${storyId}`,
};

function readLegacyFallbackValue<T>(key: string): ParsedLegacyFallbackValue<T> {
  if (typeof window === "undefined") {
    return {
      key,
      exists: false,
      status: "missing",
      value: null,
    };
  }

  const rawValue = localStorage.getItem(key);

  if (rawValue === null) {
    return {
      key,
      exists: false,
      status: "missing",
      value: null,
    };
  }

  try {
    return {
      key,
      exists: true,
      status: "healthy",
      value: JSON.parse(rawValue) as T,
    };
  } catch (error) {
    return {
      key,
      exists: true,
      status: "error",
      value: null,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

function localStoryForId(storyId: string, storiesValue: Story[] | null) {
  return storiesValue?.find((story) => story.id === storyId);
}

function legacyStorySetupToIndexedDbSetup(
  storyId: string,
  value: unknown,
): StorySetupData | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return {
    storyId,
    originalTitle:
      typeof record.originalTitle === "string" ? record.originalTitle : "",
    originalAuthor:
      typeof record.originalAuthor === "string" ? record.originalAuthor : "",
    mustKeep: typeof record.mustKeep === "string" ? record.mustKeep : "",
    mustChange: typeof record.mustChange === "string" ? record.mustChange : "",
    updatedAt: new Date().toISOString(),
  };
}

function removeStoryFromLegacyStories(storyId: string) {
  const parsedStories = readLegacyFallbackValue<Story[]>(
    legacyFallbackKeys.stories,
  );

  if (!parsedStories.value?.length) return;

  const remainingStories = parsedStories.value.filter(
    (story) => story.id !== storyId,
  );

  if (remainingStories.length === 0) {
    localStorage.removeItem(legacyFallbackKeys.stories);
    return;
  }

  localStorage.setItem(
    legacyFallbackKeys.stories,
    JSON.stringify(remainingStories),
  );
}

function clearLegacyStoryDataKeys(storyId: string) {
  [
    legacyFallbackKeys.chapters(storyId),
    legacyFallbackKeys.chunks(storyId),
    legacyFallbackKeys.analysisStatus(storyId),
    legacyFallbackKeys.analysisResult(storyId),
    legacyFallbackKeys.branches(storyId),
    legacyFallbackKeys.branchChanges(storyId),
    legacyFallbackKeys.continuityIssues(storyId),
    legacyFallbackKeys.rewriteDrafts(storyId),
    legacyFallbackKeys.storySetup(storyId),
  ].forEach((key) => {
    localStorage.removeItem(key);
  });

  removeStoryFromLegacyStories(storyId);
}

async function inspectStoryData(
  storyId: string,
): Promise<DataHealthInspection> {
  let indexedDbError: string | undefined;
  const indexedDb: DataHealthInspection["indexedDb"] = {
    chapters: [],
    chunks: [],
    branches: [],
    branchChanges: [],
    continuityIssues: [],
    rewriteDrafts: [],
    aiJobs: [],
    aiJobTasks: [],
    aiJobCacheEntries: [],
  };

  try {
    const jobStore = new IndexedDbJobStore();
    const cacheStore = new IndexedDbJobCacheStore();
    const [
      story,
      chapters,
      chunks,
      analysisStatus,
      analysisResult,
      branches,
      branchChanges,
      continuityIssues,
      rewriteDrafts,
      jobs,
      cacheEntries,
    ] = await Promise.all([
      getStoryById(storyId),
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
    const jobTasks = jobs.length
      ? (
          await Promise.all(
            jobs.map((job) => jobStore.listTasksByJob(job.id)),
          )
        ).flat()
      : [];

    indexedDb.story = story;
    indexedDb.chapters = chapters;
    indexedDb.chunks = chunks;
    indexedDb.analysisStatus = analysisStatus;
    indexedDb.analysisResult = analysisResult;
    indexedDb.branches = branches;
    indexedDb.branchChanges = branchChanges;
    indexedDb.continuityIssues = continuityIssues;
    indexedDb.rewriteDrafts = rewriteDrafts;
    indexedDb.aiJobs = jobs;
    indexedDb.aiJobTasks = jobTasks;
    indexedDb.aiJobCacheEntries = cacheEntries;
  } catch (error) {
    indexedDbError =
      error instanceof Error ? error.message : "IndexedDB read failed";
    console.error("Failed to inspect IndexedDB story data", error);
  }

  const legacyFallback = {
    stories: readLegacyFallbackValue<Story[]>(legacyFallbackKeys.stories),
    chapters: readLegacyFallbackValue<ImportedChapter[]>(
      legacyFallbackKeys.chapters(storyId),
    ),
    chunks: readLegacyFallbackValue<ChapterChunk[]>(
      legacyFallbackKeys.chunks(storyId),
    ),
    analysisStatus: readLegacyFallbackValue<AnalysisStatus>(
      legacyFallbackKeys.analysisStatus(storyId),
    ),
    analysisResult: readLegacyFallbackValue<StoryAnalysisResult>(
      legacyFallbackKeys.analysisResult(storyId),
    ),
    branches: readLegacyFallbackValue<StoryBranchV2[]>(
      legacyFallbackKeys.branches(storyId),
    ),
    branchChanges: readLegacyFallbackValue<BranchChange[]>(
      legacyFallbackKeys.branchChanges(storyId),
    ),
    continuityIssues: readLegacyFallbackValue<BranchContinuityIssue[]>(
      legacyFallbackKeys.continuityIssues(storyId),
    ),
    rewriteDrafts: readLegacyFallbackValue<RewriteDraft[]>(
      legacyFallbackKeys.rewriteDrafts(storyId),
    ),
    settings: readLegacyFallbackValue<StoryLocalSettings>(
      legacyFallbackKeys.settings(storyId),
    ),
    storySetup: readLegacyFallbackValue<unknown>(
      legacyFallbackKeys.storySetup(storyId),
    ),
  };

  const warnings = buildWarnings({
    storyId,
    indexedDb,
    indexedDbError,
    legacyFallback,
  });

  return {
    inspectedAt: new Date().toISOString(),
    indexedDbError,
    indexedDb,
    legacyFallback,
    warnings,
  };
}

function buildWarnings({
  storyId,
  indexedDb,
  indexedDbError,
  legacyFallback,
}: {
  storyId: string;
  indexedDb: DataHealthInspection["indexedDb"];
  indexedDbError?: string;
  legacyFallback: DataHealthInspection["legacyFallback"];
}) {
  const warnings: string[] = [];
  const localStory = localStoryForId(storyId, legacyFallback.stories.value);

  if (indexedDbError) warnings.push(`IndexedDB read error: ${indexedDbError}`);
  if (!indexedDb.story && !localStory)
    warnings.push("Thiếu bản ghi story.");
  if (
    indexedDb.chapters.length === 0 &&
    !legacyFallback.chapters.value?.length
  ) {
    warnings.push("Story chưa có chapter đã import.");
  }
  if (!indexedDb.analysisResult && !legacyFallback.analysisResult.value) {
    warnings.push("Analysis result is missing.");
  }
  if (
    indexedDb.branchChanges.length === 0 &&
    !legacyFallback.branchChanges.value?.length
  ) {
    warnings.push("Branch changes are missing or empty.");
  }
  if (
    indexedDb.continuityIssues.length === 0 &&
    !legacyFallback.continuityIssues.value?.length
  ) {
    warnings.push("Continuity issues are missing or empty.");
  }
  if (
    indexedDb.rewriteDrafts.length === 0 &&
    !legacyFallback.rewriteDrafts.value?.length
  ) {
    warnings.push("Rewrite drafts are missing or empty.");
  }
  if (!legacyFallback.settings.exists) {
    warnings.push("Thiếu story settings.");
  }
  if (indexedDb.aiJobs.length > 0 && indexedDb.aiJobTasks.length === 0) {
    warnings.push("AI jobs exist but AI job tasks are missing.");
  }
  if (
    indexedDb.aiJobCacheEntries.length === 0 &&
    indexedDb.aiJobs.some((job) => job.status === "completed")
  ) {
    warnings.push("Completed AI jobs exist but no AI job cache entries were found.");
  }

  Object.values(legacyFallback).forEach((item) => {
    if (item.status === "error") {
      warnings.push(`Invalid JSON in legacy fallback key: ${item.key}`);
    }
  });

  if (!indexedDb.story && localStory) {
    warnings.push(
      "Có legacy story fallback nhưng thiếu story trong IndexedDB.",
    );
  }
  if (
    indexedDb.chapters.length === 0 &&
    legacyFallback.chapters.value?.length
  ) {
    warnings.push(
      "Có legacy chapter fallback nhưng thiếu chapters trong IndexedDB.",
    );
  }
  if (!indexedDb.analysisResult && legacyFallback.analysisResult.value) {
    warnings.push(
      "Có legacy analysis fallback nhưng thiếu analysis trong IndexedDB.",
    );
  }
  if (
    indexedDb.rewriteDrafts.length === 0 &&
    legacyFallback.rewriteDrafts.value?.length
  ) {
    warnings.push(
      "Có legacy rewrite draft fallback nhưng thiếu drafts trong IndexedDB.",
    );
  }

  return warnings;
}

function getStateForRecord(
  exists: boolean,
  fallbackExists = false,
): HealthState {
  if (exists) return "healthy";
  if (fallbackExists) return "partial";

  return "missing";
}

function getCountState(count: number, fallbackCount = 0): HealthState {
  if (count > 0) return "healthy";
  if (fallbackCount > 0) return "partial";

  return "missing";
}

function getStorageValueCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return 1;

  return 0;
}

function getOverallHealth(inspection?: DataHealthInspection): HealthState {
  if (!inspection) return "missing";
  if (inspection.indexedDbError) return "error";
  if (inspection.warnings.length === 0) return "healthy";

  return "partial";
}

function getStateBadgeVariant(state: HealthState) {
  if (state === "healthy") return "secondary";
  if (state === "error") return "destructive";

  return "outline";
}

export function StoryDataHealthClient({ storyId }: StoryDataHealthClientProps) {
  const [inspection, setInspection] = useState<DataHealthInspection>();
  const [isLoading, setIsLoading] = useState(false);
  const [isMigratingLegacyData, setIsMigratingLegacyData] = useState(false);
  const [isClearingAiCache, setIsClearingAiCache] = useState(false);
  const [isExportingStoryBackup, setIsExportingStoryBackup] = useState(false);
  const [isValidatingStoryBackup, setIsValidatingStoryBackup] = useState(false);
  const [isRestoringStoryBackup, setIsRestoringStoryBackup] = useState(false);
  const [backupValidationResult, setBackupValidationResult] =
    useState<StoryBackupValidationResult>();
  const [actionMessage, setActionMessage] = useState("");

  async function handleRefreshInspection() {
    setIsLoading(true);
    setActionMessage("");

    const nextInspection = await inspectStoryData(storyId);

    setInspection(nextInspection);
    setIsLoading(false);
  }

  async function handleCopyDiagnosticSummary() {
    if (!inspection) return;

    const summary = JSON.stringify(inspection, null, 2);

    try {
      await navigator.clipboard.writeText(summary);
      setActionMessage("Diagnostic summary copied as JSON.");
    } catch (error) {
      console.error("Failed to copy diagnostic summary", error);
      setActionMessage("Không thể sao chép diagnostic summary.");
    }
  }

  async function handleClearSettings() {
    localStorage.removeItem(legacyFallbackKeys.settings(storyId));
    await handleRefreshInspection();
    setActionMessage("Đã xóa key story settings.");
  }

  async function handleMigrateLegacyData() {
    if (!inspection || isMigratingLegacyData) return;

    setIsMigratingLegacyData(true);
    setActionMessage("");

    const localStory = localStoryForId(
      storyId,
      inspection.legacyFallback.stories.value,
    );
    const storyToMigrate = inspection.indexedDb.story ?? localStory;
    const setupToMigrate = legacyStorySetupToIndexedDbSetup(
      storyId,
      inspection.legacyFallback.storySetup.value,
    );

    const hasLegacyData =
      Boolean(localStory) ||
      Boolean(setupToMigrate) ||
      Boolean(inspection.legacyFallback.chapters.value?.length) ||
      Boolean(inspection.legacyFallback.chunks.value?.length) ||
      Boolean(inspection.legacyFallback.analysisStatus.value) ||
      Boolean(inspection.legacyFallback.analysisResult.value) ||
      Boolean(inspection.legacyFallback.branches.value?.length) ||
      Boolean(inspection.legacyFallback.branchChanges.value?.length) ||
      Boolean(inspection.legacyFallback.continuityIssues.value?.length) ||
      Boolean(inspection.legacyFallback.rewriteDrafts.value?.length);

    if (!hasLegacyData) {
      setActionMessage("Không tìm thấy legacy story data cho story này.");
      setIsMigratingLegacyData(false);
      return;
    }

    try {
      await saveLegacyStoryMigrationData({
        story: storyToMigrate,
        setup: setupToMigrate,
        chapters: inspection.legacyFallback.chapters.value ?? [],
        chunks: inspection.legacyFallback.chunks.value ?? [],
        analysisStatus:
          inspection.legacyFallback.analysisStatus.value ?? undefined,
        analysisResult:
          inspection.legacyFallback.analysisResult.value ?? undefined,
        branches: inspection.legacyFallback.branches.value ?? [],
        branchChanges: inspection.legacyFallback.branchChanges.value ?? [],
        continuityIssues:
          inspection.legacyFallback.continuityIssues.value ?? [],
        rewriteDrafts: inspection.legacyFallback.rewriteDrafts.value ?? [],
      });

      clearLegacyStoryDataKeys(storyId);
      await handleRefreshInspection();
      setActionMessage("Đã migrate legacy story data sang IndexedDB và dọn key cũ.");
    } catch (error) {
      console.error("Failed to migrate legacy story data", error);
      setActionMessage("Failed to migrate legacy story data.");
    } finally {
      setIsMigratingLegacyData(false);
    }
  }

  async function handleClearAiCache() {
    setIsClearingAiCache(true);
    setActionMessage("");

    try {
      const cacheStore = new IndexedDbJobCacheStore();
      await cacheStore.clearByStory(storyId);
      await handleRefreshInspection();
      setActionMessage("AI job cache entries cleared for this story.");
    } catch (error) {
      console.error("Failed to clear AI job cache entries", error);
      setActionMessage("Failed to clear AI job cache entries.");
    } finally {
      setIsClearingAiCache(false);
    }
  }

  async function handleExportStoryBackup() {
    setIsExportingStoryBackup(true);
    setActionMessage("");

    try {
      const payload = await createStoryBackupPayload(storyId);
      const fileName = downloadStoryBackup(payload);

      setActionMessage(`Đã export story backup: ${fileName}`);
    } catch (error) {
      console.error("Failed to export story backup", error);
      setActionMessage("Failed to export story backup.");
    } finally {
      setIsExportingStoryBackup(false);
    }
  }

  function canRestoreValidatedBackup() {
    return (
      backupValidationResult?.isValid === true &&
      backupValidationResult.payload?.manifest.storyId === storyId
    );
  }

  async function handleValidateStoryBackupFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsValidatingStoryBackup(true);
    setActionMessage("");
    setBackupValidationResult(undefined);

    try {
      const result = await readStoryBackupFile(file, storyId);

      setBackupValidationResult(result);
      setActionMessage(
        result.isValid
          ? "File story backup hợp lệ."
          : "File story backup có lỗi validation.",
      );
    } catch (error) {
      console.error("Failed to validate story backup", error);
      setActionMessage("Failed to validate story backup.");
    } finally {
      setIsValidatingStoryBackup(false);
      event.target.value = "";
    }
  }

  async function handleRestoreValidatedStoryBackup() {
    const payload = backupValidationResult?.payload;

    if (!payload) {
      setActionMessage("Chưa chọn story backup hợp lệ.");
      return;
    }

    if (payload.manifest.storyId !== storyId) {
      setActionMessage(
        "Backup storyId không khớp story hiện tại. Đã chặn restore.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Restore backup này vào story hiện tại? Hành động sẽ ghi đè dữ liệu IndexedDB local hiện tại của story này.",
    );

    if (!confirmed) return;

    setIsRestoringStoryBackup(true);
    setActionMessage("");

    try {
      const summary = await restoreStoryBackupPayload(payload, storyId);

      await handleRefreshInspection();

      setActionMessage(
        `Story backup restored. Chapters: ${summary.counts.chapters.toLocaleString(
          "vi-VN",
        )}, chunks: ${summary.counts.chunks.toLocaleString("vi-VN")}.`,
      );
    } catch (error) {
      console.error("Failed to restore story backup", error);
      setActionMessage(
        error instanceof Error
          ? `Failed to restore story backup: ${error.message}`
          : "Failed to restore story backup.",
      );
    } finally {
      setIsRestoringStoryBackup(false);
    }
  }

  const localStory = localStoryForId(
    storyId,
    inspection?.legacyFallback.stories.value ?? null,
  );
  const story =
    inspection?.indexedDb.story ??
    localStory ??
    stories.find((item) => item.id === storyId);
  const overallHealth = getOverallHealth(inspection);

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Nâng cao"
          title="Backup & khôi phục"
          description="Kiểm tra tình trạng dữ liệu truyện, export backup và khôi phục khi cần."
          action={
            <>
              <Button
                disabled={isLoading}
                type="button"
                variant="outline"
                onClick={handleRefreshInspection}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Làm mới
              </Button>
              <Button
                disabled={!inspection}
                type="button"
                onClick={handleCopyDiagnosticSummary}
              >
                <Clipboard className="mr-2 h-4 w-4" />
                Copy JSON
              </Button>
            </>
          }
        />

        <SectionCard title="Dành cho nâng cao">
          <div className="space-y-2">
            <DataHealthHint>
              Trang này dành cho kiểm tra backup/khôi phục và dữ liệu cũ.
            </DataHealthHint>
            <DataHealthHint>
              Nếu bạn chỉ đọc và rewrite, có thể bỏ qua trang này.
            </DataHealthHint>
          </div>
        </SectionCard>

        {!inspection ? (
          <EmptyState
            title="Chưa load inspection."
            description="Refresh inspection để đọc dữ liệu IndexedDB và legacy fallback cho tiểu thuyết này."
            action={
              <Button type="button" onClick={handleRefreshInspection}>
                <Database className="mr-2 h-4 w-4" />
                Kiểm tra dữ liệu tiểu thuyết
              </Button>
            }
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <StatCard
                icon={<Database className="h-4 w-4" />}
                title="Tổng thể health"
                value={overallHealth}
              />
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                title="Chương"
                value={inspection.indexedDb.chapters.length}
                description={`${inspection.legacyFallback.chapters.value?.length ?? 0} trong legacy fallback`}
              />
              <StatCard
                icon={<GitBranchIcon />}
                title="Branch change"
                value={inspection.indexedDb.branchChanges.length}
                description={`${inspection.legacyFallback.branchChanges.value?.length ?? 0} trong legacy fallback`}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Cảnh báo"
                value={inspection.warnings.length}
              />
              <StatCard
                icon={<Database className="h-4 w-4" />}
                title="AI job"
                value={inspection.indexedDb.aiJobs.length}
                description={`${inspection.indexedDb.aiJobTasks.length} task`}
              />
              <StatCard
                icon={<Database className="h-4 w-4" />}
                title="AI cache"
                value={inspection.indexedDb.aiJobCacheEntries.length}
                description="cached task output"
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
              <div className="space-y-4">
                <SectionCard title="Storage overview">
                  <div className="grid gap-3 md:grid-cols-2">
                    <HealthRow
                      label="IndexedDB"
                      state={inspection.indexedDbError ? "error" : "healthy"}
                      value={
                        inspection.indexedDbError ?? "Có thể đọc cho trình duyệt này"
                      }
                    />
                    <HealthRow
                      label="Legacy fallback"
                      state="healthy"
                      value="Có thể đọc cho trình duyệt này"
                    />
                    <HealthRow
                      label="Inspected at"
                      state="healthy"
                      value={new Date(inspection.inspectedAt).toLocaleString("vi-VN")}
                    />
                    <HealthRow
                      label="Story id"
                      state="healthy"
                      value={storyId}
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Tình trạng bản ghi story">
                  <div className="grid gap-3 md:grid-cols-2">
                    <HealthRow
                      label="Bản ghi story"
                      state={getStateForRecord(
                        Boolean(inspection.indexedDb.story),
                        Boolean(localStory),
                      )}
                      value={story?.title ?? "Không có story record"}
                    />
                    <HealthRow
                      label="Trạng thái settings"
                      state={inspection.legacyFallback.settings.status}
                      value={
                        inspection.legacyFallback.settings.exists
                          ? "Có settings key"
                          : "Thiếu settings"
                      }
                    />
                    <HealthRow
                      label="Analysis result"
                      state={getStateForRecord(
                        Boolean(inspection.indexedDb.analysisResult),
                        Boolean(inspection.legacyFallback.analysisResult.value),
                      )}
                      value={
                        inspection.indexedDb.analysisResult
                          ? "IndexedDB analysis found"
                          : "Không có IndexedDB analysis"
                      }
                    />
                    <HealthRow
                      label="Analysis status"
                      state={getStateForRecord(
                        Boolean(inspection.indexedDb.analysisStatus),
                        Boolean(inspection.legacyFallback.analysisStatus.value),
                      )}
                      value={
                        inspection.indexedDb.analysisStatus
                          ? `${inspection.indexedDb.analysisStatus.analyzedChapters}/${inspection.indexedDb.analysisStatus.totalChapters} analyzed`
                          : "Không có analysis status"
                      }
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Counts">
                  <div className="grid gap-3 md:grid-cols-2">
                    <HealthRow
                      label="Chapters count"
                      state={getCountState(
                        inspection.indexedDb.chapters.length,
                        inspection.legacyFallback.chapters.value?.length ?? 0,
                      )}
                      value={`${inspection.indexedDb.chapters.length} IndexedDB / ${inspection.legacyFallback.chapters.value?.length ?? 0} legacy`}
                    />
                    <HealthRow
                      label="Chunks count"
                      state={getCountState(
                        inspection.indexedDb.chunks.length,
                        inspection.legacyFallback.chunks.value?.length ?? 0,
                      )}
                      value={`${inspection.indexedDb.chunks.length} IndexedDB / ${inspection.legacyFallback.chunks.value?.length ?? 0} legacy`}
                    />
                    <HealthRow
                      label="Branch changes count"
                      state={getCountState(
                        inspection.indexedDb.branchChanges.length,
                        inspection.legacyFallback.branchChanges.value?.length ??
                          0,
                      )}
                      value={`${inspection.indexedDb.branchChanges.length} IndexedDB / ${inspection.legacyFallback.branchChanges.value?.length ?? 0} legacy`}
                    />
                    <HealthRow
                      label="Continuity issues count"
                      state={getCountState(
                        inspection.indexedDb.continuityIssues.length,
                        inspection.legacyFallback.continuityIssues.value
                          ?.length ?? 0,
                      )}
                      value={`${inspection.indexedDb.continuityIssues.length} IndexedDB / ${inspection.legacyFallback.continuityIssues.value?.length ?? 0} legacy`}
                    />
                    <HealthRow
                      label="Rewrite drafts count"
                      state={getCountState(
                        inspection.indexedDb.rewriteDrafts.length,
                        inspection.legacyFallback.rewriteDrafts.value?.length ??
                          0,
                      )}
                      value={`${inspection.indexedDb.rewriteDrafts.length} IndexedDB / ${inspection.legacyFallback.rewriteDrafts.value?.length ?? 0} legacy`}
                    />
                    <HealthRow
                      label="Branches count"
                      state={getCountState(
                        inspection.indexedDb.branches.length,
                        inspection.legacyFallback.branches.value?.length ?? 0,
                      )}
                      value={`${inspection.indexedDb.branches.length} IndexedDB / ${inspection.legacyFallback.branches.value?.length ?? 0} legacy`}
                    />
                  </div>
                </SectionCard>

                <SectionCard title="AI job và cache state">
                  <div className="mb-3 space-y-1">
                    <DataHealthHint>
                      AI job và cache entry được sử dụng bởi Gemini Proxy batch analysis.
                    </DataHealthHint>
                    <DataHealthHint>
                      Cache hit có thể skip completed work.
                    </DataHealthHint>
                    <DataHealthHint>
                      Failed hoặc incomplete job có thể resumable từ Story Analysis Dashboard.
                    </DataHealthHint>
                    <DataHealthHint>
                      Clearing AI cache không xóa story text hoặc chapter.
                    </DataHealthHint>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <HealthRow
                      label="AI job"
                      state={getCountState(inspection.indexedDb.aiJobs.length)}
                      value={`${inspection.indexedDb.aiJobs.length} job`}
                    />
                    <HealthRow
                      label="AI job task"
                      state={getCountState(inspection.indexedDb.aiJobTasks.length)}
                      value={`${inspection.indexedDb.aiJobTasks.length} task`}
                    />
                    <HealthRow
                      label="AI cache entry"
                      state={getCountState(inspection.indexedDb.aiJobCacheEntries.length)}
                      value={`${inspection.indexedDb.aiJobCacheEntries.length} cache entry`}
                    />
                    <HealthRow
                      label="Cache hit"
                      state={getCountState(
                        inspection.indexedDb.aiJobCacheEntries.reduce(
                          (total, entry) => total + entry.hitCount,
                          0,
                        ),
                      )}
                      value={`${inspection.indexedDb.aiJobCacheEntries.reduce(
                        (total, entry) => total + entry.hitCount,
                        0,
                      )} hit`}
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Recent AI job">
                  {inspection.indexedDb.aiJobs.length > 0 ? (
                    <div className="space-y-2">
                      {inspection.indexedDb.aiJobs.slice(0, 5).map((job) => (
                        <div key={job.id} className="app-list-item">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-all font-mono text-xs">{job.id}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {job.kind} · {job.runtimeTarget} · {job.providerTarget.providerId}/{job.providerTarget.model}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Updated {new Date(job.updatedAt).toLocaleString("vi-VN")}
                              </p>
                            </div>
                            <Badge variant={getStateBadgeVariant(job.status === "failed" ? "error" : "healthy")}>
                              {job.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="app-list-item">
                      <p className="text-sm text-muted-foreground">
                        Không tìm thấy AI job cho tiểu thuyết này.
                      </p>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Legacy fallback key">
                  <div className="space-y-2">
                    {Object.values(inspection.legacyFallback).map((item) => (
                      <StorageKeyRow key={item.key} item={item} />
                    ))}
                  </div>
                </SectionCard>
              </div>

              <aside className="space-y-4">
                <SectionCard title="Cảnh báo cơ bản">
                  {inspection.warnings.length > 0 ? (
                    <div className="space-y-2">
                      {inspection.warnings.map((warning) => (
                        <div key={warning} className="app-list-item">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                            <p className="text-sm text-muted-foreground">
                              {warning}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="app-list-item">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <p className="text-sm text-muted-foreground">
                          Không phát hiện cảnh báo cơ bản.
                        </p>
                      </div>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Safe action">
                  <div className="space-y-3">
                    <Button
                      className="w-full"
                      type="button"
                      disabled={isMigratingLegacyData}
                      onClick={handleMigrateLegacyData}
                    >
                      <Database className="mr-2 h-4 w-4" />
                      {isMigratingLegacyData
                        ? "Đang migrate legacy data..."
                        : "Migrate legacy story data vào IndexedDB"}
                    </Button>
                    <p className="app-muted-text">
                      Migrate legacy story metadata/setup/data của story này
                      vào IndexedDB, rồi chỉ xóa các legacy story key đó.
                      UI settings vẫn được giữ nguyên.
                    </p>

                    <Button
                      className="w-full"
                      type="button"
                      variant="outline"
                      onClick={handleClearSettings}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear chỉ story setting
                    </Button>
                    <p className="app-muted-text">
                      This only removes{" "}
                      <span className="font-mono">
                        {legacyFallbackKeys.settings(storyId)}
                      </span>
                      . Không có nút xóa tất cả ở đây.
                    </p>

                    <Button
                      className="w-full"
                      type="button"
                      variant="outline"
                      disabled={isExportingStoryBackup}
                      onClick={handleExportStoryBackup}
                    >
                      <Database className="mr-2 h-4 w-4" />
                      {isExportingStoryBackup ? "Đang export backup..." : "Export story backup JSON"}
                    </Button>
                    <p className="app-muted-text">
                      Export tạo file JSON backup local cho story hiện tại.
                      Backup app-level settings nằm ở Global Settings; backup
                      full story content nằm tại đây.
                    </p>
                    <div className="rounded-xl border bg-background p-3">
                      <label className="block">
                        <span className="text-sm font-medium">Validate backup JSON</span>
                        <input
                          className="mt-2 block w-full text-sm"
                          type="file"
                          accept="application/json,.json"
                          disabled={isValidatingStoryBackup}
                          onChange={handleValidateStoryBackupFile}
                        />
                      </label>

                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Validate đọc file backup tại local mà không ghi dữ liệu.
                      </p>
                    </div>

                    {backupValidationResult ? (
                      <div className="rounded-xl border bg-background p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">Backup validation</p>
                          <Badge
                            variant={backupValidationResult.isValid ? "secondary" : "destructive"}
                          >
                            {backupValidationResult.isValid ? "valid" : "invalid"}
                          </Badge>
                        </div>

                        {backupValidationResult.payload ? (
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                            <p>
                              Story:{" "}
                              {backupValidationResult.payload.manifest.storyTitle ??
                                backupValidationResult.payload.manifest.storyId}
                            </p>
                            <p>
                              Exported:{" "}
                              {new Date(
                                backupValidationResult.payload.manifest.exportedAt,
                              ).toLocaleString("vi-VN")}
                            </p>
                            <p>
                              Chapters:{" "}
                              {backupValidationResult.payload.manifest.counts.chapters.toLocaleString(
                                "vi-VN",
                              )}{" "}
                              · Chunks:{" "}
                              {backupValidationResult.payload.manifest.counts.chunks.toLocaleString(
                                "vi-VN",
                              )}
                            </p>
                            <p>
                              AI jobs:{" "}
                              {backupValidationResult.payload.manifest.counts.aiJobs.toLocaleString(
                                "vi-VN",
                              )}{" "}
                              · Cache entries:{" "}
                              {backupValidationResult.payload.manifest.counts.aiJobCacheEntries.toLocaleString(
                                "vi-VN",
                              )}
                            </p>
                          </div>
                        ) : null}

                        {backupValidationResult.issues.length > 0 ? (
                          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                            {backupValidationResult.issues.map((issue, index) => (
                              <li key={`${issue.severity}-${index}`}>
                                [{issue.severity}] {issue.message}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Không phát hiện lỗi validation.
                          </p>
                        )}
                      </div>
                    ) : null}

                    {backupValidationResult?.payload ? (
                      <div className="rounded-xl border bg-background p-3">
                        <Button
                          className="w-full"
                          type="button"
                          variant="outline"
                          disabled={!canRestoreValidatedBackup() || isRestoringStoryBackup}
                          onClick={handleRestoreValidatedStoryBackup}
                        >
                          <Database className="mr-2 h-4 w-4" />
                          {isRestoringStoryBackup
                            ? "Đang restore backup..."
                            : "Restore validated backup vào tiểu thuyết này"}
                        </Button>

                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Restore được bảo vệ và chỉ cho phép khi backup
                          storyId khớp với tiểu thuyết hiện tại. Restore sẽ
                          ghi đè dữ liệu IndexedDB cục bộ cho đúng tiểu thuyết này.
                        </p>
                      </div>
                    ) : null}

                    <Button
                      className="w-full"
                      type="button"
                      variant="outline"
                      disabled={isClearingAiCache}
                      onClick={handleClearAiCache}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isClearingAiCache ? "Đang clear AI cache..." : "Clear AI cache cho tiểu thuyết này"}
                    </Button>
                    <p className="app-muted-text">
                      Clear AI cache sẽ xóa cached output của AI task cho đúng
                      story này. Nó không xóa chapters, story text hay analysis
                      đã lưu.
                    </p>
                    {actionMessage ? (
                      <p className="app-muted-text">{actionMessage}</p>
                    ) : null}
                  </div>
                </SectionCard>

                <SectionCard title="Mở story">
                  <Button asChild className="w-full" variant="outline">
                    <Link href={`/stories/${storyId}/workspace`}>
                      <BookOpen className="mr-2 h-4 w-4" />
                      Mở Workspace
                    </Link>
                  </Button>
                </SectionCard>
              </aside>
            </section>
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}

function GitBranchIcon() {
  return <Database className="h-4 w-4" />;
}

function HealthRow({
  label,
  state,
  value,
}: {
  label: string;
  state: HealthState;
  value: string | number;
}) {
  return (
    <div className="app-list-item">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {value}
          </p>
        </div>
        <Badge variant={getStateBadgeVariant(state)}>{state}</Badge>
      </div>
    </div>
  );
}

function StorageKeyRow<T>({ item }: { item: ParsedLegacyFallbackValue<T> }) {
  return (
    <div className="app-list-item">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-xs">{item.key}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.exists
              ? `${getStorageValueCount(item.value)} item(s)`
              : "Thiếu"}
            {item.error ? ` / ${item.error}` : ""}
          </p>
        </div>
        <Badge variant={getStateBadgeVariant(item.status)}>{item.status}</Badge>
      </div>
    </div>
  );
}

function DataHealthHint({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>;
}
