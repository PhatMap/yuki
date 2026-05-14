"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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

const storyNavigationItems = [
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
  {
    label: "AI Contract",
    href: "ai-contract",
    icon: FileText,
  },
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
];

export function StoryNavigation({ storyId }: StoryNavigationProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Story navigation" className="app-story-nav">
      <div className="app-story-nav-list">
        {storyNavigationItems.map((item) => {
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
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
