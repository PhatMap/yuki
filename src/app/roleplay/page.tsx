import RoleplayChat from "@/components/roleplay/roleplay-chat";

export default function RoleplayPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Session
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Roleplay
        </h1>
      </section>

      <RoleplayChat />
    </main>
  );
}
