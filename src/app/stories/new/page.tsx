"use client";

import { type FormEvent, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
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
import { saveStory } from "@/lib/db/indexed-db";
import type { CanonAdherence, Story, StoryGenre, StoryTone } from "@/lib/types";

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
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function updateForm<K extends keyof CreateStoryForm>(
    key: K,
    value: CreateStoryForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) return;

    setIsSaving(true);
    setErrorMessage("");

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

    try {
      await saveStory(newStory, {
        storyId,
        originalTitle: form.originalTitle.trim(),
        originalAuthor: form.originalAuthor.trim(),
        mustKeep: form.mustKeep.trim(),
        mustChange: form.mustChange.trim(),
        updatedAt: now,
      });

      router.push(`/stories/${storyId}/workspace`);
    } catch (error) {
      console.error("Failed to save story setup to IndexedDB", error);
      setErrorMessage("Không thể lưu truyện mới vào IndexedDB.");
      setIsSaving(false);
    }
  }

  return (
    <PageShell>
      <PageContainer className="max-w-4xl">
        <PageHeader
          eyebrow="Tùy chọn"
          title="Tạo truyện trống"
          description="Dùng khi bạn muốn bắt đầu từ ý tưởng mới. Nếu đã có truyện dài, hãy dùng Nhập truyện."
          action={
            <Button variant="ghost" type="button" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
          }
        />

        {errorMessage ? (
          <section className="app-warning-box border-destructive/40 bg-destructive/10 text-destructive">
            {errorMessage}
          </section>
        ) : null}

        <SectionCard
          title="Thông tin ban đầu"
          description="Tạo một workspace trống để viết, ghi chú canon hoặc chuẩn bị rewrite."
        >
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
                placeholder="Bối cảnh, nhân vật chính, xung đột hoặc hướng truyện bạn muốn..."
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
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
                <Label>Mức bám canon</Label>
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

            <div className="rounded-xl border bg-muted/40 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label>Fanwork / đồng nhân</Label>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Bật nếu truyện dựa trên tác phẩm, nhân vật hoặc thế giới đã có.
                  </p>
                </div>

                <Switch
                  checked={form.isFanwork}
                  onCheckedChange={(value) => updateForm("isFanwork", value)}
                />
              </div>
            </div>

            {form.isFanwork ? (
              <section className="space-y-4 rounded-xl border p-4">
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
                  <Label htmlFor="mustKeep">Cần giữ</Label>
                  <Textarea
                    id="mustKeep"
                    value={form.mustKeep}
                    onChange={(event) =>
                      updateForm("mustKeep", event.target.value)
                    }
                    placeholder="Nhân vật, quan hệ, sự kiện, world hoặc tone cần giữ..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mustChange">Cần đổi</Label>
                  <Textarea
                    id="mustChange"
                    value={form.mustChange}
                    onChange={(event) =>
                      updateForm("mustChange", event.target.value)
                    }
                    placeholder="Điểm muốn sửa, rẽ nhánh, viết lại hoặc thay thế..."
                  />
                </div>
              </section>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                <Sparkles className="mr-2 h-4 w-4" />
                {isSaving ? "Đang lưu..." : "Tạo truyện trống"}
              </Button>
            </div>
          </form>
        </SectionCard>
      </PageContainer>
    </PageShell>
  );
}
