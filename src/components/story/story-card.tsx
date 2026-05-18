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
          {story.isFanwork ? "Fanwork" : "Truyện gốc"}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {story.description || "Chưa có mô tả."}
      </p>

      <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>{chapterCount.toLocaleString("vi-VN")} chương</span>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-md border px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-muted/70"
            href={`/stories/${story.id}/workspace`}
          >
            Workspace viết
          </Link>
          <Link
            className="rounded-md border px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-muted/70"
            href={`/stories/${story.id}/reader`}
          >
            Đọc truyện
          </Link>
          <Link
            className="rounded-md border px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-muted/70"
            href={`/stories/${story.id}/analysis`}
          >
            Phân tích
          </Link>
          <Link
            className="rounded-md border px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-muted/70"
            href={`/stories/${story.id}/data-health`}
          >
            Data Health
          </Link>
        </div>
      </div>
    </article>
  );
}
