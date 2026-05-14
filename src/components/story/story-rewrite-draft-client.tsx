"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  FileText,
  GitBranch,
  Save,
} from "lucide-react";

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
import { StatCard } from "@/components/app/stat-card";
import { StoryNavigation } from "@/components/app/story-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

const storyStorageKey = "ai-story-app:stories";
const rewriteDraftsStorageKey = (storyId: string) =>
  `ai-story-app:rewrite-drafts:${storyId}`;

function readJsonValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const parsedValue = JSON.parse(localStorage.getItem(key) || "") as T;

    return parsedValue ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJsonValue<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readLocalStory(storyId: string) {
  return readJsonValue<Story[]>(storyStorageKey, []).find(
    (story) => story.id === storyId,
  );
}

function readLocalRewriteDraftData(storyId: string): RewriteDraftData {
  return {
    story: readLocalStory(storyId),
    analysisResult: readJsonValue<StoryAnalysisResult | null>(
      `ai-story-app:analysis-result:${storyId}`,
      null,
    ),
    branchChanges: readJsonValue<BranchChange[]>(
      `ai-story-app:branch-changes:${storyId}`,
      [],
    ),
    continuityIssues: readJsonValue<BranchContinuityIssue[]>(
      `ai-story-app:continuity-issues:${storyId}`,
      [],
    ),
    importedChapters: readJsonValue<ImportedChapter[]>(
      `ai-story-app:chapters:${storyId}`,
      [],
    ),
    rewriteDrafts: readJsonValue<RewriteDraft[]>(
      rewriteDraftsStorageKey(storyId),
      [],
    ),
  };
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

function mergeRewriteDraftData(
  indexedDbData: RewriteDraftData,
  localData: RewriteDraftData,
): RewriteDraftData {
  return {
    story: indexedDbData.story ?? localData.story,
    analysisResult: indexedDbData.analysisResult ?? localData.analysisResult,
    branchChanges:
      indexedDbData.branchChanges.length > 0
        ? indexedDbData.branchChanges
        : localData.branchChanges,
    continuityIssues:
      indexedDbData.continuityIssues.length > 0
        ? indexedDbData.continuityIssues
        : localData.continuityIssues,
    importedChapters:
      indexedDbData.importedChapters.length > 0
        ? indexedDbData.importedChapters
        : localData.importedChapters,
    rewriteDrafts:
      indexedDbData.rewriteDrafts.length > 0
        ? indexedDbData.rewriteDrafts
        : localData.rewriteDrafts,
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

  const chapterNumber =
    change.chapterNumber ?? change.affectedChapterNumbers[0];

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

async function saveDraftWithFallback({
  storyId,
  draft,
  existingDrafts,
}: {
  storyId: string;
  draft: RewriteDraft;
  existingDrafts: RewriteDraft[];
}) {
  let indexedDbSaved = false;
  let localStorageSaved = false;
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

  try {
    writeJsonValue(rewriteDraftsStorageKey(storyId), nextDrafts);
    localStorageSaved = true;
  } catch (error) {
    console.error("Failed to save rewrite draft to localStorage", error);
  }

  return {
    saved: indexedDbSaved || localStorageSaved,
    nextDrafts,
  };
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

  useEffect(() => {
    let isActive = true;

    async function loadRewriteDraftData() {
      const localData = readLocalRewriteDraftData(storyId);
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

      const mergedData = mergeRewriteDraftData(indexedDbData, localData);
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
          ? "IndexedDB read failed. Showing localStorage fallback data."
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

  function syncDraftForm(change?: BranchChange, chapter?: DraftChapter) {
    if (!change || !chapter) return;

    const draft = findExistingDraft({
      drafts: draftData.rewriteDrafts,
      change,
      chapter,
    });

    setDraftTitle(
      draft?.title ?? `${change.title} - ${chapter.title}`,
    );
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
    const { saved, nextDrafts } = await saveDraftWithFallback({
      storyId,
      draft,
      existingDrafts: draftData.rewriteDrafts,
    });

    if (saved) {
      setDraftData((current) => ({
        ...current,
        rewriteDrafts: nextDrafts,
      }));
      setSaveMessage("Rewrite draft saved locally.");
    } else {
      setSaveMessage("Could not save rewrite draft to IndexedDB or localStorage.");
    }

    setIsSaving(false);
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Rewrite Draft Workspace"
          title={story.title}
          description="Select a rewrite proposal, compare original chapter text, and save a manual alternate draft locally."
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
                  <BookOpen className="mr-2 h-4 w-4" />
                  Workspace
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/stories/${storyId}/analysis`}>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Analysis
                </Link>
              </Button>
            </>
          }
        />

        <StoryNavigation storyId={storyId} />

        <p className="app-muted-text">
          Rewrite Draft Workspace reads from IndexedDB first, with localStorage
          fallback.
        </p>

        {storageError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {storageError}
          </p>
        ) : null}

        {isLoading ? (
          <SectionCard title="Loading rewrite draft workspace">
            <p className="app-muted-text">
              Reading rewrite proposals, chapters, and drafts from local storage
              layers...
            </p>
          </SectionCard>
        ) : rewriteChanges.length === 0 ? (
          <EmptyState
            title="No rewrite proposals yet."
            description="Open Rewrite Planner and save a proposal before drafting rewritten chapter text."
            action={
              <Button asChild>
                <Link href={`/stories/${storyId}/rewrite-planner`}>
                  Open Rewrite Planner
                </Link>
              </Button>
            }
          />
        ) : !selectedChapter ? (
          <EmptyState
            title="No chapter text available."
            description="Import chapters or use a mock story chapter before drafting a rewrite."
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<GitBranch className="h-4 w-4" />}
                title="Rewrite proposals"
                value={rewriteChanges.length}
              />
              <StatCard
                icon={<FileText className="h-4 w-4" />}
                title="Available chapters"
                value={draftChapters.length}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Related issues"
                value={relatedIssues.length}
              />
              <StatCard
                icon={<Save className="h-4 w-4" />}
                title="Saved drafts"
                value={draftData.rewriteDrafts.length}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
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
          </>
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
    <SectionCard title="Rewrite proposal selector">
      <div className="space-y-4">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Rewrite proposal/change</span>
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
          <span className="font-medium">Target chapter</span>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedChapter.id}
            onChange={(event) => setSelectedChapterId(event.target.value)}
          >
            {draftChapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                Chapter {chapter.chapterNumber} - {chapter.title}
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

function ImpactScopeSummary({ change }: { change?: BranchChange }) {
  return (
    <SectionCard title="Impact scope summary">
      {change ? (
        <div className="space-y-3 text-sm">
          <SummaryRow label="Type" value={change.type} />
          <SummaryRow label="Impact scope" value={change.impactScope} />
          <SummaryRow
            label="Affected chapters"
            value={change.affectedChapterNumbers.length}
          />
          <SummaryRow
            label="Characters"
            value={change.affectedCharacters.join(", ") || "None"}
          />
          <SummaryRow
            label="Items"
            value={change.affectedItems.join(", ") || "None"}
          />
          <SummaryRow
            label="Terms"
            value={change.affectedTerms.join(", ") || "None"}
          />
          <SummaryRow
            label="Locations"
            value={change.affectedLocations.join(", ") || "None"}
          />
        </div>
      ) : (
        <p className="app-muted-text">No selected rewrite proposal.</p>
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
    <SectionCard title="Continuity issues panel">
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
                  Suggested fix: {issue.suggestedFix}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">No continuity issues for this selection.</p>
      )}
    </SectionCard>
  );
}

function OriginalChapterViewer({ chapter }: { chapter: DraftChapter }) {
  return (
    <SectionCard
      title="Original chapter viewer"
      description={`Chapter ${chapter.chapterNumber} / ${chapter.source}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium">{chapter.title}</h2>
        <Badge variant="secondary">
          {chapter.content.length.toLocaleString()} chars
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
    <SectionCard title="Rewrite draft editor">
      <div className="space-y-4">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Draft title</span>
          <Input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Rewritten text</span>
          <Textarea
            className="min-h-[320px] text-base leading-7"
            value={rewrittenText}
            onChange={(event) => setRewrittenText(event.target.value)}
            placeholder="Write the alternate version of this chapter manually..."
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Notes</span>
          <Textarea
            className="min-h-20"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Continuity notes, unresolved questions, or next-pass edits..."
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Status</span>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as RewriteDraft["status"])
            }
          >
            <option value="draft">Draft</option>
            <option value="reviewed">Reviewed</option>
            <option value="accepted">Accepted</option>
          </select>
        </label>

        <Button disabled={isSaving} type="button" onClick={onSave}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save draft"}
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
    <SectionCard title="Side-by-side original vs rewrite comparison">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Original</p>
            <Badge variant="secondary">
              {originalText.length.toLocaleString()} chars
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
              {rewrittenText.length.toLocaleString()} chars
            </Badge>
          </div>
          <pre className="app-code-block max-h-[420px] overflow-auto">
            {rewrittenText || "No rewrite draft yet."}
          </pre>
        </div>
      </div>
    </SectionCard>
  );
}
