"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  BookOpen,
  Boxes,
  CalendarDays,
  MapPin,
  PenLine,
  ScrollText,
  Sparkles,
  Users,
} from "lucide-react";

import type { Chapter, Story } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StoryAnalysisClientProps {
  storyId: string;
}

const storyStorageKey = "ai-story-app:stories";
const emptyStories: Story[] = [];
const emptyChapters: Chapter[] = [];
const parsedArrayCache = new Map<
  string,
  { serializedValue: string; parsedValue: unknown[] }
>();

function estimateWordCount(text: string) {
  const words = text.trim().match(/\S+/g);

  return words?.length ?? 0;
}

function readJsonArray<T>(key: string, fallback: T[]) {
  if (typeof window === "undefined") return fallback;

  const serializedValue = localStorage.getItem(key) || "[]";
  const cachedValue = parsedArrayCache.get(key);

  if (cachedValue?.serializedValue === serializedValue) {
    return cachedValue.parsedValue as T[];
  }

  try {
    const parsedValue = JSON.parse(serializedValue) as T[];
    const normalizedValue = Array.isArray(parsedValue) ? parsedValue : fallback;

    parsedArrayCache.set(key, {
      serializedValue,
      parsedValue: normalizedValue,
    });

    return normalizedValue;
  } catch {
    parsedArrayCache.set(key, {
      serializedValue,
      parsedValue: fallback,
    });

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
    () => readJsonArray<Story>(storyStorageKey, emptyStories),
    () => emptyStories,
  );
  const chapters = useSyncExternalStore(
    subscribeToLocalStorage,
    () =>
      readJsonArray<Chapter>(
        `ai-story-app:chapters:${storyId}`,
        emptyChapters,
      ),
    () => emptyChapters,
  );

  const story = stories.find((item) => item.id === storyId);
  const totalWordCount = useMemo(() => {
    return chapters.reduce(
      (total, chapter) => total + estimateWordCount(chapter.content),
      0,
    );
  }, [chapters]);

  return (
    <main className="min-h-screen bg-muted/30">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Novel Analysis
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            {story?.title ?? "Imported Novel"}
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            {story?.author ? `Tác giả: ${story.author}. ` : ""}
            Truyện đã được nạp vào localStorage và sẵn sàng cho bước phân tích
            nhân vật, timeline, vật phẩm, thuật ngữ, địa điểm và văn phong.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                Tổng số chương
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{chapters.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ScrollText className="h-4 w-4" />
                Tổng số từ ước tính
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                {totalWordCount.toLocaleString("vi-VN")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Trạng thái
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">Ready for analysis</p>
            </CardContent>
          </Card>
        </section>

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
                  <p className="text-sm text-muted-foreground">
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
