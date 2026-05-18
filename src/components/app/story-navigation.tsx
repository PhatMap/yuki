"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  CalendarDays,
  Database,
  FileJson,
  FileText,
  Gauge,
  HeartHandshake,
  Home,
  Layers3,
  Map,
  PenLine,
  Settings,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface StoryNavigationProps {
  storyId: string;
}

interface StoryNavigationItem {
  label: string;
  href: string;
  icon: typeof BookOpen;
  scope?: "story" | "global";
}

interface StoryNavigationGroup {
  label: string;
  description: string;
  items: StoryNavigationItem[];
}

const storyNavigationGroups: StoryNavigationGroup[] = [
  {
    label: "Bắt đầu",
    description: "Vào bàn làm việc và chạy phân tích",
    items: [
      {
        label: "Workspace",
        href: "workspace",
        icon: Home,
      },
      {
        label: "Phân tích truyện",
        href: "analysis",
        icon: Layers3,
      },
      {
        label: "Đọc truyện",
        href: "reader",
        icon: BookOpen,
      },
    ],
  },
  {
    label: "Viết / Rewrite",
    description: "Lập kế hoạch và viết bản sửa",
    items: [
      {
        label: "Rewrite Planner",
        href: "rewrite-planner",
        icon: PenLine,
      },
      {
        label: "Rewrite Draft",
        href: "rewrite-draft",
        icon: FileText,
      },
    ],
  },
  {
    label: "Canon",
    description: "Bối cảnh và continuity",
    items: [
      {
        label: "Story Bible",
        href: "bible",
        icon: Layers3,
      },
      {
        label: "Timeline",
        href: "timeline",
        icon: CalendarDays,
      },
      {
        label: "Quan hệ",
        href: "relationships",
        icon: HeartHandshake,
      },
      {
        label: "World Tracker",
        href: "world-tracker",
        icon: Map,
      },
    ],
  },
  {
    label: "Nâng cao",
    description: "Cài đặt kỹ thuật và công cụ",
    items: [
      {
        label: "Data Health",
        href: "data-health",
        icon: Database,
      },
      {
        label: "Story Settings",
        href: "settings",
        icon: Settings,
      },
      {
        label: "Runtime",
        href: "/settings",
        icon: Settings,
        scope: "global",
      },
      {
        label: "Prompt Manager",
        href: "/prompt-manager",
        icon: Sparkles,
        scope: "global",
      },
      {
        label: "AI Test",
        href: "ai-proxy-test",
        icon: Activity,
      },
      {
        label: "Contract",
        href: "ai-contract",
        icon: FileJson,
      },
      {
        label: "Scale",
        href: "import-scale-test",
        icon: Gauge,
      },
    ],
  },
];

function resolveStoryNavigationHref(
  storyId: string,
  item: StoryNavigationItem,
) {
  if (item.scope === "global") return item.href;

  return `/stories/${storyId}/${item.href}`;
}

function isStoryItemActive(pathname: string, href: string) {
  if (href.endsWith("/workspace")) {
    const storyRoot = href.replace(/\/workspace$/u, "");

    return pathname === href || pathname === storyRoot;
  }

  return pathname === href;
}

export function StoryNavigation({ storyId }: StoryNavigationProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Điều hướng truyện" className="app-story-nav">
      <div className="app-story-nav-scroll">
        <div className="app-story-nav-groups">
          {storyNavigationGroups.map((group) => {
            const activeItem = group.items.find((item) => {
              const href = resolveStoryNavigationHref(storyId, item);

              return isStoryItemActive(pathname, href);
            });
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
                    const href = resolveStoryNavigationHref(storyId, item);
                    const Icon = item.icon;
                    const isActive = isStoryItemActive(pathname, href);

                    return (
                      <Link
                        key={`${group.label}-${item.href}-${item.scope ?? "story"}`}
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
