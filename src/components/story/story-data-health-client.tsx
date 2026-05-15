"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clipboard,
  Database,
  RefreshCw,
  Trash2,
} from "lucide-react";

import {
  getAnalysisResult,
  getAnalysisStatus,
  getBranches,
  getBranchChanges,
  getChapterChunks,
  getContinuityIssues,
  getImportedChapters,
  getRewriteDrafts,
  getStoryById,
} from "@/lib/db/indexed-db";
import { stories } from "@/lib/mock-data";
import type {
  AnalysisStatus,
  BranchChange,
  BranchContinuityIssue,
  ChapterChunk,
  ImportedChapter,
  RewriteDraft,
  Story,
  StoryAnalysisResult,
  StoryBranchV2,
  StoryLocalSettings,
} from "@/lib/types";
import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface StoryDataHealthClientProps {
  storyId: string;
}

type HealthState = "healthy" | "missing" | "partial" | "error";

interface ParsedLocalStorageValue<T> {
  key: string;
  exists: boolean;
  status: HealthState;
  value: T | null;
  error?: string;
}

interface DataHealthInspection {
  inspectedAt: string;
  indexedDbError?: string;
  indexedDb: {
    story?: Story;
    chapters: ImportedChapter[];
    chunks: ChapterChunk[];
    analysisStatus?: AnalysisStatus;
    analysisResult?: StoryAnalysisResult;
    branches: StoryBranchV2[];
    branchChanges: BranchChange[];
    continuityIssues: BranchContinuityIssue[];
    rewriteDrafts: RewriteDraft[];
  };
  localStorage: {
    stories: ParsedLocalStorageValue<Story[]>;
    chapters: ParsedLocalStorageValue<ImportedChapter[]>;
    chunks: ParsedLocalStorageValue<ChapterChunk[]>;
    analysisStatus: ParsedLocalStorageValue<AnalysisStatus>;
    analysisResult: ParsedLocalStorageValue<StoryAnalysisResult>;
    branches: ParsedLocalStorageValue<StoryBranchV2[]>;
    branchChanges: ParsedLocalStorageValue<BranchChange[]>;
    continuityIssues: ParsedLocalStorageValue<BranchContinuityIssue[]>;
    rewriteDrafts: ParsedLocalStorageValue<RewriteDraft[]>;
    settings: ParsedLocalStorageValue<StoryLocalSettings>;
    storySetup: ParsedLocalStorageValue<unknown>;
  };
  warnings: string[];
}

const localStorageKeys = {
  stories: "ai-story-app:stories",
  chapters: (storyId: string) => `ai-story-app:chapters:${storyId}`,
  chunks: (storyId: string) => `ai-story-app:chunks:${storyId}`,
  analysisStatus: (storyId: string) =>
    `ai-story-app:analysis-status:${storyId}`,
  analysisResult: (storyId: string) =>
    `ai-story-app:analysis-result:${storyId}`,
  branches: (storyId: string) => `ai-story-app:branches:${storyId}`,
  branchChanges: (storyId: string) =>
    `ai-story-app:branch-changes:${storyId}`,
  continuityIssues: (storyId: string) =>
    `ai-story-app:continuity-issues:${storyId}`,
  rewriteDrafts: (storyId: string) =>
    `ai-story-app:rewrite-drafts:${storyId}`,
  settings: (storyId: string) => `ai-story-app:settings:${storyId}`,
  storySetup: (storyId: string) => `ai-story-app:story-setup:${storyId}`,
};

function readLocalStorageValue<T>(key: string): ParsedLocalStorageValue<T> {
  if (typeof window === "undefined") {
    return {
      key,
      exists: false,
      status: "missing",
      value: null,
    };
  }

  const rawValue = localStorage.getItem(key);

  if (rawValue === null) {
    return {
      key,
      exists: false,
      status: "missing",
      value: null,
    };
  }

  try {
    return {
      key,
      exists: true,
      status: "healthy",
      value: JSON.parse(rawValue) as T,
    };
  } catch (error) {
    return {
      key,
      exists: true,
      status: "error",
      value: null,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

function localStoryForId(storyId: string, storiesValue: Story[] | null) {
  return storiesValue?.find((story) => story.id === storyId);
}

async function inspectStoryData(storyId: string): Promise<DataHealthInspection> {
  let indexedDbError: string | undefined;
  const indexedDb: DataHealthInspection["indexedDb"] = {
    chapters: [],
    chunks: [],
    branches: [],
    branchChanges: [],
    continuityIssues: [],
    rewriteDrafts: [],
  };

  try {
    const [
      story,
      chapters,
      chunks,
      analysisStatus,
      analysisResult,
      branches,
      branchChanges,
      continuityIssues,
      rewriteDrafts,
    ] = await Promise.all([
      getStoryById(storyId),
      getImportedChapters(storyId),
      getChapterChunks(storyId),
      getAnalysisStatus(storyId),
      getAnalysisResult(storyId),
      getBranches(storyId),
      getBranchChanges(storyId),
      getContinuityIssues(storyId),
      getRewriteDrafts(storyId),
    ]);

    indexedDb.story = story;
    indexedDb.chapters = chapters;
    indexedDb.chunks = chunks;
    indexedDb.analysisStatus = analysisStatus;
    indexedDb.analysisResult = analysisResult;
    indexedDb.branches = branches;
    indexedDb.branchChanges = branchChanges;
    indexedDb.continuityIssues = continuityIssues;
    indexedDb.rewriteDrafts = rewriteDrafts;
  } catch (error) {
    indexedDbError =
      error instanceof Error ? error.message : "IndexedDB read failed";
    console.error("Failed to inspect IndexedDB story data", error);
  }

  const localStorage = {
    stories: readLocalStorageValue<Story[]>(localStorageKeys.stories),
    chapters: readLocalStorageValue<ImportedChapter[]>(
      localStorageKeys.chapters(storyId),
    ),
    chunks: readLocalStorageValue<ChapterChunk[]>(
      localStorageKeys.chunks(storyId),
    ),
    analysisStatus: readLocalStorageValue<AnalysisStatus>(
      localStorageKeys.analysisStatus(storyId),
    ),
    analysisResult: readLocalStorageValue<StoryAnalysisResult>(
      localStorageKeys.analysisResult(storyId),
    ),
    branches: readLocalStorageValue<StoryBranchV2[]>(
      localStorageKeys.branches(storyId),
    ),
    branchChanges: readLocalStorageValue<BranchChange[]>(
      localStorageKeys.branchChanges(storyId),
    ),
    continuityIssues: readLocalStorageValue<BranchContinuityIssue[]>(
      localStorageKeys.continuityIssues(storyId),
    ),
    rewriteDrafts: readLocalStorageValue<RewriteDraft[]>(
      localStorageKeys.rewriteDrafts(storyId),
    ),
    settings: readLocalStorageValue<StoryLocalSettings>(
      localStorageKeys.settings(storyId),
    ),
    storySetup: readLocalStorageValue<unknown>(
      localStorageKeys.storySetup(storyId),
    ),
  };
  const warnings = buildWarnings({
    storyId,
    indexedDb,
    indexedDbError,
    localStorage,
  });

  return {
    inspectedAt: new Date().toISOString(),
    indexedDbError,
    indexedDb,
    localStorage,
    warnings,
  };
}

function buildWarnings({
  storyId,
  indexedDb,
  indexedDbError,
  localStorage,
}: {
  storyId: string;
  indexedDb: DataHealthInspection["indexedDb"];
  indexedDbError?: string;
  localStorage: DataHealthInspection["localStorage"];
}) {
  const warnings: string[] = [];
  const localStory = localStoryForId(storyId, localStorage.stories.value);

  if (indexedDbError) warnings.push(`IndexedDB read error: ${indexedDbError}`);
  if (!indexedDb.story && !localStory) warnings.push("Story record is missing.");
  if (indexedDb.chapters.length === 0 && !localStorage.chapters.value?.length) {
    warnings.push("Story has no imported chapters.");
  }
  if (!indexedDb.analysisResult && !localStorage.analysisResult.value) {
    warnings.push("Analysis result is missing.");
  }
  if (
    indexedDb.branchChanges.length === 0 &&
    !localStorage.branchChanges.value?.length
  ) {
    warnings.push("Branch changes are missing or empty.");
  }
  if (
    indexedDb.continuityIssues.length === 0 &&
    !localStorage.continuityIssues.value?.length
  ) {
    warnings.push("Continuity issues are missing or empty.");
  }
  if (
    indexedDb.rewriteDrafts.length === 0 &&
    !localStorage.rewriteDrafts.value?.length
  ) {
    warnings.push("Rewrite drafts are missing or empty.");
  }
  if (!localStorage.settings.exists) warnings.push("Story settings are missing.");

  Object.values(localStorage).forEach((item) => {
    if (item.status === "error") {
      warnings.push(`Invalid JSON in localStorage key: ${item.key}`);
    }
  });

  if (!indexedDb.story && localStory) {
    warnings.push("localStorage story fallback exists but IndexedDB story is missing.");
  }
  if (indexedDb.chapters.length === 0 && localStorage.chapters.value?.length) {
    warnings.push(
      "localStorage chapter fallback exists but IndexedDB chapters are missing.",
    );
  }
  if (!indexedDb.analysisResult && localStorage.analysisResult.value) {
    warnings.push(
      "localStorage analysis fallback exists but IndexedDB analysis is missing.",
    );
  }
  if (
    indexedDb.rewriteDrafts.length === 0 &&
    localStorage.rewriteDrafts.value?.length
  ) {
    warnings.push(
      "localStorage rewrite draft fallback exists but IndexedDB drafts are missing.",
    );
  }

  return warnings;
}

function getStateForRecord(exists: boolean, fallbackExists = false): HealthState {
  if (exists) return "healthy";
  if (fallbackExists) return "partial";

  return "missing";
}

function getCountState(count: number, fallbackCount = 0): HealthState {
  if (count > 0) return "healthy";
  if (fallbackCount > 0) return "partial";

  return "missing";
}

function getStorageValueCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return 1;

  return 0;
}

function getOverallHealth(inspection?: DataHealthInspection): HealthState {
  if (!inspection) return "missing";
  if (inspection.indexedDbError) return "error";
  if (inspection.warnings.length === 0) return "healthy";

  return "partial";
}

function getStateBadgeVariant(state: HealthState) {
  if (state === "healthy") return "secondary";
  if (state === "error") return "destructive";

  return "outline";
}

export function StoryDataHealthClient({ storyId }: StoryDataHealthClientProps) {
  const [inspection, setInspection] = useState<DataHealthInspection>();
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  async function handleRefreshInspection() {
    setIsLoading(true);
    setActionMessage("");

    const nextInspection = await inspectStoryData(storyId);

    setInspection(nextInspection);
    setIsLoading(false);
  }

  async function handleCopyDiagnosticSummary() {
    if (!inspection) return;

    const summary = JSON.stringify(inspection, null, 2);

    try {
      await navigator.clipboard.writeText(summary);
      setActionMessage("Diagnostic summary copied as JSON.");
    } catch (error) {
      console.error("Failed to copy diagnostic summary", error);
      setActionMessage("Could not copy diagnostic summary.");
    }
  }

  async function handleClearSettings() {
    localStorage.removeItem(localStorageKeys.settings(storyId));
    await handleRefreshInspection();
    setActionMessage("Story settings localStorage key cleared.");
  }

  const localStory = localStoryForId(
    storyId,
    inspection?.localStorage.stories.value ?? null,
  );
  const story =
    inspection?.indexedDb.story ??
    localStory ??
    stories.find((item) => item.id === storyId);
  const overallHealth = getOverallHealth(inspection);

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Data Health"
          title={story?.title ?? "Storage Inspector"}
          description="Inspect local story data across IndexedDB and localStorage fallback keys."
          action={
            <>
              <Button
                disabled={isLoading}
                type="button"
                variant="outline"
                onClick={handleRefreshInspection}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh inspection
              </Button>
              <Button
                disabled={!inspection}
                type="button"
                onClick={handleCopyDiagnosticSummary}
              >
                <Clipboard className="mr-2 h-4 w-4" />
                Copy JSON
              </Button>
            </>
          }
        />


        {!inspection ? (
          <EmptyState
            title="No inspection loaded yet."
            description="Refresh inspection to read IndexedDB and localStorage data for this story."
            action={
              <Button type="button" onClick={handleRefreshInspection}>
                <Database className="mr-2 h-4 w-4" />
                Inspect story data
              </Button>
            }
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<Database className="h-4 w-4" />}
                title="Overall health"
                value={overallHealth}
              />
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                title="Chapters"
                value={inspection.indexedDb.chapters.length}
                description={`${inspection.localStorage.chapters.value?.length ?? 0} in localStorage fallback`}
              />
              <StatCard
                icon={<GitBranchIcon />}
                title="Branch changes"
                value={inspection.indexedDb.branchChanges.length}
                description={`${inspection.localStorage.branchChanges.value?.length ?? 0} in localStorage fallback`}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Warnings"
                value={inspection.warnings.length}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
              <div className="space-y-4">
                <SectionCard title="Storage overview">
                  <div className="grid gap-3 md:grid-cols-2">
                    <HealthRow
                      label="IndexedDB"
                      state={inspection.indexedDbError ? "error" : "healthy"}
                      value={
                        inspection.indexedDbError ?? "Readable for this browser"
                      }
                    />
                    <HealthRow
                      label="localStorage"
                      state="healthy"
                      value="Readable for this browser"
                    />
                    <HealthRow
                      label="Inspected at"
                      state="healthy"
                      value={new Date(inspection.inspectedAt).toLocaleString()}
                    />
                    <HealthRow
                      label="Story id"
                      state="healthy"
                      value={storyId}
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Story record health">
                  <div className="grid gap-3 md:grid-cols-2">
                    <HealthRow
                      label="Story record"
                      state={getStateForRecord(
                        Boolean(inspection.indexedDb.story),
                        Boolean(localStory),
                      )}
                      value={story?.title ?? "No story record"}
                    />
                    <HealthRow
                      label="Settings status"
                      state={inspection.localStorage.settings.status}
                      value={
                        inspection.localStorage.settings.exists
                          ? "Settings key exists"
                          : "Settings missing"
                      }
                    />
                    <HealthRow
                      label="Analysis result"
                      state={getStateForRecord(
                        Boolean(inspection.indexedDb.analysisResult),
                        Boolean(inspection.localStorage.analysisResult.value),
                      )}
                      value={
                        inspection.indexedDb.analysisResult
                          ? "IndexedDB analysis found"
                          : "No IndexedDB analysis"
                      }
                    />
                    <HealthRow
                      label="Analysis status"
                      state={getStateForRecord(
                        Boolean(inspection.indexedDb.analysisStatus),
                        Boolean(inspection.localStorage.analysisStatus.value),
                      )}
                      value={
                        inspection.indexedDb.analysisStatus
                          ? `${inspection.indexedDb.analysisStatus.analyzedChapters}/${inspection.indexedDb.analysisStatus.totalChapters} analyzed`
                          : "No analysis status"
                      }
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Counts">
                  <div className="grid gap-3 md:grid-cols-2">
                    <HealthRow
                      label="Chapters count"
                      state={getCountState(
                        inspection.indexedDb.chapters.length,
                        inspection.localStorage.chapters.value?.length ?? 0,
                      )}
                      value={`${inspection.indexedDb.chapters.length} IndexedDB / ${inspection.localStorage.chapters.value?.length ?? 0} localStorage`}
                    />
                    <HealthRow
                      label="Chunks count"
                      state={getCountState(
                        inspection.indexedDb.chunks.length,
                        inspection.localStorage.chunks.value?.length ?? 0,
                      )}
                      value={`${inspection.indexedDb.chunks.length} IndexedDB / ${inspection.localStorage.chunks.value?.length ?? 0} localStorage`}
                    />
                    <HealthRow
                      label="Branch changes count"
                      state={getCountState(
                        inspection.indexedDb.branchChanges.length,
                        inspection.localStorage.branchChanges.value?.length ?? 0,
                      )}
                      value={`${inspection.indexedDb.branchChanges.length} IndexedDB / ${inspection.localStorage.branchChanges.value?.length ?? 0} localStorage`}
                    />
                    <HealthRow
                      label="Continuity issues count"
                      state={getCountState(
                        inspection.indexedDb.continuityIssues.length,
                        inspection.localStorage.continuityIssues.value?.length ??
                          0,
                      )}
                      value={`${inspection.indexedDb.continuityIssues.length} IndexedDB / ${inspection.localStorage.continuityIssues.value?.length ?? 0} localStorage`}
                    />
                    <HealthRow
                      label="Rewrite drafts count"
                      state={getCountState(
                        inspection.indexedDb.rewriteDrafts.length,
                        inspection.localStorage.rewriteDrafts.value?.length ?? 0,
                      )}
                      value={`${inspection.indexedDb.rewriteDrafts.length} IndexedDB / ${inspection.localStorage.rewriteDrafts.value?.length ?? 0} localStorage`}
                    />
                    <HealthRow
                      label="Branches count"
                      state={getCountState(
                        inspection.indexedDb.branches.length,
                        inspection.localStorage.branches.value?.length ?? 0,
                      )}
                      value={`${inspection.indexedDb.branches.length} IndexedDB / ${inspection.localStorage.branches.value?.length ?? 0} localStorage`}
                    />
                  </div>
                </SectionCard>

                <SectionCard title="localStorage fallback keys">
                  <div className="space-y-2">
                    {Object.values(inspection.localStorage).map((item) => (
                      <StorageKeyRow key={item.key} item={item} />
                    ))}
                  </div>
                </SectionCard>
              </div>

              <aside className="space-y-4">
                <SectionCard title="Basic warnings">
                  {inspection.warnings.length > 0 ? (
                    <div className="space-y-2">
                      {inspection.warnings.map((warning) => (
                        <div key={warning} className="app-list-item">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                            <p className="text-sm text-muted-foreground">
                              {warning}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="app-list-item">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <p className="text-sm text-muted-foreground">
                          No basic warnings detected.
                        </p>
                      </div>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Safe actions">
                  <div className="space-y-3">
                    <Button
                      className="w-full"
                      type="button"
                      variant="outline"
                      onClick={handleClearSettings}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear only story settings
                    </Button>
                    <p className="app-muted-text">
                      This only removes{" "}
                      <span className="font-mono">
                        {localStorageKeys.settings(storyId)}
                      </span>
                      . No delete-all control is provided here.
                    </p>
                    {actionMessage ? (
                      <p className="app-muted-text">{actionMessage}</p>
                    ) : null}
                  </div>
                </SectionCard>

                <SectionCard title="Open story">
                  <Button asChild className="w-full" variant="outline">
                    <Link href={`/stories/${storyId}/workspace`}>
                      <BookOpen className="mr-2 h-4 w-4" />
                      Open Workspace
                    </Link>
                  </Button>
                </SectionCard>
              </aside>
            </section>
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}

function GitBranchIcon() {
  return <Database className="h-4 w-4" />;
}

function HealthRow({
  label,
  state,
  value,
}: {
  label: string;
  state: HealthState;
  value: string | number;
}) {
  return (
    <div className="app-list-item">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {value}
          </p>
        </div>
        <Badge variant={getStateBadgeVariant(state)}>{state}</Badge>
      </div>
    </div>
  );
}

function StorageKeyRow<T>({ item }: { item: ParsedLocalStorageValue<T> }) {
  return (
    <div className="app-list-item">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-xs">{item.key}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.exists
              ? `${getStorageValueCount(item.value)} item(s)`
              : "Missing"}
            {item.error ? ` / ${item.error}` : ""}
          </p>
        </div>
        <Badge variant={getStateBadgeVariant(item.status)}>{item.status}</Badge>
      </div>
    </div>
  );
}
