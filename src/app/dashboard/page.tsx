import Link from "next/link";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { StatCard } from "@/components/app/stat-card";
import CharacterCard from "@/components/character/character-card";
import StoryCard from "@/components/story/story-card";
import WorldBiblePanel from "@/components/world/world-bible-panel";
import {
  branches,
  chapters,
  characters,
  stories,
  worldNotes,
} from "@/lib/mock-data";

const stats = [
  { label: "Stories", value: stories.length },
  { label: "Characters", value: characters.length },
  { label: "Chapters", value: chapters.length },
  { label: "Branches", value: branches.length },
];

export default function DashboardPage() {
  const featuredStory = stories[0];
  const featuredCharacter = characters[0];
  const featuredWorldNote = worldNotes[0];
  const featuredStoryChapterCount = featuredStory
    ? chapters.filter((chapter) => chapter.storyId === featuredStory.id).length
    : 0;

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Yuki workspace"
          title="Story command center"
          description="Overview for story projects, cast, chapters, branches, and world notes."
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

        <section className="app-four-column">
          {stats.map((stat) => (
            <StatCard key={stat.label} title={stat.label} value={stat.value} />
          ))}
        </section>

        <section className="grid min-w-0 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {featuredStory ? (
            <StoryCard
              chapterCount={featuredStoryChapterCount}
              story={featuredStory}
            />
          ) : null}

          <div className="grid min-w-0 gap-6">
            {featuredCharacter ? (
              <CharacterCard character={featuredCharacter} />
            ) : null}

            {featuredWorldNote ? (
              <WorldBiblePanel note={featuredWorldNote} />
            ) : null}
          </div>
        </section>
      </PageContainer>
    </PageShell>
  );
}
