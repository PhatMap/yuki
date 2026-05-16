"use client";

import Link from "next/link";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useMemo,
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
  const runtimeConfig = useMemo(() => getPublicRuntimeConfig(), []);

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

  async function handleStartAnalysis() {
    if (isSavingAnalysis) return;

    setIsSavingAnalysis(true);
    setStorageError("");
    setLastPipelineResult(undefined);
    setLocalAggregatedResult(undefined);
    setJobRuntimeNote("");
    setLocalJobState(undefined);

    if (runtimeConfig.jobRuntime === "local-browser") {
      try {
        const localJobResult = await runLocalStoryAnalysisJob({
          storyId,
          story,
          chapters,
          chunks,
          runtimeSettings: runtimeSettings ?? undefined,
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
        setLocalAggregatedResult(localJobResult.analysisResult);
      } catch (error) {
        console.error("Failed to run local story analysis job", error);
        setStorageError(
          error instanceof Error
            ? `Local job orchestration failed: ${error.message}`
            : "Local job orchestration failed.",
        );
        setIsSavingAnalysis(false);
        return;
      }
    } else if (runtimeConfig.jobRuntime === "local-worker") {
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
            onProgress: (snapshot) => {
              setLocalJobState(toLocalJobState(snapshot));
            },
          },
        );

        setLocalJobState(toLocalJobState(workerResult.summary));
        setLocalAggregatedResult(workerResult.analysisResult);
      } catch (error) {
        console.error("Failed to run local worker story analysis job", error);
        setStorageError(
          error instanceof Error
            ? `Local worker job orchestration failed: ${error.message}`
            : "Local worker job orchestration failed.",
        );
        setIsSavingAnalysis(false);
        return;
      }
    } else if (runtimeConfig.jobRuntime === "cloud-queue") {
      setJobRuntimeNote(
        "Job runtime cloud-queue is not wired yet. Falling back to direct analysis pipeline.",
      );
    }

    const pipelineResult = await runAiPipeline({
      storyId,
      story,
      chapters,
      chunks,
    });
    const shouldUseLocalAggregatedMockResult =
      runtimeSettings?.providerId === "mock" && localAggregatedResult;

    const effectivePipelineResult: AiPipelineResult = shouldUseLocalAggregatedMockResult
      ? {
          ...pipelineResult,
          analysisResult: localAggregatedResult,
        }
      : pipelineResult;

    setLastPipelineResult(effectivePipelineResult);

    if (
      effectivePipelineResult.status !== "completed" ||
      !effectivePipelineResult.analysisResult
    ) {
      setStorageError(
        effectivePipelineResult.errorMessage ??
          `${effectivePipelineResult.providerLabel} did not return an analysis result.`,
      );
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
            </>
          }
        />

        <SectionCard title="Runtime and Prompt Manager">
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

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <AnimatedStatusCard
              eyebrow="Local execution"
              title="Job Runtime"
              value={runtimeConfig.jobRuntime}
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
            <p className="mt-3 text-sm text-muted-foreground">{jobRuntimeNote}</p>
          ) : null}

          {localJobState?.message ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {localJobState.message}
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
