"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, RotateCcw, Save, Settings } from "lucide-react";

import { stories } from "@/lib/mock-data";
import type { Story, StoryLocalSettings } from "@/lib/types";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StoryNavigation } from "@/components/app/story-navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface StorySettingsClientProps {
  storyId: string;
}

const settingsStorageKey = (storyId: string) =>
  `ai-story-app:settings:${storyId}`;
const storiesStorageKey = "ai-story-app:stories";

function createDefaultSettings(storyId: string): StoryLocalSettings {
  return {
    storyId,
    fontSize: "medium",
    readingWidth: "comfortable",
    density: "comfortable",
    showMetadata: true,
    autoSaveDrafts: true,
    mockAiMode: "balanced",
    updatedAt: new Date().toISOString(),
  };
}

function readJsonValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const parsedValue = JSON.parse(localStorage.getItem(key) || "") as T;

    return parsedValue ?? fallback;
  } catch {
    return fallback;
  }
}

function readLocalStory(storyId: string) {
  return readJsonValue<Story[]>(storiesStorageKey, []).find(
    (story) => story.id === storyId,
  );
}

function readLocalSettings(storyId: string) {
  return readJsonValue<StoryLocalSettings>(
    settingsStorageKey(storyId),
    createDefaultSettings(storyId),
  );
}

function saveLocalSettings(settings: StoryLocalSettings) {
  localStorage.setItem(
    settingsStorageKey(settings.storyId),
    JSON.stringify(settings),
  );
}

export function StorySettingsClient({ storyId }: StorySettingsClientProps) {
  const [settings, setSettings] = useState<StoryLocalSettings>(() =>
    readLocalSettings(storyId),
  );
  const [story] = useState<Story | undefined>(() =>
    readLocalStory(storyId) ?? stories.find((item) => item.id === storyId),
  );
  const [saveMessage, setSaveMessage] = useState("");

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

  function handleSaveSettings() {
    const nextSettings = {
      ...settings,
      storyId,
      updatedAt: new Date().toISOString(),
    };

    saveLocalSettings(nextSettings);
    setSettings(nextSettings);
    setSaveMessage("Settings saved locally.");
  }

  function handleResetSettings() {
    const defaultSettings = createDefaultSettings(storyId);

    saveLocalSettings(defaultSettings);
    setSettings(defaultSettings);
    setSaveMessage("Settings reset to defaults.");
  }

  return (
    <PageShell
      data-density={settings.density}
      data-font-size={settings.fontSize}
      data-reading-width={settings.readingWidth}
    >
      <PageContainer>
        <PageHeader
          eyebrow="Story Settings"
          title={story?.title ?? "Story Settings"}
          description="Local reading, workspace, and mock AI preferences for this story."
          action={
            <Button asChild variant="outline">
              <Link href={`/stories/${storyId}/workspace`}>
                <BookOpen className="mr-2 h-4 w-4" />
                Open Workspace
              </Link>
            </Button>
          }
        />

        <StoryNavigation storyId={storyId} />

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <SectionCard
                icon={<BookOpen className="h-5 w-5" />}
                title="Reading preferences"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <SettingsSelect
                    label="Font size"
                    value={settings.fontSize}
                    onValueChange={(value) =>
                      updateSettings(
                        "fontSize",
                        value as StoryLocalSettings["fontSize"],
                      )
                    }
                    options={[
                      ["small", "Small"],
                      ["medium", "Medium"],
                      ["large", "Large"],
                    ]}
                  />
                  <SettingsSelect
                    label="Reading width"
                    value={settings.readingWidth}
                    onValueChange={(value) =>
                      updateSettings(
                        "readingWidth",
                        value as StoryLocalSettings["readingWidth"],
                      )
                    }
                    options={[
                      ["compact", "Compact"],
                      ["comfortable", "Comfortable"],
                      ["wide", "Wide"],
                    ]}
                  />
                </div>
              </SectionCard>

              <SectionCard
                icon={<Settings className="h-5 w-5" />}
                title="Workspace preferences"
              >
                <div className="space-y-5">
                  <SettingsSelect
                    label="Workspace density"
                    value={settings.density}
                    onValueChange={(value) =>
                      updateSettings(
                        "density",
                        value as StoryLocalSettings["density"],
                      )
                    }
                    options={[
                      ["compact", "Compact"],
                      ["comfortable", "Comfortable"],
                    ]}
                  />
                  <SettingsSwitch
                    checked={settings.showMetadata}
                    description="Show chapter counts, statuses, and other supporting labels where available."
                    label="Show metadata"
                    onCheckedChange={(value) =>
                      updateSettings("showMetadata", value)
                    }
                  />
                  <SettingsSwitch
                    checked={settings.autoSaveDrafts}
                    description="Keep this preference ready for draft workflows that support auto-save."
                    label="Auto-save drafts"
                    onCheckedChange={(value) =>
                      updateSettings("autoSaveDrafts", value)
                    }
                  />
                </div>
              </SectionCard>

              <SectionCard title="Mock AI behavior">
                <SettingsSelect
                  label="Mock AI mode"
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
            </div>

            <aside className="space-y-4">
              <SectionCard title="Preview">
                <div className={previewClassName}>
                  <p className="font-medium">Reading preview</p>
                  <p className="text-muted-foreground">
                    This preview reflects the selected font size, reading width,
                    and density for this story. Broader application of these
                    settings can be layered into editor surfaces without changing
                    storage.
                  </p>
                  {settings.showMetadata ? (
                    <p className="text-sm text-muted-foreground">
                      Metadata visible / Mock AI: {settings.mockAiMode}
                    </p>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard title="Local storage">
                <div className="space-y-3">
                  <p className="app-muted-text">
                    Stored at{" "}
                    <span className="font-mono">
                      ai-story-app:settings:{storyId}
                    </span>
                  </p>
                  <p className="app-muted-text">
                    Last updated:{" "}
                    {settings.updatedAt
                      ? new Date(settings.updatedAt).toLocaleString()
                      : "Not saved yet"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleSaveSettings}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Settings
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetSettings}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset to Defaults
                    </Button>
                  </div>
                  {saveMessage ? (
                    <p className="app-muted-text">{saveMessage}</p>
                  ) : null}
                </div>
              </SectionCard>
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
      <div>
        <Label>{label}</Label>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
