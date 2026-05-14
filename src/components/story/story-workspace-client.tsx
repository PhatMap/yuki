"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Bot, BookOpen, GitBranch, Save, WandSparkles } from "lucide-react";

import {
  branches,
  chapters,
  characters,
  stories,
  worldNotes,
} from "@/lib/mock-data";
import type { Story } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface StoryWorkspaceClientProps {
  storyId: string;
}

const localStoriesKey = "ai-story-app:stories";
const emptyStories: Story[] = [];
let cachedSerializedStories = "";
let cachedLocalStories: Story[] = emptyStories;

function readLocalStoriesSnapshot() {
  if (typeof window === "undefined") return emptyStories;

  const serializedStories = localStorage.getItem(localStoriesKey) || "[]";

  if (serializedStories === cachedSerializedStories) {
    return cachedLocalStories;
  }

  cachedSerializedStories = serializedStories;

  try {
    const parsedStories = JSON.parse(serializedStories) as Story[];
    cachedLocalStories = Array.isArray(parsedStories)
      ? parsedStories
      : emptyStories;
  } catch {
    cachedLocalStories = emptyStories;
  }

  return cachedLocalStories;
}

function subscribeToLocalStories(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
  };
}

export function StoryWorkspaceClient({ storyId }: StoryWorkspaceClientProps) {
  const localStories = useSyncExternalStore(
    subscribeToLocalStories,
    readLocalStoriesSnapshot,
    () => emptyStories,
  );
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");

  const allStories = useMemo(() => {
    return [...localStories, ...stories];
  }, [localStories]);

  const story = allStories.find((item) => item.id === storyId) ?? stories[0];

  const storyChapters = chapters.filter((item) => item.storyId === story.id);
  const storyCharacters = characters.filter((item) => item.storyId === story.id);
  const storyBranches = branches.filter((item) => item.storyId === story.id);
  const notes = worldNotes.filter((item) => item.storyId === story.id);

  function handleFakeGenerate() {
    setAiResult(
      `Bản nháp AI cho "${story.title}":\n\nDựa trên tone ${story.tone}, AI sẽ viết tiếp một cảnh mới có nhịp truyện phù hợp. Đây hiện là output giả để test UI trước khi tích hợp API thật.`,
    );
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">{story.title}</h1>
            <p className="text-sm text-muted-foreground">
              {story.genre} · {story.tone} ·{" "}
              {story.isFanwork ? "Fanwork" : "Original"}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline">
              <Save className="mr-2 h-4 w-4" />
              Lưu
            </Button>
            <Button onClick={handleFakeGenerate}>
              <WandSparkles className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-4 px-6 py-6 lg:grid-cols-[260px_1fr_320px]">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                Chapters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {storyChapters.length > 0 ? (
                storyChapters.map((chapter) => (
                  <button
                    key={chapter.id}
                    className="w-full rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {chapter.title}
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có chương nào.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GitBranch className="h-4 w-4" />
                Branches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {storyBranches.length > 0 ? (
                storyBranches.map((branch) => (
                  <div
                    key={branch.id}
                    className="rounded-md border bg-background p-3"
                  >
                    <p className="text-sm font-medium">{branch.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {branch.description}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có nhánh truyện.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>

        <section>
          <Card className="min-h-[720px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{storyChapters[0]?.title ?? "Chương mới"}</CardTitle>
                <Badge variant="secondary">Draft</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[560px] resize-none border-0 text-base leading-7 shadow-none focus-visible:ring-0"
                defaultValue={storyChapters[0]?.content}
                placeholder="Bắt đầu viết chương truyện..."
              />

              {aiResult ? (
                <div className="mt-4 rounded-lg border bg-muted/40 p-4">
                  <p className="mb-2 text-sm font-medium">AI Output</p>
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {aiResult}
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4" />
                AI Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="Nhập yêu cầu: viết tiếp, thêm cao trào, sửa đoạn này u tối hơn..."
                className="min-h-28"
              />

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={handleFakeGenerate}>
                  Viết tiếp
                </Button>
                <Button variant="secondary" onClick={handleFakeGenerate}>
                  Viết lại
                </Button>
                <Button variant="secondary" onClick={handleFakeGenerate}>
                  Thêm thoại
                </Button>
                <Button variant="secondary" onClick={handleFakeGenerate}>
                  Tạo nhánh
                </Button>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium">Canon adherence</p>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <button className="rounded-md border bg-background px-3 py-2 text-left">
                    Rất sát bản gốc
                  </button>
                  <button className="rounded-md border bg-background px-3 py-2 text-left">
                    Vừa phải
                  </button>
                  <button className="rounded-md border bg-background px-3 py-2 text-left">
                    Chỉ lấy cảm hứng
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Characters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {storyCharacters.length > 0 ? (
                storyCharacters.map((character) => (
                  <div
                    key={character.id}
                    className="rounded-md border bg-background p-3"
                  >
                    <p className="text-sm font-medium">{character.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {character.role}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có nhân vật.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">World Bible</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-md border bg-background p-3"
                  >
                    <p className="text-sm font-medium">{note.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {note.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có world note.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
