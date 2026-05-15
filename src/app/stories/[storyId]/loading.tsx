export default function StoryLoading() {
  return (
    <main className="app-page">
      <div className="app-container">
        <section className="app-story-loading-panel">
          <div className="h-5 w-36 rounded-md bg-muted" />
          <div className="h-8 w-full max-w-md rounded-md bg-muted" />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="h-28 rounded-lg bg-muted" />
            <div className="h-28 rounded-lg bg-muted" />
            <div className="h-28 rounded-lg bg-muted" />
          </div>
        </section>
      </div>
    </main>
  );
}
