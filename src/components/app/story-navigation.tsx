"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Database,
  FileText,
  GitBranch,
  Gauge,
  HeartHandshake,
  Layers3,
  PenLine,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface StoryNavigationProps {
  storyId: string;
}

const storyNavigationGroups = [
  {
    label: "Core",
    items: [
      {
        label: "Workspace",
        href: "workspace",
        icon: BookOpen,
      },
      {
        label: "Analysis",
        href: "analysis",
        icon: AlertTriangle,
      },
    ],
  },
  {
    label: "Canon",
    items: [
      {
        label: "Bible",
        href: "bible",
        icon: Layers3,
      },
      {
        label: "Timeline",
        href: "timeline",
        icon: CalendarDays,
      },
      {
        label: "Relationships",
        href: "relationships",
        icon: HeartHandshake,
      },
      {
        label: "World",
        href: "world-tracker",
        icon: GitBranch,
      },
    ],
  },
  {
    label: "Rewrite",
    items: [
      {
        label: "Planner",
        href: "rewrite-planner",
        icon: PenLine,
      },
      {
        label: "Draft",
        href: "rewrite-draft",
        icon: FileText,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Settings",
        href: "settings",
        icon: Settings,
      },
      {
        label: "Data",
        href: "data-health",
        icon: Database,
      },
      {
        label: "Scale Test",
        href: "import-scale-test",
        icon: Gauge,
      },
      {
        label: "AI Contract",
        href: "ai-contract",
        icon: FileText,
      },
      {
        label: "AI Test",
        href: "ai-proxy-test",
        icon: Activity,
      },
    ],
  },
];

export function StoryNavigation({ storyId }: StoryNavigationProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Story navigation" className="app-story-nav">
      <div className="app-story-nav-scroll">
        <div className="app-story-nav-groups">
          {storyNavigationGroups.map((group) => {
            const isGroupActive = group.items.some(
              (item) => pathname === `/stories/${storyId}/${item.href}`,
            );

            return (
              <section
                key={group.label}
                className={cn(
                  "app-story-nav-group",
                  isGroupActive ? "app-story-nav-group-active" : "",
                )}
              >
                <p className="app-story-nav-group-label">{group.label}</p>
                <div className="app-story-nav-list">
                  {group.items.map((item) => {
                    const href = `/stories/${storyId}/${item.href}`;
                    const Icon = item.icon;
                    const isActive = pathname === href;

                    return (
                      <Link
                        key={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "app-story-nav-link",
                          isActive ? "app-story-nav-link-active" : "",
                        )}
                        href={href}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        <StoryNavigationPendingIndicator />
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function StoryNavigationPendingIndicator() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "app-story-nav-pending",
        pending ? "app-story-nav-pending-active" : "",
      )}
    />
  );
}
