"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingPanelProps {
  title?: string;
  description?: string;
  className?: string;
}

export function LoadingPanel({
  title = "Loading data",
  description = "Please wait while yuki prepares this workspace.",
  className,
}: LoadingPanelProps) {
  return (
    <section className={cn("app-loading-panel", className)}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted/50 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
      </div>
    </section>
  );
}
