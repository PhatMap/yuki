"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  icon?: ReactNode;
  title: string;
  value: ReactNode;
  description?: string;
  className?: string;
}

export function StatCard({
  icon,
  title,
  value,
  description,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden rounded-2xl shadow-sm", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {title}
            </p>
            <div className="mt-2 break-words text-2xl font-semibold tracking-tight">
              {value}
            </div>
          </div>

          {icon ? (
            <div className="shrink-0 rounded-xl border bg-muted/50 p-2 text-muted-foreground">
              {icon}
            </div>
          ) : null}
        </div>

        {description ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
