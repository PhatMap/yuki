"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  CalendarDays,
  GitBranch,
  HeartHandshake,
  MapPin,
  PenLine,
  ScrollText,
  Users,
} from "lucide-react";

import {
  getAnalysisResult,
  getBranchChanges,
  getBranches,
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
  StoryBranchV2,
  StoryEvent,
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

interface StoryBibleClientProps {
  storyId: string;
}

interface StoryBibleData {
  story?: Story;
  analysisResult: StoryAnalysisResult | null;
  branches: StoryBranchV2[];
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
}

const storyStorageKey = "ai-story-app:stories";

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

function readLocalBibleData(storyId: string): StoryBibleData {
  return {
    story: readLocalStory(storyId),
    analysisResult: readJsonValue<StoryAnalysisResult | null>(
      `ai-story-app:analysis-result:${storyId}`,
      null,
    ),
    branches: readJsonValue<StoryBranchV2[]>(
      `ai-story-app:branches:${storyId}`,
      [],
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

async function readIndexedDbBibleData(
  storyId: string,
): Promise<StoryBibleData> {
  const [story, analysisResult, branches, branchChanges, continuityIssues] =
    await Promise.all([
      getStoryById(storyId),
      getAnalysisResult(storyId),
      getBranches(storyId),
      getBranchChanges(storyId),
      getContinuityIssues(storyId),
    ]);

  return {
    story,
    analysisResult: analysisResult ?? null,
    branches,
    branchChanges,
    continuityIssues,
  };
}

function mergeBibleData(
  indexedDbData: StoryBibleData,
  localData: StoryBibleData,
): StoryBibleData {
  return {
    story: indexedDbData.story ?? localData.story,
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

export function StoryBibleClient({ storyId }: StoryBibleClientProps) {
  const [bibleData, setBibleData] = useState<StoryBibleData>({
    analysisResult: null,
    branches: [],
    branchChanges: [],
    continuityIssues: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadBibleData() {
      const localData = readLocalBibleData(storyId);
      let indexedDbData: StoryBibleData = {
        analysisResult: null,
        branches: [],
        branchChanges: [],
        continuityIssues: [],
      };
      let indexedDbFailed = false;

      try {
        indexedDbData = await readIndexedDbBibleData(storyId);
      } catch (error) {
        indexedDbFailed = true;
        console.error("Failed to read Story Bible data from IndexedDB", error);
      }

      if (!isActive) return;

      setBibleData(mergeBibleData(indexedDbData, localData));
      setStorageError(
        indexedDbFailed
          ? "IndexedDB read failed. Showing localStorage fallback data."
          : "",
      );
      setIsLoading(false);
    }

    void loadBibleData();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  const story =
    bibleData.story ?? stories.find((item) => item.id === storyId);
  const result = bibleData.analysisResult;
  const sortedEvents = useMemo(() => {
    return [...(result?.events ?? [])].sort(
      (left, right) => left.chapterNumber - right.chapterNumber,
    );
  }, [result?.events]);
  const styleProfile = result?.writingStyleProfiles[0];

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Story Bible"
          title={story?.title ?? "Story Bible"}
          description="Characters, events, items, terms, locations, writing style, and branch continuity overview."
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/workspace`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Open Workspace
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
          Story Bible reads from IndexedDB first, with localStorage fallback.
        </p>

        {storageError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {storageError}
          </p>
        ) : null}

        {isLoading ? (
          <SectionCard title="Loading Story Bible">
            <p className="app-muted-text">
              Reading Story Bible data from IndexedDB and localStorage...
            </p>
          </SectionCard>
        ) : !result ? (
          <EmptyState
            title="No Story Bible yet. Run mock analysis first."
            description="Open the analysis dashboard and start mock analysis to populate characters, events, items, terms, locations, and writing style."
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
                icon={<Users className="h-4 w-4" />}
                title="Characters"
                value={result.characters.length}
              />
              <StatCard
                icon={<CalendarDays className="h-4 w-4" />}
                title="Events"
                value={result.events.length}
              />
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
                icon={<GitBranch className="h-4 w-4" />}
                title="Branch changes"
                value={bibleData.branchChanges.length}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Continuity issues"
                value={bibleData.continuityIssues.length}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <EntitySection title="Characters" entities={result.characters} />
              <EventSection events={sortedEvents} />
              <EntitySection title="Items" entities={result.items} />
              <EntitySection title="Terms" entities={result.terms} />
              <EntitySection title="Locations" entities={result.locations} />
              <WritingStyleSection profile={styleProfile} />
            </section>

            <BranchContinuitySection
              branches={bibleData.branches}
              changes={bibleData.branchChanges}
              issues={bibleData.continuityIssues}
            />
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}

function EntitySection({
  title,
  entities,
}: {
  title: string;
  entities: ExtractedEntity[];
}) {
  return (
    <SectionCard title={title}>
      {entities.length > 0 ? (
        <div className="space-y-3">
          {entities.map((entity) => (
            <article key={entity.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium">{entity.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entity.description}
                  </p>
                </div>
                {typeof entity.confidence === "number" ? (
                  <Badge variant="outline">
                    {Math.round(entity.confidence * 100)}%
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {entity.firstSeenChapter
                  ? `First seen: chapter ${entity.firstSeenChapter}. `
                  : ""}
                Related chapters: {entity.relatedChapterNumbers.length}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">No entries detected.</p>
      )}
    </SectionCard>
  );
}

function EventSection({ events }: { events: StoryEvent[] }) {
  return (
    <SectionCard title="Events">
      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => (
            <article key={event.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Chapter {event.chapterNumber}
                  </p>
                  <h2 className="mt-1 text-sm font-medium">{event.title}</h2>
                </div>
                <Badge variant="outline">{event.importance}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {event.description}
              </p>
              {event.charactersInvolved.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Characters: {event.charactersInvolved.join(", ")}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">No events detected.</p>
      )}
    </SectionCard>
  );
}

function WritingStyleSection({
  profile,
}: {
  profile?: WritingStyleProfile;
}) {
  return (
    <SectionCard icon={<PenLine className="h-5 w-5" />} title="Writing Style">
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

function BranchContinuitySection({
  branches,
  changes,
  issues,
}: {
  branches: StoryBranchV2[];
  changes: BranchChange[];
  issues: BranchContinuityIssue[];
}) {
  return (
    <SectionCard title="Branch Continuity">
      <div className="grid gap-4 xl:grid-cols-3">
        <OverviewList
          emptyText="No branches yet."
          items={branches}
          renderItem={(branch) => (
            <article key={branch.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium">{branch.name}</h2>
                <Badge variant="outline">{branch.type}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {branch.description}
              </p>
            </article>
          )}
          title="Branches"
        />
        <OverviewList
          emptyText="No branch changes yet."
          items={changes}
          renderItem={(change) => (
            <article key={change.id} className="app-list-item">
              <h2 className="text-sm font-medium">{change.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {change.type} · {change.impactScope} · {change.status}
              </p>
            </article>
          )}
          title="Branch Changes"
        />
        <OverviewList
          emptyText="No continuity issues yet."
          items={issues}
          renderItem={(issue) => (
            <article key={issue.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium">{issue.title}</h2>
                <Badge variant="outline">{issue.severity}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {issue.status}
              </p>
            </article>
          )}
          title="Continuity Issues"
        />
      </div>
    </SectionCard>
  );
}

function OverviewList<T>({
  title,
  items,
  emptyText,
  renderItem,
}: {
  title: string;
  items: T[];
  emptyText: string;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="space-y-2">
        {items.length > 0 ? (
          items.map(renderItem)
        ) : (
          <p className="app-muted-text">{emptyText}</p>
        )}
      </div>
    </div>
  );
}
