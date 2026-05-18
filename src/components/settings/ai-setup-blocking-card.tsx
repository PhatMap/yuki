"use client";

import Link from "next/link";

import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import type { AiSetupReadiness } from "@/lib/settings/ai-setup-readiness";

export function AiSetupBlockingCard({
  readiness,
}: {
  readiness?: AiSetupReadiness;
}) {
  return (
    <SectionCard
      title="Cần thiết lập AI"
      description="Hoàn tất provider/API key/model/test trước khi nạp và phân tích truyện."
    >
      <div className="space-y-3">
        <p className="text-sm">
          Provider hiện tại: <strong>{readiness?.providerLabel ?? "Chưa cấu hình"}</strong>
        </p>

        {readiness?.missingReasons && readiness.missingReasons.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {readiness.missingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={readiness?.nextSetupRoute ?? "/settings"}>Thiết lập AI</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={readiness?.nextSetupRoute ?? "/settings"}>Mở cài đặt</Link>
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
