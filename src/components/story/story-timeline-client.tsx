"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  GitBranch,
  Layers3,
} from "lucide-react";

import {
  getAnalysisResult,
  getBranchChanges,
  getBranches,
  getContinuityIssues,
  getStoryById,
} from "@/lib/db/indexed-db";
import { stories } from "@/lib/mock-data";
import type {
  BranchChange,
  BranchContinuityIssue,
  Story,
  StoryAnalysisResult,
  StoryBranchV2,
  StoryEvent,
} from "@/lib/types";
import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface StoryTimelineClientProps {
  storyId: string;
}

interface StoryTimelineData {
  story?: Story;
  analysisResult: StoryAnalysisResult | null;
  branches: StoryBranchV2[];
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
}

type ImportanceFilter = "all" | "medium+" | "high+" | "critical";
type SeverityFilter = "all" | "medium+" | "high+" | "critical";

const importanceRank = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const;

async function readIndexedDbTimelineData(
  storyId: string,
): Promise<StoryTimelineData> {
  const [story, analysisResult, branches, branchChanges, continuityIssues] =
    await Promise.all([
      getStoryById(storyId),
      getAnalysisResult(storyId),
      getBranches(storyId),
      getBranchChanges(storyId),
      getContinuityIssues(storyId),
    ]);

  return {
    story,
    analysisResult: analysisResult ?? null,
    branches,
    branchChanges,
    continuityIssues,
  };
}

function passesRankFilter<T extends "low" | "medium" | "high" | "critical">(
  value: T,
  filter: ImportanceFilter | SeverityFilter,
) {
  if (filter === "all") return true;
  if (filter === "medium+") return importanceRank[value] >= importanceRank.medium;
  if (filter === "high+") return importanceRank[value] >= importanceRank.high;

  return value === "critical";
}

function sortOptionalChapter(left?: number, right?: number) {
  return (left ?? Number.POSITIVE_INFINITY) - (right ?? Number.POSITIVE_INFINITY);
}

function minAffectedChapter(numbers: number[]) {
  return numbers.length > 0 ? Math.min(...numbers) : undefined;
}

function formatAffectedChapters(numbers: number[]) {
  if (numbers.length === 0) return "Không có chương";

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);

  if (min === max) return `Chương ${min}`;

  return `Chương ${min}-${max} (${numbers.length} chương bị ảnh hưởng)`;
}

function changeTouchesBlock(
  change: BranchChange,
  blockStart: number,
  blockEnd: number,
) {
  if (change.affectedChapterNumbers.length > 0) {
    return change.affectedChapterNumbers.some(
      (chapterNumber) => chapterNumber >= blockStart && chapterNumber <= blockEnd,
    );
  }

  return (
    typeof change.chapterNumber === "number" &&
    change.chapterNumber >= blockStart &&
    change.chapterNumber <= blockEnd
  );
}

function issueTouchesBlock(
  issue: BranchContinuityIssue,
  blockStart: number,
  blockEnd: number,
) {
  return issue.affectedChapterNumbers.some(
    (chapterNumber) => chapterNumber >= blockStart && chapterNumber <= blockEnd,
  );
}

export function StoryTimelineClient({ storyId }: StoryTimelineClientProps) {
  const [timelineData, setTimelineData] = useState<StoryTimelineData>({
    analysisResult: null,
    branches: [],
    branchChanges: [],
    continuityIssues: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [importanceFilter, setImportanceFilter] =
    useState<ImportanceFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  useEffect(() => {
    let isActive = true;

    async function loadTimelineData() {
      let indexedDbData: StoryTimelineData = {
        analysisResult: null,
        branches: [],
        branchChanges: [],
        continuityIssues: [],
      };
      let indexedDbFailed = false;

      try {
        indexedDbData = await readIndexedDbTimelineData(storyId);
      } catch (error) {
        indexedDbFailed = true;
        console.error("Failed to read timeline data from IndexedDB", error);
      }

      if (!isActive) return;

      setTimelineData(indexedDbData);
      setStorageError(
        indexedDbFailed
          ? "IndexedDB read failed. Timeline data may be unavailable."
          : "",
      );
      setIsLoading(false);
    }

    void loadTimelineData();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  const story =
    timelineData.story ?? stories.find((item) => item.id === storyId);
  const result = timelineData.analysisResult;

  const filteredCanonEvents = useMemo(() => {
    return [...(result?.events ?? [])]
      .filter((event) => passesRankFilter(event.importance, importanceFilter))
      .sort((left, right) => left.chapterNumber - right.chapterNumber);
  }, [importanceFilter, result?.events]);

  const sortedBranchChanges = useMemo(() => {
    return [...timelineData.branchChanges].sort((left, right) =>
      sortOptionalChapter(left.chapterNumber, right.chapterNumber),
    );
  }, [timelineData.branchChanges]);

  const filteredContinuityIssues = useMemo(() => {
    return [...timelineData.continuityIssues]
      .filter((issue) => passesRankFilter(issue.severity, severityFilter))
      .sort((left, right) =>
        sortOptionalChapter(
          minAffectedChapter(left.affectedChapterNumbers),
          minAffectedChapter(right.affectedChapterNumbers),
        ),
      );
  }, [severityFilter, timelineData.continuityIssues]);

  const chapterRangeSummary = useMemo(() => {
    const canonEvents = result?.events ?? [];
    const maxChapter = Math.max(
      1,
      ...canonEvents.map((event) => event.chapterNumber),
      ...timelineData.branchChanges.flatMap((change) => [
        change.chapterNumber ?? 0,
        ...change.affectedChapterNumbers,
      ]),
      ...timelineData.continuityIssues.flatMap(
        (issue) => issue.affectedChapterNumbers,
      ),
    );
    const blockCount = Math.max(1, Math.ceil(maxChapter / 100));

    return Array.from({ length: blockCount }, (_, index) => {
      const start = index * 100 + 1;
      const end = (index + 1) * 100;

      return {
        id: `${start}-${end}`,
        label: `${start}-${end}`,
        canonEvents: canonEvents.filter(
          (event) => event.chapterNumber >= start && event.chapterNumber <= end,
        ).length,
        branchChanges: timelineData.branchChanges.filter((change) =>
          changeTouchesBlock(change, start, end),
        ).length,
        continuityIssues: timelineData.continuityIssues.filter((issue) =>
          issueTouchesBlock(issue, start, end),
        ).length,
      };
    });
  }, [result?.events, timelineData.branchChanges, timelineData.continuityIssues]);

  const highOrCriticalEvents =
    result?.events.filter(
      (event) =>
        event.importance === "high" || event.importance === "critical",
    ).length ?? 0;

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Timeline"
          title={story?.title ?? "Timeline truyện"}
          description="Theo dõi Canon events, nhánh rewrite và continuity issues theo chương."
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/workspace`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Mở Workspace
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/bible`}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Story Bible
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/stories/${storyId}/analysis`}>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Phân tích truyện
                </Link>
              </Button>
            </>
          }
        />

        {storageError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {storageError}
          </p>
        ) : null}

        {isLoading ? (
          <SectionCard title="Đang tải Timeline">
            <p className="app-muted-text">
              Đang đọc dữ liệu Timeline...
            </p>
          </SectionCard>
        ) : !result ? (
          <EmptyState
            title="Chưa có dữ liệu Timeline."
            description="Hãy chạy phân tích truyện để tạo Canon events và trạng thái continuity."
            action={
              <Button asChild>
                <Link href={`/stories/${storyId}/analysis`}>
                  Mở trang phân tích
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                icon={<CalendarDays className="h-4 w-4" />}
                title="Canon events"
                value={result.events.length}
              />
              <StatCard
                icon={<GitBranch className="h-4 w-4" />}
                title="Nhánh rewrite"
                value={timelineData.branches.length}
              />
              <StatCard
                icon={<Layers3 className="h-4 w-4" />}
                title="Branch changes"
                value={timelineData.branchChanges.length}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Continuity issues"
                value={timelineData.continuityIssues.length}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="High/Critical events"
                value={highOrCriticalEvents}
              />
            </section>

            <SectionCard title="Bộ lọc">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Mức độ quan trọng của Canon event</span>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={importanceFilter}
                    onChange={(event) =>
                      setImportanceFilter(event.target.value as ImportanceFilter)
                    }
                  >
                    <option value="all">Tất cả</option>
                    <option value="medium+">Medium+</option>
                    <option value="high+">High+</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Mức độ continuity issue</span>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={severityFilter}
                    onChange={(event) =>
                      setSeverityFilter(event.target.value as SeverityFilter)
                    }
                  >
                    <option value="all">Tất cả</option>
                    <option value="medium+">Medium+</option>
                    <option value="high+">High+</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
              </div>
            </SectionCard>

            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Chi tiết kỹ thuật
              </summary>
              <p className="mt-3 app-muted-text">
                Dữ liệu Timeline được đọc từ IndexedDB. Thông báo lỗi chỉ hiển thị khi quá trình đọc thất bại.
              </p>
            </details>

            <section className="grid gap-4 xl:grid-cols-2">
              <CanonTimelineSection events={filteredCanonEvents} />
              <BranchChangesTimelineSection changes={sortedBranchChanges} />
              <ContinuityIssuesTimelineSection
                issues={filteredContinuityIssues}
              />
              <ChapterRangeSummarySection ranges={chapterRangeSummary} />
            </section>
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}

function CanonTimelineSection({ events }: { events: StoryEvent[] }) {
  return (
    <SectionCard title="Timeline Canon">
      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => (
            <article key={event.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Chương {event.chapterNumber}
                  </p>
                  <h2 className="mt-1 text-sm font-medium">{event.title}</h2>
                </div>
                <Badge variant="outline">{event.importance}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {event.description}
              </p>
              {event.charactersInvolved.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Nhân vật: {event.charactersInvolved.join(", ")}
                </p>
              ) : null}
              {event.locationsInvolved.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Địa điểm: {event.locationsInvolved.join(", ")}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">Không có Canon events phù hợp bộ lọc.</p>
      )}
    </SectionCard>
  );
}

function BranchChangesTimelineSection({
  changes,
}: {
  changes: BranchChange[];
}) {
  return (
    <SectionCard title="Timeline nhánh rewrite">
      {changes.length > 0 ? (
        <div className="space-y-3">
          {changes.map((change) => (
            <article key={change.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {typeof change.chapterNumber === "number"
                      ? `Chương ${change.chapterNumber}`
                      : "Không có chương"}
                  </p>
                  <h2 className="mt-1 text-sm font-medium">{change.title}</h2>
                </div>
                <Badge variant="outline">{change.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {change.type} · {change.impactScope}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {change.affectedChapterNumbers.length} chương bị ảnh hưởng
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">Chưa có branch changes.</p>
      )}
    </SectionCard>
  );
}

function ContinuityIssuesTimelineSection({
  issues,
}: {
  issues: BranchContinuityIssue[];
}) {
  return (
    <SectionCard title="Timeline continuity issues">
      {issues.length > 0 ? (
        <div className="space-y-3">
          {issues.map((issue) => (
            <article key={issue.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {formatAffectedChapters(issue.affectedChapterNumbers)}
                  </p>
                  <h2 className="mt-1 text-sm font-medium">{issue.title}</h2>
                </div>
                <Badge variant="outline">{issue.severity}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Trạng thái: {issue.status}
              </p>
              {issue.suggestedFix ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Gợi ý xử lý: {issue.suggestedFix}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">
          Không có continuity issues phù hợp bộ lọc.
        </p>
      )}
    </SectionCard>
  );
}

function ChapterRangeSummarySection({
  ranges,
}: {
  ranges: {
    id: string;
    label: string;
    canonEvents: number;
    branchChanges: number;
    continuityIssues: number;
  }[];
}) {
  return (
    <SectionCard title="Tổng quan theo dải chương">
      <div className="space-y-2">
        {ranges.map((range) => (
          <article
            key={range.id}
            className="grid gap-3 rounded-md border bg-background p-3 text-sm md:grid-cols-[1fr_auto_auto_auto]"
          >
            <p className="font-medium">{range.label}</p>
            <p className="text-muted-foreground">
              {range.canonEvents} canon events
            </p>
            <p className="text-muted-foreground">
              {range.branchChanges} branch changes
            </p>
            <p className="text-muted-foreground">
              {range.continuityIssues} issues
            </p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
