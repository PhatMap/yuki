import type { Chapter, Story } from "@/lib/types";

export default function ChapterEditor({
  chapter,
  story,
}: {
  chapter?: Chapter;
  story: Story;
}) {
  return (
    <section className="app-editor-surface">
      <div className="app-editor-header">
        <div className="min-w-0">
          <p className="app-editor-meta">{story.title}</p>
          <h1 className="app-editor-title">
            {chapter?.title ?? "Untitled chapter"}
          </h1>
        </div>

        <span className="app-badge-muted">Draft</span>
      </div>

      <label
        className="mb-2 block text-sm font-medium text-foreground"
        htmlFor="chapter-body"
      >
        Draft
      </label>

      <textarea
        className="app-editor-textarea"
        defaultValue={chapter?.content ?? ""}
        id="chapter-body"
      />
    </section>
  );
}
