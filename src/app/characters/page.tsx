import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import CharacterCard from "@/components/character/character-card";
import CharacterForm from "@/components/character/character-form";
import { characters } from "@/lib/mock-data";

export default function CharactersPage() {
  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Cast"
          title="Characters"
          description="Review character briefs, roles, personality notes, and draft new character concepts."
        />

        <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {characters.map((character) => (
              <CharacterCard key={character.id} character={character} />
            ))}
          </div>

          <CharacterForm />
        </section>
      </PageContainer>
    </PageShell>
  );
}
