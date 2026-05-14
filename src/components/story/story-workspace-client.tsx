"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Bot, BookOpen, GitBranch, Save, WandSparkles } from "lucide-react";

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

const localStoriesKey = "ai-story-app:stories";
const emptyStories: Story[] = [];
let cachedSerializedStories = "";
let cachedLocalStories: Story[] = emptyStories;

function readLocalStoriesSnapshot() {
  if (typeof window === "undefined") return emptyStories;

  const serializedStories = localStorage.getItem(localStoriesKey) || "[]";

  if (serializedStories === cachedSerializedStories) {
    return cachedLocalStories;
  }

  cachedSerializedStories = serializedStories;

  try {
    const parsedStories = JSON.parse(serializedStories) as Story[];
    cachedLocalStories = Array.isArray(parsedStories)
      ? parsedStories
      : emptyStories;
  } catch {
    cachedLocalStories = emptyStories;
  }

  return cachedLocalStories;
}

function subscribeToLocalStories(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
  };
}

function readImportedChapters(storyId: string): ImportedChapter[] {
  if (typeof window === "undefined") return [];

  const serializedChapters =
    localStorage.getItem(`ai-story-app:chapters:${storyId}`) || "[]";

  try {
    const parsedChapters = JSON.parse(serializedChapters) as ImportedChapter[];
    return Array.isArray(parsedChapters) ? parsedChapters : [];
  } catch {
    return [];
  }
}

function readAnalysisResult(storyId: string): StoryAnalysisResult | null {
  if (typeof window === "undefined") return null;

  const serializedResult =
    localStorage.getItem(`ai-story-app:analysis-result:${storyId}`) || "";

  if (!serializedResult) return null;

  try {
    return JSON.parse(serializedResult) as StoryAnalysisResult;
  } catch {
    return null;
  }
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
  if (typeof window === "undefined") return [];

  try {
    const parsedValue = JSON.parse(localStorage.getItem(key) || "[]") as T[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function writeStoredArray<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
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
  const localStories = useSyncExternalStore(
    subscribeToLocalStories,
    readLocalStoriesSnapshot,
    () => emptyStories,
  );
  const [importedChaptersSnapshot] = useState(() => ({
    storyId,
    chapters: readImportedChapters(storyId),
  }));
  const [analysisResultSnapshot] = useState(() => ({
    storyId,
    result: readAnalysisResult(storyId),
  }));
  const [branchesSnapshot, setBranchesSnapshot] = useState(() => ({
    storyId,
    branches: readStoredArray<StoryBranchV2>(branchesStorageKey(storyId)),
  }));
  const [branchChangesSnapshot, setBranchChangesSnapshot] = useState(() => ({
    storyId,
    changes: readStoredArray<BranchChange>(branchChangesStorageKey(storyId)),
  }));
  const [continuityIssuesSnapshot, setContinuityIssuesSnapshot] = useState(
    () => ({
      storyId,
      issues: readStoredArray<BranchContinuityIssue>(
        continuityIssuesStorageKey(storyId),
      ),
    }),
  );
  const [activeBranchId, setActiveBranchId] = useState<string>();
  const [selectedChapterId, setSelectedChapterId] = useState<string>();
  const [editorChapterId, setEditorChapterId] = useState<string>();
  const [editorContent, setEditorContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");

  const importedChapters =
    importedChaptersSnapshot.storyId === storyId
      ? importedChaptersSnapshot.chapters
      : readImportedChapters(storyId);
  const analysisResult =
    analysisResultSnapshot.storyId === storyId
      ? analysisResultSnapshot.result
      : readAnalysisResult(storyId);
  const localBranches =
    branchesSnapshot.storyId === storyId
      ? branchesSnapshot.branches
      : readStoredArray<StoryBranchV2>(branchesStorageKey(storyId));
  const branchChanges =
    branchChangesSnapshot.storyId === storyId
      ? branchChangesSnapshot.changes
      : readStoredArray<BranchChange>(branchChangesStorageKey(storyId));
  const continuityIssues =
    continuityIssuesSnapshot.storyId === storyId
      ? continuityIssuesSnapshot.issues
      : readStoredArray<BranchContinuityIssue>(
          continuityIssuesStorageKey(storyId),
        );

  const allStories = useMemo(() => {
    return [...localStories, ...stories];
  }, [localStories]);

  const story = allStories.find((item) => item.id === storyId) ?? stories[0];
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

  function handleCreateAlternateBranch() {
    if (!selectedChapter) return;

    const branch = createAlternateBranch({
      storyId,
      name: `Nhánh thay đổi từ chương ${selectedChapter.chapterNumber}`,
      description: "Nhánh giả lập để thử sửa tình tiết từ chương đang chọn.",
      divergesFromChapter: selectedChapter.chapterNumber,
      baseBranchId: canonBranch.id,
    });
    const nextBranches = [branch, ...alternateBranches];

    writeStoredArray(branchesStorageKey(storyId), nextBranches);
    setBranchesSnapshot({ storyId, branches: nextBranches });
    setActiveBranchId(branch.id);
  }

  function handleAddChangeToBranch() {
    if (!selectedChapter) return;

    let targetBranch =
      activeBranch.type !== "canon" ? activeBranch : alternateBranches[0];
    let nextBranches = alternateBranches;

    if (!targetBranch) {
      targetBranch = createAlternateBranch({
        storyId,
        name: `Nhánh thay đổi từ chương ${selectedChapter.chapterNumber}`,
        description: "Nhánh giả lập để thử sửa tình tiết từ chương đang chọn.",
        divergesFromChapter: selectedChapter.chapterNumber,
        baseBranchId: canonBranch.id,
      });
      nextBranches = [targetBranch, ...alternateBranches];
      writeStoredArray(branchesStorageKey(storyId), nextBranches);
      setBranchesSnapshot({ storyId, branches: nextBranches });
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

    writeStoredArray(branchChangesStorageKey(storyId), nextChanges);
    writeStoredArray(continuityIssuesStorageKey(storyId), nextIssues);
    setBranchChangesSnapshot({ storyId, changes: nextChanges });
    setContinuityIssuesSnapshot({ storyId, issues: nextIssues });
    setActiveBranchId(targetBranch.id);
  }

  function handleFakeGenerate() {
    setAiResult(
      `Bản nháp AI cho "${story.title}":\n\nDựa trên tone ${story.tone}, AI sẽ viết tiếp một cảnh mới có nhịp truyện phù hợp. Đây hiện là output giả để test UI trước khi tích hợp API thật.`,
    );
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="border-b bg-background">
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
          </div>

          <div className="flex gap-2">
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

      <div className="mx-auto grid max-w-7xl gap-4 px-6 py-6 lg:grid-cols-[260px_1fr_320px]">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
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
                        "w-full rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted",
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
              <CardTitle className="flex items-center gap-2 text-base">
                <GitBranch className="h-4 w-4" />
                Branches / Alternate Canon
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {displayedBranches.map((branch) => {
                  const isActive = branch.id === activeBranch.id;

                  return (
                    <button
                      key={branch.id}
                      type="button"
                      className={cn(
                        "w-full rounded-md border bg-background p-3 text-left text-sm hover:bg-muted",
                        isActive && "border-primary bg-primary/5",
                      )}
                      onClick={() => setActiveBranchId(branch.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{branch.name}</p>
                        <Badge variant={branch.type === "canon" ? "secondary" : "outline"}>
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
                >
                  Create alternate branch
                </Button>
                <Button type="button" onClick={handleAddChangeToBranch}>
                  Add change to branch
                </Button>
              </div>

              {storyBranches.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Legacy mock branch notes
                  </p>
                  {storyBranches.map((branch) => (
                    <div
                      key={branch.id}
                      className="rounded-md border bg-background p-3"
                    >
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
                      <div
                        key={change.id}
                        className="rounded-md border bg-background p-3"
                      >
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
                      <div
                        key={issue.id}
                        className="rounded-md border bg-background p-3"
                      >
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
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {aiResult}
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
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
                  <button className="rounded-md border bg-background px-3 py-2 text-left">
                    Rất sát bản gốc
                  </button>
                  <button className="rounded-md border bg-background px-3 py-2 text-left">
                    Vừa phải
                  </button>
                  <button className="rounded-md border bg-background px-3 py-2 text-left">
                    Chỉ lấy cảm hứng
                  </button>
                </div>
              </div>
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
                      <div
                        key={character.id}
                        className="rounded-md border bg-background p-3"
                      >
                        <p className="text-sm font-medium">{character.name}</p>
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
                        <div
                          key={note.id}
                          className="rounded-md border bg-background p-3"
                        >
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
    </main>
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
        <div key={entity.id} className="rounded-md border bg-background p-3">
          <p className="text-sm font-medium">{entity.name}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {entity.description}
          </p>
        </div>
      ))}
    </>
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
          <div className="rounded-md border bg-background p-3">
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
            <div key={entity.id} className="rounded-md border bg-background p-3">
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
        <div key={event.id} className="rounded-md border bg-background p-3">
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
