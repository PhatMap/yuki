"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpenCheck, FileText, Upload } from "lucide-react";

import {
  chunkChapters,
  createInitialAnalysisStatus,
  detectChaptersFromText,
} from "@/lib/novel-processing";
import { saveImportedStoryData } from "@/lib/db/indexed-db";
import type { ChapterChunk, ImportedChapter, Story } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const storyStorageKey = "ai-story-app:stories";
const tempStoryId = "preview-import-story";

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
  const [detectedChapters, setDetectedChapters] = useState<ImportedChapter[]>(
    [],
  );
  const [detectedChunks, setDetectedChunks] = useState<ChapterChunk[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const totalWordCount = useMemo(() => {
    return detectedChapters.reduce(
      (total, chapter) => total + chapter.wordCount,
      0,
    );
  }, [detectedChapters]);

  const chunkCountsByChapterId = useMemo(() => {
    return detectedChunks.reduce<Record<string, number>>((counts, chunk) => {
      counts[chunk.chapterId] = (counts[chunk.chapterId] ?? 0) + 1;

      return counts;
    }, {});
  }, [detectedChunks]);

  function handleDetectChapters() {
    const chapters = detectChaptersFromText(novelText, tempStoryId);
    const chunks = chunkChapters(chapters);

    setDetectedChapters(chapters);
    setDetectedChunks(chunks);
  }

  async function handleCreateStoryFromImport() {
    if (isCreating) return;

    setIsCreating(true);
    setCreateError("");

    const storyId = `story-${Date.now()}`;
    const importedChapters = detectChaptersFromText(novelText, storyId);

    if (importedChapters.length === 0) {
      setIsCreating(false);
      setCreateError("Không thể tạo chương từ nội dung đã nhập.");
      return;
    }

    const chunks = chunkChapters(importedChapters);
    const analysisStatus = createInitialAnalysisStatus(
      storyId,
      importedChapters,
      chunks,
    );
    const now = new Date().toISOString();
    const storyTitle = title.trim() || "Imported Novel";

    const newStory: Story = {
      id: storyId,
      title: storyTitle,
      description:
        importedChapters[0]?.cleanContent.slice(0, 240) ||
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

    let localStorageSaved = false;
    let indexedDbSaved = false;

    try {
      localStorage.setItem(
        storyStorageKey,
        JSON.stringify([newStory, ...readLocalStories()]),
      );
      localStorage.setItem(
        `ai-story-app:chapters:${storyId}`,
        JSON.stringify(importedChapters),
      );
      localStorage.setItem(
        `ai-story-app:chunks:${storyId}`,
        JSON.stringify(chunks),
      );
      localStorage.setItem(
        `ai-story-app:analysis-status:${storyId}`,
        JSON.stringify(analysisStatus),
      );
      localStorageSaved = true;
    } catch (error) {
      console.error("Failed to save imported novel to localStorage", error);
    }

    try {
      await saveImportedStoryData({
        story: newStory,
        chapters: importedChapters,
        chunks,
        analysisStatus,
      });
      indexedDbSaved = true;
    } catch (error) {
      console.error("Failed to save imported novel to IndexedDB", error);
    }

    if (!localStorageSaved && !indexedDbSaved) {
      setCreateError(
        "Không thể lưu truyện import vào IndexedDB hoặc localStorage. Vui lòng thử lại.",
      );
      setIsCreating(false);
      return;
    }

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
          <div className="mt-4 flex max-w-3xl gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>
              Với truyện rất dài, bản localStorage chỉ dùng cho prototype. Bản
              production cần database và background processing.
            </p>
          </div>
          <div className="mt-3 flex max-w-3xl gap-3 rounded-lg border bg-background p-4 text-sm text-muted-foreground">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>
              Prototype hiện lưu song song IndexedDB và localStorage fallback.
            </p>
          </div>
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
                  disabled={!novelText.trim() || isCreating}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {isCreating ? "Đang tạo..." : "Create story from import"}
                </Button>
              </div>

              {createError ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {createError}
                </p>
              ) : null}
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
                      Khoảng {totalWordCount.toLocaleString("vi-VN")} từ ·{" "}
                      {detectedChunks.length.toLocaleString("vi-VN")} chunks
                    </p>
                  </div>

                  <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
                    {detectedChapters.map((chapter) => (
                      <article
                        className="rounded-lg border bg-background p-3"
                        key={chapter.id}
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Chương {chapter.chapterNumber}
                        </p>
                        <h2 className="mt-1 text-sm font-semibold">
                          {chapter.title}
                        </h2>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {chapter.wordCount.toLocaleString("vi-VN")} từ ước
                          tính
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(chunkCountsByChapterId[chapter.id] ?? 0).toLocaleString(
                            "vi-VN",
                          )}{" "}
                          chunks
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
