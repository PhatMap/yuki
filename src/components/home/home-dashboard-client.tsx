"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useSyncExternalStore } from "react";
import {
  BarChart3,
  BookOpen,
  Database,
  FileUp,
  Library,
  PenLine,
  Settings,
  Sparkles,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stories as mockStories } from "@/lib/mock-data";
import type { Story } from "@/lib/types";

const storiesStorageKey = "ai-story-app:stories";
const homeStoriesStorageEvent = "yuki-home-stories-storage-change";

type HomeStorySource = "local" | "mock";

type HomeStory = Story & {
  homeSource: HomeStorySource;
};

const emptyStoriesSnapshot: Story[] = [];

let cachedStoriesRawValue: string | null = null;
let cachedStoriesSnapshot: Story[] = emptyStoriesSnapshot;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStory(value: unknown): value is Story {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function readLocalStoriesSnapshot() {
  if (typeof window === "undefined") return emptyStoriesSnapshot;

  const rawValue = localStorage.getItem(storiesStorageKey);

  if (rawValue === cachedStoriesRawValue) {
    return cachedStoriesSnapshot;
  }

  cachedStoriesRawValue = rawValue;

  try {
    const parsedValue = rawValue ? (JSON.parse(rawValue) as unknown) : [];

    cachedStoriesSnapshot = Array.isArray(parsedValue)
      ? parsedValue.filter(isStory)
      : emptyStoriesSnapshot;
  } catch (error) {
    console.error("Failed to read local stories from localStorage", error);
    cachedStoriesSnapshot = emptyStoriesSnapshot;
  }

  return cachedStoriesSnapshot;
}

function subscribeToStoriesStorage(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorageChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(homeStoriesStorageEvent, handleStorageChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(homeStoriesStorageEvent, handleStorageChange);
  };
}

function sortByUpdatedAtDesc(storyItems: Story[]) {
  return [...storyItems].sort((firstStory, secondStory) => {
    return (
      new Date(secondStory.updatedAt).getTime() -
      new Date(firstStory.updatedAt).getTime()
    );
  });
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("vi-VN");
}

function mergeHomeStories(localStories: Story[]) {
  const localItems: HomeStory[] = sortByUpdatedAtDesc(localStories).map(
    (story) => ({
      ...story,
      homeSource: "local",
    }),
  );

  const localIds = new Set(localItems.map((story) => story.id));

  const starterItems: HomeStory[] = mockStories
    .filter((story) => !localIds.has(story.id))
    .map((story) => ({
      ...story,
      homeSource: "mock",
    }));

  return {
    localItems,
    starterItems,
    allItems: [...localItems, ...starterItems],
  };
}

export function HomeDashboardClient() {
  const localStories = useSyncExternalStore(
    subscribeToStoriesStorage,
    readLocalStoriesSnapshot,
    () => emptyStoriesSnapshot,
  );

  const { localItems, starterItems, allItems } = useMemo(
    () => mergeHomeStories(localStories),
    [localStories],
  );

  const primaryStory = allItems[0];

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Yuki"
          title="Long novel AI workspace"
          description="Import, inspect, analyze, rewrite, and manage continuity for long-form stories."
          action={
            <>
              <Button asChild>
                <Link href="/stories/import">
                  <FileUp className="mr-2 h-4 w-4" />
                  Import Story
                </Link>
              </Button>

              {primaryStory ? (
                <Button asChild variant="outline">
                  <Link href={`/stories/${primaryStory.id}`}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Open Latest
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Library className="h-4 w-4" />}
            title="Local stories"
            value={localItems.length.toLocaleString("vi-VN")}
            description="Stories found in browser localStorage."
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            title="Starter stories"
            value={starterItems.length.toLocaleString("vi-VN")}
            description="Mock stories available for demo flow."
          />
          <StatCard
            icon={<BarChart3 className="h-4 w-4" />}
            title="Main flow"
            value="Import"
            description="Recommended start for long novels."
          />
          <StatCard
            icon={<Database className="h-4 w-4" />}
            title="Storage"
            value="Local"
            description="IndexedDB-first pages with localStorage fallback."
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <SectionCard
            title="Quick actions"
            description="Use the current local-first workflow. Backend, Supabase, vector DB, and roleplay are still intentionally outside the active scope."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <HomeActionCard
                title="Import long story"
                description="Load existing chapters into the local yuki workspace."
                href="/stories/import"
                icon={<FileUp className="h-5 w-5" />}
              />

              {primaryStory ? (
                <>
                  <HomeActionCard
                    title="Open workspace"
                    description="Continue from the latest local or starter story."
                    href={`/stories/${primaryStory.id}/workspace`}
                    icon={<BookOpen className="h-5 w-5" />}
                  />
                  <HomeActionCard
                    title="Open analysis"
                    description="Run mock analysis or test configured provider selection."
                    href={`/stories/${primaryStory.id}/analysis`}
                    icon={<BarChart3 className="h-5 w-5" />}
                  />
                  <HomeActionCard
                    title="Open settings"
                    description="Adjust reading width, density, font size, and local preferences."
                    href={`/stories/${primaryStory.id}/settings`}
                    icon={<Settings className="h-5 w-5" />}
                  />
                </>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Current direction">
            <div className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                UI/UX polish is the current priority before adding more AI or
                backend work.
              </p>
              <p>
                Story-level pages now use a shared shell, persistent navigation,
                local display settings, and responsive polish.
              </p>
              <p>
                Next technical focus should stay on improving reading, editing,
                and navigation comfort.
              </p>
            </div>
          </SectionCard>
        </section>

        <SectionCard
          title="Local stories"
          description="Stories imported or saved in this browser."
        >
          {localItems.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {localItems.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No local stories yet"
              description="Import a story to make it appear here. Starter stories are still available below for testing the workspace."
              action={
                <Button asChild>
                  <Link href="/stories/import">
                    <FileUp className="mr-2 h-4 w-4" />
                    Import Story
                  </Link>
                </Button>
              }
            />
          )}
        </SectionCard>

        {starterItems.length > 0 ? (
          <SectionCard
            title="Starter stories"
            description="Mock stories for testing yuki flows without importing a new file."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {starterItems.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          </SectionCard>
        ) : null}
      </PageContainer>
    </PageShell>
  );
}

function HomeActionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}) {
  return (
    <Link href={href} className="app-link-card">
      <div className="flex items-start gap-3">
        <div className="app-dashboard-card-icon">{icon}</div>

        <div className="min-w-0">
          <h2 className="app-link-card-title">{title}</h2>
          <p className="app-link-card-description">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function StoryCard({ story }: { story: HomeStory }) {
  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <CardHeader className="gap-1 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="app-wrap-anywhere text-base">
              {story.title}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {formatDate(story.updatedAt)}
            </p>
          </div>

          <span
            className={
              story.homeSource === "local" ? "app-chip-primary" : "app-chip"
            }
          >
            {story.homeSource === "local" ? "Local" : "Starter"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {story.description}
        </p>

        <div className="app-chip-row">
          {"genre" in story && story.genre ? (
            <span className="app-chip">{story.genre}</span>
          ) : null}
          {"tone" in story && story.tone ? (
            <span className="app-chip">{story.tone}</span>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild size="sm">
            <Link href={`/stories/${story.id}/workspace`}>
              <PenLine className="mr-2 h-4 w-4" />
              Workspace
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline">
            <Link href={`/stories/${story.id}/analysis`}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Analysis
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
