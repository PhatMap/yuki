import type { WorldNote } from "@/lib/types";

export default function WorldBiblePanel({ note }: { note: WorldNote }) {
  return (
    <article className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <p className="text-sm text-muted-foreground">{note.category}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">
        {note.title}
      </h2>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {note.content}
      </p>
    </article>
  );
}
