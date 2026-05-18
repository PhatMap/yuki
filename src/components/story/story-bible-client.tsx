"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  CalendarDays,
  GitBranch,
  HeartHandshake,
  MapPin,
  PenLine,
  ScrollText,
  Users,
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
  ExtractedEntity,
  Story,
  StoryAnalysisResult,
  StoryBranchV2,
  StoryEvent,
  WritingStyleProfile,
} from "@/lib/types";
import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface StoryBibleClientProps {
  storyId: string;
}

interface StoryBibleData {
  story?: Story;
  analysisResult: StoryAnalysisResult | null;
  branches: StoryBranchV2[];
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
}

async function readIndexedDbBibleData(
  storyId: string,
): Promise<StoryBibleData> {
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

export function StoryBibleClient({ storyId }: StoryBibleClientProps) {
  const [bibleData, setBibleData] = useState<StoryBibleData>({
    analysisResult: null,
    branches: [],
    branchChanges: [],
    continuityIssues: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadBibleData() {
      let indexedDbData: StoryBibleData = {
        analysisResult: null,
        branches: [],
        branchChanges: [],
        continuityIssues: [],
      };
      let indexedDbFailed = false;

      try {
        indexedDbData = await readIndexedDbBibleData(storyId);
      } catch (error) {
        indexedDbFailed = true;
        console.error("Failed to read Story Bible data from IndexedDB", error);
      }

      if (!isActive) return;

      setBibleData(indexedDbData);
      setStorageError(
        indexedDbFailed
          ? "Không thể đọc dữ liệu Story Bible từ IndexedDB."
          : "",
      );
      setIsLoading(false);
    }

    void loadBibleData();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  const story = bibleData.story ?? stories.find((item) => item.id === storyId);
  const result = bibleData.analysisResult;
  const sortedEvents = useMemo(() => {
    return [...(result?.events ?? [])].sort(
      (left, right) => left.chapterNumber - right.chapterNumber,
    );
  }, [result?.events]);
  const styleProfile = result?.writingStyleProfiles[0];

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          title="Story Bible"
          description="Tổng hợp nhân vật, sự kiện, vật phẩm, thuật ngữ, địa điểm, văn phong và continuity."
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/workspace`}>
                  <PenLine className="mr-2 h-4 w-4" />
                  Workspace viết
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/reader`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Đọc truyện
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/timeline`}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Timeline
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/stories/${storyId}/analysis`}>Phân tích truyện</Link>
              </Button>
            </>
          }
        />

        {isLoading ? (
          <SectionCard title="Đang tải Story Bible">
            <p className="app-muted-text">Đang tải dữ liệu phân tích và canon đã lưu.</p>
          </SectionCard>
        ) : !result ? (
          <EmptyState
            title="Chưa có Story Bible"
            description="Hãy chạy phân tích truyện để tạo nhân vật, sự kiện, vật phẩm, thuật ngữ, địa điểm và văn phong."
            action={
              <Button asChild>
                <Link href={`/stories/${storyId}/analysis`}>Mở phân tích truyện</Link>
              </Button>
            }
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<Users className="h-4 w-4" />}
                title="Nhân vật"
                value={result.characters.length}
              />
              <StatCard
                icon={<CalendarDays className="h-4 w-4" />}
                title="Sự kiện"
                value={result.events.length}
              />
              <StatCard
                icon={<Boxes className="h-4 w-4" />}
                title="Vật phẩm"
                value={result.items.length}
              />
              <StatCard
                icon={<ScrollText className="h-4 w-4" />}
                title="Thuật ngữ"
                value={result.terms.length}
              />
              <StatCard
                icon={<MapPin className="h-4 w-4" />}
                title="Địa điểm"
                value={result.locations.length}
              />
              <StatCard
                icon={<GitBranch className="h-4 w-4" />}
                title="Nhánh rewrite"
                value={bibleData.branchChanges.length}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Issue continuity"
                value={bibleData.continuityIssues.length}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <EntitySection title="Nhân vật" entities={result.characters} />
              <EventSection events={sortedEvents} />
              <EntitySection title="Vật phẩm" entities={result.items} />
              <EntitySection title="Thuật ngữ" entities={result.terms} />
              <EntitySection title="Địa điểm" entities={result.locations} />
              <WritingStyleSection profile={styleProfile} />
            </section>

            <BranchContinuitySection
              branches={bibleData.branches}
              changes={bibleData.branchChanges}
              issues={bibleData.continuityIssues}
            />

            <details className="rounded-xl border bg-card/80">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Chi tiết kỹ thuật
              </summary>
              <div className="space-y-3 border-t p-4 text-sm text-muted-foreground">
                {storageError ? (
                  <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    {storageError}
                  </p>
                ) : null}
                <p>Story Bible đọc dữ liệu từ IndexedDB.</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/stories/${storyId}/relationships`}>Relationships</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/stories/${storyId}/world-tracker`}>World Tracker</Link>
                  </Button>
                </div>
              </div>
            </details>
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}

function EntitySection({
  title,
  entities,
}: {
  title: string;
  entities: ExtractedEntity[];
}) {
  return (
    <SectionCard title={title}>
      {entities.length > 0 ? (
        <div className="space-y-3">
          {entities.map((entity) => (
            <article key={entity.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium">{entity.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entity.description}
                  </p>
                </div>
                {typeof entity.confidence === "number" ? (
                  <Badge variant="outline">
                    {Math.round(entity.confidence * 100)}%
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {entity.firstSeenChapter
                  ? `Xuất hiện đầu: chương ${entity.firstSeenChapter}. `
                  : ""}
                Chương liên quan: {entity.relatedChapterNumbers.length}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">Chưa phát hiện mục nào.</p>
      )}
    </SectionCard>
  );
}

function EventSection({ events }: { events: StoryEvent[] }) {
  return (
    <SectionCard title="Sự kiện">
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
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">Chưa phát hiện sự kiện.</p>
      )}
    </SectionCard>
  );
}

function WritingStyleSection({
  profile,
}: {
  profile?: WritingStyleProfile;
}) {
  return (
    <SectionCard icon={<PenLine className="h-5 w-5" />} title="Văn phong">
      {profile ? (
        <div className="space-y-4 text-sm">
          <StyleRow label="Ngôi kể" value={profile.narrationStyle} />
          <StyleRow label="Câu văn" value={profile.sentenceStyle} />
          <StyleRow label="Đối thoại" value={profile.dialogueStyle} />
          <StyleRow label="Nhịp truyện" value={profile.pacing} />
          <StyleRow label="Tone" value={profile.tone} />
          <PatternList title="Pattern thường dùng" items={profile.commonPatterns} />
          <PatternList title="Pattern cần tránh" items={profile.tabooPatterns} />
        </div>
      ) : (
        <p className="app-muted-text">Chưa có hồ sơ văn phong.</p>
      )}
    </SectionCard>
  );
}

function StyleRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-muted-foreground">{value}</p>
    </div>
  );
}

function PatternList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted-foreground">Chưa phát hiện pattern.</p>
      )}
    </div>
  );
}

function BranchContinuitySection({
  branches,
  changes,
  issues,
}: {
  branches: StoryBranchV2[];
  changes: BranchChange[];
  issues: BranchContinuityIssue[];
}) {
  return (
    <SectionCard title="Nhánh và continuity">
      <div className="grid gap-4 xl:grid-cols-3">
        <OverviewList
          emptyText="Chưa có nhánh."
          items={branches}
          renderItem={(branch) => (
            <article key={branch.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium">{branch.name}</h2>
                <Badge variant="outline">{branch.type}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {branch.description}
              </p>
            </article>
          )}
          title="Nhánh"
        />
        <OverviewList
          emptyText="Chưa có thay đổi nhánh."
          items={changes}
          renderItem={(change) => (
            <article key={change.id} className="app-list-item">
              <h2 className="text-sm font-medium">{change.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {change.type} · {change.impactScope} · {change.status}
              </p>
            </article>
          )}
          title="Thay đổi nhánh"
        />
        <OverviewList
          emptyText="Chưa có issue continuity."
          items={issues}
          renderItem={(issue) => (
            <article key={issue.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium">{issue.title}</h2>
                <Badge variant="outline">{issue.severity}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {issue.status}
              </p>
            </article>
          )}
          title="Issue continuity"
        />
      </div>
    </SectionCard>
  );
}

function OverviewList<T>({
  title,
  items,
  emptyText,
  renderItem,
}: {
  title: string;
  items: T[];
  emptyText: string;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="space-y-2">
        {items.length > 0 ? (
          items.map(renderItem)
        ) : (
          <p className="app-muted-text">{emptyText}</p>
        )}
      </div>
    </div>
  );
}
