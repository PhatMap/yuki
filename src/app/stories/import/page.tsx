"use client";

import { type ReactNode, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpenCheck, FileText, Upload } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { ProgressMeter } from "@/components/app/progress-meter";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveImportedStoryData } from "@/lib/db/indexed-db";
import {
  runLocalImportWorker,
} from "@/lib/import/run-local-import-worker";
import type { LocalImportWorkerProgressSnapshot } from "@/lib/import/local-import-worker-types";
import type { ChapterChunk, ImportedChapter, Story } from "@/lib/types";

const tempStoryId = "preview-import-story";

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
  const [importProgress, setImportProgress] =
    useState<LocalImportWorkerProgressSnapshot>();
  const [isDetecting, setIsDetecting] = useState(false);
  const importAbortControllerRef = useRef<AbortController | null>(null);

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

  function createImportAbortController() {
    importAbortControllerRef.current?.abort();

    const controller = new AbortController();
    importAbortControllerRef.current = controller;

    return controller;
  }

  function clearImportAbortController(controller: AbortController) {
    if (importAbortControllerRef.current === controller) {
      importAbortControllerRef.current = null;
    }
  }

  function handleCancelImportProcessing() {
    importAbortControllerRef.current?.abort();
    importAbortControllerRef.current = null;
    setIsDetecting(false);
    setIsCreating(false);
    setImportProgress((current) =>
      current
        ? {
            ...current,
            status: "completed",
            message: "Import processing was cancelled.",
          }
        : undefined,
    );
  }

  async function handleDetectChapters() {
    if (isDetecting || isCreating) return;

    setIsDetecting(true);
    setCreateError("");
    setImportProgress(undefined);
    const controller = createImportAbortController();

    try {
      const result = await runLocalImportWorker(
        {
          storyId: tempStoryId,
          text: novelText,
        },
        {
          signal: controller.signal,
          onProgress: setImportProgress,
        },
      );

      setDetectedChapters(result.chapters);
      setDetectedChunks(result.chunks);
      setImportProgress({
        status: "completed",
        message: "Import preview is ready.",
        chapterCount: result.chapters.length,
        chunkCount: result.chunks.length,
        percentComplete: 100,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setCreateError("");
        return;
      }

      console.error("Failed to process import preview", error);
      setCreateError(
        error instanceof Error
          ? `Import preview failed: ${error.message}`
          : "Import preview failed.",
      );
    } finally {
      clearImportAbortController(controller);
      setIsDetecting(false);
    }
  }

  async function handleCreateStoryFromImport() {
    if (isCreating) return;

    setIsCreating(true);
    setCreateError("");
    const controller = createImportAbortController();

    const storyId = `story-${Date.now()}`;

    try {
      const processedImport = await runLocalImportWorker(
        {
          storyId,
          text: novelText,
        },
        {
          signal: controller.signal,
          onProgress: setImportProgress,
        },
      );

      const importedChapters = processedImport.chapters;
      const chunks = processedImport.chunks;

      if (importedChapters.length === 0) {
        setIsCreating(false);
        setCreateError("Không thể tạo chương từ nội dung đã nhập.");
        return;
      }

      const analysisStatus = processedImport.analysisStatus;
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

      await saveImportedStoryData({
        story: newStory,
        chapters: importedChapters,
        chunks,
        analysisStatus,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setCreateError("");
        setIsCreating(false);
        return;
      }

      console.error("Failed to save imported novel to IndexedDB", error);
      setCreateError("Could not save imported story data to IndexedDB.");
      setIsCreating(false);
      return;
    } finally {
      clearImportAbortController(controller);
    }

    router.push(`/stories/${storyId}/analysis`);
  }

  return (
    <PageShell>
      <PageContainer className="max-w-6xl">
        <PageHeader
          eyebrow="Import Novel"
          title="Import Story"
          description="Paste raw novel text, detect chapters locally, and save chapters/chunks into IndexedDB for analysis."
        />

        <SectionCard title="Large Story Import">
          <div className="space-y-2">
            <ImportHint>
              Local worker handles detection/chunking to reduce UI blocking.
              Data is saved to IndexedDB.
            </ImportHint>
            <ImportHint>
              For 3000+ chapters, use persistent storage and export backups
              later from Data Health.
            </ImportHint>
            <ImportHint>
              Import can be cancelled while processing.
            </ImportHint>
          </div>
        </SectionCard>

        <div className="space-y-3">
          <div className="app-warning-box max-w-3xl">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>
              IndexedDB is the source of truth for long story, chapter, and
              chunk data in this local-first prototype.
            </p>
          </div>
          <div className="flex max-w-3xl gap-3 rounded-lg border bg-background p-4 text-sm text-muted-foreground">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>
              Browser key-value storage is reserved for small UI preferences
              and temporary compatibility reads, not new large imports.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <SectionCard
            icon={<Upload className="h-5 w-5" />}
            title="Novel source"
            contentClassName="space-y-5"
          >
            <div className="app-form-grid">
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
              <Label htmlFor="novel-content">Raw story text</Label>
              <Textarea
                id="novel-content"
                className="min-h-[520px] text-sm leading-6"
                value={novelText}
                onChange={(event) => setNovelText(event.target.value)}
                placeholder="Paste toàn bộ truyện hoặc nhiều chương vào đây..."
              />
              <ImportHint>
                Paste the full text here. Chapter detection runs locally; no AI
                request is made during import.
              </ImportHint>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleDetectChapters}
                disabled={!novelText.trim() || isDetecting || isCreating}
              >
                <BookOpenCheck className="mr-2 h-4 w-4" />
                {isDetecting ? "Đang detect..." : "Detect chapters locally"}
              </Button>
              <Button
                type="button"
                onClick={handleCreateStoryFromImport}
                disabled={!novelText.trim() || isCreating || isDetecting}
              >
                <FileText className="mr-2 h-4 w-4" />
                {isCreating ? "Đang tạo..." : "Create story in IndexedDB"}
              </Button>
              {isDetecting || isCreating ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelImportProcessing}
                >
                  Cancel processing
                </Button>
              ) : null}
            </div>

            {importProgress ? (
              <div className="rounded-lg border bg-background p-4">
                <ProgressMeter
                  value={importProgress.percentComplete}
                  label={importProgress.status}
                  description={`${importProgress.message} ${importProgress.chapterCount.toLocaleString("vi-VN")} chapters · ${importProgress.chunkCount.toLocaleString("vi-VN")} chunks`}
                />
                <ImportHint>
                  Import worker is processing locally. You can cancel this run
                  without deleting already saved story data.
                </ImportHint>
              </div>
            ) : null}

            <div className="app-warning-box">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <p>
                Large imports may take time. Keep this tab open until
                processing completes.
              </p>
            </div>

            {createError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {createError}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Preview chương">
            {detectedChapters.length > 0 ? (
              <div className="space-y-3">
                <ImportHint>
                  Review detected chapter count before creating the story. You
                  can re-run detection after editing the raw text.
                </ImportHint>
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
                        {chapter.wordCount.toLocaleString("vi-VN")} từ ước tính
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(
                          chunkCountsByChapterId[chapter.id] ?? 0
                        ).toLocaleString("vi-VN")}{" "}
                        chunks
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Chưa detect chương"
                description="Paste nội dung truyện rồi bấm Detect chapters để xem preview."
              />
            )}
          </SectionCard>
        </div>
      </PageContainer>
    </PageShell>
  );
}

function ImportHint({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>;
}
