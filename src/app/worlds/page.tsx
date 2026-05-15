import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import WorldBiblePanel from "@/components/world/world-bible-panel";
import { worldNotes } from "@/lib/mock-data";

export default function WorldsPage() {
  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Continuity"
          title="Worlds"
          description="Track world bible notes, locations, systems, factions, rules, and continuity details."
        />

        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          {worldNotes.map((note) => (
            <WorldBiblePanel key={note.id} note={note} />
          ))}
        </section>
      </PageContainer>
    </PageShell>
  );
}
