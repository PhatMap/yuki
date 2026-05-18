"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, FileUp, PenLine, Settings, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllStories } from "@/lib/db/indexed-db";
import { stories as mockStories } from "@/lib/mock-data";
import { getAiSetupReadiness, type AiSetupReadiness } from "@/lib/settings/ai-setup-readiness";
import type { Story } from "@/lib/types";

type HomeStorySource = "indexeddb" | "mock";

type HomeStory = Story & {
  homeSource: HomeStorySource;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("vi-VN");
}

function sortStoriesByUpdatedAtDesc(storyItems: Story[]) {
  return [...storyItems].sort((firstStory, secondStory) => {
    return (
      new Date(secondStory.updatedAt).getTime() -
      new Date(firstStory.updatedAt).getTime()
    );
  });
}

function getStorySourceLabel(source: HomeStorySource) {
  if (source === "indexeddb") return "Đã lưu";

  return "Mẫu";
}

function mergeHomeStories(storedStories: Story[]) {
  const storedItems: HomeStory[] = sortStoriesByUpdatedAtDesc(storedStories).map(
    (story) => ({
      ...story,
      homeSource: "indexeddb",
    }),
  );

  const storedIds = new Set(storedItems.map((story) => story.id));

  const starterItems: HomeStory[] = mockStories
    .filter((story) => !storedIds.has(story.id))
    .map((story) => ({
      ...story,
      homeSource: "mock",
    }));

  return {
    storedItems,
    starterItems,
    allItems: [...storedItems, ...starterItems],
  };
}

export function HomeDashboardClient() {
  const [storedStories, setStoredStories] = useState<Story[]>([]);
  const [aiSetupReadiness, setAiSetupReadiness] = useState<AiSetupReadiness>();
  const [isCheckingAiSetup, setIsCheckingAiSetup] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadStories() {
      try {
        const indexedDbStories = await getAllStories();

        if (!isActive) return;

        if (indexedDbStories.length > 0) {
          setStoredStories(indexedDbStories);
          return;
        }
      } catch (error) {
        console.error("Failed to read stories from IndexedDB", error);
      }

      if (!isActive) return;

      setStoredStories([]);
    }

    void loadStories();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadReadiness() {
      try {
        const readiness = await getAiSetupReadiness();
        if (!isActive) return;
        setAiSetupReadiness(readiness);
      } catch (error) {
        console.error("Failed to load AI setup readiness", error);
      } finally {
        if (isActive) {
          setIsCheckingAiSetup(false);
        }
      }
    }

    void loadReadiness();

    return () => {
      isActive = false;
    };
  }, []);

  const { storedItems, starterItems, allItems } = useMemo(
    () => mergeHomeStories(storedStories),
    [storedStories],
  );

  const primaryStory = allItems[0];
  const isAiReady = aiSetupReadiness?.canUseStoryWorkflow ?? false;

  if (isCheckingAiSetup) {
    return (
      <PageShell>
        <PageContainer>
          <SectionCard title="Đang kiểm tra AI setup">
            <p className="app-muted-text">Đang tải trạng thái provider và kết nối AI...</p>
          </SectionCard>
        </PageContainer>
      </PageShell>
    );
  }

  if (!isAiReady) {
    return (
      <PageShell>
        <PageContainer>
          <PageHeader
            eyebrow="Yuki"
            title="Thiết lập AI trước khi dùng Yuki"
            description="Yuki cần AI để phân tích truyện, tạo canon và hỗ trợ rewrite. Hãy chọn provider, nhập API key và test kết nối trước."
            action={
              <>
                <Button asChild>
                  <Link href="/settings">Thiết lập AI</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/settings">Mở cài đặt</Link>
                </Button>
              </>
            }
          />

          <SectionCard title="Trạng thái AI setup">
            <div className="space-y-3">
              <p className="text-sm">
                Provider hiện tại:{" "}
                <strong>{aiSetupReadiness?.providerLabel ?? "Chưa xác định"}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                {aiSetupReadiness?.providerStatusSummary ?? "Chưa có trạng thái"}
              </p>
              {aiSetupReadiness?.missingReasons?.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {aiSetupReadiness.missingReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </SectionCard>
        </PageContainer>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Yuki"
          title="Bắt đầu viết với Yuki"
          description="Nhập truyện, để Yuki phân tích, rồi đọc và rewrite theo hướng bạn muốn."
          action={
            <>
              <Button asChild>
                <Link href="/stories/import">
                  <FileUp className="mr-2 h-4 w-4" />
                  Nhập truyện mới
                </Link>
              </Button>

              {primaryStory ? (
                <Button asChild variant="outline">
                  <Link href={`/stories/${primaryStory.id}/workspace`}>
                    <PenLine className="mr-2 h-4 w-4" />
                    Tiếp tục truyện gần nhất
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />

        <SectionCard
          title="Truyện gần đây"
          description="Mở lại truyện để tiếp tục đọc, phân tích hoặc rewrite."
        >
          {storedItems.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {storedItems.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Bạn chưa có truyện nào đã lưu"
              description="Bắt đầu bằng cách nhập toàn bộ truyện một lần, sau đó chạy phân tích."
              action={
                <Button asChild>
                  <Link href="/stories/import">
                    <FileUp className="mr-2 h-4 w-4" />
                    Nhập truyện mới
                  </Link>
                </Button>
              }
            />
          )}
        </SectionCard>

        {starterItems.length > 0 ? (
          <SectionCard
            title="Truyện mẫu để bắt đầu nhanh"
            description="Dùng để thử flow đọc và rewrite khi chưa nhập truyện thật."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {starterItems.slice(0, 6).map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard title="Nâng cao">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Runtime
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/prompt-manager">
                <Sparkles className="mr-2 h-4 w-4" />
                Prompt Manager
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/stories">
                <BookOpen className="mr-2 h-4 w-4" />
                Thư viện truyện
              </Link>
            </Button>
            {primaryStory ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/stories/${primaryStory.id}/data-health`}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Data Health
                </Link>
              </Button>
            ) : null}
          </div>
        </SectionCard>
      </PageContainer>
    </PageShell>
  );
}

function StoryCard({ story }: { story: HomeStory }) {
  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <CardHeader className="gap-1 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="app-wrap-anywhere text-base">
              {story.title}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Cập nhật {formatDate(story.updatedAt)}
            </p>
          </div>

          <span
            className={
              story.homeSource === "indexeddb" ? "app-chip-primary" : "app-chip"
            }
          >
            {getStorySourceLabel(story.homeSource)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {story.description}
        </p>

        <div className="grid gap-2 sm:grid-cols-3">
          <Button asChild size="sm">
            <Link href={`/stories/${story.id}/workspace`}>Mở truyện</Link>
          </Button>

          <Button asChild size="sm" variant="outline">
            <Link href={`/stories/${story.id}/analysis`}>Phân tích</Link>
          </Button>

          <Button asChild size="sm" variant="outline">
            <Link href={`/stories/${story.id}/reader`}>Đọc</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
