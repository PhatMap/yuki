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
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Yuki workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Story command center
        </h1>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
            key={stat.label}
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {featuredStory ? (
          <StoryCard
            chapterCount={featuredStoryChapterCount}
            story={featuredStory}
          />
        ) : null}
        <div className="space-y-6">
          {featuredCharacter ? (
            <CharacterCard character={featuredCharacter} />
          ) : null}
          {featuredWorldNote ? (
            <WorldBiblePanel note={featuredWorldNote} />
          ) : null}
        </div>
      </section>
    </main>
  );
}
