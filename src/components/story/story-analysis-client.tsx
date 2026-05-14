"use client";

import Link from "next/link";
import { type ComponentType, useMemo, useSyncExternalStore } from "react";
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

import type {
  AnalysisStatus,
  ChapterChunk,
  ImportedChapter,
  Story,
} from "@/lib/types";
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

const analysisCards = [
  { title: "Characters", icon: Users },
  { title: "Events", icon: CalendarDays },
  { title: "Items", icon: Boxes },
  { title: "Terms", icon: ScrollText },
  { title: "Locations", icon: MapPin },
  { title: "Writing Style", icon: PenLine },
];

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

  return (
    <main className="min-h-screen bg-muted/30">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Novel Analysis
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              {story?.title ?? "Imported Novel"}
            </h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              {story?.author ? `Tác giả: ${story.author}. ` : ""}
              Ready for analysis. Dữ liệu đang nằm trong localStorage và chưa
              gọi AI thật hoặc backend.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/stories/${storyId}/workspace`}>
                <BookOpen className="mr-2 h-4 w-4" />
                Open workspace
              </Link>
            </Button>
            <Button disabled type="button">
              <Play className="mr-2 h-4 w-4" />
              Start mock analysis
            </Button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={BookOpen}
            label="Total chapters"
            value={totalChapters.toLocaleString("vi-VN")}
          />
          <MetricCard
            icon={ScrollText}
            label="Total words"
            value={totalWordCount.toLocaleString("vi-VN")}
          />
          <MetricCard
            icon={Database}
            label="Total chunks"
            value={totalChunks.toLocaleString("vi-VN")}
          />
          <MetricCard
            icon={BarChart3}
            label="Parsed chapters"
            value={parsedChapters.toLocaleString("vi-VN")}
          />
          <MetricCard
            icon={Sparkles}
            label="Analyzed chapters"
            value={analyzedChapters.toLocaleString("vi-VN")}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ProgressCard label="Import progress" value={100} />
          <ProgressCard label="Chunk progress" value={chunkProgress} />
          <ProgressCard label="Analysis progress" value={analysisProgress} />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Chapter preview</CardTitle>
          </CardHeader>
          <CardContent>
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
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Chưa có imported chapters trong localStorage cho story này.
              </p>
            )}
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {analysisCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">Not analyzed yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Placeholder cho kết quả phân tích tự động. Chưa tích hợp AI
                    hoặc backend.
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </section>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
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
