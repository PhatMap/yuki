import type { Character } from "@/lib/types";

export default function CharacterCard({ character }: { character: Character }) {
  return (
    <article className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{character.role}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {character.name}
          </h2>
        </div>
        <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
          {character.storyId}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {character.personality}
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Goal: {character.goal}
      </p>
    </article>
  );
}
