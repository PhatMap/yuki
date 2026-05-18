"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, RotateCcw, Save, Settings } from "lucide-react";

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
import {
  getStoryById,
  getStorySetup,
  saveStorySetup,
  type StorySetupData,
} from "@/lib/db/indexed-db";
import { stories } from "@/lib/mock-data";
import {
  createDefaultStoryLocalSettings,
  getStorySettingsStorageKey,
  readStoryLocalSettings,
  saveStoryLocalSettings,
} from "@/lib/storage/story-settings-storage";
import type { Story, StoryLocalSettings } from "@/lib/types";

interface StorySettingsClientProps {
  storyId: string;
}

function createDefaultSetup(storyId: string): StorySetupData {
  return {
    storyId,
    originalTitle: "",
    originalAuthor: "",
    mustKeep: "",
    mustChange: "",
    updatedAt: new Date().toISOString(),
  };
}

export function StorySettingsClient({ storyId }: StorySettingsClientProps) {
  const [settings, setSettings] = useState<StoryLocalSettings>(() =>
    readStoryLocalSettings(storyId),
  );
  const [story, setStory] = useState<Story | undefined>(() =>
    stories.find((item) => item.id === storyId),
  );
  const [setup, setSetup] = useState<StorySetupData>(() =>
    createDefaultSetup(storyId),
  );
  const [saveMessage, setSaveMessage] = useState("");
  const [setupSaveMessage, setSetupSaveMessage] = useState("");
  const [isSavingSetup, setIsSavingSetup] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStoryData() {
      try {
        const [storedStory, storedSetup] = await Promise.all([
          getStoryById(storyId),
          getStorySetup(storyId),
        ]);

        if (!isMounted) return;

        if (storedStory) {
          setStory(storedStory);
        }

        if (storedSetup) {
          setSetup(storedSetup);
        }
      } catch (error) {
        console.error("Failed to load story settings data", error);
      }
    }

    void loadStoryData();

    return () => {
      isMounted = false;
    };
  }, [storyId]);

  const previewClassName = useMemo(() => {
    const fontSizeClass = {
      small: "text-sm",
      medium: "text-base",
      large: "text-lg",
    }[settings.fontSize];

    const widthClass = {
      compact: "max-w-xl",
      comfortable: "max-w-3xl",
      wide: "max-w-5xl",
    }[settings.readingWidth];

    const densityClass =
      settings.density === "compact" ? "space-y-2" : "space-y-4";

    return `${fontSizeClass} ${widthClass} ${densityClass}`;
  }, [settings.density, settings.fontSize, settings.readingWidth]);

  function updateSettings<K extends keyof StoryLocalSettings>(
    key: K,
    value: StoryLocalSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }));
    setSaveMessage("");
  }

  function updateSetup<K extends keyof StorySetupData>(
    key: K,
    value: StorySetupData[K],
  ) {
    setSetup((current) => ({
      ...current,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }));
    setSetupSaveMessage("");
  }

  function handleSaveSettings() {
    const nextSettings = {
      ...settings,
      storyId,
      updatedAt: new Date().toISOString(),
    };

    saveStoryLocalSettings(nextSettings);
    setSettings(nextSettings);
    setSaveMessage("Đã lưu cài đặt hiển thị.");
  }

  function handleResetSettings() {
    const defaultSettings = createDefaultStoryLocalSettings(storyId);

    saveStoryLocalSettings(defaultSettings);
    setSettings(defaultSettings);
    setSaveMessage("Đã đưa cài đặt về mặc định.");
  }

  async function handleSaveSetup() {
    if (isSavingSetup) return;

    setIsSavingSetup(true);
    setSetupSaveMessage("");

    const nextSetup: StorySetupData = {
      ...setup,
      storyId,
      originalTitle: setup.originalTitle.trim(),
      originalAuthor: setup.originalAuthor.trim(),
      mustKeep: setup.mustKeep.trim(),
      mustChange: setup.mustChange.trim(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveStorySetup(nextSetup);
      setSetup(nextSetup);
      setSetupSaveMessage("Đã lưu thiết lập truyện vào IndexedDB.");
    } catch (error) {
      console.error("Failed to save story setup", error);
      setSetupSaveMessage("Không thể lưu thiết lập truyện.");
    } finally {
      setIsSavingSetup(false);
    }
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Cài đặt truyện"
          title={story?.title ?? "Cài đặt truyện"}
          description="Tùy chỉnh trải nghiệm đọc/viết và ghi chú setup cho truyện hiện tại."
          action={
            <Button asChild variant="outline">
              <Link href={`/stories/${storyId}/workspace`}>
                <BookOpen className="mr-2 h-4 w-4" />
                Mở Workspace
              </Link>
            </Button>
          }
        />

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <SectionCard
              icon={<BookOpen className="h-5 w-5" />}
              title="Cài đặt đọc truyện"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <SettingsSelect
                  label="Cỡ chữ"
                  value={settings.fontSize}
                  onValueChange={(value) =>
                    updateSettings(
                      "fontSize",
                      value as StoryLocalSettings["fontSize"],
                    )
                  }
                  options={[
                    ["small", "Nhỏ"],
                    ["medium", "Vừa"],
                    ["large", "Lớn"],
                  ]}
                />

                <SettingsSelect
                  label="Độ rộng khung đọc"
                  value={settings.readingWidth}
                  onValueChange={(value) =>
                    updateSettings(
                      "readingWidth",
                      value as StoryLocalSettings["readingWidth"],
                    )
                  }
                  options={[
                    ["compact", "Gọn"],
                    ["comfortable", "Thoải mái"],
                    ["wide", "Rộng"],
                  ]}
                />
              </div>
            </SectionCard>

            <SectionCard
              icon={<Settings className="h-5 w-5" />}
              title="Cài đặt Workspace"
            >
              <div className="space-y-5">
                <SettingsSelect
                  label="Mật độ hiển thị"
                  value={settings.density}
                  onValueChange={(value) =>
                    updateSettings(
                      "density",
                      value as StoryLocalSettings["density"],
                    )
                  }
                  options={[
                    ["compact", "Gọn"],
                    ["comfortable", "Thoải mái"],
                  ]}
                />

                <SettingsSwitch
                  checked={settings.showMetadata}
                  description="Hiển thị số chương, trạng thái và thông tin phụ trong các màn hình truyện."
                  label="Hiển thị metadata"
                  onCheckedChange={(value) =>
                    updateSettings("showMetadata", value)
                  }
                />

                <SettingsSwitch
                  checked={settings.autoSaveDrafts}
                  description="Tự lưu bản nháp khi workflow rewrite có hỗ trợ."
                  label="Tự lưu draft"
                  onCheckedChange={(value) =>
                    updateSettings("autoSaveDrafts", value)
                  }
                />
              </div>
            </SectionCard>

            <SectionCard title="Mock AI (test)">
              <SettingsSelect
                label="Chế độ Mock AI"
                value={settings.mockAiMode}
                onValueChange={(value) =>
                  updateSettings(
                    "mockAiMode",
                    value as StoryLocalSettings["mockAiMode"],
                  )
                }
                options={[
                  ["conservative", "Conservative"],
                  ["balanced", "Balanced"],
                  ["creative", "Creative"],
                ]}
              />
            </SectionCard>

            <SectionCard
              title="Thiết lập truyện"
              description="Lưu thông tin nguồn truyện và các ghi chú mustKeep/mustChange."
            >
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="originalTitle">Tên gốc</Label>
                    <Input
                      id="originalTitle"
                      value={setup.originalTitle}
                      onChange={(event) =>
                        updateSetup("originalTitle", event.target.value)
                      }
                      placeholder="Tên tác phẩm gốc"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="originalAuthor">Tác giả gốc</Label>
                    <Input
                      id="originalAuthor"
                      value={setup.originalAuthor}
                      onChange={(event) =>
                        updateSetup("originalAuthor", event.target.value)
                      }
                      placeholder="Tác giả gốc"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mustKeep">mustKeep</Label>
                  <Textarea
                    id="mustKeep"
                    className="min-h-24"
                    value={setup.mustKeep}
                    onChange={(event) =>
                      updateSetup("mustKeep", event.target.value)
                    }
                    placeholder="Những yếu tố cần giữ khi rewrite (nhân vật, quan hệ, sự kiện, tone, luật thế giới...)."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mustChange">mustChange</Label>
                  <Textarea
                    id="mustChange"
                    className="min-h-24"
                    value={setup.mustChange}
                    onChange={(event) =>
                      updateSetup("mustChange", event.target.value)
                    }
                    placeholder="Những điểm cần đổi khi rewrite (plot, canon branch, sự kiện, quan hệ...)."
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={handleSaveSetup}
                    disabled={isSavingSetup}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingSetup ? "Đang lưu..." : "Lưu thiết lập truyện"}
                  </Button>

                  {setupSaveMessage ? (
                    <p className="app-muted-text">{setupSaveMessage}</p>
                  ) : null}
                </div>
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-4">
            <SectionCard title="Xem trước">
              <div className={previewClassName}>
                <p className="font-medium">Xem trước hiển thị</p>
                <p className="text-muted-foreground">
                  Khung này phản ánh cỡ chữ, độ rộng và mật độ hiển thị bạn đã chọn cho truyện này.
                </p>

                {settings.showMetadata ? (
                  <p className="text-sm text-muted-foreground">
                    Metadata: bật / Mock AI: {settings.mockAiMode}
                  </p>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="Lưu cài đặt">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleSaveSettings}>
                    <Save className="mr-2 h-4 w-4" />
                    Lưu settings
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetSettings}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset mặc định
                  </Button>
                </div>

                {saveMessage ? (
                  <p className="app-muted-text">{saveMessage}</p>
                ) : null}
              </div>
            </SectionCard>

            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Chi tiết kỹ thuật
              </summary>
              <div className="mt-3 space-y-3">
                <p className="app-muted-text">
                  UI settings key:{" "}
                  <span className="font-mono">
                    {getStorySettingsStorageKey(storyId)}
                  </span>
                </p>

                <p className="app-muted-text">
                  Story setup store:{" "}
                  <span className="font-mono">IndexedDB storySetups</span>
                </p>

                <p className="app-muted-text">
                  Settings updated:{" "}
                  {settings.updatedAt
                    ? new Date(settings.updatedAt).toLocaleString()
                    : "Chưa lưu"}
                </p>

                <p className="app-muted-text">
                  Setup updated:{" "}
                  {setup.updatedAt
                    ? new Date(setup.updatedAt).toLocaleString()
                    : "Chưa lưu"}
                </p>
              </div>
            </details>
          </aside>
        </section>
      </PageContainer>
    </PageShell>
  );
}

function SettingsSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SettingsSwitch({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4">
      <div className="min-w-0">
        <Label>{label}</Label>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <Switch
        checked={checked}
        className="shrink-0"
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
