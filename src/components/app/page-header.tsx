"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("app-page-header min-w-0", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="app-page-eyebrow">{eyebrow}</p> : null}

        <h1 className="app-page-title app-wrap-anywhere">{title}</h1>

        {description ? (
          <p className="app-page-description app-wrap-anywhere">
            {description}
          </p>
        ) : null}
      </div>

      {action ? (
        <div className="app-toolbar app-responsive-actions">{action}</div>
      ) : null}
    </header>
  );
}
