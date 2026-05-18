"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, GitBranch, PenLine, Save } from "lucide-react";

import {
  getAnalysisResult,
  getBranchChanges,
  getContinuityIssues,
  getImportedChapters,
  getRewriteDrafts,
  getStoryById,
  saveRewriteDraft,
} from "@/lib/db/indexed-db";
import { chapters, stories } from "@/lib/mock-data";
import { renderRewriteDraftPrompt } from "@/lib/prompts/rewrite-prompts";
import type { PromptRenderResult } from "@/lib/prompts/prompt-runtime";
import type {
  BranchChange,
  BranchContinuityIssue,
  Chapter,
  ImportedChapter,
  RewriteDraft,
  Story,
  StoryAnalysisResult,
} from "@/lib/types";
import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AiSetupBlockingCard } from "@/components/settings/ai-setup-blocking-card";
import { getAiSetupReadiness, type AiSetupReadiness } from "@/lib/settings/ai-setup-readiness";

interface StoryRewriteDraftClientProps {
  storyId: string;
}

interface RewriteDraftData {
  story?: Story;
  analysisResult: StoryAnalysisResult | null;
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
  importedChapters: ImportedChapter[];
  rewriteDrafts: RewriteDraft[];
}

interface DraftChapter {
  id: string;
  chapterNumber: number;
  title: string;
  content: string;
  source: "imported" | "mock";
}

async function readIndexedDbRewriteDraftData(
  storyId: string,
): Promise<RewriteDraftData> {
  const [
    story,
    analysisResult,
    branchChanges,
    continuityIssues,
    importedChapters,
    rewriteDrafts,
  ] = await Promise.all([
    getStoryById(storyId),
    getAnalysisResult(storyId),
    getBranchChanges(storyId),
    getContinuityIssues(storyId),
    getImportedChapters(storyId),
    getRewriteDrafts(storyId),
  ]);

  return {
    story,
    analysisResult: analysisResult ?? null,
    branchChanges,
    continuityIssues,
    importedChapters,
    rewriteDrafts,
  };
}

function normalizeImportedChapter(chapter: ImportedChapter): DraftChapter {
  return {
    id: chapter.id,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    content: chapter.cleanContent || chapter.rawContent,
    source: "imported",
  };
}

function normalizeMockChapter(chapter: Chapter): DraftChapter {
  return {
    id: chapter.id,
    chapterNumber: chapter.order,
    title: chapter.title,
    content: chapter.content,
    source: "mock",
  };
}

function buildDraftChapters({
  importedChapters,
  story,
}: {
  importedChapters: ImportedChapter[];
  story?: Story;
}) {
  if (importedChapters.length > 0) {
    return importedChapters.map(normalizeImportedChapter);
  }

  return chapters
    .filter((chapter) => chapter.storyId === story?.id)
    .map(normalizeMockChapter);
}

function getRewriteChanges(changes: BranchChange[]) {
  return changes.filter(
    (change) =>
      change.type === "chapter_rewrite" ||
      change.status === "draft" ||
      change.branchId.includes("rewrite"),
  );
}

function findTargetChapterForChange(
  change: BranchChange | undefined,
  draftChapters: DraftChapter[],
) {
  if (!change) return draftChapters[0];

  const chapterNumber = change.chapterNumber ?? change.affectedChapterNumbers[0];

  return (
    draftChapters.find((chapter) => chapter.chapterNumber === chapterNumber) ??
    draftChapters[0]
  );
}

function findExistingDraft({
  drafts,
  change,
  chapter,
}: {
  drafts: RewriteDraft[];
  change?: BranchChange;
  chapter?: DraftChapter;
}) {
  if (!change || !chapter) return undefined;

  return drafts.find(
    (draft) =>
      draft.branchChangeId === change.id && draft.targetChapterId === chapter.id,
  );
}

async function saveDraftToStorage({
  draft,
  existingDrafts,
}: {
  draft: RewriteDraft;
  existingDrafts: RewriteDraft[];
}) {
  let indexedDbSaved = false;
  const nextDrafts = [
    draft,
    ...existingDrafts.filter((item) => item.id !== draft.id),
  ];

  try {
    await saveRewriteDraft(draft);
    indexedDbSaved = true;
  } catch (error) {
    console.error("Failed to save rewrite draft to IndexedDB", error);
  }

  return {
    saved: indexedDbSaved,
    nextDrafts,
  };
}

function getChapterSourceLabel(source: DraftChapter["source"]) {
  return source === "imported" ? "Truyện đã nhập" : "Mock";
}

export function StoryRewriteDraftClient({
  storyId,
}: StoryRewriteDraftClientProps) {
  const [draftData, setDraftData] = useState<RewriteDraftData>({
    analysisResult: null,
    branchChanges: [],
    continuityIssues: [],
    importedChapters: [],
    rewriteDrafts: [],
  });
  const [selectedChangeId, setSelectedChangeId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [rewrittenText, setRewrittenText] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<RewriteDraft["status"]>("draft");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [promptRender, setPromptRender] = useState<PromptRenderResult>();
  const [setupReadiness, setSetupReadiness] = useState<AiSetupReadiness>();
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadReadiness() {
      try {
        const readiness = await getAiSetupReadiness();
        if (!active) return;
        setSetupReadiness(readiness);
      } catch (error) {
        console.error("Failed to load AI setup readiness", error);
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

  useEffect(() => {
    let isActive = true;

    async function loadRewriteDraftData() {
      let indexedDbData: RewriteDraftData = {
        analysisResult: null,
        branchChanges: [],
        continuityIssues: [],
        importedChapters: [],
        rewriteDrafts: [],
      };
      let indexedDbFailed = false;

      try {
        indexedDbData = await readIndexedDbRewriteDraftData(storyId);
      } catch (error) {
        indexedDbFailed = true;
        console.error("Failed to read rewrite draft data from IndexedDB", error);
      }

      if (!isActive) return;

      const mergedData = indexedDbData;
      const resolvedStory =
        mergedData.story ?? stories.find((item) => item.id === storyId);
      const resolvedChapters = buildDraftChapters({
        importedChapters: mergedData.importedChapters,
        story: resolvedStory,
      });
      const rewriteChanges = getRewriteChanges(mergedData.branchChanges);
      const initialChange = rewriteChanges[0];
      const initialChapter = findTargetChapterForChange(
        initialChange,
        resolvedChapters,
      );
      const initialDraft = findExistingDraft({
        drafts: mergedData.rewriteDrafts,
        change: initialChange,
        chapter: initialChapter,
      });

      setDraftData(mergedData);
      setSelectedChangeId(initialChange?.id ?? "");
      setSelectedChapterId(initialChapter?.id ?? "");
      setDraftTitle(
        initialDraft?.title ??
          (initialChange && initialChapter
            ? `${initialChange.title} - ${initialChapter.title}`
            : ""),
      );
      setRewrittenText(initialDraft?.rewrittenText ?? "");
      setNotes(initialDraft?.notes ?? "");
      setStatus(initialDraft?.status ?? "draft");
      setStorageError(
        indexedDbFailed
          ? "Không thể đọc dữ liệu Rewrite Draft từ IndexedDB."
          : "",
      );
      setIsLoading(false);
    }

    void loadRewriteDraftData();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  const story =
    draftData.story ?? stories.find((item) => item.id === storyId) ?? stories[0];
  const draftChapters = useMemo<DraftChapter[]>(() => {
    return buildDraftChapters({
      importedChapters: draftData.importedChapters,
      story,
    });
  }, [draftData.importedChapters, story]);
  const rewriteChanges = useMemo(() => {
    return getRewriteChanges(draftData.branchChanges);
  }, [draftData.branchChanges]);
  const selectedChange = useMemo(() => {
    return (
      draftData.branchChanges.find((change) => change.id === selectedChangeId) ??
      rewriteChanges[0]
    );
  }, [draftData.branchChanges, rewriteChanges, selectedChangeId]);
  const selectedChapter = useMemo(() => {
    return (
      draftChapters.find((chapter) => chapter.id === selectedChapterId) ??
      findTargetChapterForChange(selectedChange, draftChapters)
    );
  }, [draftChapters, selectedChange, selectedChapterId]);
  const existingDraft = useMemo(() => {
    return findExistingDraft({
      drafts: draftData.rewriteDrafts,
      change: selectedChange,
      chapter: selectedChapter,
    });
  }, [draftData.rewriteDrafts, selectedChange, selectedChapter]);
  const relatedIssues = useMemo(() => {
    if (!selectedChange || !selectedChapter) return [];

    return draftData.continuityIssues.filter((issue) => {
      const matchesChange = issue.changeId === selectedChange.id;
      const matchesChapter = issue.affectedChapterNumbers.includes(
        selectedChapter.chapterNumber,
      );

      return matchesChange || matchesChapter;
    });
  }, [draftData.continuityIssues, selectedChange, selectedChapter]);

  useEffect(() => {
    let isActive = true;

    async function renderDraftPrompt() {
      const rendered = await renderRewriteDraftPrompt({
        story,
        selectedChange,
        selectedChapter,
        analysisResult: draftData.analysisResult,
        relatedIssues,
      });

      if (isActive) {
        setPromptRender(rendered);
      }
    }

    void renderDraftPrompt();

    return () => {
      isActive = false;
    };
  }, [draftData.analysisResult, relatedIssues, selectedChange, selectedChapter, story]);

  function syncDraftForm(change?: BranchChange, chapter?: DraftChapter) {
    if (!change || !chapter) return;

    const draft = findExistingDraft({
      drafts: draftData.rewriteDrafts,
      change,
      chapter,
    });

    setDraftTitle(draft?.title ?? `${change.title} - ${chapter.title}`);
    setRewrittenText(draft?.rewrittenText ?? "");
    setNotes(draft?.notes ?? "");
    setStatus(draft?.status ?? "draft");
  }

  function handleSelectChange(changeId: string) {
    const change = draftData.branchChanges.find((item) => item.id === changeId);
    const chapter = findTargetChapterForChange(change, draftChapters);

    setSelectedChangeId(changeId);
    setSelectedChapterId(chapter?.id ?? "");
    syncDraftForm(change, chapter);
  }

  function handleSelectChapter(chapterId: string) {
    const chapter = draftChapters.find((item) => item.id === chapterId);

    setSelectedChapterId(chapterId);
    syncDraftForm(selectedChange, chapter);
  }

  async function handleSaveDraft() {
    if (!selectedChange || !selectedChapter || isSaving) return;

    setIsSaving(true);
    setSaveMessage("");

    const now = new Date().toISOString();
    const draft: RewriteDraft = {
      id:
        existingDraft?.id ??
        `${storyId}-rewrite-draft-${selectedChange.id}-${selectedChapter.id}`,
      storyId,
      branchChangeId: selectedChange.id,
      targetChapterId: selectedChapter.id,
      title: draftTitle.trim() || selectedChapter.title,
      originalText: selectedChapter.content,
      rewrittenText,
      notes,
      status,
      createdAt: existingDraft?.createdAt ?? now,
      updatedAt: now,
    };
    const { saved, nextDrafts } = await saveDraftToStorage({
      draft,
      existingDrafts: draftData.rewriteDrafts,
    });

    if (saved) {
      setDraftData((current) => ({
        ...current,
        rewriteDrafts: nextDrafts,
      }));
      setSaveMessage("Đã lưu Rewrite Draft trong IndexedDB.");
    } else {
      setSaveMessage("Không thể lưu Rewrite Draft vào IndexedDB.");
    }

    setIsSaving(false);
  }

  if (isCheckingSetup) {
    return (
      <PageShell>
        <PageContainer>
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
        <PageContainer>
          <AiSetupBlockingCard readiness={setupReadiness} />
        </PageContainer>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          title="Rewrite Draft"
          description="Viết bản rewrite cho chương đã chọn và lưu draft để duyệt sau."
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/rewrite-planner`}>
                  <GitBranch className="mr-2 h-4 w-4" />
                  Rewrite Planner
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/workspace`}>
                  <PenLine className="mr-2 h-4 w-4" />
                  Workspace viết
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/stories/${storyId}/reader`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Đọc truyện
                </Link>
              </Button>
            </>
          }
        />

        {isLoading ? (
          <SectionCard title="Đang tải Rewrite Draft...">
            <p className="app-muted-text">Đang tải yêu cầu rewrite, chương và draft đã lưu.</p>
          </SectionCard>
        ) : rewriteChanges.length === 0 ? (
          <EmptyState
            title="Chưa có yêu cầu rewrite"
            description="Mở Rewrite Planner và lưu một yêu cầu trước khi viết draft."
            action={
              <Button asChild>
                <Link href={`/stories/${storyId}/rewrite-planner`}>
                  Mở Rewrite Planner
                </Link>
              </Button>
            }
          />
        ) : !selectedChapter ? (
          <EmptyState
            title="Chưa có chương"
            description="Hãy nạp truyện trước khi viết Rewrite Draft."
            action={
              <Button asChild>
                <Link href="/stories/import">Nạp truyện</Link>
              </Button>
            }
          />
        ) : (
          <section className="grid gap-4 xl:grid-cols-[380px_1fr] 2xl:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              <RewriteSelectors
                draftChapters={draftChapters}
                rewriteChanges={rewriteChanges}
                selectedChange={selectedChange}
                selectedChapter={selectedChapter}
                setSelectedChangeId={handleSelectChange}
                setSelectedChapterId={handleSelectChapter}
              />
              <ImpactScopeSummary change={selectedChange} />
              <ContinuityIssuesPanel issues={relatedIssues} />
              <details className="rounded-xl border bg-card/80">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                  Chi tiết kỹ thuật
                </summary>
                <div className="space-y-4 border-t p-4">
                  {storageError ? (
                    <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                      {storageError}
                    </p>
                  ) : null}
                  <PromptTemplateSummary promptRender={promptRender} />
                  <p className="text-xs text-muted-foreground">
                    Rewrite Draft được lưu trong IndexedDB theo story, yêu cầu rewrite và chương đích.
                  </p>
                </div>
              </details>
            </div>

            <div className="space-y-4">
              <OriginalChapterViewer chapter={selectedChapter} />
              <RewriteDraftEditor
                draftTitle={draftTitle}
                isSaving={isSaving}
                notes={notes}
                rewrittenText={rewrittenText}
                saveMessage={saveMessage}
                status={status}
                setDraftTitle={setDraftTitle}
                setNotes={setNotes}
                setRewrittenText={setRewrittenText}
                setStatus={setStatus}
                onSave={handleSaveDraft}
              />
              <RewriteComparison
                originalText={selectedChapter.content}
                rewrittenText={rewrittenText}
              />
            </div>
          </section>
        )}
      </PageContainer>
    </PageShell>
  );
}

function RewriteSelectors({
  rewriteChanges,
  draftChapters,
  selectedChange,
  selectedChapter,
  setSelectedChangeId,
  setSelectedChapterId,
}: {
  rewriteChanges: BranchChange[];
  draftChapters: DraftChapter[];
  selectedChange?: BranchChange;
  selectedChapter: DraftChapter;
  setSelectedChangeId: (value: string) => void;
  setSelectedChapterId: (value: string) => void;
}) {
  return (
    <SectionCard title="Chọn yêu cầu và chương">
      <div className="space-y-4">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Yêu cầu rewrite</span>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedChange?.id ?? ""}
            onChange={(event) => setSelectedChangeId(event.target.value)}
          >
            {rewriteChanges.map((change) => (
              <option key={change.id} value={change.id}>
                {change.title}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Chương cần viết</span>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedChapter.id}
            onChange={(event) => setSelectedChapterId(event.target.value)}
          >
            {draftChapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                Chương {chapter.chapterNumber} - {chapter.title || "Không có tiêu đề"}
              </option>
            ))}
          </select>
        </label>

        {selectedChange ? (
          <div className="app-list-item">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-medium">{selectedChange.title}</h2>
              <Badge variant="outline">{selectedChange.status}</Badge>
            </div>
            <p className="mt-2 line-clamp-4 text-xs text-muted-foreground">
              {selectedChange.description}
            </p>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function PromptTemplateSummary({
  promptRender,
}: {
  promptRender?: PromptRenderResult;
}) {
  return (
    <SectionCard title="Chi tiết prompt">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">
          {promptRender?.template.id ?? "rewrite-draft"}
        </Badge>
        <span className="text-muted-foreground">
          {promptRender?.template.title ?? "Đang tải template Prompt Manager..."}
        </span>
      </div>
      {promptRender?.missingVariables.length ? (
        <p className="mt-3 text-sm text-destructive">
          Thiếu biến prompt: {promptRender.missingVariables.join(", ")}
        </p>
      ) : null}
    </SectionCard>
  );
}

function ImpactScopeSummary({ change }: { change?: BranchChange }) {
  return (
    <SectionCard title="Phạm vi ảnh hưởng">
      {change ? (
        <div className="space-y-3 text-sm">
          <SummaryRow label="Loại thay đổi" value={change.type} />
          <SummaryRow label="Phạm vi" value={change.impactScope} />
          <SummaryRow
            label="Chương bị ảnh hưởng"
            value={change.affectedChapterNumbers.length}
          />
          <SummaryRow
            label="Nhân vật"
            value={change.affectedCharacters.join(", ") || "Không có"}
          />
          <SummaryRow
            label="Vật phẩm"
            value={change.affectedItems.join(", ") || "Không có"}
          />
          <SummaryRow
            label="Thuật ngữ"
            value={change.affectedTerms.join(", ") || "Không có"}
          />
          <SummaryRow
            label="Địa điểm"
            value={change.affectedLocations.join(", ") || "Không có"}
          />
        </div>
      ) : (
        <p className="app-muted-text">Chưa chọn yêu cầu rewrite.</p>
      )}
    </SectionCard>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-muted-foreground">{value}</p>
    </div>
  );
}

function ContinuityIssuesPanel({
  issues,
}: {
  issues: BranchContinuityIssue[];
}) {
  return (
    <SectionCard title="Canon / continuity">
      {issues.length > 0 ? (
        <div className="space-y-2">
          {issues.map((issue) => (
            <article key={issue.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium">{issue.title}</h2>
                <Badge variant="outline">{issue.severity}</Badge>
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                {issue.description}
              </p>
              {issue.suggestedFix ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Đề xuất sửa: {issue.suggestedFix}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">Không có issue continuity cho lựa chọn này.</p>
      )}
    </SectionCard>
  );
}

function OriginalChapterViewer({ chapter }: { chapter: DraftChapter }) {
  return (
    <SectionCard
      title="Chương gốc"
      description={`Chương ${chapter.chapterNumber} / ${getChapterSourceLabel(chapter.source)}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium">{chapter.title || "Không có tiêu đề"}</h2>
        <Badge variant="secondary">
          {chapter.content.length.toLocaleString("vi-VN")} ký tự
        </Badge>
      </div>
      <pre className="app-code-block max-h-[360px] overflow-auto">
        {chapter.content}
      </pre>
    </SectionCard>
  );
}

function RewriteDraftEditor({
  draftTitle,
  rewrittenText,
  notes,
  status,
  isSaving,
  saveMessage,
  setDraftTitle,
  setRewrittenText,
  setNotes,
  setStatus,
  onSave,
}: {
  draftTitle: string;
  rewrittenText: string;
  notes: string;
  status: RewriteDraft["status"];
  isSaving: boolean;
  saveMessage: string;
  setDraftTitle: (value: string) => void;
  setRewrittenText: (value: string) => void;
  setNotes: (value: string) => void;
  setStatus: (value: RewriteDraft["status"]) => void;
  onSave: () => void;
}) {
  return (
    <SectionCard title="Bản rewrite">
      <div className="space-y-4">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Tiêu đề draft</span>
          <Input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Nội dung rewrite</span>
          <Textarea
            className="min-h-[320px] text-base leading-7"
            value={rewrittenText}
            onChange={(event) => setRewrittenText(event.target.value)}
            placeholder="Viết phiên bản rewrite của chương này..."
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Ghi chú</span>
          <Textarea
            className="min-h-20"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ghi chú canon, điểm cần sửa tiếp, hoặc câu hỏi còn mở..."
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Trạng thái</span>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as RewriteDraft["status"])
            }
          >
            <option value="draft">Draft</option>
            <option value="reviewed">Đã duyệt</option>
            <option value="accepted">Đã chấp nhận</option>
          </select>
        </label>

        <Button disabled={isSaving} type="button" onClick={onSave}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Đang lưu..." : "Lưu draft"}
        </Button>

        {saveMessage ? <p className="app-muted-text">{saveMessage}</p> : null}
      </div>
    </SectionCard>
  );
}

function RewriteComparison({
  originalText,
  rewrittenText,
}: {
  originalText: string;
  rewrittenText: string;
}) {
  return (
    <SectionCard title="So sánh bản gốc / rewrite">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Bản gốc</p>
            <Badge variant="secondary">
              {originalText.length.toLocaleString("vi-VN")} ký tự
            </Badge>
          </div>
          <pre className="app-code-block max-h-[420px] overflow-auto">
            {originalText}
          </pre>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Rewrite</p>
            <Badge variant="secondary">
              {rewrittenText.length.toLocaleString("vi-VN")} ký tự
            </Badge>
          </div>
          <pre className="app-code-block max-h-[420px] overflow-auto">
            {rewrittenText || "Chưa có Rewrite Draft."}
          </pre>
        </div>
      </div>
    </SectionCard>
  );
}
