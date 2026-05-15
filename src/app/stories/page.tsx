"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import StoryCard from "@/components/story/story-card";
import StoryTree from "@/components/story/story-tree";
import { getAllStories, getImportedChapters } from "@/lib/db/indexed-db";
import {
  branches as mockBranches,
  chapters as mockChapters,
  stories as mockStories,
} from "@/lib/mock-data";
import type { Chapter, Story, StoryBranch } from "@/lib/types";

const storiesStorageKey = "ai-story-app:stories";

type StoryListSource = "indexeddb" | "legacy-local" | "mock";

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

function readLegacyLocalStoriesSnapshot() {
  if (typeof window === "undefined") return [];

  const rawValue = localStorage.getItem(storiesStorageKey);

  try {
    const parsedValue = rawValue ? (JSON.parse(rawValue) as unknown) : [];

    return Array.isArray(parsedValue) ? parsedValue.filter(isStory) : [];
  } catch (error) {
    console.error("Failed to read legacy stories from localStorage", error);
    return [];
  }
}

function toStoryTreeChapter(chapter: {
  id: string;
  storyId: string;
  title: string;
  cleanContent: string;
  chapterNumber: number;
  createdAt: string;
}): Chapter {
  return {
    id: chapter.id,
    storyId: chapter.storyId,
    title: chapter.title,
    content: chapter.cleanContent,
    order: chapter.chapterNumber,
    createdAt: chapter.createdAt,
  };
}

export default function StoriesPage() {
  const [storedStories, setStoredStories] = useState<Story[]>([]);
  const [storedChapters, setStoredChapters] = useState<Chapter[]>([]);
  const [storySource, setStorySource] = useState<StoryListSource>("mock");

  useEffect(() => {
    let isActive = true;

    async function loadStories() {
      try {
        const indexedDbStories = await getAllStories();

        if (!isActive) return;

        if (indexedDbStories.length > 0) {
          const indexedDbChapters = (
            await Promise.all(
              indexedDbStories.map(async (story) => {
                const importedChapters = await getImportedChapters(story.id);

                return importedChapters.map(toStoryTreeChapter);
              }),
            )
          ).flat();

          if (!isActive) return;

          setStoredStories(indexedDbStories);
          setStoredChapters(indexedDbChapters);
          setStorySource("indexeddb");
          return;
        }
      } catch (error) {
        console.error("Failed to read stories from IndexedDB", error);
      }

      // TEMP_COMPATIBILITY: read old story metadata only while existing
      // browsers may still have records from the previous localStorage flow.
      const legacyStories = readLegacyLocalStoriesSnapshot();

      if (!isActive) return;

      setStoredStories(legacyStories);
      setStoredChapters([]);
      setStorySource(legacyStories.length > 0 ? "legacy-local" : "mock");
    }

    void loadStories();

    return () => {
      isActive = false;
    };
  }, []);

  const displayedStories = storedStories.length > 0 ? storedStories : mockStories;
  const displayedChapters =
    storedStories.length > 0 ? storedChapters : mockChapters;
  const displayedBranches: StoryBranch[] =
    storySource === "mock" ? mockBranches : [];
  const pageDescription = useMemo(() => {
    if (storySource === "indexeddb") {
      return "Browse story projects saved in IndexedDB and open the active workspace for planning, analysis, timeline, relationships, and rewrite work.";
    }

    if (storySource === "legacy-local") {
      return "Browse legacy localStorage story metadata while the app keeps IndexedDB as the primary store for new story data.";
    }

    return "Browse starter story projects and open the active workspace for planning, analysis, timeline, relationships, and rewrite work.";
  }, [storySource]);

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Library"
          title="Stories"
          description={pageDescription}
          action={
            <div className="app-action-row">
              <Link href="/stories/new" className="app-primary-action">
                New story
              </Link>
              <Link href="/stories/import" className="app-secondary-action">
                Import novel
              </Link>
            </div>
          }
        />

        <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              {displayedStories.map((story) => {
                const chapterCount = displayedChapters.filter(
                  (chapter) => chapter.storyId === story.id,
                ).length;

                return (
                  <StoryCard
                    chapterCount={chapterCount}
                    key={story.id}
                    story={story}
                  />
                );
              })}
            </div>
          </div>

          <StoryTree
            branches={displayedBranches}
            chapters={displayedChapters}
            stories={displayedStories}
          />
        </section>
      </PageContainer>
    </PageShell>
  );
}
