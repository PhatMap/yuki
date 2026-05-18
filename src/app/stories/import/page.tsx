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
            message: "Đã hủy xử lý nhập truyện.",
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
        message: "Bản xem trước đã sẵn sàng.",
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
          ? `Không thể tạo bản xem trước: ${error.message}`
          : "Không thể tạo bản xem trước.",
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
      const storyTitle = title.trim() || "Truyện đã nhập";

      const newStory: Story = {
        id: storyId,
        title: storyTitle,
        description:
          importedChapters[0]?.cleanContent.slice(0, 240) ||
          "Truyện dài đã nhập.",
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
      setCreateError("Không thể lưu dữ liệu truyện đã nhập vào IndexedDB.");
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
          eyebrow="Nhập truyện"
          title="Nhập truyện"
          description="Dán raw text của truyện, tách chương cục bộ, rồi lưu chapter/chunk vào IndexedDB để phân tích."
        />

        <SectionCard title="Nhập truyện dài">
          <div className="space-y-2">
            <ImportHint>
              Local worker xử lý tách chương/chunk để giảm nghẽn UI. Dữ liệu
              được lưu vào IndexedDB.
            </ImportHint>
            <ImportHint>
              Với truyện 3000+ chương, nên bật persistent storage và export
              backup sau từ Data Health.
            </ImportHint>
            <ImportHint>
              Có thể hủy quá trình nhập khi worker đang xử lý.
            </ImportHint>
          </div>
        </SectionCard>

        <div className="space-y-3">
          <div className="app-warning-box max-w-3xl">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>
              IndexedDB là source of truth cho dữ liệu truyện dài, chương và
              chunk trong bản local-first prototype này.
            </p>
          </div>
          <div className="flex max-w-3xl gap-3 rounded-lg border bg-background p-4 text-sm text-muted-foreground">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>
              Browser key-value storage chỉ dành cho UI preferences nhỏ và
              temporary compatibility reads, không dùng cho import lớn mới.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <SectionCard
            icon={<Upload className="h-5 w-5" />}
            title="Nguồn truyện"
            contentClassName="space-y-5"
          >
            <div className="app-form-grid">
              <div className="grid gap-2">
                <Label htmlFor="novel-title">Tên truyện</Label>
                <Input
                  id="novel-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ví dụ: Nguyệt Dạ Đao Ký"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="novel-author">Tác giả</Label>
                <Input
                  id="novel-author"
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Tên tác giả hoặc nguồn truyện"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="novel-content">Raw text truyện</Label>
              <Textarea
                id="novel-content"
                className="min-h-[520px] text-sm leading-6"
                value={novelText}
                onChange={(event) => setNovelText(event.target.value)}
                placeholder="Dán toàn bộ truyện hoặc nhiều chương vào đây..."
              />
              <ImportHint>
                Dán full text vào đây. Tách chương chạy cục bộ; bước import
                không gửi AI request.
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
                {isDetecting ? "Đang tách..." : "Tách chương cục bộ"}
              </Button>
              <Button
                type="button"
                onClick={handleCreateStoryFromImport}
                disabled={!novelText.trim() || isCreating || isDetecting}
              >
                <FileText className="mr-2 h-4 w-4" />
                {isCreating ? "Đang tạo..." : "Tạo truyện trong IndexedDB"}
              </Button>
              {isDetecting || isCreating ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelImportProcessing}
                >
                  Hủy xử lý
                </Button>
              ) : null}
            </div>

            {importProgress ? (
              <div className="rounded-lg border bg-background p-4">
                <ProgressMeter
                  value={importProgress.percentComplete}
                  label={getImportStatusLabel(importProgress.status)}
                  description={`${importProgress.message} ${importProgress.chapterCount.toLocaleString("vi-VN")} chương · ${importProgress.chunkCount.toLocaleString("vi-VN")} chunk`}
                />
                <ImportHint>
                  Import worker đang xử lý cục bộ. Có thể hủy lượt chạy này
                  mà không xóa dữ liệu truyện đã lưu trước đó.
                </ImportHint>
              </div>
            ) : null}

            <div className="app-warning-box">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <p>
                Import lớn có thể mất thời gian. Giữ tab này mở đến khi xử lý
                hoàn tất.
              </p>
            </div>

            {createError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {createError}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Xem trước chương">
            {detectedChapters.length > 0 ? (
              <div className="space-y-3">
                <ImportHint>
                  Kiểm tra số chương đã tách trước khi tạo truyện. Có thể chạy
                  lại sau khi chỉnh raw text.
                </ImportHint>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">
                    Đã tách {detectedChapters.length.toLocaleString("vi-VN")} chương
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Khoảng {totalWordCount.toLocaleString("vi-VN")} từ |{" "}
                    {detectedChunks.length.toLocaleString("vi-VN")} chunk
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
                        Khoảng {chapter.wordCount.toLocaleString("vi-VN")} từ
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(
                          chunkCountsByChapterId[chapter.id] ?? 0
                        ).toLocaleString("vi-VN")}{" "}
                        chunk
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Chưa tách được chương"
                description="Dán raw text truyện rồi bấm Tách chương cục bộ để xem trước kết quả."
              />
            )}
          </SectionCard>
        </div>
      </PageContainer>
    </PageShell>
  );
}

function getImportStatusLabel(status: LocalImportWorkerProgressSnapshot["status"]) {
  if (status === "completed") return "Hoàn tất";
  if (status === "detecting") return "Đang phát hiện chương";
  if (status === "chunking") return "Đang chunk";

  return status;
}

function ImportHint({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>;
}
