"use client";

import Link from "next/link";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BarChart3,
  BookOpen,
  Boxes,
  CalendarDays,
  Database,
  MapPin,
  PenLine,
  Play,
  ScrollText,
  Sparkles,
  Users,
} from "lucide-react";

import {
  getAnalysisResult,
  getAnalysisStatus,
  getChapterChunks,
  getImportedChapters,
  getStoryById,
  saveAnalysisResult,
} from "@/lib/db/indexed-db";
import { runAiPipeline } from "@/lib/ai/pipeline";
import { runLocalStoryAnalysisJob } from "@/lib/ai/jobs/local/run-local-story-analysis-job";
import { runLocalStoryAnalysisWorkerJob } from "@/lib/ai/jobs/local/worker/run-local-story-analysis-worker-job";
import { resumeLocalStoryAnalysisJob } from "@/lib/ai/jobs/local/resume-local-story-analysis-job";
import { runResumeLocalStoryAnalysisWorkerJob } from "@/lib/ai/jobs/local/worker/run-local-story-analysis-worker-job";
import { getLatestResumableStoryAnalysisJob } from "@/lib/ai/jobs/local/resumable-story-analysis-jobs";
import type { ResumableStoryAnalysisJobSummary } from "@/lib/ai/jobs/local/resumable-story-analysis-jobs";
import type { LocalStoryAnalysisWorkerProgressSnapshot } from "@/lib/ai/jobs/local/worker/local-story-analysis-worker-types";
import { getPublicRuntimeConfig } from "@/lib/runtime/runtime-config";
import type { AiPipelineResult } from "@/lib/ai/types";
import {
  getActiveRuntimeEndpoint,
  getActiveRuntimeModel,
  getAiRuntimeProviderLabel,
  getAiRuntimeSettings,
  type AiRuntimeSettings,
} from "@/lib/settings/ai-runtime-settings";
import type {
  AnalysisStatus,
  ChapterChunk,
  ExtractedEntity,
  ImportedChapter,
  Story,
  StoryAnalysisResult,
  StoryEvent,
  WritingStyleProfile,
} from "@/lib/types";
import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { AnimatedStatusCard } from "@/components/app/animated-status-card";
import { ProgressMeter } from "@/components/app/progress-meter";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AiSetupBlockingCard } from "@/components/settings/ai-setup-blocking-card";
import { getAiSetupReadiness, type AiSetupReadiness } from "@/lib/settings/ai-setup-readiness";

interface StoryAnalysisClientProps {
  storyId: string;
}

interface AnalysisDashboardData {
  story?: Story;
  chapters: ImportedChapter[];
  chunks: ChapterChunk[];
  analysisStatus?: AnalysisStatus;
  analysisResult?: StoryAnalysisResult;
}

interface LocalAnalysisJobState {
  jobId: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  skippedTasks: number;
  failedTasks: number;
  percentComplete: number;
  message?: string;
}

type WorkflowStep =
  | "import"
  | "scout"
  | "deep"
  | "canon-pack"
  | "bible";

type ScoutCoverageFilter =
  | "all"
  | "missing-scout"
  | "missing-digest"
  | "missing-deep"
  | "fallback"
  | "error";

async function readIndexedDbDashboardData(storyId: string) {
  const [story, chapters, chunks, analysisStatus, analysisResult] =
    await Promise.all([
      getStoryById(storyId),
      getImportedChapters(storyId),
      getChapterChunks(storyId),
      getAnalysisStatus(storyId),
      getAnalysisResult(storyId),
    ]);

  return {
    story,
    chapters,
    chunks,
    analysisStatus,
    analysisResult,
  };
}

function formatRuntimeValue(value: string) {
  return value || "chưa cấu hình";
}

function shortenJobId(jobId: string) {
  if (jobId.length <= 36) return jobId;

  return `${jobId.slice(0, 18)}...${jobId.slice(-12)}`;
}

function formatJobProgressValue(state?: LocalAnalysisJobState) {
  if (!state) return "đang chờ";

  return `${state.completedTasks}/${state.totalTasks}`;
}

function formatJobProgressDescription(state?: LocalAnalysisJobState) {
  if (!state) return "Chưa có local job nào bắt đầu.";

  return `${state.skippedTasks} bỏ qua/cache hit · ${state.failedTasks} lỗi`;
}

function toLocalJobState(
  snapshot: LocalStoryAnalysisWorkerProgressSnapshot,
): LocalAnalysisJobState {
  return {
    jobId: snapshot.jobId,
    status: snapshot.status,
    totalTasks: snapshot.totalTasks,
    completedTasks: snapshot.completedTasks,
    skippedTasks: snapshot.skippedTasks,
    failedTasks: snapshot.failedTasks,
    percentComplete: snapshot.percentComplete,
    message: snapshot.message,
  };
}

export function StoryAnalysisClient({ storyId }: StoryAnalysisClientProps) {
  const [dashboardData, setDashboardData] = useState<AnalysisDashboardData>({
    chapters: [],
    chunks: [],
  });
  const [runtimeSettings, setRuntimeSettings] =
    useState<AiRuntimeSettings | null>(null);
  const [lastPipelineResult, setLastPipelineResult] =
    useState<AiPipelineResult>();
  const [localAggregatedResult, setLocalAggregatedResult] =
    useState<StoryAnalysisResult>();
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [isSavingAnalysis, setIsSavingAnalysis] = useState(false);
  const [localJobState, setLocalJobState] = useState<LocalAnalysisJobState>();
  const [jobRuntimeNote, setJobRuntimeNote] = useState("");
  const [isLocalJobRunning, setIsLocalJobRunning] = useState(false);
  const [latestResumableJob, setLatestResumableJob] =
    useState<ResumableStoryAnalysisJobSummary | null>(null);
  const [isLoadingResumableJob, setIsLoadingResumableJob] = useState(false);
  const [isResumingBatch, setIsResumingBatch] = useState(false);
  const [scoutSearch, setScoutSearch] = useState("");
  const [scoutFilter, setScoutFilter] = useState<ScoutCoverageFilter>("all");
  const [deepPreset, setDeepPreset] = useState("ai-auto");
  const [deepFromChapter, setDeepFromChapter] = useState("");
  const [deepToChapter, setDeepToChapter] = useState("");
  const [deepCharacter, setDeepCharacter] = useState("");
  const [setupReadiness, setSetupReadiness] = useState<AiSetupReadiness>();
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const analysisAbortControllerRef = useRef<AbortController | null>(null);
  const runtimeConfig = useMemo(() => getPublicRuntimeConfig(), []);

  useEffect(() => {
    let active = true;

    async function loadReadiness() {
      try {
        const readiness = await getAiSetupReadiness();
        if (!active) return;
        setSetupReadiness(readiness);
      } catch (error) {
        console.error("Failed to load AI setup readiness", error);
      } finally {
        if (active) {
          setIsCheckingSetup(false);
        }
      }
    }

    void loadReadiness();

    return () => {
      active = false;
    };
  }, []);

  async function refreshLatestResumableJob() {
    setIsLoadingResumableJob(true);

    try {
      const resumable = await getLatestResumableStoryAnalysisJob(storyId);
      setLatestResumableJob(resumable?.canResume ? resumable : null);
    } catch (error) {
      console.error("Failed to refresh resumable job for story", error);
      setLatestResumableJob(null);
    } finally {
      setIsLoadingResumableJob(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadDashboardData() {
      let indexedDbData: AnalysisDashboardData = {
        chapters: [],
        chunks: [],
      };
      let indexedDbFailed = false;

      try {
        const [data, settings] = await Promise.all([
          readIndexedDbDashboardData(storyId),
          getAiRuntimeSettings(),
        ]);

        indexedDbData = data;

        if (isActive) {
          setRuntimeSettings(settings);
        }
      } catch (error) {
        indexedDbFailed = true;
        console.error(
          "Failed to read analysis dashboard data from IndexedDB",
          error,
        );
      }

      if (!isActive) return;

      setDashboardData(indexedDbData);
      setStorageError(
        indexedDbFailed
          ? "Đọc IndexedDB thất bại. Dữ liệu truyện có thể không khả dụng."
          : "",
      );
      setIsLoading(false);
    }

    void loadDashboardData();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  useEffect(() => {
    let isActive = true;

    async function loadResumableJob() {
      try {
        const resumable = await getLatestResumableStoryAnalysisJob(storyId);
        if (!isActive) return;
        setLatestResumableJob(resumable?.canResume ? resumable : null);
      } catch (error) {
        console.error("Failed to load resumable job for story", error);
        if (isActive) {
          setLatestResumableJob(null);
        }
      } finally {
        if (isActive) {
          setIsLoadingResumableJob(false);
        }
      }
    }

    void loadResumableJob();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  const { story, chapters, chunks, analysisStatus, analysisResult } =
    dashboardData;

  const totalWordCount = useMemo(() => {
    return chapters.reduce((total, chapter) => total + chapter.wordCount, 0);
  }, [chapters]);

  const chunkCountsByChapterId = useMemo(() => {
    return chunks.reduce<Record<string, number>>((counts, chunk) => {
      counts[chunk.chapterId] = (counts[chunk.chapterId] ?? 0) + 1;

      return counts;
    }, {});
  }, [chunks]);

  const totalChapters = analysisStatus?.totalChapters ?? chapters.length;
  const parsedChapters = analysisStatus?.parsedChapters ?? chapters.length;
  const analyzedChapters = analysisStatus?.analyzedChapters ?? 0;
  const totalChunks = analysisStatus?.totalChunks ?? chunks.length;
  const analysisProgress =
    totalChapters > 0
      ? Math.round((analyzedChapters / totalChapters) * 100)
      : 0;
  const chunkProgress = chunks.length > 0 ? 100 : 0;
  const hasDashboardData = Boolean(story) || chapters.length > 0;
  const hasImportedData = chapters.length > 0;
  const runtimeProviderLabel = runtimeSettings
    ? getAiRuntimeProviderLabel(runtimeSettings.providerId)
    : "Đang tải";
  const runtimeModel = runtimeSettings
    ? getActiveRuntimeModel(runtimeSettings)
    : "Đang tải";
  const runtimeEndpoint = runtimeSettings
    ? getActiveRuntimeEndpoint(runtimeSettings)
    : "Đang tải";
  const activeJobRuntime =
    runtimeSettings?.jobRuntime ?? runtimeConfig.jobRuntime;
  const canUseLocalAggregatedAnalysis =
    runtimeSettings?.providerId === "mock" ||
    runtimeSettings?.providerId === "gemini-proxy";
  const isAnalysisRunning = isSavingAnalysis || isLocalJobRunning;

  const scoutCoveragePercent = totalChapters
    ? Math.round((parsedChapters / totalChapters) * 100)
    : 0;
  const deepCoveragePercent = totalChapters
    ? Math.round((analyzedChapters / totalChapters) * 100)
    : 0;
  const canonReadinessPercent = Math.min(
    100,
    Math.round(scoutCoveragePercent * 0.4 + deepCoveragePercent * 0.6),
  );
  const canonReadinessLevel =
    canonReadinessPercent >= 80
      ? "Sẵn sàng"
      : canonReadinessPercent >= 50
        ? "Đang hoàn thiện"
        : "Chưa sẵn sàng";

  const selectedDeepChapterNumbers = useMemo(() => {
    const numbers = chapters.map((chapter) => chapter.chapterNumber);
    if (!numbers.length) return [];

    const minChapter = Math.min(...numbers);
    const maxChapter = Math.max(...numbers);
    const from = Number(deepFromChapter);
    const to = Number(deepToChapter);
    const fromValue = Number.isFinite(from) ? from : minChapter;
    const toValue = Number.isFinite(to) ? to : maxChapter;

    return numbers.filter(
      (number) =>
        number >= Math.min(fromValue, toValue) &&
        number <= Math.max(fromValue, toValue),
    );
  }, [chapters, deepFromChapter, deepToChapter]);

  const selectedDeepChapterCount = selectedDeepChapterNumbers.length;
  const deepTargetCoverage = totalChapters
    ? Math.round((selectedDeepChapterCount / totalChapters) * 100)
    : 0;
  const estimatedTokens = selectedDeepChapterCount * 3200;
  const estimatedRequests = Math.max(1, Math.ceil(selectedDeepChapterCount / 5));

  const currentWorkflowStep: WorkflowStep = !hasImportedData
    ? "import"
    : parsedChapters === 0
      ? "scout"
      : analyzedChapters === 0
        ? "deep"
        : canonReadinessPercent < 80
          ? "canon-pack"
          : "bible";

  const nextActionLabel =
    currentWorkflowStep === "import"
      ? "Upload file truyện"
      : currentWorkflowStep === "scout"
        ? "Quét nhanh"
        : currentWorkflowStep === "deep"
          ? "Tạo bản đồ arc / Chọn phân tích sâu"
          : currentWorkflowStep === "canon-pack"
            ? "Dựng Canon Pack"
            : currentWorkflowStep === "bible"
              ? "Đưa vào Story Bible"
              : "Mở editor / Viết truyện";

  const scoutRows = useMemo(() => {
    return chapters.map((chapter) => {
      const chunkCount = chunkCountsByChapterId[chapter.id] ?? 0;
      const isDeep = chapter.status === "analyzed" || chunkCount >= 5;
      const isDigest = chunkCount >= 2;
      const isFallback = chunkCount === 0;
      const isError = chapter.status === "failed";

      const badges: string[] = [];
      if (isDeep) {
        badges.push("Nạp sâu - Cao");
      } else if (isDigest) {
        badges.push("Nạp nhẹ - Vừa");
      }
      if (!isDigest) badges.push("Thiếu digest");
      if (!isDeep) badges.push("Thiếu deep");
      if (isFallback) badges.push("Fallback");
      if (isError) badges.push("Lỗi");

      return {
        chapter,
        chunkCount,
        isDeep,
        isDigest,
        isFallback,
        isError,
        badges,
      };
    });
  }, [chapters, chunkCountsByChapterId]);

  const filteredScoutRows = useMemo(() => {
    const keyword = scoutSearch.trim().toLowerCase();

    return scoutRows.filter((row) => {
      const matchSearch =
        !keyword ||
        String(row.chapter.chapterNumber).includes(keyword) ||
        row.chapter.title.toLowerCase().includes(keyword);
      if (!matchSearch) return false;

      if (scoutFilter === "all") return true;
      if (scoutFilter === "missing-scout") return row.chunkCount === 0;
      if (scoutFilter === "missing-digest") return !row.isDigest;
      if (scoutFilter === "missing-deep") return !row.isDeep;
      if (scoutFilter === "fallback") return row.isFallback;
      if (scoutFilter === "error") return row.isError;

      return true;
    });
  }, [scoutRows, scoutSearch, scoutFilter]);

  const scoutResultCards = useMemo(() => {
    return filteredScoutRows.slice(0, 6).map((row) => ({
      chapterNumber: row.chapter.chapterNumber,
      title: row.chapter.title,
      decision: row.isDeep ? "Nạp sâu" : row.isDigest ? "Nạp nhẹ" : "Bỏ qua",
      reason: row.isDeep
        ? "Nhiều tín hiệu nhân vật/sự kiện đáng theo dõi."
        : row.isDigest
          ? "Có thông tin bối cảnh, nên nạp ở mức vừa."
          : "Ít tín hiệu nổi bật ở lượt quét nhanh.",
      tags: row.badges.slice(0, 3),
    }));
  }, [filteredScoutRows]);

  function createAnalysisAbortController() {
    analysisAbortControllerRef.current?.abort();

    const controller = new AbortController();
    analysisAbortControllerRef.current = controller;

    return controller;
  }

  function clearAnalysisAbortController(controller: AbortController) {
    if (analysisAbortControllerRef.current === controller) {
      analysisAbortControllerRef.current = null;
    }
  }

  function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError";
  }

  function handleCancelAnalysisJob() {
    analysisAbortControllerRef.current?.abort();
    analysisAbortControllerRef.current = null;
    setIsLocalJobRunning(false);
    setIsSavingAnalysis(false);
    setLocalJobState((current) =>
      current
        ? {
            ...current,
            status: "cancelled",
            message: "Local analysis job was cancelled.",
          }
        : current,
    );
  }

  async function handleStartAnalysis() {
    if (isSavingAnalysis) return;

    setIsSavingAnalysis(true);
    setStorageError("");
    setLastPipelineResult(undefined);
    setLocalAggregatedResult(undefined);
    setJobRuntimeNote("");
    setLocalJobState(undefined);
    let localAnalysisResult: StoryAnalysisResult | undefined;
    const controller = createAnalysisAbortController();
    setIsLocalJobRunning(
      activeJobRuntime === "local-browser" ||
        activeJobRuntime === "local-worker",
    );

    if (activeJobRuntime === "local-browser") {
      try {
        const localJobResult = await runLocalStoryAnalysisJob({
          storyId,
          story,
          chapters,
          chunks,
          runtimeSettings: runtimeSettings ?? undefined,
          signal: controller.signal,
          onProgress: (progress, tasks) => {
            const jobId = tasks[0]?.jobId ?? localJobState?.jobId ?? "";

            setLocalJobState({
              jobId,
              status: "running",
              totalTasks: progress.totalTasks,
              completedTasks: progress.completedTasks,
              skippedTasks: progress.skippedTasks,
              failedTasks: progress.failedTasks,
              percentComplete: progress.percentComplete,
              message: progress.message,
            });
          },
        });

        if (localJobResult.runnerResult.cancelled) {
          setLocalJobState({
            jobId: localJobResult.job.id,
            status: "cancelled",
            totalTasks: localJobResult.progress.totalTasks,
            completedTasks: localJobResult.completedTasks,
            skippedTasks: localJobResult.skippedTasks,
            failedTasks: localJobResult.failedTasks,
            percentComplete: localJobResult.progress.percentComplete,
            message: "Local analysis job was cancelled.",
          });
          clearAnalysisAbortController(controller);
          setIsLocalJobRunning(false);
          setIsSavingAnalysis(false);
          return;
        }

        if (localJobResult.hasFailedTasks) {
          setLocalJobState({
            jobId: localJobResult.job.id,
            status: localJobResult.job.status,
            totalTasks: localJobResult.progress.totalTasks,
            completedTasks: localJobResult.completedTasks,
            skippedTasks: localJobResult.skippedTasks,
            failedTasks: localJobResult.failedTasks,
            percentComplete: localJobResult.progress.percentComplete,
            message: "Local batch analysis finished with failed task(s).",
          });
          clearAnalysisAbortController(controller);
          setIsLocalJobRunning(false);
          setStorageError(
            `Local batch analysis failed: ${localJobResult.failedTasks} failed, ${localJobResult.completedTasks} completed, ${localJobResult.skippedTasks} skipped. No partial analysis was saved.`,
          );
          await refreshLatestResumableJob();
          setIsSavingAnalysis(false);
          return;
        }

        if (!localJobResult.canSaveAggregatedResult) {
          setLocalJobState({
            jobId: localJobResult.job.id,
            status: localJobResult.job.status,
            totalTasks: localJobResult.progress.totalTasks,
            completedTasks: localJobResult.completedTasks,
            skippedTasks: localJobResult.skippedTasks,
            failedTasks: localJobResult.failedTasks,
            percentComplete: localJobResult.progress.percentComplete,
            message:
              "Local batch analysis did not complete all tasks. No partial analysis was saved.",
          });
          clearAnalysisAbortController(controller);
          setIsLocalJobRunning(false);
          setStorageError(
            "Local batch analysis did not complete all tasks. No partial analysis was saved.",
          );
          await refreshLatestResumableJob();
          setIsSavingAnalysis(false);
          return;
        }

        setLocalJobState({
          jobId: localJobResult.job.id,
          status: localJobResult.job.status,
          totalTasks: localJobResult.progress.totalTasks,
          completedTasks: localJobResult.completedTasks,
          skippedTasks: localJobResult.skippedTasks,
          failedTasks: localJobResult.failedTasks,
          percentComplete: localJobResult.progress.percentComplete,
          message: localJobResult.progress.message,
        });
        localAnalysisResult = localJobResult.analysisResult;
        setLocalAggregatedResult(localAnalysisResult);
      } catch (error) {
        if (isAbortError(error)) {
          clearAnalysisAbortController(controller);
          setIsLocalJobRunning(false);
          setStorageError("");
          setIsSavingAnalysis(false);
          return;
        }

        console.error("Failed to run local story analysis job", error);
        setStorageError(
          error instanceof Error
            ? `Local job orchestration failed: ${error.message}`
            : "Local job orchestration failed.",
        );
        await refreshLatestResumableJob();
        clearAnalysisAbortController(controller);
        setIsLocalJobRunning(false);
        setIsSavingAnalysis(false);
        return;
      }
    } else if (activeJobRuntime === "local-worker") {
      try {
        const workerResult = await runLocalStoryAnalysisWorkerJob(
          {
            storyId,
            story,
            chapters,
            chunks,
            runtimeSettings: runtimeSettings ?? undefined,
          },
          {
            signal: controller.signal,
            onProgress: (snapshot) => {
              setLocalJobState(toLocalJobState(snapshot));
            },
          },
        );

        setLocalJobState(toLocalJobState(workerResult.summary));

        if (workerResult.summary.status === "cancelled") {
          clearAnalysisAbortController(controller);
          setIsLocalJobRunning(false);
          setIsSavingAnalysis(false);
          return;
        }

        if (
          workerResult.summary.hasFailedTasks ||
          workerResult.summary.failedTasks > 0
        ) {
          setStorageError(
            `Local worker batch analysis failed: ${workerResult.summary.failedTasks} failed, ${workerResult.summary.completedTasks} completed, ${workerResult.summary.skippedTasks} skipped. No partial analysis was saved.`,
          );
          clearAnalysisAbortController(controller);
          setIsLocalJobRunning(false);
          await refreshLatestResumableJob();
          setIsSavingAnalysis(false);
          return;
        }

        if (!workerResult.summary.canSaveAggregatedResult) {
          setStorageError(
            "Local worker batch analysis did not complete all tasks. No partial analysis was saved.",
          );
          clearAnalysisAbortController(controller);
          setIsLocalJobRunning(false);
          await refreshLatestResumableJob();
          setIsSavingAnalysis(false);
          return;
        }

        localAnalysisResult = workerResult.analysisResult;
        setLocalAggregatedResult(localAnalysisResult);
      } catch (error) {
        if (isAbortError(error)) {
          clearAnalysisAbortController(controller);
          setIsLocalJobRunning(false);
          setStorageError("");
          setIsSavingAnalysis(false);
          return;
        }

        console.error("Failed to run local worker story analysis job", error);
        setStorageError(
          error instanceof Error
            ? `Local worker job orchestration failed: ${error.message}`
            : "Local worker job orchestration failed.",
        );
        await refreshLatestResumableJob();
        clearAnalysisAbortController(controller);
        setIsLocalJobRunning(false);
        setIsSavingAnalysis(false);
        return;
      }
    } else if (activeJobRuntime === "cloud-queue") {
      setJobRuntimeNote(
        "Job runtime cloud-queue is not wired yet. Falling back to direct analysis pipeline.",
      );
    }

    clearAnalysisAbortController(controller);
    setIsLocalJobRunning(false);
    const usedLocalBatchRuntime =
      activeJobRuntime === "local-browser" ||
      activeJobRuntime === "local-worker";
    let effectivePipelineResult: AiPipelineResult;

    if (canUseLocalAggregatedAnalysis && usedLocalBatchRuntime) {
      if (!runtimeSettings || !localAnalysisResult) {
        setStorageError(
          "Local batch analysis did not return an aggregated analysis result. No partial analysis was saved.",
        );
        await refreshLatestResumableJob();
        setIsSavingAnalysis(false);
        return;
      }

      effectivePipelineResult = {
        providerId: runtimeSettings.providerId,
        providerLabel: runtimeProviderLabel,
        status: "completed",
        analysisResult: localAnalysisResult,
        steps: [
          {
            status: "completed",
            currentStep: "complete",
            message:
              runtimeSettings.providerId === "gemini-proxy"
                ? "Gemini Proxy batch analysis completed through local jobs."
                : "Mock batch analysis completed through local jobs.",
            completedSteps: ["complete"],
            totalSteps: 1,
          },
        ],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        runtime: {
          settings: runtimeSettings,
          providerId: runtimeSettings.providerId,
          providerLabel: runtimeProviderLabel,
          endpoint: runtimeEndpoint,
          model: runtimeModel,
          temperature: runtimeSettings.temperature,
          maxOutputTokens: runtimeSettings.maxOutputTokens,
        },
      };
    } else {
      effectivePipelineResult = await runAiPipeline({
        storyId,
        story,
        chapters,
        chunks,
      });
    }

    setLastPipelineResult(effectivePipelineResult);

    if (
      effectivePipelineResult.status !== "completed" ||
      !effectivePipelineResult.analysisResult
    ) {
      setStorageError(
        effectivePipelineResult.errorMessage ??
          `${effectivePipelineResult.providerLabel} did not return an analysis result.`,
      );
      await refreshLatestResumableJob();
      setIsSavingAnalysis(false);
      return;
    }

    const result = effectivePipelineResult.analysisResult;
    const now = new Date().toISOString();
    const chunkedChapterCount = new Set(chunks.map((chunk) => chunk.chapterId))
      .size;

    const updatedStatus: AnalysisStatus = {
      storyId,
      totalChapters: chapters.length,
      parsedChapters: chapters.length,
      chunkedChapters: chunkedChapterCount,
      analyzedChapters: chapters.length,
      totalChunks: chunks.length,
      createdAt: analysisStatus?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await saveAnalysisResult(storyId, result, updatedStatus);
    } catch (error) {
      console.error("Failed to save analysis to IndexedDB", error);
      setStorageError("Could not save analysis to IndexedDB.");
      setIsSavingAnalysis(false);
      return;
    }

    setDashboardData((current) => ({
      ...current,
      analysisResult: result,
      analysisStatus: updatedStatus,
    }));
    setIsSavingAnalysis(false);
  }

  async function handleResumeFailedBatch() {
    if (!chapters || chapters.length === 0 || !runtimeSettings) {
      setStorageError("Cannot resume: missing story data or runtime settings.");
      return;
    }

    if (isSavingAnalysis || isResumingBatch) return;

    setIsResumingBatch(true);
    setStorageError("");
    setLastPipelineResult(undefined);
    setLocalAggregatedResult(undefined);
    setJobRuntimeNote("");
    setLocalJobState(undefined);
    let localAnalysisResult: StoryAnalysisResult | undefined;
    const controller = createAnalysisAbortController();
    const isWorkerRuntime = activeJobRuntime === "local-worker";

    try {
      let localWorkerResumeResult:
        | Awaited<ReturnType<typeof runResumeLocalStoryAnalysisWorkerJob>>
        | undefined;
      let localBrowserResumeResult:
        | Awaited<ReturnType<typeof resumeLocalStoryAnalysisJob>>
        | undefined;

      if (isWorkerRuntime) {
        localWorkerResumeResult = await runResumeLocalStoryAnalysisWorkerJob(
          {
            storyId,
            jobId: latestResumableJob?.jobId,
            story,
            chapters,
            chunks,
            runtimeSettings: runtimeSettings ?? undefined,
          },
          {
            signal: controller.signal,
            onProgress: (snapshot) => {
              setLocalJobState(toLocalJobState(snapshot));
            },
          },
        );
      } else {
        localBrowserResumeResult = await resumeLocalStoryAnalysisJob({
          storyId,
          jobId: latestResumableJob?.jobId,
          story,
          chapters,
          chunks,
          runtimeSettings: runtimeSettings ?? undefined,
          signal: controller.signal,
          onProgress: (progress, tasks) => {
            const jobId = tasks[0]?.jobId ?? latestResumableJob?.jobId ?? "";

            setLocalJobState({
              jobId,
              status: "running",
              totalTasks: progress.totalTasks,
              completedTasks: progress.completedTasks,
              skippedTasks: progress.skippedTasks,
              failedTasks: progress.failedTasks,
              percentComplete: progress.percentComplete,
              message: progress.message,
            });
          },
        });
      }

      const summary =
        localWorkerResumeResult?.summary ??
        (localBrowserResumeResult
          ? {
              jobId: localBrowserResumeResult.job.id,
              status: localBrowserResumeResult.job.status,
              totalTasks: localBrowserResumeResult.progress.totalTasks,
              completedTasks: localBrowserResumeResult.completedTasks,
              skippedTasks: localBrowserResumeResult.skippedTasks,
              failedTasks: localBrowserResumeResult.failedTasks,
              percentComplete: localBrowserResumeResult.progress.percentComplete,
              message: localBrowserResumeResult.progress.message,
              hasFailedTasks: localBrowserResumeResult.hasFailedTasks,
              hasCompletedAllTasks:
                localBrowserResumeResult.hasCompletedAllTasks,
              canSaveAggregatedResult:
                localBrowserResumeResult.canSaveAggregatedResult,
            }
          : undefined);

      if (!summary) {
        throw new Error("Resume batch did not return a progress summary.");
      }

      setLocalJobState(toLocalJobState(summary));

      if (summary.hasFailedTasks || summary.failedTasks > 0) {
        setStorageError(
          `Resume batch failed: ${summary.failedTasks} failed, ${summary.completedTasks} completed, ${summary.skippedTasks} skipped. No partial analysis was saved.`,
        );
        await refreshLatestResumableJob();
        clearAnalysisAbortController(controller);
        setIsResumingBatch(false);
        return;
      }

      if (!summary.canSaveAggregatedResult) {
        setStorageError(
          "Resume batch did not complete all tasks. No partial analysis was saved.",
        );
        await refreshLatestResumableJob();
        clearAnalysisAbortController(controller);
        setIsResumingBatch(false);
        return;
      }

      localAnalysisResult =
        localWorkerResumeResult?.analysisResult ??
        localBrowserResumeResult?.analysisResult;
      setLocalAggregatedResult(localAnalysisResult);

      if (!localAnalysisResult) {
        setStorageError(
          "Resume batch did not return an aggregated analysis result. No partial analysis was saved.",
        );
        await refreshLatestResumableJob();
        clearAnalysisAbortController(controller);
        setIsResumingBatch(false);
        return;
      }

      const result = localAnalysisResult;
      const now = new Date().toISOString();
      const chunkedChapterCount = new Set(chunks.map((chunk) => chunk.chapterId))
        .size;

      const updatedStatus: AnalysisStatus = {
        storyId,
        totalChapters: chapters.length,
        parsedChapters: chapters.length,
        chunkedChapters: chunkedChapterCount,
        analyzedChapters: chapters.length,
        totalChunks: chunks.length,
        createdAt: analysisStatus?.createdAt ?? now,
        updatedAt: now,
      };

      try {
        await saveAnalysisResult(storyId, result, updatedStatus);
      } catch (error) {
        console.error("Failed to save resume analysis to IndexedDB", error);
        setStorageError("Could not save resume analysis to IndexedDB.");
        await refreshLatestResumableJob();
        clearAnalysisAbortController(controller);
        setIsResumingBatch(false);
        return;
      }

      setDashboardData((current) => ({
        ...current,
        analysisResult: result,
        analysisStatus: updatedStatus,
      }));
      setLatestResumableJob(null);
      clearAnalysisAbortController(controller);
      setIsResumingBatch(false);
    } catch (error) {
      const isAbort =
        error instanceof DOMException && error.name === "AbortError";

      if (isAbort) {
        clearAnalysisAbortController(controller);
        setIsResumingBatch(false);
        setStorageError("");
        return;
      }

      console.error("Failed to resume local story analysis job", error);
      setStorageError(
        error instanceof Error
          ? `Resume batch orchestration failed: ${error.message}`
          : "Resume batch orchestration failed.",
      );
      await refreshLatestResumableJob();
      clearAnalysisAbortController(controller);
      setIsResumingBatch(false);
    }
  }

  if (isCheckingSetup) {
    return (
      <PageShell>
        <PageContainer>
          <SectionCard title="Đang kiểm tra AI setup">
            <p className="app-muted-text">Đang tải trạng thái provider và test kết nối...</p>
          </SectionCard>
        </PageContainer>
      </PageShell>
    );
  }

  if (!setupReadiness?.canUseStoryWorkflow) {
    return (
      <PageShell>
        <PageContainer>
          <AiSetupBlockingCard readiness={setupReadiness} />
        </PageContainer>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Phân tích truyện"
          title="Phân tích truyện"
          description={`${story?.author ? `Tác giả: ${story.author}. ` : ""}Yuki đọc các chương đã nhập để tạo context nhân vật, timeline, vật phẩm, địa điểm và canon.`}
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/reader`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Đọc truyện
                </Link>
              </Button>

              <Button
                type="button"
                onClick={handleStartAnalysis}
                disabled={
                  isLoading || chapters.length === 0 || isAnalysisRunning
                }
              >
                <Play className="mr-2 h-4 w-4" />
                {isSavingAnalysis ? "Đang chạy..." : "Chạy phân tích"}
              </Button>

              {isLocalJobRunning ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelAnalysisJob}
                >
                  Hủy local job
                </Button>
              ) : null}

              {latestResumableJob &&
              !isLoadingResumableJob &&
              !isLocalJobRunning &&
              !isResumingBatch ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResumeFailedBatch}
                  disabled={
                    isLoading || chapters.length === 0 || isAnalysisRunning
                  }
                >
                  {isResumingBatch ? "Đang tiếp tục..." : "Tiếp tục batch lỗi"}
                </Button>
              ) : null}
            </>
          }
        />

        <SectionCard title="Tiến trình phân tích">
          <StoryAnalysisHint>
            Yuki đang đọc các chương đã nhập để tạo context canon cho đọc và rewrite.
          </StoryAnalysisHint>
          <div className="mt-3">
            <ProgressMeter
              value={analysisProgress}
              label="Tiến trình phân tích"
              description={`Đã phân tích ${analyzedChapters.toLocaleString("vi-VN")} / ${totalChapters.toLocaleString("vi-VN")} chương`}
            />
          </div>
        </SectionCard>

        <SectionCard title="Việc tiếp theo">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{nextActionLabel}</p>
            {currentWorkflowStep === "import" ? (
              <Button asChild size="sm">
                <Link href="/stories/import">Upload file truyện</Link>
              </Button>
            ) : currentWorkflowStep === "scout" ? (
              <Button size="sm" disabled>
                Quét nhanh (sắp có)
              </Button>
            ) : currentWorkflowStep === "deep" ? (
              <Button size="sm" disabled>
                Chọn phân tích sâu (sắp có)
              </Button>
            ) : currentWorkflowStep === "canon-pack" ? (
              <Button size="sm" disabled>
                Dựng Canon Pack (sắp có)
              </Button>
            ) : (
              <Button size="sm" disabled>
                Đưa vào Story Bible (sắp có)
              </Button>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Workflow">
          <div className="grid gap-2 md:grid-cols-5">
            {[
              { id: "import", label: "Nạp liệu" },
              { id: "scout", label: "Quét nhanh" },
              { id: "deep", label: "Phân tích sâu" },
              { id: "canon-pack", label: "Canon Pack" },
              { id: "bible", label: "Đưa vào Story Bible" },
            ].map((step) => (
              <div
                key={step.id}
                className={
                  currentWorkflowStep === step.id
                    ? "rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium"
                    : "rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground"
                }
              >
                {step.label}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Quét nhanh"
          description="Quét mẫu từng chương bằng AI để tìm chương đáng chú ý, reveal, worldbuilding, đổi quan hệ và chương nên nạp sâu."
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {[
                  ["all", "Tất cả"],
                  ["missing-scout", "Thiếu Scout"],
                  ["missing-digest", "Thiếu digest"],
                  ["missing-deep", "Thiếu deep"],
                  ["fallback", "Fallback"],
                  ["error", "Lỗi"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      scoutFilter === value ? "app-chip-primary" : "app-chip"
                    }
                    onClick={() => setScoutFilter(value as ScoutCoverageFilter)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Input
                value={scoutSearch}
                onChange={(event) => setScoutSearch(event.target.value)}
                placeholder="Tìm chương..."
              />

              <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                {filteredScoutRows.map((row) => (
                  <div key={row.chapter.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        Chương {row.chapter.chapterNumber} - {row.chapter.title}
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/stories/${storyId}/reader?chapter=${row.chapter.chapterNumber}`}>
                          Mở chương
                        </Link>
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.badges.map((badge) => (
                        <span
                          key={`${row.chapter.id}-${badge}`}
                          className={badge.includes("Nạp sâu") ? "app-chip-primary" : "app-chip"}
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border bg-background p-3">
                <p className="text-sm font-medium">AI scan panel</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mục tiêu, Bộ lọc, Tìm kết quả
                </p>
                <div className="mt-3 grid gap-2">
                  <Button size="sm" disabled>Quét chương</Button>
                  <Button size="sm" variant="outline" disabled>Quét lại tất cả</Button>
                  <Button size="sm" variant="outline" disabled>Tạm dừng</Button>
                  <Button size="sm" variant="outline" disabled>Hủy</Button>
                  <Button size="sm" variant="outline" disabled>Thử lại lỗi</Button>
                </div>
              </div>

              <div className="rounded-xl border bg-background p-3">
                <p className="text-sm font-medium">Bản đồ arc</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gom kết quả quét thành mạch truyện để chọn phần cần nạp sâu.
                </p>
                <Button className="mt-3 w-full" size="sm" variant="outline" disabled>
                  Tạo arc
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {scoutResultCards.map((result) => (
              <div key={`${result.chapterNumber}-${result.title}`} className="rounded-lg border p-3">
                <p className="text-sm font-medium">
                  Chương {result.chapterNumber} - {result.decision}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{result.reason}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.tags.map((tag) => (
                    <span key={tag} className="app-chip">{tag}</span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/stories/${storyId}/reader?chapter=${result.chapterNumber}`}>
                      Mở chương
                    </Link>
                  </Button>
                  <Button size="sm" disabled>
                    Chọn phân tích sâu
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Phân tích sâu"
          description="Chọn phần quan trọng để AI đọc kỹ, thay vì bắt tác giả lần tay qua danh sách dài."
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-sm font-medium">Preset</label>
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={deepPreset}
                    onChange={(event) => setDeepPreset(event.target.value)}
                  >
                    <option value="ai-auto">AI tự chọn phần quan trọng</option>
                    <option value="arc">Arc quan trọng</option>
                    <option value="reveal-world-rel">Reveal / worldbuilding / quan hệ</option>
                    <option value="sensitive">Cảnh 18+ / nhạy cảm</option>
                    <option value="chapter-range">Khoảng chương</option>
                    <option value="character">Nhân vật xuất hiện</option>
                    <option value="missing-digest">Mọi chương còn thiếu digest</option>
                  </select>
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium">Nhân vật</label>
                  <Input
                    value={deepCharacter}
                    onChange={(event) => setDeepCharacter(event.target.value)}
                    placeholder="Tên nhân vật"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-sm font-medium">Từ chương</label>
                  <Input
                    value={deepFromChapter}
                    onChange={(event) => setDeepFromChapter(event.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium">Đến chương</label>
                  <Input
                    value={deepToChapter}
                    onChange={(event) => setDeepToChapter(event.target.value)}
                    placeholder={String(totalChapters || "")}
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-background p-3 text-sm">
                <p>{selectedDeepChapterCount.toLocaleString("vi-VN")} chương được chọn</p>
                <p className="mt-1 text-muted-foreground">
                  Độ phủ sau chạy: {deepTargetCoverage}%
                </p>
              </div>

              <details className="rounded-xl border bg-background p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Ước tính kỹ thuật
                </summary>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>{estimatedTokens.toLocaleString("vi-VN")} token</p>
                  <p>{estimatedRequests.toLocaleString("vi-VN")} request dự kiến</p>
                </div>
              </details>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled>Để AI tự chọn phần quan trọng</Button>
                <Button size="sm" variant="outline" disabled>
                  Phân tích mọi chương còn thiếu digest
                </Button>
                <Button size="sm" onClick={handleStartAnalysis} disabled={isSavingAnalysis || !hasImportedData}>
                  Chạy phân tích sâu
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelAnalysisJob} disabled={!isSavingAnalysis}>
                  Dừng
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border bg-background p-3">
                <p className="text-sm font-medium">Arc đã chọn</p>
                <p className="mt-1 text-xs text-muted-foreground">Chưa có arc được chọn.</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-sm font-medium">Danh sách chương đã chọn</p>
                <div className="mt-2 max-h-40 space-y-1 overflow-auto pr-1 text-xs text-muted-foreground">
                  {selectedDeepChapterNumbers.length > 0 ? (
                    selectedDeepChapterNumbers.map((number) => (
                      <p key={number}>Chương {number}</p>
                    ))
                  ) : (
                    <p>Chưa chọn chương nào.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Dùng Canon Pack để viết"
          description="Gộp kết quả quét, bản đồ arc và phân tích sâu thành bộ nhớ tác giả có thể dùng ngay trong dự án."
        >
          <div className="rounded-xl border bg-background p-3">
            <p className="text-sm font-medium">
              {canonReadinessLevel} - {canonReadinessPercent}%
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${canonReadinessPercent}%` }}
              />
            </div>
            {canonReadinessPercent < 80 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Chưa đủ vì thiếu: coverage. Dùng Deep Selection Planner để tăng độ phủ chương/arc trọng tâm.
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled>Dựng Canon Pack</Button>
            <Button size="sm" variant="outline" disabled>Dùng cho dự án này</Button>
            <Button size="sm" variant="outline" disabled>Tạo project đồng nhân từ Canon Pack</Button>
            <Button size="sm" variant="outline" disabled>Mở editor với Canon Pack</Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {["Tổng quan", "Nhân vật", "Quan hệ", "Timeline", "Style", "Cấm phá canon", "Vùng trống"].map((tab) => (
              <span key={tab} className="app-chip">{tab}</span>
            ))}
          </div>

          <div className="mt-3 rounded-xl border bg-background p-3">
            <p className="text-sm font-medium">Gợi ý dùng để viết</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Các vùng trống và unresolved threads sẽ hiển thị ở đây sau khi Canon Pack được dựng.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Đưa vào Story Bible"
          description="Bước này không bắt buộc. Duyệt các mục sẽ thêm hoặc cập nhật trước khi ghi vào dự án."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Canon Pack selector</label>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" disabled>
                <option>Chưa có Canon Pack</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Dự án</label>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" disabled>
                <option>{story?.title ?? "Dự án hiện tại"}</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled>Tạo bản duyệt</Button>
            <Button size="sm" variant="outline" disabled>Áp dụng 0 mục đã duyệt</Button>
          </div>
        </SectionCard>

        <details className="rounded-xl border bg-card/70">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            Chi tiết kỹ thuật
          </summary>
          <div className="border-t p-4">
            <SectionCard title="Runtime, Jobs và Prompt">
          <StoryAnalysisHint>
            Gemini Proxy batch job chạy qua runtime cục bộ được chọn và
            chỉ lưu sau khi tất cả task hoàn tất hoặc cache hit hợp lệ có sẵn.
          </StoryAnalysisHint>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <RuntimeTile label="Provider" value={runtimeProviderLabel} />
            <RuntimeTile label="Model" value={runtimeModel} />
            <RuntimeTile
              label="Endpoint"
              value={formatRuntimeValue(runtimeEndpoint)}
            />
            <RuntimeTile
              label="Prompt"
              value={
                lastPipelineResult?.promptContext?.templateTitle ??
                "import-analysis"
              }
            />
          </div>

          {runtimeSettings?.providerId === "gemini-proxy" ? (
            <div className="mt-3 rounded-xl border bg-card/80 p-3">
              <p className="text-sm font-medium">Gemini batch profile</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Batch size {runtimeSettings.geminiBatchSize}, concurrency{" "}
                {runtimeSettings.geminiBatchConcurrency}, delay{" "}
                {runtimeSettings.geminiRequestDelayMs}ms. Completed cache hits
                are reused; failed tasks can be resumed without saving partial
                analysis.
              </p>
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <AnimatedStatusCard
              eyebrow="Thực thi cục bộ"
              title="Job Runtime"
              value={activeJobRuntime}
              description="Kiểm soát xem analysis job planning chạy trong trình duyệt, local worker hay cloud queue tương lai."
            />

            <AnimatedStatusCard
              eyebrow="Story analysis job"
              title={localJobState?.status ?? "đang chờ"}
              value={formatJobProgressValue(localJobState)}
              description={
                localJobState?.jobId
                  ? shortenJobId(localJobState.jobId)
                  : "chưa bắt đầu"
              }
            >
              <ProgressMeter
                value={localJobState?.percentComplete ?? 0}
                label="Job progress"
                description={formatJobProgressDescription(localJobState)}
              />
            </AnimatedStatusCard>

            {latestResumableJob && !isLoadingResumableJob && !isLocalJobRunning ? (
              <AnimatedStatusCard
                eyebrow="Batch lỗi/chưa hoàn tất"
                title="Có thể tiếp tục"
                value={`${latestResumableJob.retryableTasks} task`}
                description={
                  latestResumableJob.jobId
                    ? shortenJobId(latestResumableJob.jobId)
                    : "job"
                }
              >
                <p className="text-xs text-muted-foreground">
                  {latestResumableJob.failedTasks} failed ·{" "}
                  {latestResumableJob.completedTasks} completed ·{" "}
                  {latestResumableJob.skippedTasks} skipped
                </p>
                {latestResumableJob.pendingTasks > 0 ||
                latestResumableJob.runningTasks > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {latestResumableJob.pendingTasks} pending ·{" "}
                    {latestResumableJob.runningTasks} running
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Tiếp tục chỉ retry task lỗi hoặc chưa hoàn tất. Không lưu kết quả một phần.
                </p>
              </AnimatedStatusCard>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/settings">Mở Runtime Settings</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/prompt-manager">Mở Prompt Manager</Link>
            </Button>
          </div>

          {jobRuntimeNote ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {jobRuntimeNote}
            </p>
          ) : null}

          {localJobState && localJobState.failedTasks > 0 ? (
            <p className="mt-3 text-sm text-destructive">
              Một số batch task lỗi. Yuki sẽ không lưu analysis một phần. Sử dụng
              Tiếp tục batch lỗi sau khi kiểm tra số lượng lỗi.
            </p>
          ) : null}

          {localJobState?.message ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {localJobState.message}
            </p>
          ) : null}

          {localAggregatedResult?.updatedAt ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Kết quả batch tổng hợp sẵn sàng lúc{" "}
              {new Date(localAggregatedResult.updatedAt).toLocaleString(
                "vi-VN",
              )}
              . Nó sẽ được lưu chỉ sau khi kiểm tra hoàn tất thành công.
            </p>
          ) : null}

          {runtimeSettings?.providerId === "gemini-proxy" &&
          localAggregatedResult ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Kết quả Gemini Proxy batch sẵn sàng và sẽ được lưu mà không cần yêu cầu provider full-story thứ hai.
            </p>
          ) : null}

          {lastPipelineResult?.promptContext?.missingVariables.length ? (
            <p className="mt-3 text-sm text-destructive">
              Thiếu prompt variables:{" "}
              {lastPipelineResult.promptContext.missingVariables.join(", ")}
            </p>
          ) : null}
            </SectionCard>
          </div>
        </details>

        {storageError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {storageError}
          </p>
        ) : null}

        {isLoading ? (
          <SectionCard title="Đang tải dữ liệu analysis">
            <p className="app-muted-text">
              Đang đọc dữ liệu tiểu thuyết nhập khẩu từ IndexedDB...
            </p>
          </SectionCard>
        ) : !hasDashboardData ? (
          <EmptyState
            title="Chưa có dữ liệu analysis"
            description="Không tìm thấy dữ liệu tiểu thuyết nhập khẩu trong IndexedDB cho tiểu thuyết này."
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                title="Tổng số chương"
                value={totalChapters.toLocaleString("vi-VN")}
              />
              <StatCard
                icon={<ScrollText className="h-4 w-4" />}
                title="Tổng số từ"
                value={totalWordCount.toLocaleString("vi-VN")}
              />
              <StatCard
                icon={<Database className="h-4 w-4" />}
                title="Tổng số chunk"
                value={totalChunks.toLocaleString("vi-VN")}
              />
              <StatCard
                icon={<BarChart3 className="h-4 w-4" />}
                title="Chương đã phân tích"
                value={parsedChapters.toLocaleString("vi-VN")}
              />
              <StatCard
                icon={<Sparkles className="h-4 w-4" />}
                title="Chương đã phân tích"
                value={analyzedChapters.toLocaleString("vi-VN")}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <ProgressCard label="Tiến độ nhập khẩu" value={100} />
              <ProgressCard label="Tiến độ chunk" value={chunkProgress} />
              <ProgressCard
                label="Tiến độ analysis"
                value={analysisProgress}
              />
            </section>

            <SectionCard title="Xem trước chương">
              {chapters.length > 0 ? (
                <div className="app-table-wrap">
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th>Chương</th>
                        <th>Tiêu đề</th>
                        <th>Từ</th>
                        <th>Chunk</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chapters.slice(0, 20).map((chapter) => (
                        <tr key={chapter.id}>
                          <td>{chapter.chapterNumber}</td>
                          <td className="font-medium">{chapter.title}</td>
                          <td>{chapter.wordCount.toLocaleString("vi-VN")}</td>
                          <td>
                            {(
                              chunkCountsByChapterId[chapter.id] ?? 0
                            ).toLocaleString("vi-VN")}
                          </td>
                          <td>{chapter.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="Không có chương nhập khẩu"
                  description="Không tìm thấy dữ liệu IndexedDB cục bộ cho tiểu thuyết này."
                />
              )}
            </SectionCard>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <EntityAnalysisCard
                icon={Users}
                title="Characters"
                entities={analysisResult?.characters}
              />
              <EventAnalysisCard events={analysisResult?.events} />
              <EntityAnalysisCard
                icon={Boxes}
                title="Vật phẩm"
                entities={analysisResult?.items}
              />
              <EntityAnalysisCard
                icon={ScrollText}
                title="Thuật ngữ"
                entities={analysisResult?.terms}
              />
              <EntityAnalysisCard
                icon={MapPin}
                title="Địa điểm"
                entities={analysisResult?.locations}
              />
              <WritingStyleCard
                profile={analysisResult?.writingStyleProfiles[0]}
              />
            </section>
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}

function StoryAnalysisHint({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>;
}

function RuntimeTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-xs">{value}</p>
    </div>
  );
}

function ProgressCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{value}%</p>
      </CardContent>
    </Card>
  );
}

function AnalysisCardShell({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function NotAnalyzedYet() {
  return <p className="text-sm text-muted-foreground">Chưa phân tích</p>;
}

function EntityAnalysisCard({
  icon,
  title,
  entities,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  entities?: ExtractedEntity[];
}) {
  return (
    <AnalysisCardShell icon={icon} title={title}>
      {entities ? (
        <div>
          <p className="text-sm font-medium">Phát hiện {entities.length}</p>
          <div className="mt-3 space-y-3">
            {entities.slice(0, 5).map((entity) => (
              <div key={entity.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{entity.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {entity.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <NotAnalyzedYet />
      )}
    </AnalysisCardShell>
  );
}

function EventAnalysisCard({ events }: { events?: StoryEvent[] }) {
  return (
    <AnalysisCardShell icon={CalendarDays} title="Sự kiện">
      {events ? (
        <div>
          <p className="text-sm font-medium">Phát hiện {events.length}</p>
          <div className="mt-3 space-y-3">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{event.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chương {event.chapterNumber} · {event.importance}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <NotAnalyzedYet />
      )}
    </AnalysisCardShell>
  );
}

function WritingStyleCard({ profile }: { profile?: WritingStyleProfile }) {
  return (
    <AnalysisCardShell icon={PenLine} title="Phong cách viết">
      {profile ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium">Lối kể</p>
            <p className="mt-1 text-muted-foreground">
              {profile.narrationStyle}
            </p>
          </div>
          <div>
            <p className="font-medium">Nhịp độ</p>
            <p className="mt-1 text-muted-foreground">{profile.pacing}</p>
          </div>
          <div>
            <p className="font-medium">Tone</p>
            <p className="mt-1 text-muted-foreground">{profile.tone}</p>
          </div>
        </div>
      ) : (
        <NotAnalyzedYet />
      )}
    </AnalysisCardShell>
  );
}
