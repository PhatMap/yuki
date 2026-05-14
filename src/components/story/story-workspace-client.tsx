"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Bot,
  BookOpen,
  Boxes,
  CalendarDays,
  GitBranch,
  HeartHandshake,
  PenLine,
  Save,
  WandSparkles,
} from "lucide-react";

import {
  getAnalysisResult,
  getBranchChanges,
  getBranches,
  getContinuityIssues,
  getImportedChapters,
  getStoryById,
  saveBranchChanges,
  saveBranches,
  saveContinuityIssues,
} from "@/lib/db/indexed-db";
import {
  branches,
  chapters,
  characters,
  stories,
  worldNotes,
} from "@/lib/mock-data";
import {
  createAlternateBranch,
  createBranchChange,
  createCanonBranch,
  createMockContinuityIssues,
  estimateAffectedChapters,
} from "@/lib/mock-branches";
import type {
  BranchChange,
  BranchContinuityIssue,
  Chapter,
  ExtractedEntity,
  ImportedChapter,
  Story,
  StoryAnalysisResult,
  StoryBranchV2,
  StoryEvent,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface StoryWorkspaceClientProps {
  storyId: string;
}

type WorkspaceChapter = {
  id: string;
  chapterNumber: number;
  title: string;
  content: string;
  wordCount?: number;
  status?: string;
};

type WorkspaceStorageData = {
  story?: Story;
  importedChapters: ImportedChapter[];
  analysisResult: StoryAnalysisResult | null;
  branches: StoryBranchV2[];
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
};

const localStoriesKey = "ai-story-app:stories";

function readJsonValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const parsedValue = JSON.parse(localStorage.getItem(key) || "") as T;

    return parsedValue ?? fallback;
  } catch {
    return fallback;
  }
}

function readLocalStory(storyId: string) {
  return readJsonValue<Story[]>(localStoriesKey, []).find(
    (story) => story.id === storyId,
  );
}

function readLocalImportedChapters(storyId: string) {
  return readJsonValue<ImportedChapter[]>(
    `ai-story-app:chapters:${storyId}`,
    [],
  );
}

function readLocalAnalysisResult(storyId: string) {
  return readJsonValue<StoryAnalysisResult | null>(
    `ai-story-app:analysis-result:${storyId}`,
    null,
  );
}

function branchesStorageKey(storyId: string) {
  return `ai-story-app:branches:${storyId}`;
}

function branchChangesStorageKey(storyId: string) {
  return `ai-story-app:branch-changes:${storyId}`;
}

function continuityIssuesStorageKey(storyId: string) {
  return `ai-story-app:continuity-issues:${storyId}`;
}

function readStoredArray<T>(key: string): T[] {
  return readJsonValue<T[]>(key, []);
}

function writeStoredArray<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function saveBranchesToStorage(storyId: string, branches: StoryBranchV2[]) {
  let localStorageSaved = false;
  let indexedDbSaved = false;

  try {
    writeStoredArray(branchesStorageKey(storyId), branches);
    localStorageSaved = true;
  } catch (error) {
    console.error("Failed to save branches to localStorage", error);
  }

  try {
    await saveBranches(storyId, branches);
    indexedDbSaved = true;
  } catch (error) {
    console.error("Failed to save branches to IndexedDB", error);
  }

  return localStorageSaved || indexedDbSaved;
}

async function saveBranchChangesToStorage({
  storyId,
  changes,
  issues,
}: {
  storyId: string;
  changes: BranchChange[];
  issues: BranchContinuityIssue[];
}) {
  let localStorageSaved = false;
  let indexedDbSaved = false;

  try {
    writeStoredArray(branchChangesStorageKey(storyId), changes);
    writeStoredArray(continuityIssuesStorageKey(storyId), issues);
    localStorageSaved = true;
  } catch (error) {
    console.error("Failed to save branch changes to localStorage", error);
  }

  try {
    await saveBranchChanges(storyId, changes);
    await saveContinuityIssues(storyId, issues);
    indexedDbSaved = true;
  } catch (error) {
    console.error("Failed to save branch changes to IndexedDB", error);
  }

  return localStorageSaved || indexedDbSaved;
}

async function readIndexedDbWorkspaceData(
  storyId: string,
): Promise<WorkspaceStorageData> {
  const [
    story,
    importedChapters,
    analysisResult,
    branches,
    branchChanges,
    continuityIssues,
  ] = await Promise.all([
    getStoryById(storyId),
    getImportedChapters(storyId),
    getAnalysisResult(storyId),
    getBranches(storyId),
    getBranchChanges(storyId),
    getContinuityIssues(storyId),
  ]);

  return {
    story,
    importedChapters,
    analysisResult: analysisResult ?? null,
    branches,
    branchChanges,
    continuityIssues,
  };
}

function readLocalWorkspaceData(storyId: string): WorkspaceStorageData {
  return {
    story: readLocalStory(storyId),
    importedChapters: readLocalImportedChapters(storyId),
    analysisResult: readLocalAnalysisResult(storyId),
    branches: readStoredArray<StoryBranchV2>(branchesStorageKey(storyId)),
    branchChanges: readStoredArray<BranchChange>(
      branchChangesStorageKey(storyId),
    ),
    continuityIssues: readStoredArray<BranchContinuityIssue>(
      continuityIssuesStorageKey(storyId),
    ),
  };
}

function mergeWorkspaceData(
  indexedDbData: WorkspaceStorageData,
  localData: WorkspaceStorageData,
): WorkspaceStorageData {
  return {
    story: indexedDbData.story ?? localData.story,
    importedChapters:
      indexedDbData.importedChapters.length > 0
        ? indexedDbData.importedChapters
        : localData.importedChapters,
    analysisResult: indexedDbData.analysisResult ?? localData.analysisResult,
    branches:
      indexedDbData.branches.length > 0
        ? indexedDbData.branches
        : localData.branches,
    branchChanges:
      indexedDbData.branchChanges.length > 0
        ? indexedDbData.branchChanges
        : localData.branchChanges,
    continuityIssues:
      indexedDbData.continuityIssues.length > 0
        ? indexedDbData.continuityIssues
        : localData.continuityIssues,
  };
}

function normalizeImportedChapter(chapter: ImportedChapter): WorkspaceChapter {
  return {
    id: chapter.id,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    content: chapter.cleanContent || chapter.rawContent,
    wordCount: chapter.wordCount,
    status: chapter.status,
  };
}

function normalizeMockChapter(chapter: Chapter): WorkspaceChapter {
  return {
    id: chapter.id,
    chapterNumber: chapter.order,
    title: chapter.title,
    content: chapter.content,
    status: "Draft",
  };
}

export function StoryWorkspaceClient({ storyId }: StoryWorkspaceClientProps) {
  const [storageData, setStorageData] = useState<WorkspaceStorageData>({
    importedChapters: [],
    analysisResult: null,
    branches: [],
    branchChanges: [],
    continuityIssues: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [isSavingBranchData, setIsSavingBranchData] = useState(false);
  const [branchStorageError, setBranchStorageError] = useState("");
  const [activeBranchId, setActiveBranchId] = useState<string>();
  const [selectedChapterId, setSelectedChapterId] = useState<string>();
  const [editorChapterId, setEditorChapterId] = useState<string>();
  const [editorContent, setEditorContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadWorkspaceData() {
      const localData = readLocalWorkspaceData(storyId);
      let indexedDbData: WorkspaceStorageData = {
        importedChapters: [],
        analysisResult: null,
        branches: [],
        branchChanges: [],
        continuityIssues: [],
      };
      let indexedDbFailed = false;

      try {
        indexedDbData = await readIndexedDbWorkspaceData(storyId);
      } catch (error) {
        indexedDbFailed = true;
        console.error("Failed to read workspace data from IndexedDB", error);
      }

      if (!isActive) return;

      setStorageData(mergeWorkspaceData(indexedDbData, localData));
      setStorageError(
        indexedDbFailed
          ? "IndexedDB read failed. Showing localStorage or mock fallback data."
          : "",
      );
      setIsLoading(false);
    }

    void loadWorkspaceData();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  const importedChapters = storageData.importedChapters;
  const analysisResult = storageData.analysisResult;
  const localBranches = storageData.branches;
  const branchChanges = storageData.branchChanges;
  const continuityIssues = storageData.continuityIssues;
  const story =
    storageData.story ?? stories.find((item) => item.id === storyId) ?? stories[0];
  const hasImportedChapters = importedChapters.length > 0;

  const storyChapters = useMemo(() => {
    return chapters.filter((item) => item.storyId === story.id);
  }, [story.id]);

  const storyCharacters = useMemo(() => {
    return characters.filter((item) => item.storyId === story.id);
  }, [story.id]);

  const storyBranches = useMemo(() => {
    return branches.filter((item) => item.storyId === story.id);
  }, [story.id]);

  const canonBranch = useMemo(() => {
    return createCanonBranch(storyId);
  }, [storyId]);

  const alternateBranches = useMemo(() => {
    return localBranches.filter((branch) => branch.type !== "canon");
  }, [localBranches]);

  const displayedBranches = useMemo(() => {
    return [canonBranch, ...alternateBranches];
  }, [alternateBranches, canonBranch]);

  const activeBranch = useMemo(() => {
    return (
      displayedBranches.find((branch) => branch.id === activeBranchId) ??
      alternateBranches[0] ??
      canonBranch
    );
  }, [activeBranchId, alternateBranches, canonBranch, displayedBranches]);

  const activeBranchChanges = useMemo(() => {
    return branchChanges.filter((change) => change.branchId === activeBranch.id);
  }, [activeBranch.id, branchChanges]);

  const activeContinuityIssues = useMemo(() => {
    return continuityIssues.filter((issue) => issue.branchId === activeBranch.id);
  }, [activeBranch.id, continuityIssues]);

  const notes = useMemo(() => {
    return worldNotes.filter((item) => item.storyId === story.id);
  }, [story.id]);

  const workspaceChapters = useMemo<WorkspaceChapter[]>(() => {
    if (hasImportedChapters) {
      return importedChapters.map(normalizeImportedChapter);
    }

    return storyChapters.map(normalizeMockChapter);
  }, [hasImportedChapters, importedChapters, storyChapters]);

  const resolvedSelectedChapterId = useMemo(() => {
    const hasSelectedChapter = workspaceChapters.some(
      (chapter) => chapter.id === selectedChapterId,
    );

    return hasSelectedChapter ? selectedChapterId : workspaceChapters[0]?.id;
  }, [selectedChapterId, workspaceChapters]);

  const selectedChapter = useMemo(() => {
    return workspaceChapters.find(
      (chapter) => chapter.id === resolvedSelectedChapterId,
    );
  }, [resolvedSelectedChapterId, workspaceChapters]);

  const nearbyEvents = useMemo(() => {
    if (!analysisResult?.events || !selectedChapter) return [];

    return [...analysisResult.events]
      .sort((left, right) => {
        const leftDistance = Math.abs(
          left.chapterNumber - selectedChapter.chapterNumber,
        );
        const rightDistance = Math.abs(
          right.chapterNumber - selectedChapter.chapterNumber,
        );

        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }

        return left.chapterNumber - right.chapterNumber;
      })
      .slice(0, 5);
  }, [analysisResult, selectedChapter]);

  const chapterBranchChanges = useMemo(() => {
    if (!selectedChapter) return [];

    return branchChanges
      .filter((change) => {
        if (change.affectedChapterNumbers.length > 0) {
          return change.affectedChapterNumbers.includes(
            selectedChapter.chapterNumber,
          );
        }

        return change.chapterNumber === selectedChapter.chapterNumber;
      })
      .slice(0, 5);
  }, [branchChanges, selectedChapter]);

  const chapterContinuityIssues = useMemo(() => {
    if (!selectedChapter) return [];

    return continuityIssues
      .filter((issue) =>
        issue.affectedChapterNumbers.includes(selectedChapter.chapterNumber),
      )
      .slice(0, 5);
  }, [continuityIssues, selectedChapter]);

  const visibleEditorContent =
    editorChapterId === selectedChapter?.id
      ? editorContent
      : (selectedChapter?.content ?? "");

  function handleSelectChapter(chapter: WorkspaceChapter) {
    setSelectedChapterId(chapter.id);
    setEditorChapterId(chapter.id);
    setEditorContent(chapter.content);
  }

  function handleEditorContentChange(value: string) {
    setEditorChapterId(selectedChapter?.id);
    setEditorContent(value);
  }

  async function handleCreateAlternateBranch() {
    if (!selectedChapter || isSavingBranchData) return;

    setIsSavingBranchData(true);
    setBranchStorageError("");

    const branch = createAlternateBranch({
      storyId,
      name: `Nhánh thay đổi từ chương ${selectedChapter.chapterNumber}`,
      description: "Nhánh giả lập để thử sửa tình tiết từ chương đang chọn.",
      divergesFromChapter: selectedChapter.chapterNumber,
      baseBranchId: canonBranch.id,
    });
    const nextBranches = [branch, ...alternateBranches];

    setStorageData((current) => ({
      ...current,
      branches: nextBranches,
    }));
    setActiveBranchId(branch.id);

    const saved = await saveBranchesToStorage(storyId, nextBranches);

    if (!saved) {
      setBranchStorageError(
        "Could not save branch data to IndexedDB or localStorage.",
      );
    }

    setIsSavingBranchData(false);
  }

  async function handleAddChangeToBranch() {
    if (!selectedChapter || isSavingBranchData) return;

    setIsSavingBranchData(true);
    setBranchStorageError("");

    let targetBranch =
      activeBranch.type !== "canon" ? activeBranch : alternateBranches[0];
    let nextBranches = alternateBranches;
    let shouldSaveBranches = false;

    if (!targetBranch) {
      targetBranch = createAlternateBranch({
        storyId,
        name: `Nhánh thay đổi từ chương ${selectedChapter.chapterNumber}`,
        description: "Nhánh giả lập để thử sửa tình tiết từ chương đang chọn.",
        divergesFromChapter: selectedChapter.chapterNumber,
        baseBranchId: canonBranch.id,
      });
      nextBranches = [targetBranch, ...alternateBranches];
      shouldSaveBranches = true;
      setStorageData((current) => ({
        ...current,
        branches: nextBranches,
      }));
    }

    const draftChange = createBranchChange({
      storyId,
      branchId: targetBranch.id,
      type: "event_change",
      title: `Thay đổi tình tiết chương ${selectedChapter.chapterNumber}`,
      description: "Người dùng muốn sửa một tình tiết quan trọng ở chương này.",
      chapterNumber: selectedChapter.chapterNumber,
      impactScope: "from_chapter_forward",
    });
    const totalChapters = Math.max(
      workspaceChapters.at(-1)?.chapterNumber ?? 0,
      workspaceChapters.length,
      selectedChapter.chapterNumber,
    );
    const change: BranchChange = {
      ...draftChange,
      affectedChapterNumbers: estimateAffectedChapters(
        draftChange,
        totalChapters,
      ),
    };
    const issues = createMockContinuityIssues(change);
    const nextChanges = [change, ...branchChanges];
    const nextIssues = [...issues, ...continuityIssues];

    setStorageData((current) => ({
      ...current,
      branches: nextBranches,
      branchChanges: nextChanges,
      continuityIssues: nextIssues,
    }));
    setActiveBranchId(targetBranch.id);

    const branchSaved = shouldSaveBranches
      ? await saveBranchesToStorage(storyId, nextBranches)
      : true;
    const changesSaved = await saveBranchChangesToStorage({
      storyId,
      changes: nextChanges,
      issues: nextIssues,
    });

    if (!branchSaved || !changesSaved) {
      setBranchStorageError(
        "Could not save branch changes to IndexedDB or localStorage.",
      );
    }

    setIsSavingBranchData(false);
  }

  function handleFakeGenerate() {
    setAiResult(
      `Bản nháp AI cho "${story.title}":\n\nDựa trên tone ${story.tone}, AI sẽ viết tiếp một cảnh mới có nhịp truyện phù hợp. Đây hiện là output giả để test UI trước khi tích hợp API thật.`,
    );
  }

  return (
    <PageShell className="app-workspace">
      <div className="app-workspace-topbar">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{story.title}</h1>
              {hasImportedChapters ? (
                <Badge variant="outline">Imported novel</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {story.genre} · {story.tone} ·{" "}
              {story.isFanwork ? "Fanwork" : "Original"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Workspace reads from IndexedDB first, with localStorage fallback.
            </p>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/stories/${storyId}/bible`}>
                <BookOpen className="mr-2 h-4 w-4" />
                Open Story Bible
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/stories/${storyId}/timeline`}>
                <CalendarDays className="mr-2 h-4 w-4" />
                Open Timeline
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/stories/${storyId}/relationships`}>
                <HeartHandshake className="mr-2 h-4 w-4" />
                Open Relationships
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/stories/${storyId}/world-tracker`}>
                <Boxes className="mr-2 h-4 w-4" />
                Open World Tracker
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/stories/${storyId}/rewrite-planner`}>
                <PenLine className="mr-2 h-4 w-4" />
                Open Rewrite Planner
              </Link>
            </Button>
            <Button variant="outline">
              <Save className="mr-2 h-4 w-4" />
              Lưu
            </Button>
            <Button onClick={handleFakeGenerate}>
              <WandSparkles className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="app-workspace-grid">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Loading workspace data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="app-muted-text">
                Reading workspace data from IndexedDB and localStorage...
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="app-workspace-grid">
          <aside className="app-panel">
            {storageError ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {storageError}
              </p>
            ) : null}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="app-panel-title">
                    <BookOpen className="h-4 w-4" />
                    Chapters
                  </CardTitle>
                  {hasImportedChapters ? (
                    <Badge variant="secondary">
                      {importedChapters.length} imported
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {workspaceChapters.length > 0 ? (
                  workspaceChapters.map((chapter) => {
                    const isSelected = chapter.id === selectedChapter?.id;

                    return (
                      <button
                        key={chapter.id}
                        type="button"
                        className={cn(
                          "app-list-button",
                          isSelected && "border-primary bg-primary/5",
                        )}
                        onClick={() => handleSelectChapter(chapter)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">
                            Ch. {chapter.chapterNumber}
                          </span>
                          {chapter.status ? (
                            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              {chapter.status}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2">{chapter.title}</p>
                        {typeof chapter.wordCount === "number" ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {chapter.wordCount.toLocaleString()} words
                          </p>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa có chương nào.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="app-panel-title">
                  <GitBranch className="h-4 w-4" />
                  Branches / Alternate Canon
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Branch data is saved to IndexedDB with localStorage fallback.
                </p>
                {isSavingBranchData ? (
                  <p className="text-xs text-muted-foreground">
                    Saving branch data...
                  </p>
                ) : null}
                {branchStorageError ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    {branchStorageError}
                  </p>
                ) : null}

                <div className="space-y-2">
                  {displayedBranches.map((branch) => {
                    const isActive = branch.id === activeBranch.id;

                    return (
                      <button
                        key={branch.id}
                        type="button"
                        className={cn(
                          "app-list-item w-full text-left text-sm hover:bg-muted",
                          isActive && "border-primary bg-primary/5",
                        )}
                        onClick={() => setActiveBranchId(branch.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{branch.name}</p>
                          <Badge
                            variant={
                              branch.type === "canon" ? "secondary" : "outline"
                            }
                          >
                            {branch.type}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {branch.description}
                        </p>
                        {branch.divergesFromChapter ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Diverges from chapter {branch.divergesFromChapter}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCreateAlternateBranch}
                    disabled={isSavingBranchData}
                  >
                    Create alternate branch
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAddChangeToBranch}
                    disabled={isSavingBranchData}
                  >
                    Add change to branch
                  </Button>
                </div>

                {storyBranches.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Legacy mock branch notes
                    </p>
                    {storyBranches.map((branch) => (
                      <div key={branch.id} className="app-list-item">
                        <p className="text-sm font-medium">{branch.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {branch.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <Separator />

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Change Set</p>
                    <Badge variant="secondary">
                      {activeBranchChanges.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {activeBranchChanges.length > 0 ? (
                      activeBranchChanges.map((change) => (
                        <div key={change.id} className="app-list-item">
                          <p className="text-sm font-medium">{change.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {change.type} · {change.impactScope}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {change.affectedChapterNumbers.length} affected
                            chapters · {change.status}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Chưa có change set cho branch này.
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Continuity Issues</p>
                    <Badge variant="secondary">
                      {activeContinuityIssues.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {activeContinuityIssues.length > 0 ? (
                      activeContinuityIssues.map((issue) => (
                        <div key={issue.id} className="app-list-item">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{issue.title}</p>
                            <Badge variant="outline">{issue.severity}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {issue.affectedChapterNumbers.length} affected
                            chapters · {issue.status}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Chưa có continuity issue.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          <section>
            <Card className="min-h-[720px]">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>
                      {selectedChapter?.title ?? "Chương mới"}
                    </CardTitle>
                    {selectedChapter ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Chapter {selectedChapter.chapterNumber}
                        {typeof selectedChapter.wordCount === "number"
                          ? ` · ${selectedChapter.wordCount.toLocaleString()} words`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="secondary">
                    {selectedChapter?.status ?? "Draft"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[560px] resize-none border-0 text-base leading-7 shadow-none focus-visible:ring-0"
                  value={visibleEditorContent}
                  onChange={(event) =>
                    handleEditorContentChange(event.target.value)
                  }
                  placeholder="Bắt đầu viết chương truyện..."
                />

                {aiResult ? (
                  <div className="mt-4 rounded-lg border bg-muted/40 p-4">
                    <p className="mb-2 text-sm font-medium">AI Output</p>
                    <pre className="app-code-block">{aiResult}</pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <aside className="app-panel">
            <Card>
              <CardHeader>
                <CardTitle className="app-panel-title">
                  <Bot className="h-4 w-4" />
                  AI Assistant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  placeholder="Nhập yêu cầu: viết tiếp, thêm cao trào, sửa đoạn này u tối hơn..."
                  className="min-h-28"
                />

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={handleFakeGenerate}>
                    Viết tiếp
                  </Button>
                  <Button variant="secondary" onClick={handleFakeGenerate}>
                    Viết lại
                  </Button>
                  <Button variant="secondary" onClick={handleFakeGenerate}>
                    Thêm thoại
                  </Button>
                  <Button variant="secondary" onClick={handleFakeGenerate}>
                    Tạo nhánh
                  </Button>
                </div>

                <Separator />

                <div>
                  <p className="mb-2 text-sm font-medium">Canon adherence</p>
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <button className="app-list-button">
                      Rất sát bản gốc
                    </button>
                    <button className="app-list-button">Vừa phải</button>
                    <button className="app-list-button">
                      Chỉ lấy cảm hứng
                    </button>
                  </div>
                </div>
              </CardContent>
          </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chapter Inspector</CardTitle>
              </CardHeader>
              <CardContent>
                <ChapterInspector
                  chapter={selectedChapter}
                  events={nearbyEvents}
                  branchChanges={chapterBranchChanges}
                  continuityIssues={chapterContinuityIssues}
                  isImportedChapter={hasImportedChapters}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Characters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysisResult ? (
                  <AnalysisEntityList
                    emptyText="No characters detected."
                    entities={analysisResult.characters}
                  />
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      No analysis result yet. Run analysis first.
                    </p>
                    {storyCharacters.length > 0 ? (
                      storyCharacters.map((character) => (
                        <div key={character.id} className="app-list-item">
                          <p className="text-sm font-medium">
                            {character.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {character.role}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Chưa có nhân vật.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">World Bible</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisResult ? (
                  <WorldBibleAnalysis result={analysisResult} />
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      No analysis result yet. Run analysis first.
                    </p>
                    <div className="space-y-2">
                      {notes.length > 0 ? (
                        notes.map((note) => (
                          <div key={note.id} className="app-list-item">
                            <p className="text-sm font-medium">{note.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {note.content}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Chưa có world note.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Story Events</CardTitle>
              </CardHeader>
              <CardContent>
                {analysisResult ? (
                  <StoryEventsList events={nearbyEvents} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No analysis result yet. Run analysis first.
                  </p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </PageShell>
  );
}

function AnalysisEntityList({
  entities,
  emptyText,
}: {
  entities: ExtractedEntity[];
  emptyText: string;
}) {
  if (entities.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <>
      {entities.slice(0, 5).map((entity) => (
        <div key={entity.id} className="app-list-item">
          <p className="text-sm font-medium">{entity.name}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {entity.description}
          </p>
        </div>
      ))}
    </>
  );
}

function ChapterInspector({
  chapter,
  events,
  branchChanges,
  continuityIssues,
  isImportedChapter,
}: {
  chapter?: WorkspaceChapter;
  events: StoryEvent[];
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
  isImportedChapter: boolean;
}) {
  if (!chapter) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a chapter to inspect.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-sm">
        <InspectorRow label="Chapter" value={chapter.chapterNumber} />
        <InspectorRow label="Title" value={chapter.title} />
        {typeof chapter.wordCount === "number" ? (
          <InspectorRow
            label="Word count"
            value={chapter.wordCount.toLocaleString()}
          />
        ) : null}
        {chapter.status ? (
          <InspectorRow label="Status" value={chapter.status} />
        ) : null}
        <InspectorRow
          label="Content length"
          value={chapter.content.length.toLocaleString()}
        />
        <InspectorRow
          label="Source"
          value={isImportedChapter ? "Imported chapter" : "Mock chapter"}
        />
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <p className="text-sm font-medium">Chunks</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Chunk data is available in analysis dashboard. Chunk details will be
          added after workspace chunk loading.
        </p>
      </div>

      <InspectorSection title="Nearby Story Events">
        {events.length > 0 ? (
          events.map((event) => (
            <div key={event.id} className="app-list-item">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{event.title}</p>
                <Badge variant="outline">{event.importance}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Chapter {event.chapterNumber}
              </p>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {event.description}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No events for this chapter.
          </p>
        )}
      </InspectorSection>

      <InspectorSection title="Branch Changes">
        {branchChanges.length > 0 ? (
          branchChanges.map((change) => (
            <div key={change.id} className="app-list-item">
              <p className="text-sm font-medium">{change.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {change.type} · {change.impactScope}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {change.status}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No branch changes affect this chapter.
          </p>
        )}
      </InspectorSection>

      <InspectorSection title="Continuity Issues">
        {continuityIssues.length > 0 ? (
          continuityIssues.map((issue) => (
            <div key={issue.id} className="app-list-item">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{issue.title}</p>
                <Badge variant="outline">{issue.severity}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {issue.status}
              </p>
              {issue.suggestedFix ? (
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                  {issue.suggestedFix}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No continuity issues for this chapter.
          </p>
        )}
      </InspectorSection>
    </div>
  );
}

function InspectorRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function WorldBibleAnalysis({ result }: { result: StoryAnalysisResult }) {
  const style = result.writingStyleProfiles[0];

  return (
    <>
      <WorldBibleSection title="Terms" entities={result.terms} />
      <WorldBibleSection title="Locations" entities={result.locations} />
      <WorldBibleSection title="Items" entities={result.items} />
      {style ? (
        <div>
          <p className="mb-2 text-sm font-medium">Writing Style</p>
          <div className="app-list-item">
            <p className="text-xs text-muted-foreground">{style.tone}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {style.pacing}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function WorldBibleSection({
  title,
  entities,
}: {
  title: string;
  entities: ExtractedEntity[];
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="space-y-2">
        {entities.length > 0 ? (
          entities.slice(0, 5).map((entity) => (
            <div key={entity.id} className="app-list-item">
              <p className="text-sm font-medium">{entity.name}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {entity.description}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No entries detected.</p>
        )}
      </div>
    </div>
  );
}

function StoryEventsList({ events }: { events: StoryEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No events detected.</p>;
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div key={event.id} className="app-list-item">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{event.title}</p>
            <Badge variant="outline">{event.importance}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Chapter {event.chapterNumber}
          </p>
          <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
            {event.description}
          </p>
        </div>
      ))}
    </div>
  );
}
