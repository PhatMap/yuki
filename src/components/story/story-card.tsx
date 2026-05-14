import Link from "next/link";
import type { Story } from "@/lib/types";

export default function StoryCard({
  chapterCount = 0,
  story,
}: {
  chapterCount?: number;
  story: Story;
}) {
  return (
    <article className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {story.genre} · {story.tone}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {story.title}
          </h2>
        </div>
        <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
          {story.isFanwork ? "Fanwork" : "Original"}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {story.description}
      </p>

      <div className="mt-5 flex items-center justify-between text-sm">
        <span>{chapterCount} chương</span>
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href={`/stories/${story.id}/workspace`}
        >
          Mở workspace
        </Link>
      </div>
    </article>
  );
}
