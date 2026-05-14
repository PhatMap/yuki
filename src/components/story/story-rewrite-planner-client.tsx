"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  FileText,
  GitBranch,
  Layers3,
  PenLine,
  Save,
} from "lucide-react";

import {
  getAnalysisResult,
  getBranchChanges,
  getContinuityIssues,
  getStoryById,
  saveBranchChanges,
  saveContinuityIssues,
} from "@/lib/db/indexed-db";
import { stories } from "@/lib/mock-data";
import type {
  BranchChange,
  BranchChangeType,
  BranchContinuityIssue,
  ExtractedEntity,
  ImpactScope,
  Story,
  StoryAnalysisResult,
  StoryEvent,
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

interface StoryRewritePlannerClientProps {
  storyId: string;
}

interface StoryRewritePlannerData {
  story?: Story;
  analysisResult: StoryAnalysisResult | null;
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
}

type RewriteType =
  | "plot-change"
  | "character-decision-change"
  | "timeline-change"
  | "item-change"
  | "relationship-change"
  | "worldbuilding-change"
  | "style-change";

type ImpactCategory =
  | "characters"
  | "timeline"
  | "relationships"
  | "items"
  | "terms"
  | "locations"
  | "power-system"
  | "writing-style";

interface RewriteForm {
  title: string;
  description: string;
  reason: string;
  rewriteType: RewriteType;
  selectedChapter: number;
  selectedEventId: string;
  rangeStart: number;
  rangeEnd: number;
  impactCategories: ImpactCategory[];
}

interface ContinuityIssuePreview {
  id: string;
  title: string;
  type: string;
  severity: BranchContinuityIssue["severity"];
  affectedRange: string;
  relatedEntity: string;
  suggestedFix: string;
}

const storyStorageKey = "ai-story-app:stories";
const branchChangesStorageKey = (storyId: string) =>
  `ai-story-app:branch-changes:${storyId}`;
const continuityIssuesStorageKey = (storyId: string) =>
  `ai-story-app:continuity-issues:${storyId}`;
const rewriteTypes: { value: RewriteType; label: string }[] = [
  { value: "plot-change", label: "Plot change" },
  { value: "character-decision-change", label: "Character decision change" },
  { value: "timeline-change", label: "Timeline change" },
  { value: "item-change", label: "Item change" },
  { value: "relationship-change", label: "Relationship change" },
  { value: "worldbuilding-change", label: "Worldbuilding change" },
  { value: "style-change", label: "Style change" },
];
const impactCategories: { value: ImpactCategory; label: string }[] = [
  { value: "characters", label: "Characters" },
  { value: "timeline", label: "Timeline" },
  { value: "relationships", label: "Relationships" },
  { value: "items", label: "Items" },
  { value: "terms", label: "Terms" },
  { value: "locations", label: "Locations" },
  { value: "power-system", label: "Power-system" },
  { value: "writing-style", label: "Writing style" },
];

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

function readLocalRewritePlannerData(storyId: string): StoryRewritePlannerData {
  return {
    story: readLocalStory(storyId),
    analysisResult: readJsonValue<StoryAnalysisResult | null>(
      `ai-story-app:analysis-result:${storyId}`,
      null,
    ),
    branchChanges: readJsonValue<BranchChange[]>(
      branchChangesStorageKey(storyId),
      [],
    ),
    continuityIssues: readJsonValue<BranchContinuityIssue[]>(
      continuityIssuesStorageKey(storyId),
      [],
    ),
  };
}

async function readIndexedDbRewritePlannerData(
  storyId: string,
): Promise<StoryRewritePlannerData> {
  const [story, analysisResult, branchChanges, continuityIssues] =
    await Promise.all([
      getStoryById(storyId),
      getAnalysisResult(storyId),
      getBranchChanges(storyId),
      getContinuityIssues(storyId),
    ]);

  return {
    story,
    analysisResult: analysisResult ?? null,
    branchChanges,
    continuityIssues,
  };
}

function mergeRewritePlannerData(
  indexedDbData: StoryRewritePlannerData,
  localData: StoryRewritePlannerData,
): StoryRewritePlannerData {
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
  };
}

function mapRewriteTypeToBranchChangeType(
  rewriteType: RewriteType,
): BranchChangeType {
  const map: Record<RewriteType, BranchChangeType> = {
    "plot-change": "event_change",
    "character-decision-change": "character_state_change",
    "timeline-change": "timeline_change",
    "item-change": "item_change",
    "relationship-change": "relationship_change",
    "worldbuilding-change": "term_change",
    "style-change": "chapter_rewrite",
  };

  return map[rewriteType];
}

function getImpactScope(form: RewriteForm): ImpactScope {
  if (form.rangeEnd > form.rangeStart) return "chapter_range";
  if (form.rewriteType === "plot-change" || form.rewriteType === "timeline-change") {
    return "from_chapter_forward";
  }

  return "single_chapter";
}

function createChapterRange(start: number, end: number) {
  const safeStart = Math.max(1, Math.min(start, end));
  const safeEnd = Math.max(safeStart, Math.max(start, end));

  return Array.from(
    { length: safeEnd - safeStart + 1 },
    (_, index) => safeStart + index,
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function entitiesInRange(entities: ExtractedEntity[], chapters: number[]) {
  const chapterSet = new Set(chapters);

  return entities.filter((entity) =>
    entity.relatedChapterNumbers.some((chapter) => chapterSet.has(chapter)),
  );
}

function eventsInRange(events: StoryEvent[], chapters: number[]) {
  const chapterSet = new Set(chapters);

  return events.filter((event) => chapterSet.has(event.chapterNumber));
}

function formatRange(start: number, end: number) {
  return start === end ? `Chapter ${start}` : `Chapters ${start}-${end}`;
}

function createInitialForm(result: StoryAnalysisResult | null): RewriteForm {
  const firstEvent = result?.events[0];
  const firstChapter = firstEvent?.chapterNumber ?? 1;

  return {
    title: "",
    description: "",
    reason: "",
    rewriteType: "plot-change",
    selectedChapter: firstChapter,
    selectedEventId: firstEvent?.id ?? "",
    rangeStart: firstChapter,
    rangeEnd: Math.max(firstChapter, firstChapter + 10),
    impactCategories: ["characters", "timeline"],
  };
}

function buildContinuityIssuePreviews({
  form,
  affectedCharacters,
  affectedEvents,
  affectedItems,
  affectedTerms,
  affectedLocations,
}: {
  form: RewriteForm;
  affectedCharacters: ExtractedEntity[];
  affectedEvents: StoryEvent[];
  affectedItems: ExtractedEntity[];
  affectedTerms: ExtractedEntity[];
  affectedLocations: ExtractedEntity[];
}): ContinuityIssuePreview[] {
  const range = formatRange(form.rangeStart, form.rangeEnd);
  const issues: ContinuityIssuePreview[] = [
    {
      id: "timeline-alignment",
      title: "Timeline alignment needs review",
      type: "timeline",
      severity:
        form.rewriteType === "timeline-change" || form.rewriteType === "plot-change"
          ? "high"
          : "medium",
      affectedRange: range,
      relatedEntity: affectedEvents[0]?.title ?? "Timeline",
      suggestedFix:
        "Review later canon events and update any event that depends on the original version.",
    },
  ];

  if (affectedCharacters.length > 0 || form.rewriteType === "relationship-change") {
    issues.push({
      id: "character-state",
      title: "Character state and relationship memory may diverge",
      type: "character",
      severity: form.rewriteType === "relationship-change" ? "high" : "medium",
      affectedRange: range,
      relatedEntity: affectedCharacters[0]?.name ?? "Character relationships",
      suggestedFix:
        "Update character goals, knowledge, emotional state, and relationship notes from this chapter forward.",
    });
  }

  if (
    affectedItems.length > 0 ||
    affectedTerms.length > 0 ||
    affectedLocations.length > 0 ||
    form.rewriteType === "worldbuilding-change" ||
    form.rewriteType === "item-change"
  ) {
    issues.push({
      id: "world-bible",
      title: "World Bible entries may need alternate canon values",
      type: "world-bible",
      severity: form.rewriteType === "item-change" ? "high" : "medium",
      affectedRange: range,
      relatedEntity:
        affectedItems[0]?.name ??
        affectedTerms[0]?.name ??
        affectedLocations[0]?.name ??
        "World Bible",
      suggestedFix:
        "Create branch-specific notes for items, terms, locations, and power-system concepts touched by this rewrite.",
    });
  }

  if (form.impactCategories.includes("writing-style")) {
    issues.push({
      id: "style-continuity",
      title: "Writing style drift should be checked",
      type: "writing-style",
      severity: "low",
      affectedRange: range,
      relatedEntity: "Writing style",
      suggestedFix:
        "Compare rewritten prose against the story style profile before approving generated chapters.",
    });
  }

  return issues;
}

async function savePlannerData({
  storyId,
  branchChanges,
  continuityIssues,
}: {
  storyId: string;
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
}) {
  let localStorageSaved = false;
  let indexedDbSaved = false;

  try {
    writeJsonValue(branchChangesStorageKey(storyId), branchChanges);
    writeJsonValue(continuityIssuesStorageKey(storyId), continuityIssues);
    localStorageSaved = true;
  } catch (error) {
    console.error("Failed to save rewrite planner data to localStorage", error);
  }

  try {
    await saveBranchChanges(storyId, branchChanges);
    await saveContinuityIssues(storyId, continuityIssues);
    indexedDbSaved = true;
  } catch (error) {
    console.error("Failed to save rewrite planner data to IndexedDB", error);
  }

  return localStorageSaved || indexedDbSaved;
}

export function StoryRewritePlannerClient({
  storyId,
}: StoryRewritePlannerClientProps) {
  const [plannerData, setPlannerData] = useState<StoryRewritePlannerData>({
    analysisResult: null,
    branchChanges: [],
    continuityIssues: [],
  });
  const [form, setForm] = useState<RewriteForm>(() => createInitialForm(null));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadRewritePlannerData() {
      const localData = readLocalRewritePlannerData(storyId);
      let indexedDbData: StoryRewritePlannerData = {
        analysisResult: null,
        branchChanges: [],
        continuityIssues: [],
      };
      let indexedDbFailed = false;

      try {
        indexedDbData = await readIndexedDbRewritePlannerData(storyId);
      } catch (error) {
        indexedDbFailed = true;
        console.error(
          "Failed to read rewrite planner data from IndexedDB",
          error,
        );
      }

      if (!isActive) return;

      const mergedData = mergeRewritePlannerData(indexedDbData, localData);

      setPlannerData(mergedData);
      setForm(createInitialForm(mergedData.analysisResult));
      setStorageError(
        indexedDbFailed
          ? "IndexedDB read failed. Showing localStorage fallback data."
          : "",
      );
      setIsLoading(false);
    }

    void loadRewritePlannerData();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  const story =
    plannerData.story ?? stories.find((item) => item.id === storyId);
  const result = plannerData.analysisResult;
  const chapterOptions = useMemo(() => {
    if (!result) return [1];

    const chapters = [
      ...result.events.map((event) => event.chapterNumber),
      ...result.characters.flatMap((entity) => entity.relatedChapterNumbers),
      ...result.items.flatMap((entity) => entity.relatedChapterNumbers),
      ...result.terms.flatMap((entity) => entity.relatedChapterNumbers),
      ...result.locations.flatMap((entity) => entity.relatedChapterNumbers),
    ];

    return Array.from(new Set(chapters.length > 0 ? chapters : [1])).sort(
      (left, right) => left - right,
    );
  }, [result]);
  const selectedEvent = useMemo(() => {
    return result?.events.find((event) => event.id === form.selectedEventId);
  }, [form.selectedEventId, result?.events]);
  const affectedChapters = useMemo(() => {
    return createChapterRange(form.rangeStart, form.rangeEnd);
  }, [form.rangeEnd, form.rangeStart]);
  const affectedEvents = useMemo(() => {
    return result ? eventsInRange(result.events, affectedChapters) : [];
  }, [affectedChapters, result]);
  const affectedCharacters = useMemo(() => {
    if (!result) return [];

    const eventCharacters = uniqueValues(
      affectedEvents.flatMap((event) => event.charactersInvolved),
    );
    const byChapter = entitiesInRange(result.characters, affectedChapters);
    const byEvent = result.characters.filter((entity) =>
      eventCharacters.some(
        (characterName) =>
          characterName.toLocaleLowerCase() === entity.name.toLocaleLowerCase(),
      ),
    );

    return Array.from(new Map([...byChapter, ...byEvent].map((entity) => [entity.id, entity])).values());
  }, [affectedChapters, affectedEvents, result]);
  const affectedItems = useMemo(() => {
    return result ? entitiesInRange(result.items, affectedChapters) : [];
  }, [affectedChapters, result]);
  const affectedTerms = useMemo(() => {
    return result ? entitiesInRange(result.terms, affectedChapters) : [];
  }, [affectedChapters, result]);
  const affectedLocations = useMemo(() => {
    return result ? entitiesInRange(result.locations, affectedChapters) : [];
  }, [affectedChapters, result]);
  const affectedRelationships = useMemo(() => {
    return uniqueValues(
      affectedEvents
        .filter((event) => event.charactersInvolved.length >= 2)
        .flatMap((event) => {
          const names = event.charactersInvolved;

          return names.flatMap((leftName, leftIndex) =>
            names
              .slice(leftIndex + 1)
              .map((rightName) => `${leftName} / ${rightName}`),
          );
        }),
    );
  }, [affectedEvents]);
  const powerConcepts = useMemo(() => {
    return affectedTerms.filter((term) => {
      const searchableText = `${term.name} ${term.description}`.toLocaleLowerCase();

      return (
        term.type === "power-system" ||
        searchableText.includes("power") ||
        searchableText.includes("system") ||
        searchableText.includes("linh") ||
        searchableText.includes("phap")
      );
    });
  }, [affectedTerms]);
  const continuityIssuePreviews = useMemo(() => {
    return buildContinuityIssuePreviews({
      form,
      affectedCharacters,
      affectedEvents,
      affectedItems,
      affectedTerms,
      affectedLocations,
    });
  }, [
    affectedCharacters,
    affectedEvents,
    affectedItems,
    affectedLocations,
    affectedTerms,
    form,
  ]);

  function updateForm<K extends keyof RewriteForm>(
    key: K,
    value: RewriteForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleImpactCategory(category: ImpactCategory) {
    setForm((current) => {
      const exists = current.impactCategories.includes(category);

      return {
        ...current,
        impactCategories: exists
          ? current.impactCategories.filter((item) => item !== category)
          : [...current.impactCategories, category],
      };
    });
  }

  async function handleSaveProposal() {
    if (!result || isSaving) return;

    setIsSaving(true);
    setSaveMessage("");

    const now = new Date().toISOString();
    const changeId = `${storyId}-rewrite-change-${Date.now()}`;
    const branchId = `${storyId}-branch-rewrite-planner`;
    const descriptionParts = [
      form.description.trim(),
      form.reason.trim() ? `Reason: ${form.reason.trim()}` : "",
      `Rewrite type: ${form.rewriteType}`,
      selectedEvent ? `Target event: ${selectedEvent.title}` : "",
      `Impact categories: ${form.impactCategories.join(", ")}`,
    ].filter(Boolean);
    const newChange: BranchChange = {
      id: changeId,
      storyId,
      branchId,
      type: mapRewriteTypeToBranchChangeType(form.rewriteType),
      title: form.title.trim() || `Rewrite proposal for chapter ${form.selectedChapter}`,
      description: descriptionParts.join("\n"),
      targetName: selectedEvent?.title ?? `Chapter ${form.selectedChapter}`,
      chapterNumber: form.selectedChapter,
      chapterRangeStart: form.rangeStart,
      chapterRangeEnd: form.rangeEnd,
      impactScope: getImpactScope(form),
      affectedCharacters: affectedCharacters.map((entity) => entity.name),
      affectedItems: affectedItems.map((entity) => entity.name),
      affectedTerms: affectedTerms.map((entity) => entity.name),
      affectedLocations: affectedLocations.map((entity) => entity.name),
      affectedChapterNumbers: affectedChapters,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    const newIssues: BranchContinuityIssue[] = continuityIssuePreviews.map(
      (issue) => ({
        id: `${changeId}-${issue.id}`,
        storyId,
        branchId,
        changeId,
        severity: issue.severity,
        title: issue.title,
        description: `${issue.type}: ${issue.relatedEntity}. ${issue.affectedRange}.`,
        affectedChapterNumbers: affectedChapters,
        suggestedFix: issue.suggestedFix,
        status: "open",
      }),
    );
    const nextChanges = [newChange, ...plannerData.branchChanges];
    const nextIssues = [...newIssues, ...plannerData.continuityIssues];
    const saved = await savePlannerData({
      storyId,
      branchChanges: nextChanges,
      continuityIssues: nextIssues,
    });

    if (saved) {
      setPlannerData((current) => ({
        ...current,
        branchChanges: nextChanges,
        continuityIssues: nextIssues,
      }));
      setSaveMessage("Rewrite proposal saved as a draft branch change.");
    } else {
      setSaveMessage("Could not save rewrite proposal to IndexedDB or localStorage.");
    }

    setIsSaving(false);
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Rewrite Impact Planner"
          title={story?.title ?? "Rewrite Impact Planner"}
          description="Plan a canon divergence, preview affected story systems, and save it as a draft branch change."
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/workspace`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Open Workspace
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/bible`}>
                  <Layers3 className="mr-2 h-4 w-4" />
                  Story Bible
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/timeline`}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Timeline
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/rewrite-draft`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Open Rewrite Draft Workspace
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
          Rewrite Planner reads from IndexedDB first, with localStorage fallback.
        </p>

        {storageError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {storageError}
          </p>
        ) : null}

        {isLoading ? (
          <SectionCard title="Loading Rewrite Planner">
            <p className="app-muted-text">
              Reading rewrite planner data from IndexedDB and localStorage...
            </p>
          </SectionCard>
        ) : !result ? (
          <EmptyState
            title="No rewrite planning data yet. Run mock analysis first."
            description="Open the analysis dashboard and start mock analysis to populate chapters, events, characters, and world bible data."
            action={
              <Button asChild>
                <Link href={`/stories/${storyId}/analysis`}>
                  Open Analysis
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<CalendarDays className="h-4 w-4" />}
                title="Affected chapters"
                value={affectedChapters.length}
              />
              <StatCard
                icon={<PenLine className="h-4 w-4" />}
                title="Existing changes"
                value={plannerData.branchChanges.length}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Issue previews"
                value={continuityIssuePreviews.length}
              />
              <StatCard
                icon={<GitBranch className="h-4 w-4" />}
                title="Saved issues"
                value={plannerData.continuityIssues.length}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
              <div className="space-y-4">
                <RewriteTargetSelector
                  chapterOptions={chapterOptions}
                  events={result.events}
                  form={form}
                  selectedEvent={selectedEvent}
                  updateForm={updateForm}
                />
                <RewriteProposalForm
                  form={form}
                  isSaving={isSaving}
                  saveMessage={saveMessage}
                  toggleImpactCategory={toggleImpactCategory}
                  updateForm={updateForm}
                  onSave={handleSaveProposal}
                />
              </div>

              <div className="space-y-4">
                <ImpactPreview
                  affectedCharacters={affectedCharacters}
                  affectedChapters={affectedChapters}
                  affectedEvents={affectedEvents}
                  affectedItems={affectedItems}
                  affectedLocations={affectedLocations}
                  affectedRelationships={affectedRelationships}
                  affectedTerms={affectedTerms}
                  powerConcepts={powerConcepts}
                />
                <ContinuityIssuesPreview issues={continuityIssuePreviews} />
                <ExistingSummary
                  changes={plannerData.branchChanges}
                  issues={plannerData.continuityIssues}
                />
              </div>
            </section>
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}

function RewriteTargetSelector({
  chapterOptions,
  events,
  form,
  selectedEvent,
  updateForm,
}: {
  chapterOptions: number[];
  events: StoryEvent[];
  form: RewriteForm;
  selectedEvent?: StoryEvent;
  updateForm: <K extends keyof RewriteForm>(key: K, value: RewriteForm[K]) => void;
}) {
  return (
    <SectionCard title="Rewrite target selector">
      <div className="space-y-4">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Select chapter</span>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={form.selectedChapter}
            onChange={(event) => {
              const chapterNumber = Number(event.target.value);

              updateForm("selectedChapter", chapterNumber);
              updateForm("rangeStart", chapterNumber);
              updateForm("rangeEnd", Math.max(chapterNumber, form.rangeEnd));
            }}
          >
            {chapterOptions.map((chapterNumber) => (
              <option key={chapterNumber} value={chapterNumber}>
                Chapter {chapterNumber}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Select plot/timeline event</span>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={form.selectedEventId}
            onChange={(event) => updateForm("selectedEventId", event.target.value)}
          >
            <option value="">No specific event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                Ch. {event.chapterNumber} - {event.title}
              </option>
            ))}
          </select>
        </label>

        {selectedEvent ? (
          <div className="app-list-item">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Chapter {selectedEvent.chapterNumber}
                </p>
                <p className="mt-1 text-sm font-medium">{selectedEvent.title}</p>
              </div>
              <Badge variant="outline">{selectedEvent.importance}</Badge>
            </div>
            <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
              {selectedEvent.description}
            </p>
          </div>
        ) : (
          <p className="app-muted-text">No event selected.</p>
        )}
      </div>
    </SectionCard>
  );
}

function RewriteProposalForm({
  form,
  isSaving,
  saveMessage,
  toggleImpactCategory,
  updateForm,
  onSave,
}: {
  form: RewriteForm;
  isSaving: boolean;
  saveMessage: string;
  toggleImpactCategory: (category: ImpactCategory) => void;
  updateForm: <K extends keyof RewriteForm>(key: K, value: RewriteForm[K]) => void;
  onSave: () => void;
}) {
  return (
    <SectionCard title="Rewrite proposal form">
      <div className="space-y-4">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Title</span>
          <Input
            value={form.title}
            onChange={(event) => updateForm("title", event.target.value)}
            placeholder="If the protagonist chooses a different path..."
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Description</span>
          <Textarea
            className="min-h-24"
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            placeholder="Describe what changes in the scene, event, relationship, item, or world rule."
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Reason</span>
          <Textarea
            className="min-h-20"
            value={form.reason}
            onChange={(event) => updateForm("reason", event.target.value)}
            placeholder="Why this alternate canon branch should exist."
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Rewrite type</span>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={form.rewriteType}
            onChange={(event) =>
              updateForm("rewriteType", event.target.value as RewriteType)
            }
          >
            {rewriteTypes.map((rewriteType) => (
              <option key={rewriteType.value} value={rewriteType.value}>
                {rewriteType.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Range start</span>
            <Input
              min={1}
              type="number"
              value={form.rangeStart}
              onChange={(event) =>
                updateForm("rangeStart", Number(event.target.value))
              }
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Range end</span>
            <Input
              min={form.rangeStart}
              type="number"
              value={form.rangeEnd}
              onChange={(event) =>
                updateForm("rangeEnd", Number(event.target.value))
              }
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Impact scopes</p>
          <div className="grid gap-2 md:grid-cols-2">
            {impactCategories.map((category) => (
              <button
                key={category.value}
                className="app-list-button"
                type="button"
                onClick={() => toggleImpactCategory(category.value)}
              >
                <span>{category.label}</span>
                {form.impactCategories.includes(category.value) ? (
                  <Badge variant="secondary">On</Badge>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <Button
          className="w-full"
          disabled={isSaving}
          type="button"
          onClick={onSave}
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save rewrite proposal"}
        </Button>

        {saveMessage ? <p className="app-muted-text">{saveMessage}</p> : null}
      </div>
    </SectionCard>
  );
}

function ImpactPreview({
  affectedChapters,
  affectedCharacters,
  affectedEvents,
  affectedRelationships,
  affectedItems,
  affectedTerms,
  affectedLocations,
  powerConcepts,
}: {
  affectedChapters: number[];
  affectedCharacters: ExtractedEntity[];
  affectedEvents: StoryEvent[];
  affectedRelationships: string[];
  affectedItems: ExtractedEntity[];
  affectedTerms: ExtractedEntity[];
  affectedLocations: ExtractedEntity[];
  powerConcepts: ExtractedEntity[];
}) {
  return (
    <SectionCard title="Impact preview">
      <div className="grid gap-3 md:grid-cols-2">
        <PreviewList
          items={affectedChapters.map((chapter) => `Chapter ${chapter}`)}
          title="Affected chapters"
        />
        <PreviewList
          items={affectedCharacters.map((entity) => entity.name)}
          title="Affected characters"
        />
        <PreviewList
          items={affectedEvents.map((event) => event.title)}
          title="Affected timeline events"
        />
        <PreviewList
          items={affectedRelationships}
          title="Affected relationships"
        />
        <PreviewList
          items={affectedItems.map((entity) => entity.name)}
          title="Affected items"
        />
        <PreviewList
          items={affectedTerms.map((entity) => entity.name)}
          title="Affected terms"
        />
        <PreviewList
          items={affectedLocations.map((entity) => entity.name)}
          title="Affected locations"
        />
        <PreviewList
          items={powerConcepts.map((entity) => entity.name)}
          title="Affected power concepts"
        />
      </div>
    </SectionCard>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      {items.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {items.slice(0, 8).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No impact detected.</p>
      )}
    </div>
  );
}

function ContinuityIssuesPreview({
  issues,
}: {
  issues: ContinuityIssuePreview[];
}) {
  return (
    <SectionCard title="Continuity issues preview">
      <div className="space-y-3">
        {issues.map((issue) => (
          <article key={issue.id} className="app-list-item">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {issue.type} / {issue.affectedRange}
                </p>
                <h2 className="mt-1 text-sm font-medium">{issue.title}</h2>
              </div>
              <Badge variant="outline">{issue.severity}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Related entity: {issue.relatedEntity}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Suggested fix: {issue.suggestedFix}
            </p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function ExistingSummary({
  changes,
  issues,
}: {
  changes: BranchChange[];
  issues: BranchContinuityIssue[];
}) {
  return (
    <SectionCard title="Existing branch/change summary">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">Branch changes</p>
          <div className="space-y-2">
            {changes.length > 0 ? (
              changes.slice(0, 8).map((change) => (
                <article key={change.id} className="app-list-item">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-medium">{change.title}</h2>
                    <Badge variant="outline">{change.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {change.type} / {change.impactScope} /{" "}
                    {change.affectedChapterNumbers.length} chapters
                  </p>
                </article>
              ))
            ) : (
              <p className="app-muted-text">No branch changes saved yet.</p>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Continuity issues</p>
          <div className="space-y-2">
            {issues.length > 0 ? (
              issues.slice(0, 8).map((issue) => (
                <article key={issue.id} className="app-list-item">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-medium">{issue.title}</h2>
                    <Badge variant="outline">{issue.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {issue.status} / {issue.affectedChapterNumbers.length} chapters
                  </p>
                </article>
              ))
            ) : (
              <p className="app-muted-text">No continuity issues saved yet.</p>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
