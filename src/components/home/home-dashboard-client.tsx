"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Database,
  FileUp,
  Library,
  PenLine,
  Settings,
  Sparkles,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllStories } from "@/lib/db/indexed-db";
import { stories as mockStories } from "@/lib/mock-data";
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
  if (source === "indexeddb") return "IndexedDB";

  return "Starter";
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

  const { storedItems, starterItems, allItems } = useMemo(
    () => mergeHomeStories(storedStories),
    [storedStories],
  );

  const primaryStory = allItems[0];

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Yuki"
          title="Không gian viết truyện local-first"
          description="Yuki lưu truyện trong IndexedDB trên browser này. Nhập truyện, phân tích bằng Gemini Proxy, và quản lý backup qua Data Health."
          action={
            <>
              <Button asChild>
                <Link href="/stories/import">
                  <FileUp className="mr-2 h-4 w-4" />
                  Nhập truyện
                </Link>
              </Button>

              {primaryStory ? (
                <Button asChild variant="outline">
                  <Link href={`/stories/${primaryStory.id}`}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Mở truyện mới nhất
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Library className="h-4 w-4" />}
            title="Truyện cục bộ"
            value={storedItems.length.toLocaleString("vi-VN")}
            description="Metadata truyện tải từ IndexedDB."
          />
          <StatCard
            icon={<Database className="h-4 w-4" />}
            title="IndexedDB storage"
            value="Local"
            description="Truyện và dữ liệu analysis nằm cục bộ trong browser."
          />
          <StatCard
            icon={<BarChart3 className="h-4 w-4" />}
            title="Gemini Core"
            value="Proxy"
            description="Đường real-AI khuyến nghị qua /api/ai/gemini."
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            title="Backup readiness"
            value="Data Health"
            description="Có kiểm tra backup/restore theo từng truyện."
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <SectionCard
            title="Yuki Workflow"
            description="Flow local-first khuyến nghị cho dự án truyện dài."
          >
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Nhập truyện</li>
              <li>Phân tích bằng Gemini Proxy</li>
              <li>Kiểm tra Data Health và backup</li>
              <li>Đọc tiếp / lập kế hoạch / rewrite</li>
            </ol>
          </SectionCard>

          <SectionCard
            title="Thao tác nhanh"
            description="Dùng workflow local-first hiện tại. Backend, Supabase, vector DB và roleplay vẫn đang nằm ngoài active scope."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <HomeActionCard
                title="Nhập truyện dài"
                description="Nạp các chương có sẵn vào Yuki workspace cục bộ."
                href="/stories/import"
                icon={<FileUp className="h-5 w-5" />}
              />

              {primaryStory ? (
                <>
                  <HomeActionCard
                    title="Mở workspace"
                    description="Tiếp tục từ truyện local hoặc starter mới nhất."
                    href={`/stories/${primaryStory.id}/workspace`}
                    icon={<BookOpen className="h-5 w-5" />}
                  />
                  <HomeActionCard
                    title="Mở analysis"
                    description="Chạy analysis hoặc kiểm tra provider đã chọn."
                    href={`/stories/${primaryStory.id}/analysis`}
                    icon={<BarChart3 className="h-5 w-5" />}
                  />
                  <HomeActionCard
                    title="Mở settings"
                    description="Chỉnh độ rộng đọc, mật độ, cỡ chữ và local preferences."
                    href={`/stories/${primaryStory.id}/settings`}
                    icon={<Settings className="h-5 w-5" />}
                  />
                </>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Định hướng hiện tại">
            <div className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                UI/UX polish là ưu tiên hiện tại trước khi thêm AI hoặc backend
                mới.
              </p>
              <p>
                Các trang theo truyện đã dùng shared shell, navigation cố định,
                local display settings và responsive polish.
              </p>
              <p>
                Trọng tâm kỹ thuật tiếp theo vẫn nên là đọc, chỉnh sửa và điều
                hướng thoải mái hơn.
              </p>
            </div>
          </SectionCard>
        </section>

        <SectionCard
          title="Truyện đã lưu"
          description="Truyện đã lưu trong IndexedDB trên browser này."
        >
          {storedItems.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {storedItems.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có truyện local"
              description="Nhập truyện để tạo chapter/chunk trong IndexedDB cho bước analysis."
              action={
                <Button asChild>
                  <Link href="/stories/import">
                    <FileUp className="mr-2 h-4 w-4" />
                    Nhập truyện
                  </Link>
                </Button>
              }
            />
          )}
        </SectionCard>

        {starterItems.length > 0 ? (
          <SectionCard
            title="Truyện starter"
            description="Mock stories để test Yuki flow khi chưa import truyện mới."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {starterItems.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          </SectionCard>
        ) : null}
      </PageContainer>
    </PageShell>
  );
}

function HomeActionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}) {
  return (
    <Link href={href} className="app-link-card">
      <div className="flex items-start gap-3">
        <div className="app-dashboard-card-icon">{icon}</div>

        <div className="min-w-0">
          <h2 className="app-link-card-title">{title}</h2>
          <p className="app-link-card-description">{description}</p>
        </div>
      </div>
    </Link>
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

        <div className="app-chip-row">
          {"genre" in story && story.genre ? (
            <span className="app-chip">{story.genre}</span>
          ) : null}
          {"tone" in story && story.tone ? (
            <span className="app-chip">{story.tone}</span>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild size="sm">
            <Link href={`/stories/${story.id}/workspace`}>
              <PenLine className="mr-2 h-4 w-4" />
              Mở Workspace
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline">
            <Link href={`/stories/${story.id}/analysis`}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Analysis
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
