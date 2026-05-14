import CharacterCard from "@/components/character/character-card";
import CharacterForm from "@/components/character/character-form";
import { characters } from "@/lib/mock-data";

export default function CharactersPage() {
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-6 py-8 lg:grid-cols-[1fr_380px]">
      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Cast
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Characters
          </h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      </section>

      <CharacterForm />
    </main>
  );
}
