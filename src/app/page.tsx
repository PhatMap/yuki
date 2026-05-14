import Link from "next/link";
import {
  BookOpen,
  Bot,
  FileUp,
  Library,
  MessageCircle,
  PenLine,
  Sparkles,
} from "lucide-react";

import { stories } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const actions = [
  {
    title: "Tạo truyện mới",
    description: "Tạo concept, nhân vật, thế giới và chương đầu.",
    href: "/stories/new",
    icon: Sparkles,
  },
  {
    title: "Import truyện có sẵn",
    description: "Nạp truyện dài để phân tích chương, timeline và văn phong.",
    href: "/stories/import",
    icon: FileUp,
  },
  {
    title: "Viết tiếp truyện",
    description: "Tạo chương mới cho truyện đang dang dở hoặc fanwork.",
    href: "/stories/story-1/workspace",
    icon: PenLine,
  },
  {
    title: "Nhập vai nhân vật",
    description: "Trò chuyện hoặc nhập vai trong thế giới truyện.",
    href: "/roleplay",
    icon: MessageCircle,
  },
  {
    title: "Thư viện của tôi",
    description: "Quản lý truyện, nhân vật, world bible và nhánh truyện.",
    href: "/stories",
    icon: Library,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-muted/30">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              AI Story Companion
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Studio sáng tác truyện bằng AI
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Tạo truyện mới, viết tiếp truyện đang dang dở, viết fanfiction,
              nhập vai nhân vật và quản lý thế giới truyện trong một workspace.
            </p>
          </div>

          <Button asChild>
            <Link href="/dashboard">
              <Bot className="mr-2 h-4 w-4" />
              Bắt đầu
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Link key={action.title} href={action.href}>
                <Card className="h-full transition hover:shadow-md">
                  <CardHeader>
                    <Icon className="mb-3 h-6 w-6 text-primary" />
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Truyện gần đây</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {stories.map((story) => (
              <Card key={story.id}>
                <CardHeader>
                  <CardTitle>{story.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {story.description}
                  </p>
                  <Button asChild variant="secondary">
                    <Link href={`/stories/${story.id}/workspace`}>
                      Mở workspace
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
