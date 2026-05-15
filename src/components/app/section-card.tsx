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
    <Card className={cn("overflow-hidden rounded-2xl shadow-sm", className)}>
      {hasHeader ? (
        <CardHeader className="gap-1 border-b px-4 py-4 sm:px-5">
          {title ? (
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              {icon}
              {title}
            </CardTitle>
          ) : null}

          {description ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </CardHeader>
      ) : null}

      <CardContent
        className={cn(
          hasHeader ? "p-4 sm:p-5" : "p-4 sm:p-5",
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}
