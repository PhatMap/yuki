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
    <div className={cn("app-page-header", className)}>
      <div>
        {eyebrow ? <p className="app-page-eyebrow">{eyebrow}</p> : null}
        <h1 className="app-page-title">{title}</h1>
        {description ? (
          <p className="app-page-description">{description}</p>
        ) : null}
      </div>

      {action ? <div className="app-toolbar">{action}</div> : null}
    </div>
  );
}
