"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, FileText, Upload } from "lucide-react";

import type { Chapter, Story } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DetectedChapter {
  title: string;
  content: string;
  order: number;
  wordCount: number;
}

const storyStorageKey = "ai-story-app:stories";
const chapterMatcher = /(chương|chapter)\s+\d+/i;
const chapterHeadingMatcher = /(chương|chapter)\s+\d+[^\r\n]*/gi;

function estimateWordCount(text: string) {
  const words = text.trim().match(/\S+/g);

  return words?.length ?? 0;
}

function detectNovelChapters(text: string): DetectedChapter[] {
  const sourceText = text.trim();

  if (!sourceText) return [];

  if (!chapterMatcher.test(sourceText)) {
    return [
      {
        title: "Imported Novel",
        content: sourceText,
        order: 1,
        wordCount: estimateWordCount(sourceText),
      },
    ];
  }

  const matches = Array.from(sourceText.matchAll(chapterHeadingMatcher));

  if (matches.length === 0) {
    return [
      {
        title: "Imported Novel",
        content: sourceText,
        order: 1,
        wordCount: estimateWordCount(sourceText),
      },
    ];
  }

  return matches.map((match, index) => {
    const startIndex = match.index ?? 0;
    const nextIndex = matches[index + 1]?.index ?? sourceText.length;
    const content = sourceText.slice(startIndex, nextIndex).trim();

    return {
      title: match[0].trim(),
      content,
      order: index + 1,
      wordCount: estimateWordCount(content),
    };
  });
}

function readLocalStories() {
  try {
    const parsedStories = JSON.parse(
      localStorage.getItem(storyStorageKey) || "[]",
    ) as Story[];

    return Array.isArray(parsedStories) ? parsedStories : [];
  } catch {
    return [];
  }
}

export default function ImportNovelPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [novelText, setNovelText] = useState("");
  const [detectedChapters, setDetectedChapters] = useState<DetectedChapter[]>(
    [],
  );

  const totalWordCount = useMemo(() => {
    return detectedChapters.reduce(
      (total, chapter) => total + chapter.wordCount,
      0,
    );
  }, [detectedChapters]);

  function handleDetectChapters() {
    setDetectedChapters(detectNovelChapters(novelText));
  }

  function handleCreateStoryFromImport() {
    const chaptersToImport =
      detectedChapters.length > 0
        ? detectedChapters
        : detectNovelChapters(novelText);

    if (chaptersToImport.length === 0) return;

    const storyId = `story-${Date.now()}`;
    const now = new Date().toISOString();
    const storyTitle = title.trim() || "Imported Novel";

    const newStory: Story = {
      id: storyId,
      title: storyTitle,
      description:
        chaptersToImport[0]?.content.slice(0, 240) ||
        "Imported long-form novel.",
      author: author.trim(),
      genre: "adventure",
      tone: "dramatic",
      canonAdherence: "completely-different",
      isFanwork: false,
      source: "import",
      createdAt: now,
      updatedAt: now,
    };

    const importedChapters: Chapter[] = chaptersToImport.map((chapter) => ({
      id: `${storyId}-chapter-${chapter.order}`,
      storyId,
      title: chapter.title,
      content: chapter.content,
      order: chapter.order,
      createdAt: now,
    }));

    localStorage.setItem(
      storyStorageKey,
      JSON.stringify([newStory, ...readLocalStories()]),
    );
    localStorage.setItem(
      `ai-story-app:chapters:${storyId}`,
      JSON.stringify(importedChapters),
    );

    router.push(`/stories/${storyId}/analysis`);
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Import Novel
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Import Novel</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Nạp truyện có sẵn để phân tích chương, nhân vật, timeline, vật
            phẩm, thuật ngữ và văn phong.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Novel source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="novel-title">Tên truyện</Label>
                  <Input
                    id="novel-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ví dụ: Thiên Kiếm Lưu Vân"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="novel-author">Tác giả</Label>
                  <Input
                    id="novel-author"
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                    placeholder="Tên tác giả hoặc nguồn"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="novel-content">Nội dung truyện</Label>
                <Textarea
                  id="novel-content"
                  className="min-h-[520px] text-sm leading-6"
                  value={novelText}
                  onChange={(event) => setNovelText(event.target.value)}
                  placeholder="Paste toàn bộ truyện hoặc nhiều chương vào đây..."
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDetectChapters}
                >
                  <BookOpenCheck className="mr-2 h-4 w-4" />
                  Detect chapters
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateStoryFromImport}
                  disabled={!novelText.trim()}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Create story from import
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview chương</CardTitle>
            </CardHeader>
            <CardContent>
              {detectedChapters.length > 0 ? (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">
                      {detectedChapters.length} chương detected
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Khoảng {totalWordCount.toLocaleString("vi-VN")} từ
                    </p>
                  </div>

                  <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
                    {detectedChapters.map((chapter) => (
                      <article
                        className="rounded-lg border bg-background p-3"
                        key={`${chapter.order}-${chapter.title}`}
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Chương {chapter.order}
                        </p>
                        <h2 className="mt-1 text-sm font-semibold">
                          {chapter.title}
                        </h2>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {chapter.wordCount.toLocaleString("vi-VN")} từ ước
                          tính
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Chưa detect chương. Paste nội dung truyện rồi bấm Detect
                  chapters để xem preview.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
