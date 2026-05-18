"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileText,
  GitBranch,
  ListTree,
  PenLine,
  Save,
  Search,
  Sparkles,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAnalysisResult,
  getBranchChanges,
  getImportedChapters,
  getRewriteDrafts,
  getStoryById,
  saveBranchChanges,
} from "@/lib/db/indexed-db";
import type {
  BranchChange,
  ImpactScope,
  ImportedChapter,
  RewriteDraft,
  Story,
  StoryAnalysisResult,
} from "@/lib/types";

interface StoryReaderClientProps {
  storyId: string;
}

interface ReaderData {
  story?: Story;
  chapters: ImportedChapter[];
  analysisResult?: StoryAnalysisResult;
  branchChanges: BranchChange[];
  rewriteDrafts: RewriteDraft[];
}

type ReaderPreviewMode = "original" | "rewrite";

const impactOptions: {
  value: ImpactScope;
  label: string;
  description: string;
}[] = [
  {
    value: "single_chapter",
    label: "Chỉ chương này",
    description: "Chỉ tạo yêu cầu sửa cho chương đang đọc.",
  },
  {
    value: "chapter_range",
    label: "Một đoạn chương",
    description: "Dùng khi thay đổi ảnh hưởng vài chương gần đó.",
  },
  {
    value: "from_chapter_forward",
    label: "Từ chương này trở về sau",
    description: "Dùng khi đổi tình tiết có thể ảnh hưởng toàn bộ phần sau.",
  },
];

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function getChapterFromQuery(
  chapters: ImportedChapter[],
  chapterQuery: string | null,
) {
  const chapterNumber = Number(chapterQuery);

  if (!Number.isFinite(chapterNumber)) {
    return chapters[0];
  }

  return (
    chapters.find((chapter) => chapter.chapterNumber === chapterNumber) ??
    chapters[0]
  );
}

function getAffectedChapterNumbers({
  chapters,
  currentChapter,
  impactScope,
}: {
  chapters: ImportedChapter[];
  currentChapter: ImportedChapter;
  impactScope: ImpactScope;
}) {
  if (impactScope === "from_chapter_forward") {
    return chapters
      .filter(
        (chapter) => chapter.chapterNumber >= currentChapter.chapterNumber,
      )
      .map((chapter) => chapter.chapterNumber);
  }

  if (impactScope === "chapter_range") {
    return chapters
      .filter(
        (chapter) =>
          chapter.chapterNumber >= currentChapter.chapterNumber &&
          chapter.chapterNumber <= currentChapter.chapterNumber + 5,
      )
      .map((chapter) => chapter.chapterNumber);
  }

  return [currentChapter.chapterNumber];
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function createChangeId() {
  return `reader-change-${Date.now()}`;
}

function getDraftRank(status: RewriteDraft["status"]) {
  if (status === "accepted") return 3;
  if (status === "reviewed") return 2;

  return 1;
}

function findBestRewriteDraftForChapter({
  chapter,
  rewriteDrafts,
}: {
  chapter?: ImportedChapter;
  rewriteDrafts: RewriteDraft[];
}) {
  if (!chapter) return undefined;

  return rewriteDrafts
    .filter((draft) => draft.targetChapterId === chapter.id)
    .sort((firstDraft, secondDraft) => {
      const statusDiff =
        getDraftRank(secondDraft.status) - getDraftRank(firstDraft.status);

      if (statusDiff !== 0) return statusDiff;

      return (
        new Date(secondDraft.updatedAt).getTime() -
        new Date(firstDraft.updatedAt).getTime()
      );
    })[0];
}

function getImportedChapterStatusLabel(status: ImportedChapter["status"]) {
  if (status === "imported") return "Đã nhập";
  if (status === "parsed") return "Đã tách";
  if (status === "analyzed") return "Đã phân tích";
  if (status === "failed") return "Lỗi";

  return status;
}

export function StoryReaderClient({ storyId }: StoryReaderClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [readerData, setReaderData] = useState<ReaderData>({
    chapters: [],
    branchChanges: [],
    rewriteDrafts: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [chapterSearch, setChapterSearch] = useState("");
  const [previewMode, setPreviewMode] = useState<ReaderPreviewMode>("original");
  const [changeTitle, setChangeTitle] = useState("");
  const [changeDescription, setChangeDescription] = useState("");
  const [newValue, setNewValue] = useState("");
  const [impactScope, setImpactScope] = useState<ImpactScope>(
    "from_chapter_forward",
  );
  const [isSavingChange, setIsSavingChange] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadReaderData() {
      setIsLoading(true);
      setStorageError("");

      try {
        const [story, chapters, analysisResult, branchChanges, rewriteDrafts] =
          await Promise.all([
            getStoryById(storyId),
            getImportedChapters(storyId),
            getAnalysisResult(storyId),
            getBranchChanges(storyId),
            getRewriteDrafts(storyId),
          ]);

        if (!isActive) return;

        setReaderData({
          story,
          chapters,
          analysisResult,
          branchChanges,
          rewriteDrafts,
        });
      } catch (error) {
        console.error("Failed to load reader data", error);

        if (!isActive) return;

        setStorageError("Không thể đọc dữ liệu truyện từ IndexedDB.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadReaderData();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  const { story, chapters, analysisResult, branchChanges, rewriteDrafts } =
    readerData;

  const currentChapter = useMemo(() => {
    return getChapterFromQuery(chapters, searchParams.get("chapter"));
  }, [chapters, searchParams]);

  const currentChapterIndex = currentChapter
    ? chapters.findIndex((chapter) => chapter.id === currentChapter.id)
    : -1;
  const previousChapter =
    currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : undefined;
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1
      ? chapters[currentChapterIndex + 1]
      : undefined;

  const selectedRewriteDraft = useMemo(() => {
    return findBestRewriteDraftForChapter({
      chapter: currentChapter,
      rewriteDrafts,
    });
  }, [currentChapter, rewriteDrafts]);

  const readingContent =
    previewMode === "rewrite" && selectedRewriteDraft
      ? selectedRewriteDraft.rewrittenText
      : currentChapter?.cleanContent;

  const filteredChapters = useMemo(() => {
    const keyword = normalizeSearchText(chapterSearch);

    if (!keyword) return chapters;

    return chapters.filter((chapter) => {
      return (
        String(chapter.chapterNumber).includes(keyword) ||
        chapter.title.toLowerCase().includes(keyword) ||
        chapter.cleanContent.toLowerCase().includes(keyword)
      );
    });
  }, [chapterSearch, chapters]);

  const currentChapterEntities = useMemo(() => {
    if (!currentChapter || !analysisResult) {
      return {
        characters: [],
        items: [],
        terms: [],
        locations: [],
        events: [],
      };
    }

    return {
      characters: analysisResult.characters.filter((entity) =>
        entity.relatedChapterNumbers.includes(currentChapter.chapterNumber),
      ),
      items: analysisResult.items.filter((entity) =>
        entity.relatedChapterNumbers.includes(currentChapter.chapterNumber),
      ),
      terms: analysisResult.terms.filter((entity) =>
        entity.relatedChapterNumbers.includes(currentChapter.chapterNumber),
      ),
      locations: analysisResult.locations.filter((entity) =>
        entity.relatedChapterNumbers.includes(currentChapter.chapterNumber),
      ),
      events: analysisResult.events.filter(
        (event) => event.chapterNumber === currentChapter.chapterNumber,
      ),
    };
  }, [analysisResult, currentChapter]);

  const totalWordCount = useMemo(() => {
    return chapters.reduce((total, chapter) => total + chapter.wordCount, 0);
  }, [chapters]);

  function goToChapter(chapter: ImportedChapter) {
    setPreviewMode("original");

    router.replace(
      `/stories/${storyId}/reader?chapter=${chapter.chapterNumber}`,
      {
        scroll: true,
      },
    );
  }

  async function handleCreateChangeRequest() {
    if (!currentChapter || isSavingChange) return;

    const trimmedTitle = changeTitle.trim();
    const trimmedDescription = changeDescription.trim();
    const trimmedNewValue = newValue.trim();

    if (!trimmedTitle || !trimmedDescription) {
      setActionMessage("Cần nhập tiêu đề và mô tả thay đổi.");
      return;
    }

    setIsSavingChange(true);
    setActionMessage("");

    const now = new Date().toISOString();
    const affectedChapterNumbers = getAffectedChapterNumbers({
      chapters,
      currentChapter,
      impactScope,
    });

    const nextChange: BranchChange = {
      id: createChangeId(),
      storyId,
      branchId: "reader-change-requests",
      type: "event_change",
      title: trimmedTitle,
      description: trimmedDescription,
      originalValue: currentChapter.cleanContent.slice(0, 1600),
      newValue: trimmedNewValue,
      chapterNumber: currentChapter.chapterNumber,
      chapterRangeStart: currentChapter.chapterNumber,
      chapterRangeEnd:
        affectedChapterNumbers[affectedChapterNumbers.length - 1] ??
        currentChapter.chapterNumber,
      impactScope,
      affectedCharacters: currentChapterEntities.characters.map(
        (entity) => entity.name,
      ),
      affectedItems: currentChapterEntities.items.map((entity) => entity.name),
      affectedTerms: currentChapterEntities.terms.map((entity) => entity.name),
      affectedLocations: currentChapterEntities.locations.map(
        (entity) => entity.name,
      ),
      affectedChapterNumbers,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };

    const nextChanges = [nextChange, ...branchChanges];

    try {
      await saveBranchChanges(storyId, nextChanges);

      setReaderData((current) => ({
        ...current,
        branchChanges: nextChanges,
      }));
      setChangeTitle("");
      setChangeDescription("");
      setNewValue("");
      setImpactScope("from_chapter_forward");
      setActionMessage(
        "Đã tạo yêu cầu thay đổi. Mở Rewrite Planner để xem ảnh hưởng.",
      );
    } catch (error) {
      console.error("Failed to save reader change request", error);
      setActionMessage("Không thể lưu yêu cầu thay đổi vào IndexedDB.");
    } finally {
      setIsSavingChange(false);
    }
  }

  return (
    <PageShell>
      <PageContainer className="max-w-[96rem]">
        <PageHeader
          eyebrow="Đọc truyện"
          title={story?.title ?? "Đọc truyện"}
          description="Đọc các chương đã lưu trong IndexedDB. Nếu chương có rewrite draft, có thể xem trực tiếp tại đây."
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/analysis`}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Phân tích
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/rewrite-draft`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Rewrite Draft
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/stories/${storyId}/rewrite-planner`}>
                  <GitBranch className="mr-2 h-4 w-4" />
                  Rewrite Planner
                </Link>
              </Button>
            </>
          }
        />

        {storageError ? (
          <section className="app-warning-box border-destructive/40 bg-destructive/10 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{storageError}</p>
          </section>
        ) : null}

        {actionMessage ? (
          <section className="app-warning-box">
            <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>{actionMessage}</p>
          </section>
        ) : null}

        <SectionCard title="Chế độ đọc">
          <div className="space-y-2">
            <StoryAnalysisHint>
              Chương được tải từ IndexedDB cục bộ.
            </StoryAnalysisHint>
            <StoryAnalysisHint>
              Trải nghiệm đọc dài được tối ưu cho theme Yuki Night Snow.
            </StoryAnalysisHint>
            <StoryAnalysisHint>
              Analysis và Data Health vẫn có thể mở từ điều hướng truyện.
            </StoryAnalysisHint>
          </div>
        </SectionCard>

        {isLoading ? (
          <SectionCard title="Đang tải Reader">
            <p className="app-muted-text">
              Đang tải chương từ IndexedDB...
            </p>
          </SectionCard>
        ) : chapters.length === 0 ? (
          <EmptyState
            title="Chưa có chương để đọc"
            description="Nhập truyện trước để Reader hiển thị các chương đã lưu."
            action={
              <Button asChild>
                <Link href="/stories/import">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Nhập truyện
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                title="Chương"
                value={formatNumber(chapters.length)}
                description="Chương đã nhập"
              />
              <StatCard
                icon={<ListTree className="h-4 w-4" />}
                title="Số từ"
                value={formatNumber(totalWordCount)}
                description="Ước tính từ dữ liệu đã nhập"
              />
              <StatCard
                icon={<Sparkles className="h-4 w-4" />}
                title="Analysis"
                value={analysisResult ? "Sẵn sàng" : "Thiếu"}
                description={
                  analysisResult
                    ? "Có context canon"
                    : "Chạy Analysis để bổ sung context"
                }
              />
              <StatCard
                icon={<GitBranch className="h-4 w-4" />}
                title="Rewrite drafts"
                value={formatNumber(rewriteDrafts.length)}
                description="Phiên bản rewrite đã lưu"
              />
            </section>

            <section className="grid min-w-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
              <SectionCard
                title="Danh sách chương"
                description="Tất cả chương đã import nằm sẵn ở đây."
                className="xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)]"
                contentClassName="space-y-3"
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={chapterSearch}
                    onChange={(event) => setChapterSearch(event.target.value)}
                    placeholder="Tìm chương..."
                  />
                </div>

                <div className="max-h-[640px] space-y-2 overflow-auto pr-1">
                  {filteredChapters.map((chapter) => {
                    const isActive = chapter.id === currentChapter?.id;
                    const hasDraft = rewriteDrafts.some(
                      (draft) => draft.targetChapterId === chapter.id,
                    );

                    return (
                      <button
                        key={chapter.id}
                        type="button"
                        className={
                          isActive
                            ? "w-full rounded-xl border bg-primary/10 p-3 text-left"
                            : "w-full rounded-xl border bg-background p-3 text-left transition hover:bg-muted/60"
                        }
                        onClick={() => goToChapter(chapter)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Chương {chapter.chapterNumber}
                          </p>
                          {hasDraft ? (
                            <span className="app-chip-primary">Rewrite</span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold">
                          {chapter.title}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatNumber(chapter.wordCount)} từ
                        </p>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              <main className="min-w-0 space-y-4">
                {currentChapter ? (
                  <>
                    <article className="app-reading-surface">
                      <header>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="app-reading-meta">
                            Chương {currentChapter.chapterNumber}
                            <span>·</span>
                            <span>
                              {formatNumber(currentChapter.wordCount)} từ
                            </span>
                            <span>·</span>
                            <span>
                              {getImportedChapterStatusLabel(currentChapter.status)}
                            </span>
                          </p>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={
                                previewMode === "original"
                                  ? "app-chip-primary"
                                  : "app-chip"
                              }
                              onClick={() => setPreviewMode("original")}
                            >
                              Bản gốc
                            </button>
                            <button
                              type="button"
                              className={
                                previewMode === "rewrite"
                                  ? "app-chip-primary"
                                  : "app-chip"
                              }
                              disabled={!selectedRewriteDraft}
                              onClick={() => setPreviewMode("rewrite")}
                            >
                              Xem rewrite
                            </button>
                          </div>
                        </div>

                        <h1 className="app-reading-title">
                          {currentChapter.title}
                        </h1>

                        {selectedRewriteDraft ? (
                          <div className="mt-4 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">
                              Có rewrite draft: {selectedRewriteDraft.title}
                            </p>
                            <p className="mt-1">
                              Trạng thái: {selectedRewriteDraft.status} · Cập
                              nhật:{" "}
                              {new Date(
                                selectedRewriteDraft.updatedAt,
                              ).toLocaleString("vi-VN")}
                            </p>
                          </div>
                        ) : null}
                      </header>

                      <div className="app-reading-body">{readingContent}</div>
                    </article>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!previousChapter}
                        onClick={() => {
                          if (previousChapter) goToChapter(previousChapter);
                        }}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Chương trước
                      </Button>

                      <Button
                        type="button"
                        disabled={!nextChapter}
                        onClick={() => {
                          if (nextChapter) goToChapter(nextChapter);
                        }}
                      >
                        Chương sau
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="Chưa chọn chương"
                    description="Chọn một chương từ danh sách."
                  />
                )}
              </main>

              <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:overflow-auto">
                <SectionCard
                  title="Context canon"
                  description="Dữ liệu lấy từ analysis nếu đã chạy."
                >
                  {analysisResult && currentChapter ? (
                    <div className="space-y-4">
                      <ContextGroup
                        label="Sự kiện"
                        values={currentChapterEntities.events.map(
                          (event) => event.title,
                        )}
                      />
                      <ContextGroup
                        label="Nhân vật"
                        values={currentChapterEntities.characters.map(
                          (entity) => entity.name,
                        )}
                      />
                      <ContextGroup
                        label="Vật phẩm"
                        values={currentChapterEntities.items.map(
                          (entity) => entity.name,
                        )}
                      />
                      <ContextGroup
                        label="Thuật ngữ"
                        values={currentChapterEntities.terms.map(
                          (entity) => entity.name,
                        )}
                      />
                      <ContextGroup
                        label="Địa điểm"
                        values={currentChapterEntities.locations.map(
                          (entity) => entity.name,
                        )}
                      />
                    </div>
                  ) : (
                    <p className="app-muted-text">
                      Chưa có analysis result. Chạy Analysis để Reader có
                      context canon theo chương.
                    </p>
                  )}
                </SectionCard>

                <SectionCard
                  title="Đổi tình tiết chương này"
                  description="Tạo yêu cầu đổi tình tiết từ chương đang đọc. Đây là đầu vào cho Rewrite Planner."
                >
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <label
                        className="text-sm font-medium"
                        htmlFor="change-title"
                      >
                        Tên thay đổi
                      </label>
                      <Input
                        id="change-title"
                        value={changeTitle}
                        onChange={(event) => setChangeTitle(event.target.value)}
                        placeholder="Ví dụ: Cho nhân vật A sống sót"
                      />
                    </div>

                    <div className="grid gap-2">
                      <label
                        className="text-sm font-medium"
                        htmlFor="change-description"
                      >
                        Mô tả tình tiết muốn đổi
                      </label>
                      <textarea
                        id="change-description"
                        className="app-editor-textarea min-h-28"
                        value={changeDescription}
                        onChange={(event) =>
                          setChangeDescription(event.target.value)
                        }
                        placeholder="Bạn không thích điểm nào ở chương này?"
                      />
                    </div>

                    <div className="grid gap-2">
                      <label
                        className="text-sm font-medium"
                        htmlFor="new-value"
                      >
                        Hướng sửa mong muốn
                      </label>
                      <textarea
                        id="new-value"
                        className="app-editor-textarea min-h-28"
                        value={newValue}
                        onChange={(event) => setNewValue(event.target.value)}
                        placeholder="Muốn đổi thành gì? Có thể để trống nếu chỉ muốn AI tự đề xuất."
                      />
                    </div>

                    <div className="grid gap-2">
                      <p className="text-sm font-medium">Phạm vi ảnh hưởng</p>
                      <div className="space-y-2">
                        {impactOptions.map((option) => (
                          <label
                            key={option.value}
                            className={
                              impactScope === option.value
                                ? "block rounded-xl border bg-primary/10 p-3"
                                : "block rounded-xl border bg-background p-3"
                            }
                          >
                            <div className="flex items-start gap-2">
                              <input
                                className="mt-1"
                                type="radio"
                                name="impactScope"
                                checked={impactScope === option.value}
                                onChange={() => setImpactScope(option.value)}
                              />
                              <span>
                                <span className="block text-sm font-medium">
                                  {option.label}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                  {option.description}
                                </span>
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      type="button"
                      disabled={!currentChapter || isSavingChange}
                      onClick={handleCreateChangeRequest}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isSavingChange ? "Đang lưu..." : "Tạo yêu cầu thay đổi"}
                    </Button>
                  </div>
                </SectionCard>
              </aside>
            </section>
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}

function ContextGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      {values.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.slice(0, 12).map((value) => (
            <span className="app-chip" key={value}>
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Chưa phát hiện</p>
      )}
    </div>
  );
}

function StoryAnalysisHint({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>;
}
