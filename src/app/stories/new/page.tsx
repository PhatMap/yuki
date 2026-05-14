"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";

import type { CanonAdherence, Story, StoryGenre, StoryTone } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface CreateStoryForm {
  title: string;
  description: string;
  genre: StoryGenre;
  tone: StoryTone;
  canonAdherence: CanonAdherence;
  isFanwork: boolean;
  originalTitle: string;
  originalAuthor: string;
  mustKeep: string;
  mustChange: string;
}

const initialForm: CreateStoryForm = {
  title: "",
  description: "",
  genre: "fantasy",
  tone: "epic",
  canonAdherence: "inspired-only",
  isFanwork: false,
  originalTitle: "",
  originalAuthor: "",
  mustKeep: "",
  mustChange: "",
};

export default function NewStoryPage() {
  const router = useRouter();
  const [form, setForm] = useState<CreateStoryForm>(initialForm);

  function updateForm<K extends keyof CreateStoryForm>(
    key: K,
    value: CreateStoryForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const storyId = `story-${Date.now()}`;
    const now = new Date().toISOString();

    const newStory: Story = {
      id: storyId,
      title: form.title.trim() || "Truyện chưa đặt tên",
      description: form.description.trim(),
      genre: form.genre,
      tone: form.tone,
      canonAdherence: form.canonAdherence,
      isFanwork: form.isFanwork,
      createdAt: now,
      updatedAt: now,
    };

    const existingStories = JSON.parse(
      localStorage.getItem("ai-story-app:stories") || "[]",
    ) as Story[];

    localStorage.setItem(
      "ai-story-app:stories",
      JSON.stringify([newStory, ...existingStories]),
    );

    const projectSetup = {
      storyId,
      originalTitle: form.originalTitle,
      originalAuthor: form.originalAuthor,
      mustKeep: form.mustKeep,
      mustChange: form.mustChange,
    };

    localStorage.setItem(
      `ai-story-app:story-setup:${storyId}`,
      JSON.stringify(projectSetup),
    );

    router.push(`/stories/${storyId}/workspace`);
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          type="button"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại
        </Button>

        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Create Story
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Tạo project truyện mới
          </h1>
          <p className="mt-3 text-muted-foreground">
            Nhập thông tin cơ bản để AI có thể tạo outline, chương đầu hoặc
            viết tiếp theo đúng gu của bạn.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin truyện</CardTitle>
          </CardHeader>

          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="title">Tên truyện</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Ví dụ: Thiên Kiếm Lưu Vân"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Ý tưởng / mô tả ngắn</Label>
                <Textarea
                  id="description"
                  className="min-h-28"
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                  placeholder="Mô tả bối cảnh, nhân vật chính, xung đột hoặc hướng truyện bạn muốn..."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Thể loại</Label>
                  <Select
                    value={form.genre}
                    onValueChange={(value) =>
                      updateForm("genre", value as StoryGenre)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fantasy">Fantasy</SelectItem>
                      <SelectItem value="xianxia">Tiên hiệp</SelectItem>
                      <SelectItem value="romance">Ngôn tình</SelectItem>
                      <SelectItem value="action">Hành động</SelectItem>
                      <SelectItem value="horror">Kinh dị</SelectItem>
                      <SelectItem value="mystery">Trinh thám</SelectItem>
                      <SelectItem value="school">Học đường</SelectItem>
                      <SelectItem value="sci-fi">Khoa học viễn tưởng</SelectItem>
                      <SelectItem value="adventure">Phiêu lưu</SelectItem>
                      <SelectItem value="comedy">Hài</SelectItem>
                      <SelectItem value="tragedy">Bi kịch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Giọng văn</Label>
                  <Select
                    value={form.tone}
                    onValueChange={(value) =>
                      updateForm("tone", value as StoryTone)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="funny">Hài hước</SelectItem>
                      <SelectItem value="dark">U tối</SelectItem>
                      <SelectItem value="romantic">Lãng mạn</SelectItem>
                      <SelectItem value="tragic">Bi thương</SelectItem>
                      <SelectItem value="dramatic">Kịch tính</SelectItem>
                      <SelectItem value="soft">Nhẹ nhàng</SelectItem>
                      <SelectItem value="epic">Sử thi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Mức bám sát bản gốc</Label>
                  <Select
                    value={form.canonAdherence}
                    onValueChange={(value) =>
                      updateForm("canonAdherence", value as CanonAdherence)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="very-close">Rất sát</SelectItem>
                      <SelectItem value="moderate">Vừa phải</SelectItem>
                      <SelectItem value="inspired-only">
                        Chỉ lấy cảm hứng
                      </SelectItem>
                      <SelectItem value="completely-different">
                        Hoàn toàn khác
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Đây là fanwork / đồng nhân?</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Bật nếu truyện dựa trên tác phẩm, nhân vật hoặc thế giới
                      đã có.
                    </p>
                  </div>

                  <Switch
                    checked={form.isFanwork}
                    onCheckedChange={(value) => updateForm("isFanwork", value)}
                  />
                </div>
              </div>

              {form.isFanwork ? (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="originalTitle">Tên tác phẩm gốc</Label>
                      <Input
                        id="originalTitle"
                        value={form.originalTitle}
                        onChange={(event) =>
                          updateForm("originalTitle", event.target.value)
                        }
                        placeholder="Ví dụ: tên truyện gốc"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="originalAuthor">Tác giả gốc</Label>
                      <Input
                        id="originalAuthor"
                        value={form.originalAuthor}
                        onChange={(event) =>
                          updateForm("originalAuthor", event.target.value)
                        }
                        placeholder="Ví dụ: tên tác giả"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="mustKeep">Tình tiết muốn giữ</Label>
                    <Textarea
                      id="mustKeep"
                      value={form.mustKeep}
                      onChange={(event) =>
                        updateForm("mustKeep", event.target.value)
                      }
                      placeholder="Nhân vật, quan hệ, sự kiện, thế giới hoặc tone cần giữ..."
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="mustChange">Tình tiết muốn thay đổi</Label>
                    <Textarea
                      id="mustChange"
                      value={form.mustChange}
                      onChange={(event) =>
                        updateForm("mustChange", event.target.value)
                      }
                      placeholder="Những điểm bạn muốn sửa, rẽ nhánh, viết lại hoặc thay thế..."
                    />
                  </div>

                  <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    Nội dung fanwork là bản sáng tạo không chính thức, không đại
                    diện cho tác giả gốc hoặc đơn vị sở hữu bản quyền.
                  </p>
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Tạo project truyện
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
