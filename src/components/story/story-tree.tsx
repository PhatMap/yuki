import type { Chapter, Story, StoryBranch } from "@/lib/types";

export default function StoryTree({
  branches,
  chapters,
  stories,
}: {
  branches: StoryBranch[];
  chapters: Chapter[];
  stories: Story[];
}) {
  return (
    <aside className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">Story tree</h2>
      <div className="mt-5 space-y-5">
        {stories.map((story) => {
          const storyChapters = chapters.filter(
            (chapter) => chapter.storyId === story.id,
          );
          const storyBranches = branches.filter(
            (branch) => branch.storyId === story.id,
          );

          return (
            <section key={story.id}>
              <h3 className="text-sm font-semibold">{story.title}</h3>
              <ol className="mt-3 space-y-2 border-l pl-4 text-sm text-muted-foreground">
                {storyChapters.map((chapter) => (
                  <li key={chapter.id}>
                    <span className="text-foreground">{chapter.title}</span>
                    <span className="ml-2">#{chapter.order}</span>
                  </li>
                ))}
                {storyBranches.map((branch) => (
                  <li key={branch.id}>
                    <span className="text-foreground">{branch.name}</span>
                    <span className="ml-2">branch</span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
