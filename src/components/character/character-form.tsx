export default function CharacterForm() {
  return (
    <form className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">Character brief</h2>

      <label className="mt-5 block text-sm font-medium" htmlFor="name">
        Name
      </label>
      <input
        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
        id="name"
        name="name"
        placeholder="Character name"
      />

      <label className="mt-4 block text-sm font-medium" htmlFor="role">
        Role
      </label>
      <input
        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
        id="role"
        name="role"
        placeholder="Protagonist, rival, mentor..."
      />

      <label className="mt-4 block text-sm font-medium" htmlFor="description">
        Description
      </label>
      <textarea
        className="mt-2 min-h-32 w-full resize-y rounded-md border bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
        id="description"
        name="description"
        placeholder="Motivation, wound, secrets, voice..."
      />

      <button
        className="mt-5 h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        type="button"
      >
        Save draft
      </button>
    </form>
  );
}
