"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  CalendarDays,
  HeartHandshake,
  MapPin,
  Search,
  ScrollText,
  Sparkles,
} from "lucide-react";

import {
  getAnalysisResult,
  getBranchChanges,
  getContinuityIssues,
  getStoryById,
} from "@/lib/db/indexed-db";
import { stories } from "@/lib/mock-data";
import type {
  BranchChange,
  BranchContinuityIssue,
  ExtractedEntity,
  Story,
  StoryAnalysisResult,
  WritingStyleProfile,
} from "@/lib/types";
import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StoryWorldTrackerClientProps {
  storyId: string;
}

interface StoryWorldTrackerData {
  story?: Story;
  analysisResult: StoryAnalysisResult | null;
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
}

type WorldTrackerCategory =
  | "all"
  | "items"
  | "terms"
  | "locations"
  | "power-system"
  | "impacted";

const storyStorageKey = "ai-story-app:stories";
const powerSystemKeywords = [
  "cảnh giới",
  "linh khí",
  "công pháp",
  "trận pháp",
  "ma pháp",
  "huyết mạch",
  "thần thức",
];
const worldRiskKeywords = [
  "item",
  "term",
  "location",
  "world",
  "vật phẩm",
  "thuật ngữ",
  "địa danh",
  "cảnh giới",
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

function readLocalStory(storyId: string) {
  return readJsonValue<Story[]>(storyStorageKey, []).find(
    (story) => story.id === storyId,
  );
}

function readLocalWorldTrackerData(storyId: string): StoryWorldTrackerData {
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
  };
}

async function readIndexedDbWorldTrackerData(
  storyId: string,
): Promise<StoryWorldTrackerData> {
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

function mergeWorldTrackerData(
  indexedDbData: StoryWorldTrackerData,
  localData: StoryWorldTrackerData,
): StoryWorldTrackerData {
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

function textIncludesAnyKeyword(text: string, keywords: string[]) {
  const normalizedText = text.toLocaleLowerCase();

  return keywords.some((keyword) =>
    normalizedText.includes(keyword.toLocaleLowerCase()),
  );
}

function isPowerSystemEntity(entity: ExtractedEntity) {
  const searchableText = `${entity.name} ${entity.description}`;

  return (
    entity.type === "power-system" ||
    textIncludesAnyKeyword(searchableText, powerSystemKeywords)
  );
}

function changeMatchesEntity(change: BranchChange, entity: ExtractedEntity) {
  return (
    change.targetName
      ?.toLocaleLowerCase()
      .includes(entity.name.toLocaleLowerCase()) ?? false
  );
}

function isWorldBranchChange(change: BranchChange) {
  return (
    change.type === "item_change" ||
    change.type === "term_change" ||
    change.type === "location_change" ||
    change.type === "timeline_change"
  );
}

function isWorldContinuityRisk(issue: BranchContinuityIssue) {
  const searchableText = `${issue.title} ${issue.description}`;

  return (
    issue.severity === "high" ||
    issue.severity === "critical" ||
    textIncludesAnyKeyword(searchableText, worldRiskKeywords)
  );
}

function matchesSearch(entity: ExtractedEntity, searchQuery: string) {
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();

  if (!normalizedSearch) return true;

  return `${entity.name} ${entity.description}`
    .toLocaleLowerCase()
    .includes(normalizedSearch);
}

function filterEntities({
  entities,
  searchQuery,
  category,
  worldBranchChanges,
}: {
  entities: ExtractedEntity[];
  searchQuery: string;
  category: WorldTrackerCategory;
  worldBranchChanges: BranchChange[];
}) {
  return entities.filter((entity) => {
    const impacted = worldBranchChanges.some((change) =>
      changeMatchesEntity(change, entity),
    );

    if (!matchesSearch(entity, searchQuery)) return false;
    if (category === "impacted") return impacted;
    if (category === "power-system") return isPowerSystemEntity(entity);

    return true;
  });
}

export function StoryWorldTrackerClient({
  storyId,
}: StoryWorldTrackerClientProps) {
  const [worldTrackerData, setWorldTrackerData] =
    useState<StoryWorldTrackerData>({
      analysisResult: null,
      branchChanges: [],
      continuityIssues: [],
    });
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<WorldTrackerCategory>("all");

  useEffect(() => {
    let isActive = true;

    async function loadWorldTrackerData() {
      const localData = readLocalWorldTrackerData(storyId);
      let indexedDbData: StoryWorldTrackerData = {
        analysisResult: null,
        branchChanges: [],
        continuityIssues: [],
      };
      let indexedDbFailed = false;

      try {
        indexedDbData = await readIndexedDbWorldTrackerData(storyId);
      } catch (error) {
        indexedDbFailed = true;
        console.error("Failed to read World Tracker data from IndexedDB", error);
      }

      if (!isActive) return;

      setWorldTrackerData(mergeWorldTrackerData(indexedDbData, localData));
      setStorageError(
        indexedDbFailed
          ? "IndexedDB read failed. Showing localStorage fallback data."
          : "",
      );
      setIsLoading(false);
    }

    void loadWorldTrackerData();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  const story =
    worldTrackerData.story ?? stories.find((item) => item.id === storyId);
  const result = worldTrackerData.analysisResult;
  const worldBranchChanges = useMemo(() => {
    return worldTrackerData.branchChanges.filter(isWorldBranchChange);
  }, [worldTrackerData.branchChanges]);
  const worldContinuityRisks = useMemo(() => {
    return worldTrackerData.continuityIssues.filter(isWorldContinuityRisk);
  }, [worldTrackerData.continuityIssues]);
  const powerSystemTerms = useMemo(() => {
    return result?.terms.filter(isPowerSystemEntity) ?? [];
  }, [result?.terms]);
  const filteredItems = useMemo(() => {
    if (!result || (category !== "all" && category !== "items" && category !== "impacted")) {
      return [];
    }

    return filterEntities({
      entities: result.items,
      searchQuery,
      category,
      worldBranchChanges,
    });
  }, [category, result, searchQuery, worldBranchChanges]);
  const filteredTerms = useMemo(() => {
    if (!result || (category !== "all" && category !== "terms" && category !== "power-system" && category !== "impacted")) {
      return [];
    }

    return filterEntities({
      entities: result.terms,
      searchQuery,
      category,
      worldBranchChanges,
    });
  }, [category, result, searchQuery, worldBranchChanges]);
  const filteredLocations = useMemo(() => {
    if (!result || (category !== "all" && category !== "locations" && category !== "impacted")) {
      return [];
    }

    return filterEntities({
      entities: result.locations,
      searchQuery,
      category,
      worldBranchChanges,
    });
  }, [category, result, searchQuery, worldBranchChanges]);
  const highCriticalRisks = worldContinuityRisks.filter(
    (issue) => issue.severity === "high" || issue.severity === "critical",
  );
  const styleProfile = result?.writingStyleProfiles[0];

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="World Tracker"
          title={story?.title ?? "World Tracker"}
          description="Items, terms, locations, power-system concepts, and branch impacts."
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
                  <ScrollText className="mr-2 h-4 w-4" />
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
                <Link href={`/stories/${storyId}/relationships`}>
                  <HeartHandshake className="mr-2 h-4 w-4" />
                  Relationships
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


        <p className="app-muted-text">
          World Tracker reads from IndexedDB first, with localStorage fallback.
        </p>

        {storageError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {storageError}
          </p>
        ) : null}

        {isLoading ? (
          <SectionCard title="Loading World Tracker">
            <p className="app-muted-text">
              Reading world tracker data from IndexedDB and localStorage...
            </p>
          </SectionCard>
        ) : !result ? (
          <EmptyState
            title="No world tracker data yet. Run mock analysis first."
            description="Open the analysis dashboard and start mock analysis to populate items, terms, locations, and writing style."
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
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <StatCard
                icon={<Boxes className="h-4 w-4" />}
                title="Items"
                value={result.items.length}
              />
              <StatCard
                icon={<ScrollText className="h-4 w-4" />}
                title="Terms"
                value={result.terms.length}
              />
              <StatCard
                icon={<MapPin className="h-4 w-4" />}
                title="Locations"
                value={result.locations.length}
              />
              <StatCard
                icon={<Sparkles className="h-4 w-4" />}
                title="Power-system"
                value={powerSystemTerms.length}
              />
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                title="World changes"
                value={worldBranchChanges.length}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="High/Critical risks"
                value={highCriticalRisks.length}
              />
            </section>

            <SectionCard title="Filters">
              <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Search world data</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Name or description..."
                    />
                  </div>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Category</span>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value as WorldTrackerCategory)
                    }
                  >
                    <option value="all">All</option>
                    <option value="items">Items</option>
                    <option value="terms">Terms</option>
                    <option value="locations">Locations</option>
                    <option value="power-system">Power-system</option>
                    <option value="impacted">Impacted only</option>
                  </select>
                </label>
              </div>
            </SectionCard>

            <section className="grid gap-4 xl:grid-cols-2">
              <WorldEntitySection
                branchChanges={worldBranchChanges}
                emptyText="No items match the current filters."
                entities={filteredItems}
                title="Items"
              />
              <WorldEntitySection
                branchChanges={worldBranchChanges}
                emptyText="No terms match the current filters."
                entities={filteredTerms}
                title="Terms"
              />
              <WorldEntitySection
                branchChanges={worldBranchChanges}
                emptyText="No locations match the current filters."
                entities={filteredLocations}
                title="Locations"
              />
              <WorldEntitySection
                branchChanges={worldBranchChanges}
                emptyText="No power-system concepts detected."
                entities={
                  category === "all" || category === "power-system"
                    ? powerSystemTerms.filter((entity) =>
                        matchesSearch(entity, searchQuery),
                      )
                    : []
                }
                title="Power System Concepts"
              />
              <BranchImpactsSection changes={worldBranchChanges} />
              <WorldContinuityRisksSection risks={worldContinuityRisks} />
              <WritingStyleSummary profile={styleProfile} />
            </section>
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}

function WorldEntitySection({
  title,
  entities,
  emptyText,
  branchChanges,
}: {
  title: string;
  entities: ExtractedEntity[];
  emptyText: string;
  branchChanges: BranchChange[];
}) {
  return (
    <SectionCard title={title}>
      {entities.length > 0 ? (
        <div className="space-y-3">
          {entities.map((entity) => {
            const impacted = branchChanges.some((change) =>
              changeMatchesEntity(change, entity),
            );

            return (
              <article key={entity.id} className="app-list-item">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-medium">{entity.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entity.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {impacted ? <Badge variant="outline">Impacted</Badge> : null}
                    {typeof entity.confidence === "number" ? (
                      <Badge variant="secondary">
                        {Math.round(entity.confidence * 100)}%
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {entity.firstSeenChapter
                    ? `First seen: chapter ${entity.firstSeenChapter}. `
                    : ""}
                  Related chapters: {entity.relatedChapterNumbers.length}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="app-muted-text">{emptyText}</p>
      )}
    </SectionCard>
  );
}

function BranchImpactsSection({ changes }: { changes: BranchChange[] }) {
  return (
    <SectionCard title="Branch Impacts">
      {changes.length > 0 ? (
        <div className="space-y-2">
          {changes.map((change) => (
            <article key={change.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium">{change.title}</h2>
                <Badge variant="outline">{change.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {change.type} / {change.targetName ?? "No target"} /{" "}
                {change.impactScope}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {change.affectedChapterNumbers.length} affected chapters
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">No item, term, location, or timeline changes yet.</p>
      )}
    </SectionCard>
  );
}

function WorldContinuityRisksSection({
  risks,
}: {
  risks: BranchContinuityIssue[];
}) {
  return (
    <SectionCard title="World Continuity Risks">
      {risks.length > 0 ? (
        <div className="space-y-2">
          {risks.map((risk) => (
            <article key={risk.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium">{risk.title}</h2>
                <Badge variant="outline">{risk.severity}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {risk.status} / {risk.affectedChapterNumbers.length} affected
                chapters
              </p>
              {risk.suggestedFix ? (
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                  Suggested fix: {risk.suggestedFix}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">No world continuity risks detected.</p>
      )}
    </SectionCard>
  );
}

function WritingStyleSummary({
  profile,
}: {
  profile?: WritingStyleProfile;
}) {
  return (
    <SectionCard title="Writing Style Summary">
      {profile ? (
        <div className="space-y-4 text-sm">
          <StyleRow label="Narration" value={profile.narrationStyle} />
          <StyleRow label="Sentence" value={profile.sentenceStyle} />
          <StyleRow label="Dialogue" value={profile.dialogueStyle} />
          <StyleRow label="Pacing" value={profile.pacing} />
          <StyleRow label="Tone" value={profile.tone} />
          <PatternList title="Common patterns" items={profile.commonPatterns} />
          <PatternList title="Taboo patterns" items={profile.tabooPatterns} />
        </div>
      ) : (
        <p className="app-muted-text">No writing style profile detected.</p>
      )}
    </SectionCard>
  );
}

function StyleRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-muted-foreground">{value}</p>
    </div>
  );
}

function PatternList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted-foreground">No patterns detected.</p>
      )}
    </div>
  );
}
