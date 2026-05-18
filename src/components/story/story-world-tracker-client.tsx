"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  CalendarDays,
  HeartHandshake,
  MapPin,
  Search,
  ScrollText,
  Sparkles,
} from "lucide-react";

import {
  getAnalysisResult,
  getBranchChanges,
  getContinuityIssues,
  getStoryById,
} from "@/lib/db/indexed-db";
import type {
  BranchChange,
  BranchContinuityIssue,
  ExtractedEntity,
  Story,
  StoryAnalysisResult,
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
import { Input } from "@/components/ui/input";

interface StoryWorldTrackerClientProps {
  storyId: string;
}

interface StoryWorldTrackerData {
  story?: Story;
  analysisResult: StoryAnalysisResult | null;
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
}

type WorldTrackerCategory =
  | "all"
  | "items"
  | "terms"
  | "locations"
  | "power-system"
  | "impacted";

const powerSystemKeywords = [
  "cảnh giới",
  "linh khí",
  "công pháp",
  "trận pháp",
  "ma pháp",
  "huyết mạch",
  "thần thức",
];
const worldRiskKeywords = [
  "item",
  "term",
  "location",
  "world",
  "vật phẩm",
  "thuật ngữ",
  "địa danh",
  "cảnh giới",
];

async function readIndexedDbWorldTrackerData(
  storyId: string,
): Promise<StoryWorldTrackerData> {
  const [story, analysisResult, branchChanges, continuityIssues] =
    await Promise.all([
      getStoryById(storyId),
      getAnalysisResult(storyId),
      getBranchChanges(storyId),
      getContinuityIssues(storyId),
    ]);

  return {
    story,
    analysisResult: analysisResult ?? null,
    branchChanges,
    continuityIssues,
  };
}

function textIncludesAnyKeyword(text: string, keywords: string[]) {
  const normalizedText = text.toLocaleLowerCase();

  return keywords.some((keyword) =>
    normalizedText.includes(keyword.toLocaleLowerCase()),
  );
}

function isPowerSystemEntity(entity: ExtractedEntity) {
  const searchableText = `${entity.name} ${entity.description}`;

  return (
    entity.type === "power-system" ||
    textIncludesAnyKeyword(searchableText, powerSystemKeywords)
  );
}

function changeMatchesEntity(change: BranchChange, entity: ExtractedEntity) {
  return (
    change.targetName
      ?.toLocaleLowerCase()
      .includes(entity.name.toLocaleLowerCase()) ?? false
  );
}

function isWorldBranchChange(change: BranchChange) {
  return (
    change.type === "item_change" ||
    change.type === "term_change" ||
    change.type === "location_change" ||
    change.type === "timeline_change"
  );
}

function isWorldContinuityRisk(issue: BranchContinuityIssue) {
  const searchableText = `${issue.title} ${issue.description}`;

  return (
    issue.severity === "high" ||
    issue.severity === "critical" ||
    textIncludesAnyKeyword(searchableText, worldRiskKeywords)
  );
}

function matchesSearch(entity: ExtractedEntity, searchQuery: string) {
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();

  if (!normalizedSearch) return true;

  return `${entity.name} ${entity.description}`
    .toLocaleLowerCase()
    .includes(normalizedSearch);
}

function filterEntities({
  entities,
  searchQuery,
  category,
  worldBranchChanges,
}: {
  entities: ExtractedEntity[];
  searchQuery: string;
  category: WorldTrackerCategory;
  worldBranchChanges: BranchChange[];
}) {
  return entities.filter((entity) => {
    const impacted = worldBranchChanges.some((change) =>
      changeMatchesEntity(change, entity),
    );

    if (!matchesSearch(entity, searchQuery)) return false;
    if (category === "impacted") return impacted;
    if (category === "power-system") return isPowerSystemEntity(entity);

    return true;
  });
}

export function StoryWorldTrackerClient({
  storyId,
}: StoryWorldTrackerClientProps) {
  const [worldTrackerData, setWorldTrackerData] =
    useState<StoryWorldTrackerData>({
      analysisResult: null,
      branchChanges: [],
      continuityIssues: [],
    });
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<WorldTrackerCategory>("all");

  useEffect(() => {
    let isActive = true;

    async function loadWorldTrackerData() {
      let indexedDbData: StoryWorldTrackerData = {
        analysisResult: null,
        branchChanges: [],
        continuityIssues: [],
      };
      let indexedDbFailed = false;

      try {
        indexedDbData = await readIndexedDbWorldTrackerData(storyId);
      } catch (error) {
        indexedDbFailed = true;
        console.error("Failed to read World Tracker data from IndexedDB", error);
      }

      if (!isActive) return;

      setWorldTrackerData(indexedDbData);
      setStorageError(
        indexedDbFailed
          ? "Không thể đọc dữ liệu World Tracker từ IndexedDB."
          : "",
      );
      setIsLoading(false);
    }

    void loadWorldTrackerData();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  const result = worldTrackerData.analysisResult;
  const worldBranchChanges = useMemo(() => {
    return worldTrackerData.branchChanges.filter(isWorldBranchChange);
  }, [worldTrackerData.branchChanges]);
  const worldContinuityRisks = useMemo(() => {
    return worldTrackerData.continuityIssues.filter(isWorldContinuityRisk);
  }, [worldTrackerData.continuityIssues]);
  const powerSystemTerms = useMemo(() => {
    return result?.terms.filter(isPowerSystemEntity) ?? [];
  }, [result?.terms]);
  const filteredItems = useMemo(() => {
    if (!result || (category !== "all" && category !== "items" && category !== "impacted")) {
      return [];
    }

    return filterEntities({
      entities: result.items,
      searchQuery,
      category,
      worldBranchChanges,
    });
  }, [category, result, searchQuery, worldBranchChanges]);
  const filteredTerms = useMemo(() => {
    if (!result || (category !== "all" && category !== "terms" && category !== "power-system" && category !== "impacted")) {
      return [];
    }

    return filterEntities({
      entities: result.terms,
      searchQuery,
      category,
      worldBranchChanges,
    });
  }, [category, result, searchQuery, worldBranchChanges]);
  const filteredLocations = useMemo(() => {
    if (!result || (category !== "all" && category !== "locations" && category !== "impacted")) {
      return [];
    }

    return filterEntities({
      entities: result.locations,
      searchQuery,
      category,
      worldBranchChanges,
    });
  }, [category, result, searchQuery, worldBranchChanges]);
  const highCriticalRisks = worldContinuityRisks.filter(
    (issue) => issue.severity === "high" || issue.severity === "critical",
  );
  const styleProfile = result?.writingStyleProfiles[0];

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          title="World Tracker"
          description="Theo dõi vật phẩm, thuật ngữ, địa điểm, power-system và ảnh hưởng từ nhánh rewrite."
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/workspace`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Workspace viết
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/bible`}>
                  <ScrollText className="mr-2 h-4 w-4" />
                  Story Bible
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/timeline`}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Timeline
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/relationships`}>
                  <HeartHandshake className="mr-2 h-4 w-4" />
                  Quan hệ
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/stories/${storyId}/analysis`}>Phân tích truyện</Link>
              </Button>
            </>
          }
        />

        {isLoading ? (
          <SectionCard title="Đang tải World Tracker">
            <p className="app-muted-text">Đang tải vật phẩm, thuật ngữ, địa điểm và văn phong.</p>
          </SectionCard>
        ) : !result ? (
          <EmptyState
            title="Chưa có dữ liệu World Tracker"
            description="Hãy chạy phân tích truyện để tạo dữ liệu vật phẩm, thuật ngữ, địa điểm và văn phong."
            action={
              <Button asChild>
                <Link href={`/stories/${storyId}/analysis`}>Mở phân tích truyện</Link>
              </Button>
            }
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
                icon={<Sparkles className="h-4 w-4" />}
                title="Power-system"
                value={powerSystemTerms.length}
              />
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                title="Thay đổi world"
                value={worldBranchChanges.length}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Risk cao"
                value={highCriticalRisks.length}
              />
            </section>

            <SectionCard title="Bộ lọc">
              <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Tìm dữ liệu world</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Tên hoặc mô tả..."
                    />
                  </div>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Nhóm dữ liệu</span>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value as WorldTrackerCategory)
                    }
                  >
                    <option value="all">Tất cả</option>
                    <option value="items">Vật phẩm</option>
                    <option value="terms">Thuật ngữ</option>
                    <option value="locations">Địa điểm</option>
                    <option value="power-system">Power-system</option>
                    <option value="impacted">Chỉ bị ảnh hưởng</option>
                  </select>
                </label>
              </div>
            </SectionCard>

            <section className="grid gap-4 xl:grid-cols-2">
              <WorldEntitySection
                branchChanges={worldBranchChanges}
                emptyText="Không có vật phẩm khớp bộ lọc."
                entities={filteredItems}
                title="Vật phẩm"
              />
              <WorldEntitySection
                branchChanges={worldBranchChanges}
                emptyText="Không có thuật ngữ khớp bộ lọc."
                entities={filteredTerms}
                title="Thuật ngữ"
              />
              <WorldEntitySection
                branchChanges={worldBranchChanges}
                emptyText="Không có địa điểm khớp bộ lọc."
                entities={filteredLocations}
                title="Địa điểm"
              />
              <WorldEntitySection
                branchChanges={worldBranchChanges}
                emptyText="Chưa phát hiện khái niệm power-system."
                entities={
                  category === "all" || category === "power-system"
                    ? powerSystemTerms.filter((entity) =>
                        matchesSearch(entity, searchQuery),
                      )
                    : []
                }
                title="Khái niệm power-system"
              />
              <BranchImpactsSection changes={worldBranchChanges} />
              <WorldContinuityRisksSection risks={worldContinuityRisks} />
              <WritingStyleSummary profile={styleProfile} />
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
                  <p>World Tracker đọc dữ liệu từ IndexedDB.</p>
                </div>
              </details>
            </section>
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}

function WorldEntitySection({
  title,
  entities,
  emptyText,
  branchChanges,
}: {
  title: string;
  entities: ExtractedEntity[];
  emptyText: string;
  branchChanges: BranchChange[];
}) {
  return (
    <SectionCard title={title}>
      {entities.length > 0 ? (
        <div className="space-y-3">
          {entities.map((entity) => {
            const impacted = branchChanges.some((change) =>
              changeMatchesEntity(change, entity),
            );

            return (
              <article key={entity.id} className="app-list-item">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-medium">{entity.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entity.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {impacted ? <Badge variant="outline">Bị ảnh hưởng</Badge> : null}
                    {typeof entity.confidence === "number" ? (
                      <Badge variant="secondary">
                        {Math.round(entity.confidence * 100)}%
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {entity.firstSeenChapter
                    ? `Xuất hiện đầu: chương ${entity.firstSeenChapter}. `
                    : ""}
                  Chương liên quan: {entity.relatedChapterNumbers.length}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="app-muted-text">{emptyText}</p>
      )}
    </SectionCard>
  );
}

function BranchImpactsSection({ changes }: { changes: BranchChange[] }) {
  return (
    <SectionCard title="Ảnh hưởng từ nhánh rewrite">
      {changes.length > 0 ? (
        <div className="space-y-2">
          {changes.map((change) => (
            <article key={change.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium">{change.title}</h2>
                <Badge variant="outline">{change.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {change.type} / {change.targetName ?? "Không có target"} / {change.impactScope}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {change.affectedChapterNumbers.length} chương bị ảnh hưởng
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">Chưa có thay đổi vật phẩm, thuật ngữ, địa điểm hoặc timeline.</p>
      )}
    </SectionCard>
  );
}

function WorldContinuityRisksSection({
  risks,
}: {
  risks: BranchContinuityIssue[];
}) {
  return (
    <SectionCard title="Risk continuity world">
      {risks.length > 0 ? (
        <div className="space-y-2">
          {risks.map((risk) => (
            <article key={risk.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium">{risk.title}</h2>
                <Badge variant="outline">{risk.severity}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {risk.status} / {risk.affectedChapterNumbers.length} chương bị ảnh hưởng
              </p>
              {risk.suggestedFix ? (
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                  Đề xuất sửa: {risk.suggestedFix}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">Không có risk continuity world.</p>
      )}
    </SectionCard>
  );
}

function WritingStyleSummary({
  profile,
}: {
  profile?: WritingStyleProfile;
}) {
  return (
    <SectionCard title="Tóm tắt văn phong">
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
