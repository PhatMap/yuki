"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SectionCardProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({
  title,
  description,
  icon,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || icon);

  return (
    <Card
      className={cn(
        "app-section-card min-w-0 overflow-hidden rounded-2xl shadow-sm",
        className,
      )}
    >
      {hasHeader ? (
        <CardHeader className="gap-1 border-b px-4 py-4 sm:px-5">
          {title ? (
            <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight">
              {icon ? <span className="shrink-0">{icon}</span> : null}
              <span className="app-wrap-anywhere min-w-0">{title}</span>
            </CardTitle>
          ) : null}

          {description ? (
            <p className="app-wrap-anywhere text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </CardHeader>
      ) : null}

      <CardContent className={cn("min-w-0 p-4 sm:p-5", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
