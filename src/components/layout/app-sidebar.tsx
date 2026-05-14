import Link from "next/link";
import { stories } from "@/lib/mock-data";

const navigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/stories", label: "Stories" },
  { href: "/characters", label: "Characters" },
  { href: "/worlds", label: "Worlds" },
  { href: "/roleplay", label: "Roleplay" },
];

export default function AppSidebar() {
  return (
    <aside className="flex h-full w-72 flex-col border-r bg-sidebar px-4 py-5 text-sidebar-foreground">
      <Link className="text-lg font-semibold tracking-tight" href="/dashboard">
        Yuki
      </Link>

      <nav className="mt-8 space-y-1">
        {navigationItems.map((item) => (
          <Link
            className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="mt-8 space-y-3">
        <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recent stories
        </h2>
        <div className="space-y-1">
          {stories.map((story) => (
            <Link
              className="block rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
              href={`/stories/${story.id}/workspace`}
              key={story.id}
            >
              {story.title}
            </Link>
          ))}
        </div>
      </section>
    </aside>
  );
}
