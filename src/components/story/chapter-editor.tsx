import type { Chapter, Story } from "@/lib/types";

export default function ChapterEditor({
  chapter,
  story,
}: {
  chapter?: Chapter;
  story: Story;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{story.title}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {chapter?.title ?? "Untitled chapter"}
          </h1>
        </div>
        <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
          Draft
        </span>
      </div>

      <label className="mt-6 block text-sm font-medium" htmlFor="chapter-body">
        Draft
      </label>
      <textarea
        className="mt-2 min-h-96 w-full resize-y rounded-md border bg-background p-4 text-sm leading-6 outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
        defaultValue={chapter?.content ?? ""}
        id="chapter-body"
      />
    </section>
  );
}
