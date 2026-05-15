"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <section className={cn("app-empty-state text-center", className)}>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>

        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}

        {action ? (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {action}
          </div>
        ) : null}
      </div>
    </section>
  );
}
