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
  Settings,
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
  return value || "not configured";
}

function shortenJobId(jobId: string) {
  if (jobId.length <= 36) return jobId;

  return `${jobId.slice(0, 18)}...${jobId.slice(-12)}`;
}

function formatJobProgressValue(state?: LocalAnalysisJobState) {
  if (!state) return "idle";

  return `${state.completedTasks}/${state.totalTasks}`;
}

function formatJobProgressDescription(state?: LocalAnalysisJobState) {
  if (!state) return "No local job has started yet.";

  return `${state.skippedTasks} skipped/cache hits · ${state.failedTasks} failed`;
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
  const analysisAbortControllerRef = useRef<AbortController | null>(null);
  const runtimeConfig = useMemo(() => getPublicRuntimeConfig(), []);

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
          ? "IndexedDB read failed. Story data may be unavailable."
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
  const runtimeProviderLabel = runtimeSettings
    ? getAiRuntimeProviderLabel(runtimeSettings.providerId)
    : "Loading";
  const runtimeModel = runtimeSettings
    ? getActiveRuntimeModel(runtimeSettings)
    : "Loading";
  const runtimeEndpoint = runtimeSettings
    ? getActiveRuntimeEndpoint(runtimeSettings)
    : "Loading";
  const activeJobRuntime =
    runtimeSettings?.jobRuntime ?? runtimeConfig.jobRuntime;
  const canUseLocalAggregatedAnalysis =
    runtimeSettings?.providerId === "mock" ||
    runtimeSettings?.providerId === "gemini-proxy";

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

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Novel Analysis"
          title={story?.title ?? "Imported Novel"}
          description={`${story?.author ? `Tác giả: ${story.author}. ` : ""}Analysis uses global runtime settings and Prompt Manager templates.`}
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/reader`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Reader
                </Link>
              </Button>

              <Button asChild variant="outline">
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Runtime
                </Link>
              </Button>

              <Button
                type="button"
                onClick={handleStartAnalysis}
                disabled={
                  isLoading || chapters.length === 0 || isSavingAnalysis
                }
              >
                <Play className="mr-2 h-4 w-4" />
                {isSavingAnalysis ? "Running..." : "Run analysis"}
              </Button>

              {isLocalJobRunning ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelAnalysisJob}
                >
                  Cancel local job
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
                    isLoading || chapters.length === 0 || isSavingAnalysis
                  }
                >
                  {isResumingBatch ? "Resuming..." : "Resume failed batch"}
                </Button>
              ) : null}
            </>
          }
        />

        <SectionCard title="Runtime, Jobs, and Prompt">
          <StoryAnalysisHint>
            Gemini Proxy batch jobs run through the selected local runtime and
            save only after all tasks complete or valid cache hits are
            available.
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
              eyebrow="Local execution"
              title="Job Runtime"
              value={activeJobRuntime}
              description="Controls whether analysis job planning runs in the browser, a local worker, or a future cloud queue."
            />

            <AnimatedStatusCard
              eyebrow="Story analysis job"
              title={localJobState?.status ?? "idle"}
              value={formatJobProgressValue(localJobState)}
              description={
                localJobState?.jobId
                  ? shortenJobId(localJobState.jobId)
                  : "not started"
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
                eyebrow="Failed/incomplete batch"
                title="Resume available"
                value={`${latestResumableJob.retryableTasks} tasks`}
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
                  Resume retries failed or incomplete tasks only. No partial
                  result will be saved.
                </p>
              </AnimatedStatusCard>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/settings">Open Runtime Settings</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/prompt-manager">Open Prompt Manager</Link>
            </Button>
          </div>

          {jobRuntimeNote ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {jobRuntimeNote}
            </p>
          ) : null}

          {localJobState && localJobState.failedTasks > 0 ? (
            <p className="mt-3 text-sm text-destructive">
              Some batch tasks failed. Yuki will not save partial analysis. Use
              Resume failed batch after checking the failed counts.
            </p>
          ) : null}

          {localJobState?.message ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {localJobState.message}
            </p>
          ) : null}

          {localAggregatedResult?.updatedAt ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Aggregated batch result ready at{" "}
              {new Date(localAggregatedResult.updatedAt).toLocaleString(
                "vi-VN",
              )}
              . It will be saved only after completion checks pass.
            </p>
          ) : null}

          {runtimeSettings?.providerId === "gemini-proxy" &&
          localAggregatedResult ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Gemini Proxy batch result is ready and will be saved without a
              second full-story request.
            </p>
          ) : null}

          {lastPipelineResult?.promptContext?.missingVariables.length ? (
            <p className="mt-3 text-sm text-destructive">
              Missing prompt variables:{" "}
              {lastPipelineResult.promptContext.missingVariables.join(", ")}
            </p>
          ) : null}
        </SectionCard>

        {storageError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {storageError}
          </p>
        ) : null}

        {isLoading ? (
          <SectionCard title="Loading analysis data">
            <p className="app-muted-text">
              Reading imported story data from IndexedDB...
            </p>
          </SectionCard>
        ) : !hasDashboardData ? (
          <EmptyState
            title="No analysis data found"
            description="No imported story data was found in IndexedDB for this story."
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                title="Total chapters"
                value={totalChapters.toLocaleString("vi-VN")}
              />
              <StatCard
                icon={<ScrollText className="h-4 w-4" />}
                title="Total words"
                value={totalWordCount.toLocaleString("vi-VN")}
              />
              <StatCard
                icon={<Database className="h-4 w-4" />}
                title="Total chunks"
                value={totalChunks.toLocaleString("vi-VN")}
              />
              <StatCard
                icon={<BarChart3 className="h-4 w-4" />}
                title="Parsed chapters"
                value={parsedChapters.toLocaleString("vi-VN")}
              />
              <StatCard
                icon={<Sparkles className="h-4 w-4" />}
                title="Analyzed chapters"
                value={analyzedChapters.toLocaleString("vi-VN")}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <ProgressCard label="Import progress" value={100} />
              <ProgressCard label="Chunk progress" value={chunkProgress} />
              <ProgressCard
                label="Analysis progress"
                value={analysisProgress}
              />
            </section>

            <SectionCard title="Chapter preview">
              {chapters.length > 0 ? (
                <div className="app-table-wrap">
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th>Chapter</th>
                        <th>Title</th>
                        <th>Words</th>
                        <th>Chunks</th>
                        <th>Status</th>
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
                  title="Chưa có imported chapters"
                  description="Chưa có dữ liệu trong IndexedDB cho story này."
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
                title="Items"
                entities={analysisResult?.items}
              />
              <EntityAnalysisCard
                icon={ScrollText}
                title="Terms"
                entities={analysisResult?.terms}
              />
              <EntityAnalysisCard
                icon={MapPin}
                title="Locations"
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
  return <p className="text-sm text-muted-foreground">Not analyzed yet</p>;
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
          <p className="text-sm font-medium">{entities.length} detected</p>
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
    <AnalysisCardShell icon={CalendarDays} title="Events">
      {events ? (
        <div>
          <p className="text-sm font-medium">{events.length} detected</p>
          <div className="mt-3 space-y-3">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{event.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chapter {event.chapterNumber} · {event.importance}
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
    <AnalysisCardShell icon={PenLine} title="Writing Style">
      {profile ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium">Narration</p>
            <p className="mt-1 text-muted-foreground">
              {profile.narrationStyle}
            </p>
          </div>
          <div>
            <p className="font-medium">Pacing</p>
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
