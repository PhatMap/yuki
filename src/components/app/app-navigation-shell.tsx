"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  FileUp,
  Home,
  Lock,
  Settings,
  Sparkles,
} from "lucide-react";

import {
  getAiSetupReadiness,
  type AiSetupReadiness,
} from "@/lib/settings/ai-setup-readiness";
import { cn } from "@/lib/utils";

type AppNavItem = {
  label: string;
  href: string;
  icon: typeof Home;
  requiresAi?: boolean;
};

const appNavItems: AppNavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: Home,
    requiresAi: true,
  },
  {
    label: "Thiết lập AI",
    href: "/settings",
    icon: Settings,
  },
  {
    label: "Nạp truyện",
    href: "/stories/import",
    icon: FileUp,
    requiresAi: true,
  },
  {
    label: "Thư viện truyện",
    href: "/stories",
    icon: BookOpen,
    requiresAi: true,
  },
  {
    label: "Prompt Manager",
    href: "/prompt-manager",
    icon: Sparkles,
    requiresAi: true,
  },
];

function isStoryWorkspaceRoute(pathname: string) {
  if (!pathname.startsWith("/stories/")) return false;

  const [, root, storySegment] = pathname.split("/");
  if (root !== "stories") return false;
  if (!storySegment) return false;
  if (storySegment === "import" || storySegment === "new") return false;

  return true;
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/stories") return pathname === "/stories" || pathname === "/stories/new";

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [readiness, setReadiness] = useState<AiSetupReadiness>();
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadReadiness() {
      try {
        const nextReadiness = await getAiSetupReadiness();

        if (active) {
          setReadiness(nextReadiness);
        }
      } catch (error) {
        console.error("Failed to load AI setup readiness", error);
      } finally {
        if (active) {
          setIsLoadingReadiness(false);
        }
      }
    }

    void loadReadiness();

    return () => {
      active = false;
    };
  }, [pathname]);

  const canUseCoreWorkflow = Boolean(readiness?.canUseStoryWorkflow);
  const statusLabel = useMemo(() => {
    if (isLoadingReadiness) return "Đang kiểm tra";
    if (canUseCoreWorkflow) return "AI sẵn sàng";

    return "Cần thiết lập AI";
  }, [canUseCoreWorkflow, isLoadingReadiness]);

  if (isStoryWorkspaceRoute(pathname)) {
    return children;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="border-b border-border/80 bg-card/80 px-4 py-4 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-3">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:h-full lg:max-w-none">
          <div className="rounded-2xl border bg-background/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Yuki
            </p>
            <h1 className="mt-1 text-base font-semibold">Story Studio</h1>
            <p className="mt-2 text-xs text-muted-foreground">{statusLabel}</p>
          </div>

          <nav aria-label="Điều hướng chính" className="flex gap-2 overflow-x-auto lg:flex-1 lg:flex-col lg:overflow-visible">
            {appNavItems.map((item) => {
              const Icon = item.icon;
              const isLocked = item.requiresAi && !canUseCoreWorkflow;
              const isActive = isActivePath(pathname, item.href);
              const className = cn(
                "flex min-w-fit items-center gap-2 rounded-xl border px-3 py-2 text-sm transition lg:min-w-0",
                isActive
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-transparent bg-background/50 text-muted-foreground hover:border-border hover:text-foreground",
                isLocked ? "cursor-not-allowed opacity-55 hover:border-transparent hover:text-muted-foreground" : "",
              );
              const content = (
                <>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {isLocked ? <Lock className="ml-auto h-3.5 w-3.5 shrink-0" /> : null}
                </>
              );

              if (isLocked) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    className={className}
                    title="Cần thiết lập AI trước"
                    disabled
                  >
                    {content}
                  </button>
                );
              }

              return (
                <Link key={item.href} href={item.href} className={className}>
                  {content}
                </Link>
              );
            })}
          </nav>

          {!canUseCoreWorkflow ? (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm">
              <p className="font-medium">Bắt đầu ở Thiết lập AI</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Chọn provider, nhập key, chọn model và test kết nối để mở workflow.
              </p>
              <Link
                href="/settings"
                className="mt-3 inline-flex rounded-lg border bg-background px-3 py-1.5 text-xs font-medium"
              >
                Mở Settings
              </Link>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
