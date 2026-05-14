import WorldBiblePanel from "@/components/world/world-bible-panel";
import { worldNotes } from "@/lib/mock-data";

export default function WorldsPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Continuity
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Worlds</h1>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {worldNotes.map((note) => (
          <WorldBiblePanel key={note.id} note={note} />
        ))}
      </section>
    </main>
  );
}
