"use client";

import Link from "next/link";
import {
  type ComponentType,
  type ReactNode,
  useMemo,
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

import { runMockAnalysis } from "@/lib/mock-analysis";
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

interface StoryAnalysisClientProps {
  storyId: string;
}

const storyStorageKey = "ai-story-app:stories";
const emptyStories: Story[] = [];
const emptyChapters: ImportedChapter[] = [];
const emptyChunks: ChapterChunk[] = [];
const emptyAnalysisStatus: AnalysisStatus | null = null;
const emptyAnalysisResult: StoryAnalysisResult | null = null;
const parsedValueCache = new Map<
  string,
  { serializedValue: string; parsedValue: unknown }
>();

function readJsonValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  const serializedValue = localStorage.getItem(key) || "";
  const cachedValue = parsedValueCache.get(key);

  if (cachedValue?.serializedValue === serializedValue) {
    return cachedValue.parsedValue as T;
  }

  if (!serializedValue) {
    parsedValueCache.set(key, { serializedValue, parsedValue: fallback });

    return fallback;
  }

  try {
    const parsedValue = JSON.parse(serializedValue) as T;

    parsedValueCache.set(key, { serializedValue, parsedValue });

    return parsedValue;
  } catch {
    parsedValueCache.set(key, { serializedValue, parsedValue: fallback });

    return fallback;
  }
}

function subscribeToLocalStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
  };
}

function notifyLocalStorageChange() {
  window.dispatchEvent(new Event("storage"));
}

export function StoryAnalysisClient({ storyId }: StoryAnalysisClientProps) {
  const stories = useSyncExternalStore(
    subscribeToLocalStorage,
    () => readJsonValue<Story[]>(storyStorageKey, emptyStories),
    () => emptyStories,
  );
  const chapters = useSyncExternalStore(
    subscribeToLocalStorage,
    () =>
      readJsonValue<ImportedChapter[]>(
        `ai-story-app:chapters:${storyId}`,
        emptyChapters,
      ),
    () => emptyChapters,
  );
  const chunks = useSyncExternalStore(
    subscribeToLocalStorage,
    () =>
      readJsonValue<ChapterChunk[]>(
        `ai-story-app:chunks:${storyId}`,
        emptyChunks,
      ),
    () => emptyChunks,
  );
  const analysisStatus = useSyncExternalStore(
    subscribeToLocalStorage,
    () =>
      readJsonValue<AnalysisStatus | null>(
        `ai-story-app:analysis-status:${storyId}`,
        emptyAnalysisStatus,
      ),
    () => emptyAnalysisStatus,
  );
  const analysisResult = useSyncExternalStore(
    subscribeToLocalStorage,
    () =>
      readJsonValue<StoryAnalysisResult | null>(
        `ai-story-app:analysis-result:${storyId}`,
        emptyAnalysisResult,
      ),
    () => emptyAnalysisResult,
  );

  const story = stories.find((item) => item.id === storyId);
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
    totalChapters > 0 ? Math.round((analyzedChapters / totalChapters) * 100) : 0;
  const chunkProgress = chunks.length > 0 ? 100 : 0;

  function handleStartMockAnalysis() {
    const result = runMockAnalysis(storyId, chapters);
    const now = new Date().toISOString();
    const chunkedChapterCount = new Set(
      chunks.map((chunk) => chunk.chapterId),
    ).size;
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

    localStorage.setItem(
      `ai-story-app:analysis-result:${storyId}`,
      JSON.stringify(result),
    );
    localStorage.setItem(
      `ai-story-app:analysis-status:${storyId}`,
      JSON.stringify(updatedStatus),
    );
    notifyLocalStorageChange();
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Novel Analysis"
          title={story?.title ?? "Imported Novel"}
          description={`${story?.author ? `Tác giả: ${story.author}. ` : ""}Ready for analysis. Dữ liệu đang nằm trong localStorage và chưa gọi AI thật hoặc backend.`}
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/workspace`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Open workspace
                </Link>
              </Button>
              <Button type="button" onClick={handleStartMockAnalysis}>
                <Play className="mr-2 h-4 w-4" />
                Start mock analysis
              </Button>
            </>
          }
        />

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
          <ProgressCard label="Analysis progress" value={analysisProgress} />
        </section>

        <SectionCard title="Chapter preview">
          {chapters.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Chapter</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Words</th>
                    <th className="px-3 py-2 font-medium">Chunks</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {chapters.slice(0, 20).map((chapter) => (
                    <tr className="border-t" key={chapter.id}>
                      <td className="px-3 py-2">{chapter.chapterNumber}</td>
                      <td className="px-3 py-2 font-medium">
                        {chapter.title}
                      </td>
                      <td className="px-3 py-2">
                        {chapter.wordCount.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-3 py-2">
                        {(chunkCountsByChapterId[chapter.id] ?? 0).toLocaleString(
                          "vi-VN",
                        )}
                      </td>
                      <td className="px-3 py-2">{chapter.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Chưa có imported chapters"
              description="Chưa có dữ liệu trong localStorage cho story này."
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

function WritingStyleCard({
  profile,
}: {
  profile?: WritingStyleProfile;
}) {
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
