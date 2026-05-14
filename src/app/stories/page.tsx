import StoryCard from "@/components/story/story-card";
import StoryTree from "@/components/story/story-tree";
import { branches, chapters, stories } from "@/lib/mock-data";

export default function StoriesPage() {
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Library
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Stories
          </h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
      </section>

      <StoryTree branches={branches} chapters={chapters} stories={stories} />
    </main>
  );
}
