import Link from "next/link";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import StoryCard from "@/components/story/story-card";
import StoryTree from "@/components/story/story-tree";
import { branches, chapters, stories } from "@/lib/mock-data";

export default function StoriesPage() {
  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Library"
          title="Stories"
          description="Browse story projects and open the active workspace for planning, analysis, timeline, relationships, and rewrite work."
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
              {stories.map((story) => {
                const chapterCount = chapters.filter(
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
            branches={branches}
            chapters={chapters}
            stories={stories}
          />
        </section>
      </PageContainer>
    </PageShell>
  );
}
