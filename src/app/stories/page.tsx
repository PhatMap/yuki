"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import StoryCard from "@/components/story/story-card";
import StoryTree from "@/components/story/story-tree";
import { getAllStories, getImportedChapters } from "@/lib/db/indexed-db";
import {
  branches as mockBranches,
  chapters as mockChapters,
  stories as mockStories,
} from "@/lib/mock-data";
import type { Chapter, Story, StoryBranch } from "@/lib/types";

type StoryListSource = "indexeddb" | "mock";

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

      if (!isActive) return;

      setStoredStories([]);
      setStoredChapters([]);
      setStorySource("mock");
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

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Thư viện"
          title="Thư viện truyện"
          description="Mở lại truyện đã lưu, nhập truyện mới hoặc kiểm tra nhanh sơ đồ chương."
          action={
            <div className="app-action-row">
              <Link href="/stories/import" className="app-primary-action">
                Nhập truyện
              </Link>
              <Link href="/stories/new" className="app-secondary-action">
                Tạo truyện mới
              </Link>
            </div>
          }
        />

        <SectionCard title="Truyện trong máy này">
          <p className="text-sm leading-6 text-muted-foreground">
            Dữ liệu truyện được lưu local trong browser. Với truyện dài, hãy export backup từ Data Health sau khi nhập hoặc phân tích.
          </p>
        </SectionCard>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-4">
            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
