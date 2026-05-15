"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, RotateCcw, Save, Settings } from "lucide-react";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { notifyStorySettingsChanged } from "@/components/app/story-settings-provider";
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
import { readJsonFromLocalStorage } from "@/lib/storage/safe-local-storage";
import type { Story, StoryLocalSettings } from "@/lib/types";

interface StorySettingsClientProps {
  storyId: string;
}

const settingsStorageKey = (storyId: string) =>
  `ai-story-app:settings:${storyId}`;

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

function readLocalSettings(storyId: string) {
  return readJsonFromLocalStorage<StoryLocalSettings>(
    settingsStorageKey(storyId),
    createDefaultSettings(storyId),
  );
}

function saveLocalSettings(settings: StoryLocalSettings) {
  localStorage.setItem(
    settingsStorageKey(settings.storyId),
    JSON.stringify(settings),
  );
  notifyStorySettingsChanged();
}

export function StorySettingsClient({ storyId }: StorySettingsClientProps) {
  const [settings, setSettings] = useState<StoryLocalSettings>(() =>
    readLocalSettings(storyId),
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
      setSetupSaveMessage("Story setup saved to IndexedDB.");
    } catch (error) {
      console.error("Failed to save story setup", error);
      setSetupSaveMessage("Failed to save story setup.");
    } finally {
      setIsSavingSetup(false);
    }
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Story Settings"
          title={story?.title ?? "Story Settings"}
          description="Local reading preferences and IndexedDB-backed story setup data."
          action={
            <Button asChild variant="outline">
              <Link href={`/stories/${storyId}/workspace`}>
                <BookOpen className="mr-2 h-4 w-4" />
                Open Workspace
              </Link>
            </Button>
          }
        />

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

            <SectionCard
              title="Story setup"
              description="Fanwork/source setup is stored in IndexedDB, not localStorage."
            >
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="originalTitle">Original title</Label>
                    <Input
                      id="originalTitle"
                      value={setup.originalTitle}
                      onChange={(event) =>
                        updateSetup("originalTitle", event.target.value)
                      }
                      placeholder="Original work title"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="originalAuthor">Original author</Label>
                    <Input
                      id="originalAuthor"
                      value={setup.originalAuthor}
                      onChange={(event) =>
                        updateSetup("originalAuthor", event.target.value)
                      }
                      placeholder="Original author"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mustKeep">Must keep</Label>
                  <Textarea
                    id="mustKeep"
                    className="min-h-24"
                    value={setup.mustKeep}
                    onChange={(event) =>
                      updateSetup("mustKeep", event.target.value)
                    }
                    placeholder="Characters, relationships, events, tone, or world rules that should be preserved."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mustChange">Must change</Label>
                  <Textarea
                    id="mustChange"
                    className="min-h-24"
                    value={setup.mustChange}
                    onChange={(event) =>
                      updateSetup("mustChange", event.target.value)
                    }
                    placeholder="Plot points, canon branches, events, or relationships that should be changed."
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={handleSaveSetup}
                    disabled={isSavingSetup}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingSetup ? "Saving..." : "Save Story Setup"}
                  </Button>

                  {setupSaveMessage ? (
                    <p className="app-muted-text">{setupSaveMessage}</p>
                  ) : null}
                </div>
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-4">
            <SectionCard title="Preview">
              <div className={previewClassName}>
                <p className="font-medium">Reading preview</p>
                <p className="text-muted-foreground">
                  This preview reflects the selected font size, reading width,
                  and density for this story. The saved settings also apply to
                  the shared story workspace shell.
                </p>

                {settings.showMetadata ? (
                  <p className="text-sm text-muted-foreground">
                    Metadata visible / Mock AI: {settings.mockAiMode}
                  </p>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="Storage">
              <div className="space-y-3">
                <p className="app-muted-text">
                  UI settings:{" "}
                  <span className="font-mono">
                    ai-story-app:settings:{storyId}
                  </span>
                </p>

                <p className="app-muted-text">
                  Story setup:{" "}
                  <span className="font-mono">IndexedDB storySetups</span>
                </p>

                <p className="app-muted-text">
                  Settings updated:{" "}
                  {settings.updatedAt
                    ? new Date(settings.updatedAt).toLocaleString()
                    : "Not saved yet"}
                </p>

                <p className="app-muted-text">
                  Setup updated:{" "}
                  {setup.updatedAt
                    ? new Date(setup.updatedAt).toLocaleString()
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
