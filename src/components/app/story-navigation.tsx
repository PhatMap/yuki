"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Database,
  FileJson,
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
    description: "Read, inspect, analyze",
    items: [
      {
        label: "Reader",
        href: "reader",
        icon: BookOpen,
      },
      {
        label: "Workspace",
        href: "workspace",
        icon: Layers3,
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
    description: "World, timeline, relation",
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
    description: "Plan and draft changes",
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
    description: "Settings, data, proxy tools",
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
        label: "Scale",
        href: "import-scale-test",
        icon: Gauge,
      },
      {
        label: "Contract",
        href: "ai-contract",
        icon: FileJson,
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
            const activeItem = group.items.find(
              (item) => pathname === `/stories/${storyId}/${item.href}`,
            );
            const isGroupActive = Boolean(activeItem);

            return (
              <section
                key={group.label}
                aria-label={`${group.label} story tools`}
                className={cn(
                  "app-story-nav-group",
                  isGroupActive ? "app-story-nav-group-active" : "",
                )}
              >
                <div className="app-story-nav-group-heading">
                  <div className="min-w-0">
                    <p className="app-story-nav-group-label">{group.label}</p>
                    <p className="app-story-nav-group-description">
                      {activeItem ? activeItem.label : group.description}
                    </p>
                  </div>
                </div>

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
                        prefetch
                        title={item.label}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="app-story-nav-link-label">
                          {item.label}
                        </span>
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
