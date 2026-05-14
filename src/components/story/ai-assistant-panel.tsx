const prompts = [
  "Find emotional contradiction in the current scene.",
  "Suggest three branch choices with different costs.",
  "Extract unresolved lore from this chapter.",
];

export default function AiAssistantPanel({ storyTitle }: { storyTitle: string }) {
  return (
    <aside className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">AI assistant</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight">
        {storyTitle}
      </h2>

      <div className="mt-5 space-y-3">
        {prompts.map((prompt) => (
          <button
            className="w-full rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            key={prompt}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>
    </aside>
  );
}
