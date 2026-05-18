"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  HeartHandshake,
  Search,
  Users,
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
  Story,
  StoryAnalysisResult,
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

interface StoryRelationshipsClientProps {
  storyId: string;
}

interface StoryRelationshipsData {
  story?: Story;
  analysisResult: StoryAnalysisResult | null;
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
}

type RelationshipFilter = "all" | "impacted" | "high-risk";

interface DerivedRelationship {
  id: string;
  characterA: string;
  characterB: string;
  coAppearanceCount: number;
  chapterNumbers: number[];
  relatedEvents: string[];
  latestChapterNumber: number;
  impactedChanges: BranchChange[];
  highRiskIssues: BranchContinuityIssue[];
}

async function readIndexedDbRelationshipsData(
  storyId: string,
): Promise<StoryRelationshipsData> {
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

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function pairKey(characterA: string, characterB: string) {
  return [characterA, characterB]
    .map((name) => name.toLocaleLowerCase())
    .sort()
    .join("::");
}

function changeMentionsCharacter(change: BranchChange, characterName: string) {
  const targetName = change.targetName?.toLocaleLowerCase() ?? "";

  return targetName.includes(characterName.toLocaleLowerCase());
}

function changeMentionsPair(
  change: BranchChange,
  characterA: string,
  characterB: string,
) {
  return (
    changeMentionsCharacter(change, characterA) ||
    changeMentionsCharacter(change, characterB)
  );
}

function isRelationshipRisk(issue: BranchContinuityIssue) {
  const text = `${issue.title} ${issue.description}`.toLocaleLowerCase();

  return (
    text.includes("relationship") ||
    text.includes("quan hệ") ||
    issue.severity === "high" ||
    issue.severity === "critical"
  );
}

function deriveRelationships({
  result,
  relationshipChanges,
  relationshipRisks,
}: {
  result: StoryAnalysisResult;
  relationshipChanges: BranchChange[];
  relationshipRisks: BranchContinuityIssue[];
}) {
  const relationshipMap = new Map<string, DerivedRelationship>();

  result.events.forEach((event) => {
    const characters = Array.from(
      new Set(event.charactersInvolved.map(normalizeName).filter(Boolean)),
    );

    if (characters.length < 2) return;

    for (let leftIndex = 0; leftIndex < characters.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < characters.length;
        rightIndex += 1
      ) {
        const characterA = characters[leftIndex];
        const characterB = characters[rightIndex];
        const id = pairKey(characterA, characterB);
        const existing = relationshipMap.get(id);

        if (existing) {
          existing.coAppearanceCount += 1;
          existing.chapterNumbers = Array.from(
            new Set([...existing.chapterNumbers, event.chapterNumber]),
          ).sort((left, right) => left - right);
          existing.relatedEvents = Array.from(
            new Set([...existing.relatedEvents, event.title]),
          ).slice(0, 5);
          existing.latestChapterNumber = Math.max(
            existing.latestChapterNumber,
            event.chapterNumber,
          );
          continue;
        }

        relationshipMap.set(id, {
          id,
          characterA,
          characterB,
          coAppearanceCount: 1,
          chapterNumbers: [event.chapterNumber],
          relatedEvents: [event.title],
          latestChapterNumber: event.chapterNumber,
          impactedChanges: [],
          highRiskIssues: [],
        });
      }
    }
  });

  return Array.from(relationshipMap.values())
    .map((relationship) => ({
      ...relationship,
      impactedChanges: relationshipChanges.filter((change) =>
        changeMentionsPair(
          change,
          relationship.characterA,
          relationship.characterB,
        ),
      ),
      highRiskIssues: relationshipRisks,
    }))
    .sort((left, right) => {
      if (right.coAppearanceCount !== left.coAppearanceCount) {
        return right.coAppearanceCount - left.coAppearanceCount;
      }

      return left.characterA.localeCompare(right.characterA);
    });
}

export function StoryRelationshipsClient({
  storyId,
}: StoryRelationshipsClientProps) {
  const [relationshipsData, setRelationshipsData] =
    useState<StoryRelationshipsData>({
      analysisResult: null,
      branchChanges: [],
      continuityIssues: [],
    });
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [relationshipFilter, setRelationshipFilter] =
    useState<RelationshipFilter>("all");

  useEffect(() => {
    let isActive = true;

    async function loadRelationshipsData() {
      let indexedDbData: StoryRelationshipsData = {
        analysisResult: null,
        branchChanges: [],
        continuityIssues: [],
      };
      let indexedDbFailed = false;

      try {
        indexedDbData = await readIndexedDbRelationshipsData(storyId);
      } catch (error) {
        indexedDbFailed = true;
        console.error(
          "Failed to read relationship data from IndexedDB",
          error,
        );
      }

      if (!isActive) return;

      setRelationshipsData(indexedDbData);
      setStorageError(
        indexedDbFailed
          ? "Không thể đọc dữ liệu quan hệ từ IndexedDB."
          : "",
      );
      setIsLoading(false);
    }

    void loadRelationshipsData();

    return () => {
      isActive = false;
    };
  }, [storyId]);

  const result = relationshipsData.analysisResult;
  const relationshipChanges = useMemo(() => {
    return relationshipsData.branchChanges.filter(
      (change) => change.type === "relationship_change",
    );
  }, [relationshipsData.branchChanges]);
  const relationshipRisks = useMemo(() => {
    return relationshipsData.continuityIssues.filter(isRelationshipRisk);
  }, [relationshipsData.continuityIssues]);
  const highCriticalRisks = useMemo(() => {
    return relationshipRisks.filter(
      (issue) => issue.severity === "high" || issue.severity === "critical",
    );
  }, [relationshipRisks]);
  const derivedRelationships = useMemo(() => {
    if (!result) return [];

    return deriveRelationships({
      result,
      relationshipChanges,
      relationshipRisks: highCriticalRisks,
    });
  }, [highCriticalRisks, relationshipChanges, result]);
  const filteredRelationships = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLocaleLowerCase();

    return derivedRelationships.filter((relationship) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        relationship.characterA
          .toLocaleLowerCase()
          .includes(normalizedSearch) ||
        relationship.characterB.toLocaleLowerCase().includes(normalizedSearch);
      const matchesFilter =
        relationshipFilter === "all" ||
        (relationshipFilter === "impacted" &&
          relationship.impactedChanges.length > 0) ||
        (relationshipFilter === "high-risk" &&
          relationship.highRiskIssues.length > 0);

      return matchesSearch && matchesFilter;
    });
  }, [derivedRelationships, relationshipFilter, searchQuery]);
  const unmatchedRelationshipChanges = useMemo(() => {
    return relationshipChanges.filter((change) => {
      return !derivedRelationships.some((relationship) =>
        changeMentionsPair(
          change,
          relationship.characterA,
          relationship.characterB,
        ),
      );
    });
  }, [derivedRelationships, relationshipChanges]);

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          title="Quan hệ nhân vật"
          description="Theo dõi cặp nhân vật, lần xuất hiện chung, nhánh rewrite và risk continuity."
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
                  <HeartHandshake className="mr-2 h-4 w-4" />
                  Story Bible
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
          <SectionCard title="Đang tải quan hệ">
            <p className="app-muted-text">Đang tải nhân vật, sự kiện và risk continuity.</p>
          </SectionCard>
        ) : !result ? (
          <EmptyState
            title="Chưa có dữ liệu quan hệ"
            description="Hãy chạy phân tích truyện để tạo dữ liệu nhân vật và sự kiện."
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
                icon={<HeartHandshake className="h-4 w-4" />}
                title="Cặp quan hệ"
                value={derivedRelationships.length}
              />
              <StatCard
                icon={<HeartHandshake className="h-4 w-4" />}
                title="Thay đổi quan hệ"
                value={relationshipChanges.length}
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
                  <span className="font-medium">Tìm nhân vật</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Tên nhân vật..."
                    />
                  </div>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Hiển thị</span>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={relationshipFilter}
                    onChange={(event) =>
                      setRelationshipFilter(
                        event.target.value as RelationshipFilter,
                      )
                    }
                  >
                    <option value="all">Tất cả</option>
                    <option value="impacted">Chỉ bị ảnh hưởng</option>
                    <option value="high-risk">Chỉ risk cao</option>
                  </select>
                </label>
              </div>
            </SectionCard>

            <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
              <SectionCard title="Quan hệ suy ra từ truyện">
                {derivedRelationships.length === 0 ? (
                  <EmptyState title="Chưa tìm thấy cặp nhân vật xuất hiện chung." />
                ) : filteredRelationships.length > 0 ? (
                  <div className="space-y-3">
                    {filteredRelationships.map((relationship) => (
                      <RelationshipCard
                        key={relationship.id}
                        relationship={relationship}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="app-muted-text">
                    Không có quan hệ nào khớp bộ lọc.
                  </p>
                )}
              </SectionCard>

              <div className="space-y-4">
                <RelationshipChangesSection
                  changes={unmatchedRelationshipChanges}
                />
                <RelationshipRisksSection risks={relationshipRisks} />
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
                    <p>Relationship Tracker đọc dữ liệu từ IndexedDB.</p>
                  </div>
                </details>
              </div>
            </section>
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}

function RelationshipCard({
  relationship,
}: {
  relationship: DerivedRelationship;
}) {
  return (
    <article className="app-list-item">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">
            {relationship.characterA} / {relationship.characterB}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Chương gần nhất: {relationship.latestChapterNumber}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {relationship.coAppearanceCount} lần xuất hiện chung
          </Badge>
          {relationship.impactedChanges.length > 0 ? (
            <Badge variant="outline">Bị ảnh hưởng</Badge>
          ) : null}
          {relationship.highRiskIssues.length > 0 ? (
            <Badge variant="destructive">Risk cao</Badge>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Số chương có mặt chung: {relationship.chapterNumbers.length}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Chương: {relationship.chapterNumbers.slice(0, 12).join(", ")}
        {relationship.chapterNumbers.length > 12 ? "..." : ""}
      </p>

      {relationship.relatedEvents.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium">Sự kiện liên quan</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {relationship.relatedEvents.map((eventTitle) => (
              <li key={eventTitle}>{eventTitle}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function RelationshipChangesSection({ changes }: { changes: BranchChange[] }) {
  return (
    <SectionCard title="Thay đổi quan hệ chưa khớp cặp">
      {changes.length > 0 ? (
        <div className="space-y-2">
          {changes.map((change) => (
            <article key={change.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium">{change.title}</h2>
                <Badge variant="outline">{change.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {change.targetName ?? "Không có target"} / {change.impactScope}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">Không có thay đổi quan hệ chưa khớp.</p>
      )}
    </SectionCard>
  );
}

function RelationshipRisksSection({
  risks,
}: {
  risks: BranchContinuityIssue[];
}) {
  return (
    <SectionCard title="Risk continuity quan hệ">
      {risks.length > 0 ? (
        <div className="space-y-2">
          {risks.map((risk) => (
            <article key={risk.id} className="app-list-item">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium">{risk.title}</h2>
                <Badge variant="outline">{risk.severity}</Badge>
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                {risk.description}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {risk.affectedChapterNumbers.length} chương bị ảnh hưởng / {risk.status}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="app-muted-text">Không có risk continuity quan hệ.</p>
      )}
    </SectionCard>
  );
}
