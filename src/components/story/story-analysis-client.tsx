"use client";

import Link from "next/link";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
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
import {
  type AiPipelineProviderId,
  getAiPipelineProvider,
  listAiPipelineProviders,
  runAiPipeline,
} from "@/lib/ai/pipeline";
import {
  defaultAiProviderId,
  readStoredAiProviderId,
  saveStoredAiProviderId,
  subscribeToAiProviderStorage,
} from "@/lib/storage/ai-provider-storage";
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
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export function StoryAnalysisClient({ storyId }: StoryAnalysisClientProps) {
  const [dashboardData, setDashboardData] = useState<AnalysisDashboardData>({
    chapters: [],
    chunks: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [isSavingAnalysis, setIsSavingAnalysis] = useState(false);

  const selectedProviderId = useSyncExternalStore<AiPipelineProviderId>(
    subscribeToAiProviderStorage,
    () => readStoredAiProviderId(storyId),
    () => defaultAiProviderId,
  );

  useEffect(() => {
    let isActive = true;

    async function loadDashboardData() {
      let indexedDbData: AnalysisDashboardData = {
        chapters: [],
        chunks: [],
      };
      let indexedDbFailed = false;

      try {
        indexedDbData = await readIndexedDbDashboardData(storyId);
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
  const pipelineProviders = listAiPipelineProviders();
  const pipelineProvider = getAiPipelineProvider(selectedProviderId);
  const geminiProxyProvider = getAiPipelineProvider("gemini-proxy");
  const analysisProgress =
    totalChapters > 0
      ? Math.round((analyzedChapters / totalChapters) * 100)
      : 0;
  const chunkProgress = chunks.length > 0 ? 100 : 0;
  const hasDashboardData = Boolean(story) || chapters.length > 0;

  async function handleStartMockAnalysis() {
    if (isSavingAnalysis) return;

    setIsSavingAnalysis(true);
    setStorageError("");

    if (
      selectedProviderId === "gemini-proxy" &&
      !geminiProxyProvider.isConfigured?.()
    ) {
      setStorageError(
        "Gemini proxy is not configured. Set NEXT_PUBLIC_AI_PROXY_ENDPOINT or choose Mock pipeline.",
      );
      setIsSavingAnalysis(false);
      return;
    }

    const pipelineResult = await runAiPipeline(
      {
        storyId,
        story,
        chapters,
        chunks,
      },
      selectedProviderId,
    );

    if (
      pipelineResult.status !== "completed" ||
      !pipelineResult.analysisResult
    ) {
      setStorageError(
        pipelineResult.errorMessage ??
          `${pipelineResult.providerLabel} did not return an analysis result.`,
      );
      setIsSavingAnalysis(false);
      return;
    }

    const result = pipelineResult.analysisResult;
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
      console.error("Failed to save mock analysis to IndexedDB", error);
      setStorageError("Could not save mock analysis to IndexedDB.");
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
          description={`${story?.author ? `Tác giả: ${story.author}. ` : ""}Ready for analysis. Story data is loaded from IndexedDB.`}
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/workspace`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Open workspace
                </Link>
              </Button>
              <Button
                type="button"
                onClick={handleStartMockAnalysis}
                disabled={
                  isLoading || chapters.length === 0 || isSavingAnalysis
                }
              >
                <Play className="mr-2 h-4 w-4" />
                {isSavingAnalysis ? "Saving..." : "Start analysis"}
              </Button>
            </>
          }
        />

        <p className="app-muted-text">
          Reading story data from IndexedDB. Provider: {pipelineProvider.label}.
          Gemini proxy:{" "}
          {geminiProxyProvider.isConfigured?.()
            ? "configured"
            : "not configured"}
          .
        </p>

        <SectionCard title="AI provider">
          <div className="grid gap-3 md:grid-cols-[280px_1fr] md:items-center">
            <Select
              value={selectedProviderId}
              onValueChange={(value) => {
                const providerId = value as AiPipelineProviderId;

                saveStoredAiProviderId(storyId, providerId);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipelineProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="app-muted-text">
              {pipelineProvider.description}
              {" Selection is saved locally for this story."}
              {selectedProviderId === "gemini-proxy" &&
              !geminiProxyProvider.isConfigured?.()
                ? " NEXT_PUBLIC_AI_PROXY_ENDPOINT is not configured."
                : ""}
            </p>
          </div>
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
