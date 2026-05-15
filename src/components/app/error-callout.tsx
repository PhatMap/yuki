"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

interface ErrorCalloutProps {
  title?: string;
  message: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ErrorCallout({
  title = "Something needs attention",
  message,
  action,
  className,
}: ErrorCalloutProps) {
  return (
    <section className={cn("app-error-callout", className)} role="alert">
      <div className="flex min-w-0 gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-destructive">{title}</h2>
          <div className="mt-1 text-sm leading-6 text-destructive/90">
            {message}
          </div>

          {action ? (
            <div className="mt-3 flex flex-wrap gap-2">{action}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
