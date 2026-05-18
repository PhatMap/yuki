"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  FileText,
  Search,
  Upload,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { ProgressMeter } from "@/components/app/progress-meter";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveImportedStoryData } from "@/lib/db/indexed-db";
import { runLocalImportWorker } from "@/lib/import/run-local-import-worker";
import type { LocalImportWorkerProgressSnapshot } from "@/lib/import/local-import-worker-types";
import type { ChapterChunk, ImportedChapter, Story } from "@/lib/types";

const tempStoryId = "preview-import-story";
const MAX_VISIBLE_CHAPTERS = 240;

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
  const [importFileName, setImportFileName] = useState("");
  const [importFileSize, setImportFileSize] = useState<number | null>(null);
  const [chapterSearch, setChapterSearch] = useState("");
  const [jumpChapterValue, setJumpChapterValue] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const hasText = novelText.trim().length > 0;
  const hasDetectedChapters = detectedChapters.length > 0;
  const currentStepIndex = !hasText ? 0 : 1;

  const chapterSearchKeyword = chapterSearch.trim().toLowerCase();
  const filteredChapters = useMemo(() => {
    if (!chapterSearchKeyword) return detectedChapters;

    return detectedChapters.filter((chapter) => {
      return (
        String(chapter.chapterNumber).includes(chapterSearchKeyword) ||
        chapter.title.toLowerCase().includes(chapterSearchKeyword)
      );
    });
  }, [chapterSearchKeyword, detectedChapters]);

  const visibleChapters = useMemo(
    () => filteredChapters.slice(0, MAX_VISIBLE_CHAPTERS),
    [filteredChapters],
  );

  const selectedChapter = useMemo(() => {
    const selected =
      detectedChapters.find((chapter) => chapter.id === selectedChapterId) ??
      detectedChapters[0];
    return selected;
  }, [detectedChapters, selectedChapterId]);

  const selectedChapterIndex = selectedChapter
    ? detectedChapters.findIndex((chapter) => chapter.id === selectedChapter.id)
    : -1;
  const previousChapter =
    selectedChapterIndex > 0
      ? detectedChapters[selectedChapterIndex - 1]
      : undefined;
  const nextChapter =
    selectedChapterIndex >= 0 && selectedChapterIndex < detectedChapters.length - 1
      ? detectedChapters[selectedChapterIndex + 1]
      : undefined;

  const duplicateChapterNumbers = useMemo(() => {
    const seen = new Set<number>();
    const duplicateNumbers = new Set<number>();

    for (const chapter of detectedChapters) {
      if (seen.has(chapter.chapterNumber)) {
        duplicateNumbers.add(chapter.chapterNumber);
      } else {
        seen.add(chapter.chapterNumber);
      }
    }

    return Array.from(duplicateNumbers).sort((a, b) => a - b);
  }, [detectedChapters]);

  const genericTitleCount = useMemo(() => {
    return detectedChapters.filter((chapter) => {
      const normalizedTitle = chapter.title.trim().toLowerCase();
      return (
        normalizedTitle.length === 0 ||
        normalizedTitle === "chapter" ||
        normalizedTitle === "chương" ||
        normalizedTitle === "untitled"
      );
    }).length;
  }, [detectedChapters]);

  const showSingleChapterWarning =
    detectedChapters.length === 1 && totalWordCount >= 5000;

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

  async function handleImportTextFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setCreateError("Yuki hiện hỗ trợ file .txt cho bước nạp nhanh.");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const inferredTitle = inferTitleFromFileName(file.name);

      setNovelText(text);
      setImportFileName(file.name);
      setImportFileSize(file.size);
      setTitle((current) => (current.trim().length > 0 ? current : inferredTitle));
      setDetectedChapters([]);
      setDetectedChunks([]);
      setSelectedChapterId(undefined);
      setCreateError("");
      setImportProgress(undefined);
    } catch (error) {
      console.error("Failed to read import text file", error);
      setCreateError("Không thể đọc file TXT.");
    } finally {
      event.target.value = "";
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
        { storyId: tempStoryId, text: novelText },
        { signal: controller.signal, onProgress: setImportProgress },
      );

      setDetectedChapters(result.chapters);
      setDetectedChunks(result.chunks);
      setSelectedChapterId(result.chapters[0]?.id);
      setImportProgress({
        status: "completed",
        message: "Đã tách chương xong.",
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
          ? `Không thể tách chương: ${error.message}`
          : "Không thể tách chương.",
      );
    } finally {
      clearImportAbortController(controller);
      setIsDetecting(false);
    }
  }

  async function handleCreateStoryFromImport() {
    if (isCreating || detectedChapters.length === 0) return;

    setIsCreating(true);
    setCreateError("");
    const controller = createImportAbortController();
    const storyId = `story-${Date.now()}`;

    try {
      const processedImport = await runLocalImportWorker(
        { storyId, text: novelText },
        { signal: controller.signal, onProgress: setImportProgress },
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
          importedChapters[0]?.cleanContent.slice(0, 240) || "Truyện dài đã nhập.",
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
      setCreateError("Không thể lưu dữ liệu truyện đã nhập.");
      setIsCreating(false);
      return;
    } finally {
      clearImportAbortController(controller);
    }

    router.push(`/stories/${storyId}/analysis`);
  }

  function handleJumpToChapter() {
    const chapterNumber = Number(jumpChapterValue);
    if (!Number.isFinite(chapterNumber)) return;

    const target = detectedChapters.find(
      (chapter) => chapter.chapterNumber === chapterNumber,
    );
    if (target) {
      setSelectedChapterId(target.id);
    }
  }

  return (
    <PageShell>
      <PageContainer className="max-w-7xl">
        <PageHeader
          eyebrow="Nhập truyện"
          title="Nạp truyện vào Yuki"
          description="Upload file TXT. Yuki sẽ tự tách chương, cho bạn kiểm tra lại, rồi mới lưu để phân tích."
          action={
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/">Về Dashboard</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/stories">Thư viện truyện</Link>
              </Button>
            </>
          }
        />

        <SectionCard title="Workflow">
          <div className="grid gap-2 md:grid-cols-5">
            {[
              "Nạp liệu",
              "Kiểm tra chương",
              "Quét nhanh",
              "Phân tích sâu",
              "Story Bible",
            ].map((step, index) => (
              <div
                key={step}
                className={
                  index === currentStepIndex
                    ? "rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium"
                    : "rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground"
                }
              >
                {step}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Việc tiếp theo">
          {!hasText ? (
            <div>
              <div>
                <p className="text-sm font-medium">Upload file truyện</p>
                <p className="text-sm text-muted-foreground">
                  Chọn file TXT ở khối Nạp liệu bên dưới. File nên chứa toàn bộ truyện.
                </p>
              </div>
            </div>
          ) : !hasDetectedChapters ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Tách chương</p>
                <p className="text-sm text-muted-foreground">
                  Yuki sẽ nhận diện tiêu đề chương và tạo danh sách chương để bạn
                  kiểm tra.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleDetectChapters}
                disabled={isDetecting || isCreating}
              >
                Tách chương
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Kiểm tra chương đã tách</p>
                <p className="text-sm text-muted-foreground">
                  Xem số chương, kiểm tra chương đầu/cuối, rồi lưu để phân tích.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleCreateStoryFromImport}
                  disabled={isCreating || isDetecting || !hasDetectedChapters}
                >
                  Lưu và phân tích
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDetectChapters}
                  disabled={isDetecting || isCreating}
                >
                  Tách lại
                </Button>
              </div>
            </div>
          )}
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <SectionCard
            icon={<Upload className="h-5 w-5" />}
            title="Nạp liệu"
            contentClassName="space-y-5"
          >
            <div className="rounded-xl border border-dashed bg-background p-4">
              <p className="text-sm font-medium">Kéo thả hoặc chọn file TXT</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Hỗ trợ định dạng .txt
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                File nên chứa toàn bộ truyện trong một lần nạp. Yuki tự nhận diện
                chương từ tiêu đề.
              </p>
              <Input
                ref={fileInputRef}
                className="mt-3"
                type="file"
                accept=".txt,text/plain"
                onChange={handleImportTextFile}
              />

              {importFileName ? (
                <div className="mt-3 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{importFileName}</p>
                  {importFileSize !== null ? (
                    <p className="mt-1">{(importFileSize / 1024).toFixed(1)} KB</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleDetectChapters}
                disabled={!novelText.trim() || isDetecting || isCreating}
              >
                <BookOpenCheck className="mr-2 h-4 w-4" />
                {isDetecting ? "Đang tách..." : "Tách chương"}
              </Button>
              <Button
                type="button"
                onClick={handleCreateStoryFromImport}
                disabled={!hasDetectedChapters || isCreating || isDetecting}
              >
                <FileText className="mr-2 h-4 w-4" />
                {isCreating ? "Đang lưu..." : "Lưu và phân tích"}
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
                  description={`${importProgress.chapterCount.toLocaleString("vi-VN")} chương · ${importProgress.chunkCount.toLocaleString("vi-VN")} đoạn`}
                />
              </div>
            ) : null}

            {createError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {createError}
              </p>
            ) : null}
          </SectionCard>

          <div className="space-y-6">
            <SectionCard
              title="Thông tin truyện"
              description="Yuki tự lấy tên từ file nếu bạn để trống. Chỉ sửa tay khi tên truyện hoặc tác giả chưa đúng."
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
            </SectionCard>

            <SectionCard title="Kiểm tra sau khi tách">
              {hasDetectedChapters ? (
                <div className="space-y-3">
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <PreflightRow
                      label="Số chương"
                      value={detectedChapters.length.toLocaleString("vi-VN")}
                    />
                    <PreflightRow
                      label="Số từ ước tính"
                      value={totalWordCount.toLocaleString("vi-VN")}
                    />
                    <PreflightRow
                      label="Số đoạn"
                      value={detectedChunks.length.toLocaleString("vi-VN")}
                    />
                    <PreflightRow
                      label="Chương đầu"
                      value={`Chương ${detectedChapters[0]?.chapterNumber ?? "-"}`}
                    />
                    <PreflightRow
                      label="Chương cuối"
                      value={`Chương ${detectedChapters.at(-1)?.chapterNumber ?? "-"}`}
                    />
                  </div>

                  {showSingleChapterWarning ? (
                    <WarningText text="Có thể Yuki chưa nhận diện đúng tiêu đề chương." />
                  ) : null}
                  {duplicateChapterNumbers.length > 0 ? (
                    <WarningText
                      text={`Phát hiện chapter number trùng: ${duplicateChapterNumbers.join(", ")}.`}
                    />
                  ) : null}
                  {genericTitleCount > 0 ? (
                    <WarningText
                      text={`Có ${genericTitleCount.toLocaleString("vi-VN")} chương có title trống hoặc quá chung.`}
                    />
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="Chưa có dữ liệu tách chương"
                  description="Upload TXT, sau đó bấm Tách chương."
                />
              )}
            </SectionCard>

            <SectionCard title="Quét nhanh / Bản đồ arc">
              <p className="text-sm text-muted-foreground">
                Bước tiếp theo sau khi kiểm tra chương là Quét nhanh để lập map
                chương đáng chú ý và chọn phần cần phân tích sâu.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled>
                  Quét nhanh (sắp có)
                </Button>
                <Button type="button" size="sm" variant="outline" disabled>
                  Tạo bản đồ arc (sắp có)
                </Button>
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="Danh sách chương">
          {hasDetectedChapters ? (
            <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={chapterSearch}
                      onChange={(event) => setChapterSearch(event.target.value)}
                      placeholder="Tìm chương..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={jumpChapterValue}
                      onChange={(event) => setJumpChapterValue(event.target.value)}
                      placeholder="Nhảy chương số..."
                    />
                    <Button type="button" variant="outline" onClick={handleJumpToChapter}>
                      Đi
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Hiển thị {visibleChapters.length.toLocaleString("vi-VN")} /{" "}
                  {filteredChapters.length.toLocaleString("vi-VN")} chương
                </p>

                <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
                  {visibleChapters.map((chapter) => (
                    <button
                      key={chapter.id}
                      type="button"
                      className={
                        chapter.id === selectedChapter?.id
                          ? "w-full rounded-lg border border-primary/40 bg-primary/10 p-3 text-left"
                          : "w-full rounded-lg border bg-background p-3 text-left hover:bg-muted/50"
                      }
                      onClick={() => setSelectedChapterId(chapter.id)}
                    >
                      <p className="text-xs text-muted-foreground">
                        Chương {chapter.chapterNumber}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium">
                        {chapter.title || "(Không có tiêu đề)"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {chapter.wordCount.toLocaleString("vi-VN")} từ ·{" "}
                        {(chunkCountsByChapterId[chapter.id] ?? 0).toLocaleString("vi-VN")} đoạn
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">Xem trước chương</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!previousChapter}
                      onClick={() => setSelectedChapterId(previousChapter?.id)}
                    >
                      <ArrowLeft className="mr-1 h-4 w-4" />
                      Trước
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!nextChapter}
                      onClick={() => setSelectedChapterId(nextChapter?.id)}
                    >
                      Sau
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {selectedChapter ? (
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      Chương {selectedChapter.chapterNumber}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {selectedChapter.title || "(Không có tiêu đề)"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedChapter.wordCount.toLocaleString("vi-VN")} từ ·{" "}
                      {(chunkCountsByChapterId[selectedChapter.id] ?? 0).toLocaleString("vi-VN")} đoạn
                    </p>
                    <div className="mt-3 max-h-[360px] overflow-auto rounded-lg border bg-muted/30 p-3 text-sm leading-6">
                      {selectedChapter.cleanContent.slice(0, 5000)}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="Chưa chọn chương"
                    description="Chọn một chương từ danh sách để xem trước."
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              title="Chưa tách được chương"
              description="Upload TXT, sau đó bấm Tách chương."
            />
          )}
        </SectionCard>
      </PageContainer>
    </PageShell>
  );
}

function getImportStatusLabel(
  status: LocalImportWorkerProgressSnapshot["status"],
) {
  if (status === "completed") return "Hoàn tất";
  if (status === "detecting") return "Đang nhận diện chương";
  if (status === "chunking") return "Đang tách chương";
  return status;
}

function inferTitleFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, "");
  const normalized = withoutExtension.replace(/[_-]+/g, " ").trim();
  return normalized.length > 0 ? normalized : "Truyện đã nhập";
}

function PreflightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function WarningText({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
      {text}
    </p>
  );
}
