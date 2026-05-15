"use client";

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <section className={cn("app-empty-state", className)}>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-muted/50 text-muted-foreground">
          {icon ?? <Inbox className="h-5 w-5" />}
        </div>

        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>

          {description ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {action ? (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {action}
          </div>
        ) : null}
      </div>
    </section>
  );
}
