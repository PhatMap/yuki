import type { ReactNode } from "react";

import { SectionCard } from "@/components/app/section-card";

type JobStatus = "running" | "failed" | "completed" | "cancelling";

const statusLabel: Record<JobStatus, string> = {
  running: "Đang chạy",
  failed: "Thất bại",
  completed: "Hoàn tất",
  cancelling: "Đang hủy",
};

export function JobStatusCard({
  status,
  title,
  description,
  progressLabel,
  actions,
}: {
  status: JobStatus;
  title: string;
  description?: string;
  progressLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <SectionCard title={title}>
      <div className="space-y-3">
        <span
          className={
            status === "failed"
              ? "app-chip border-destructive/40 bg-destructive/10 text-destructive"
              : status === "completed"
                ? "app-chip-primary"
                : "app-chip"
          }
        >
          {statusLabel[status]}
        </span>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {progressLabel ? <p className="text-sm font-medium">{progressLabel}</p> : null}
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </SectionCard>
  );
}
