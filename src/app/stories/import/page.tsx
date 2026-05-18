"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpenCheck, FileText, Search, Upload } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { ProgressMeter } from "@/components/app/progress-meter";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiSetupBlockingCard } from "@/components/settings/ai-setup-blocking-card";
import { saveImportedStoryData } from "@/lib/db/indexed-db";
import { runLocalImportWorker } from "@/lib/import/run-local-import-worker";
import { getAiSetupReadiness, type AiSetupReadiness } from "@/lib/settings/ai-setup-readiness";
import type { LocalImportWorkerProgressSnapshot } from "@/lib/import/local-import-worker-types";
import type { ChapterChunk, ImportedChapter, Story } from "@/lib/types";

const tempStoryId = "preview-import-story";
const MAX_VISIBLE_CHAPTERS = 240;

export default function ImportNovelPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [novelText, setNovelText] = useState("");
  const [detectedChapters, setDetectedChapters] = useState<ImportedChapter[]>([]);
  const [detectedChunks, setDetectedChunks] = useState<ChapterChunk[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [importProgress, setImportProgress] = useState<LocalImportWorkerProgressSnapshot>();
  const [isDetecting, setIsDetecting] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importFileSize, setImportFileSize] = useState<number | null>(null);
  const [chapterSearch, setChapterSearch] = useState("");
  const [jumpChapterValue, setJumpChapterValue] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>();
  const [setupReadiness, setSetupReadiness] = useState<AiSetupReadiness>();
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadSectionRef = useRef<HTMLDivElement | null>(null);
  const preflightSectionRef = useRef<HTMLDivElement | null>(null);
  const chapterListSectionRef = useRef<HTMLDivElement | null>(null);
  const importAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReadiness() {
      try {
        const readiness = await getAiSetupReadiness();
        if (!active) return;
        setSetupReadiness(readiness);
      } catch (error) {
        console.error("Failed to read AI setup readiness", error);
      } finally {
        if (active) {
          setIsCheckingSetup(false);
        }
      }
    }

    void loadReadiness();

    return () => {
      active = false;
    };
  }, []);

  const totalWordCount = useMemo(() => detectedChapters.reduce((total, chapter) => total + chapter.wordCount, 0), [detectedChapters]);
  const chunkCountsByChapterId = useMemo(() => detectedChunks.reduce<Record<string, number>>((counts, chunk) => {
    counts[chunk.chapterId] = (counts[chunk.chapterId] ?? 0) + 1;
    return counts;
  }, {}), [detectedChunks]);

  const hasText = novelText.trim().length > 0;
  const hasDetectedChapters = detectedChapters.length > 0;
  const selectedChapter = detectedChapters.find((chapter) => chapter.id === selectedChapterId) ?? detectedChapters[0];
  const selectedChapterIndex = selectedChapter ? detectedChapters.findIndex((chapter) => chapter.id === selectedChapter.id) : -1;
  const previousChapter = selectedChapterIndex > 0 ? detectedChapters[selectedChapterIndex - 1] : undefined;
  const nextChapter = selectedChapterIndex >= 0 && selectedChapterIndex < detectedChapters.length - 1 ? detectedChapters[selectedChapterIndex + 1] : undefined;
  const filteredChapters = useMemo(() => {
    const keyword = chapterSearch.trim().toLowerCase();
    if (!keyword) return detectedChapters;
    return detectedChapters.filter((chapter) => String(chapter.chapterNumber).includes(keyword) || chapter.title.toLowerCase().includes(keyword));
  }, [chapterSearch, detectedChapters]);
  const visibleChapters = filteredChapters.slice(0, MAX_VISIBLE_CHAPTERS);

  const duplicateChapterNumbers = useMemo(() => {
    const seen = new Set<number>();
    const duplicates = new Set<number>();
    for (const chapter of detectedChapters) {
      if (seen.has(chapter.chapterNumber)) duplicates.add(chapter.chapterNumber);
      seen.add(chapter.chapterNumber);
    }
    return Array.from(duplicates).sort((a, b) => a - b);
  }, [detectedChapters]);

  const genericTitleCount = useMemo(() => detectedChapters.filter((chapter) => {
    const value = chapter.title.trim().toLowerCase();
    return value.length === 0 || value === "chapter" || value === "chương" || value === "untitled";
  }).length, [detectedChapters]);

  const nextAction = !hasText
    ? { title: "Nạp truyện", description: "Chọn file TXT chứa toàn bộ truyện." }
    : !hasDetectedChapters
      ? { title: "Tách chương", description: "Nhận diện tiêu đề chương để tạo danh sách kiểm tra." }
      : { title: "Kiểm tra và lưu truyện", description: "Xem chương đầu/cuối, cảnh báo tách chương, rồi lưu để phân tích." };

  function createImportAbortController() {
    importAbortControllerRef.current?.abort();
    const controller = new AbortController();
    importAbortControllerRef.current = controller;
    return controller;
  }

  function clearImportAbortController(controller: AbortController) {
    if (importAbortControllerRef.current === controller) importAbortControllerRef.current = null;
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
      setNovelText(text);
      setImportFileName(file.name);
      setImportFileSize(file.size);
      setTitle((current) => current.trim() || inferTitleFromFileName(file.name));
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
    setImportProgress((current) => current ? { ...current, status: "completed", message: "Đã hủy xử lý nhập truyện." } : undefined);
  }

  async function handleDetectChapters() {
    if (isDetecting || isCreating) return;
    setIsDetecting(true);
    setCreateError("");
    setImportProgress(undefined);
    const controller = createImportAbortController();
    try {
      const result = await runLocalImportWorker({ storyId: tempStoryId, text: novelText }, { signal: controller.signal, onProgress: setImportProgress });
      setDetectedChapters(result.chapters);
      setDetectedChunks(result.chunks);
      setSelectedChapterId(result.chapters[0]?.id);
      setImportProgress({ status: "completed", message: "Đã tách chương xong.", chapterCount: result.chapters.length, chunkCount: result.chunks.length, percentComplete: 100 });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setCreateError("");
        return;
      }
      console.error("Failed to process import preview", error);
      setCreateError(error instanceof Error ? `Không thể tách chương: ${error.message}` : "Không thể tách chương.");
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
      const processedImport = await runLocalImportWorker({ storyId, text: novelText }, { signal: controller.signal, onProgress: setImportProgress });
      if (processedImport.chapters.length === 0) {
        setIsCreating(false);
        setCreateError("Không thể tạo chương từ nội dung đã nhập.");
        return;
      }
      const now = new Date().toISOString();
      const newStory: Story = {
        id: storyId,
        title: title.trim() || "Truyện đã nhập",
        description: processedImport.chapters[0]?.cleanContent.slice(0, 240) || "Truyện dài đã nhập.",
        author: author.trim(),
        genre: "adventure",
        tone: "dramatic",
        canonAdherence: "completely-different",
        isFanwork: false,
        source: "import",
        createdAt: now,
        updatedAt: now,
      };
      await saveImportedStoryData({ story: newStory, chapters: processedImport.chapters, chunks: processedImport.chunks, analysisStatus: processedImport.analysisStatus });
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
    const target = detectedChapters.find((chapter) => chapter.chapterNumber === chapterNumber);
    if (target) setSelectedChapterId(target.id);
  }

  function handleOpenCurrentStep() {
    const target = hasDetectedChapters ? chapterListSectionRef.current : hasText ? preflightSectionRef.current : uploadSectionRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!hasText) fileInputRef.current?.focus();
  }

  function handleRunSuggestedStep() {
    if (!hasText) {
      fileInputRef.current?.click();
      return;
    }
    if (!hasDetectedChapters) {
      void handleDetectChapters();
      return;
    }
    void handleCreateStoryFromImport();
  }

  if (isCheckingSetup) {
    return (
      <PageShell>
        <PageContainer className="max-w-7xl">
          <SectionCard title="Đang kiểm tra AI setup">
            <p className="app-muted-text">Đang tải trạng thái provider và test kết nối...</p>
          </SectionCard>
        </PageContainer>
      </PageShell>
    );
  }

  if (!setupReadiness?.canUseStoryWorkflow) {
    return (
      <PageShell>
        <PageContainer className="max-w-7xl">
          <PageHeader
            eyebrow="Nhập truyện"
            title="Cần thiết lập AI trước khi nạp truyện"
            description="Hoàn tất provider/API key/model/test trước khi nạp và phân tích truyện."
            action={
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href="/">Về Dashboard</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/settings">Thiết lập AI</Link>
                </Button>
              </>
            }
          />
          <AiSetupBlockingCard readiness={setupReadiness} />
        </PageContainer>
      </PageShell>
    );
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
              <Button asChild variant="outline" size="sm"><Link href="/">Về Dashboard</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href="/stories">Thư viện truyện</Link></Button>
            </>
          }
        />

        <SectionCard title="Quy trình nạp truyện">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-2 md:grid-cols-5">
              {[
                { label: "Nạp truyện", status: hasDetectedChapters ? `${detectedChapters.length.toLocaleString("vi-VN")} chương đã tách` : hasText ? "đã nạp truyện" : "chưa nạp truyện" },
                { label: "Quét nhanh", status: "sau khi lưu truyện" },
                { label: "Phân tích sâu", status: "chọn phần quan trọng" },
                { label: "Canon Pack", status: "đóng gói context" },
                { label: "Đưa vào Story Bible", status: "sẵn sàng để viết" },
              ].map((step, index) => (
                <div key={step.label} className={index === 0 ? "rounded-lg border border-primary/40 bg-primary/10 px-3 py-2" : "rounded-lg border bg-background px-3 py-2 text-muted-foreground"}>
                  <span className="block text-sm font-medium">{step.label}</span>
                  <small className="mt-1 block text-xs leading-4 text-muted-foreground">{step.status}</small>
                </div>
              ))}
            </div>
            <div className="rounded-xl border bg-background p-4">
              <strong className="text-sm">Việc tiếp theo</strong>
              <p className="mt-1 text-sm font-medium">{nextAction.title}</p>
              <small className="mt-1 block text-xs leading-5 text-muted-foreground">{nextAction.description}</small>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleOpenCurrentStep}>Mở bước này<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
                <Button type="button" size="sm" onClick={handleRunSuggestedStep} disabled={isDetecting || isCreating || (hasText && !novelText.trim())}>Chạy bước đề xuất</Button>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <SectionCard icon={<Upload className="h-5 w-5" />} title="Nạp truyện" contentClassName="space-y-5">
            <div ref={uploadSectionRef} className="rounded-xl border border-dashed bg-background p-4">
              <p className="text-sm font-medium">Kéo thả hoặc chọn file TXT</p>
              <p className="mt-1 text-xs text-muted-foreground">Hỗ trợ định dạng .txt</p>
              <p className="mt-1 text-xs text-muted-foreground">File nên chứa toàn bộ truyện trong một lần nạp. Yuki tự nhận diện chương từ tiêu đề.</p>
              <Input ref={fileInputRef} className="mt-3" type="file" accept=".txt,text/plain" onChange={handleImportTextFile} />
              {importFileName ? (
                <div className="mt-3 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{importFileName}</p>
                  {importFileSize !== null ? <p className="mt-1">{(importFileSize / 1024).toFixed(1)} KB</p> : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={handleDetectChapters} disabled={!novelText.trim() || isDetecting || isCreating}><BookOpenCheck className="mr-2 h-4 w-4" />{isDetecting ? "Đang tách..." : "Tách chương"}</Button>
              <Button type="button" onClick={handleCreateStoryFromImport} disabled={!hasDetectedChapters || isCreating || isDetecting}><FileText className="mr-2 h-4 w-4" />{isCreating ? "Đang lưu..." : "Lưu và phân tích"}</Button>
              {isDetecting || isCreating ? <Button type="button" variant="outline" onClick={handleCancelImportProcessing}>Hủy xử lý</Button> : null}
            </div>

            {importProgress ? <div className="rounded-lg border bg-background p-4"><ProgressMeter value={importProgress.percentComplete} label={getImportStatusLabel(importProgress.status)} description={`${importProgress.chapterCount.toLocaleString("vi-VN")} chương · ${importProgress.chunkCount.toLocaleString("vi-VN")} đoạn`} /></div> : null}
            {createError ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{createError}</p> : null}
          </SectionCard>

          <div className="space-y-6">
            <SectionCard title="Thông tin truyện" description="Yuki tự lấy tên từ file nếu bạn để trống. Chỉ sửa tay khi tên truyện hoặc tác giả chưa đúng.">
              <div className="app-form-grid">
                <div className="grid gap-2"><Label htmlFor="novel-title">Tên truyện</Label><Input id="novel-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Nguyệt Dạ Đao Ký" /></div>
                <div className="grid gap-2"><Label htmlFor="novel-author">Tác giả</Label><Input id="novel-author" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Tên tác giả hoặc nguồn truyện" /></div>
              </div>
            </SectionCard>

            <SectionCard title="Kiểm tra sau khi tách"><div ref={preflightSectionRef}>{hasDetectedChapters ? <PreflightSummary chapterCount={detectedChapters.length} wordCount={totalWordCount} chunkCount={detectedChunks.length} firstChapterNumber={detectedChapters[0]?.chapterNumber} lastChapterNumber={detectedChapters.at(-1)?.chapterNumber} showSingleChapterWarning={detectedChapters.length === 1 && totalWordCount >= 5000} duplicateChapterNumbers={duplicateChapterNumbers} genericTitleCount={genericTitleCount} /> : <EmptyState title="Chưa có dữ liệu tách chương" description="Upload TXT, sau đó bấm Tách chương." />}</div></SectionCard>

            <SectionCard title="Quét nhanh / Bản đồ arc">
              <p className="text-sm text-muted-foreground">Bước tiếp theo sau khi kiểm tra chương là Quét nhanh để lập map chương đáng chú ý và chọn phần cần phân tích sâu.</p>
              <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" disabled>Quét nhanh (sắp có)</Button><Button type="button" size="sm" variant="outline" disabled>Tạo bản đồ arc (sắp có)</Button></div>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="Danh sách chương"><div ref={chapterListSectionRef}>{hasDetectedChapters ? <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]"><div className="space-y-3"><div className="grid gap-2 sm:grid-cols-2"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={chapterSearch} onChange={(event) => setChapterSearch(event.target.value)} placeholder="Tìm chương..." /></div><div className="flex gap-2"><Input value={jumpChapterValue} onChange={(event) => setJumpChapterValue(event.target.value)} placeholder="Nhảy chương số..." /><Button type="button" variant="outline" onClick={handleJumpToChapter}>Đi</Button></div></div><p className="text-xs text-muted-foreground">Hiển thị {visibleChapters.length.toLocaleString("vi-VN")} / {filteredChapters.length.toLocaleString("vi-VN")} chương</p><div className="max-h-[520px] space-y-2 overflow-auto pr-1">{visibleChapters.map((chapter) => <button key={chapter.id} type="button" className={chapter.id === selectedChapter?.id ? "w-full rounded-lg border border-primary/40 bg-primary/10 p-3 text-left" : "w-full rounded-lg border bg-background p-3 text-left hover:bg-muted/50"} onClick={() => setSelectedChapterId(chapter.id)}><p className="text-xs text-muted-foreground">Chương {chapter.chapterNumber}</p><p className="mt-1 line-clamp-2 text-sm font-medium">{chapter.title || "(Không có tiêu đề)"}</p><p className="mt-1 text-xs text-muted-foreground">{chapter.wordCount.toLocaleString("vi-VN")} từ · {(chunkCountsByChapterId[chapter.id] ?? 0).toLocaleString("vi-VN")} đoạn</p></button>)}</div></div><div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-semibold">Xem trước chương</h3><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={!previousChapter} onClick={() => setSelectedChapterId(previousChapter?.id)}><ArrowLeft className="mr-1 h-4 w-4" />Trước</Button><Button type="button" variant="outline" size="sm" disabled={!nextChapter} onClick={() => setSelectedChapterId(nextChapter?.id)}>Sau<ArrowRight className="ml-1 h-4 w-4" /></Button></div></div>{selectedChapter ? <div className="rounded-xl border bg-background p-4"><p className="text-xs text-muted-foreground">Chương {selectedChapter.chapterNumber}</p><p className="mt-1 text-sm font-medium">{selectedChapter.title || "(Không có tiêu đề)"}</p><p className="mt-1 text-xs text-muted-foreground">{selectedChapter.wordCount.toLocaleString("vi-VN")} từ · {(chunkCountsByChapterId[selectedChapter.id] ?? 0).toLocaleString("vi-VN")} đoạn</p><div className="mt-3 max-h-[360px] overflow-auto rounded-lg border bg-muted/30 p-3 text-sm leading-6">{selectedChapter.cleanContent.slice(0, 5000)}</div></div> : <EmptyState title="Chưa chọn chương" description="Chọn một chương từ danh sách để xem trước." />}</div></div> : <EmptyState title="Chưa tách được chương" description="Upload TXT, sau đó bấm Tách chương." />}</div></SectionCard>
      </PageContainer>
    </PageShell>
  );
}

function getImportStatusLabel(status: LocalImportWorkerProgressSnapshot["status"]) {
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

function PreflightSummary({ chapterCount, wordCount, chunkCount, firstChapterNumber, lastChapterNumber, showSingleChapterWarning, duplicateChapterNumbers, genericTitleCount }: { chapterCount: number; wordCount: number; chunkCount: number; firstChapterNumber?: number; lastChapterNumber?: number; showSingleChapterWarning: boolean; duplicateChapterNumbers: number[]; genericTitleCount: number }) {
  return <div className="space-y-3"><div className="grid gap-2 text-sm md:grid-cols-2"><PreflightRow label="Số chương" value={chapterCount.toLocaleString("vi-VN")} /><PreflightRow label="Số từ ước tính" value={wordCount.toLocaleString("vi-VN")} /><PreflightRow label="Số đoạn" value={chunkCount.toLocaleString("vi-VN")} /><PreflightRow label="Chương đầu" value={`Chương ${firstChapterNumber ?? "-"}`} /><PreflightRow label="Chương cuối" value={`Chương ${lastChapterNumber ?? "-"}`} /></div>{showSingleChapterWarning ? <WarningText text="Có thể Yuki chưa nhận diện đúng tiêu đề chương." /> : null}{duplicateChapterNumbers.length > 0 ? <WarningText text={`Phát hiện chapter number trùng: ${duplicateChapterNumbers.join(", ")}.`} /> : null}{genericTitleCount > 0 ? <WarningText text={`Có ${genericTitleCount.toLocaleString("vi-VN")} chương có title trống hoặc quá chung.`} /> : null}</div>;
}

function PreflightRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-muted/30 p-2.5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function WarningText({ text }: { text: string }) {
  return <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{text}</p>;
}
