export default function Topbar() {
  return (
    <header className="flex min-h-16 items-center justify-between border-b bg-background px-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Creative OS
        </p>
        <p className="text-base font-semibold">Plan, write, and branch scenes</p>
      </div>
      <div className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
        Draft mode
      </div>
    </header>
  );
}
