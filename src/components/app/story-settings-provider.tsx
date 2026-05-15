"use client";

import type { ReactNode } from "react";
import { useMemo, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";
import type { StoryLocalSettings } from "@/lib/types";

interface StorySettingsProviderProps {
  storyId: string;
  children: ReactNode;
}

type StoryDisplaySettings = Pick<
  StoryLocalSettings,
  | "fontSize"
  | "readingWidth"
  | "density"
  | "showMetadata"
  | "autoSaveDrafts"
  | "mockAiMode"
>;

const settingsStorageKeyPrefix = "ai-story-app:settings";
const settingsStorageEvent = "yuki-story-settings-storage-change";

const defaultSettings: StoryDisplaySettings = {
  fontSize: "medium",
  readingWidth: "comfortable",
  density: "comfortable",
  showMetadata: true,
  autoSaveDrafts: true,
  mockAiMode: "balanced",
};

const cachedSnapshots = new Map<
  string,
  {
    rawValue: string | null;
    settings: StoryDisplaySettings;
  }
>();

function getSettingsStorageKey(storyId: string) {
  return `${settingsStorageKeyPrefix}:${storyId}`;
}

function isFontSize(value: unknown): value is StoryDisplaySettings["fontSize"] {
  return value === "small" || value === "medium" || value === "large";
}

function isReadingWidth(
  value: unknown,
): value is StoryDisplaySettings["readingWidth"] {
  return value === "compact" || value === "comfortable" || value === "wide";
}

function isDensity(value: unknown): value is StoryDisplaySettings["density"] {
  return value === "compact" || value === "comfortable";
}

function isMockAiMode(
  value: unknown,
): value is StoryDisplaySettings["mockAiMode"] {
  return (
    value === "conservative" || value === "balanced" || value === "creative"
  );
}

function normalizeStorySettings(value: unknown): StoryDisplaySettings {
  if (!value || typeof value !== "object") return defaultSettings;

  const candidate = value as Partial<StoryLocalSettings>;

  return {
    fontSize: isFontSize(candidate.fontSize)
      ? candidate.fontSize
      : defaultSettings.fontSize,
    readingWidth: isReadingWidth(candidate.readingWidth)
      ? candidate.readingWidth
      : defaultSettings.readingWidth,
    density: isDensity(candidate.density)
      ? candidate.density
      : defaultSettings.density,
    showMetadata:
      typeof candidate.showMetadata === "boolean"
        ? candidate.showMetadata
        : defaultSettings.showMetadata,
    autoSaveDrafts:
      typeof candidate.autoSaveDrafts === "boolean"
        ? candidate.autoSaveDrafts
        : defaultSettings.autoSaveDrafts,
    mockAiMode: isMockAiMode(candidate.mockAiMode)
      ? candidate.mockAiMode
      : defaultSettings.mockAiMode,
  };
}

function readStorySettingsSnapshot(storyId: string): StoryDisplaySettings {
  if (typeof window === "undefined") return defaultSettings;

  const storageKey = getSettingsStorageKey(storyId);
  const rawValue = localStorage.getItem(storageKey);
  const cachedSnapshot = cachedSnapshots.get(storageKey);

  if (cachedSnapshot && cachedSnapshot.rawValue === rawValue) {
    return cachedSnapshot.settings;
  }

  let parsedValue: unknown;

  try {
    parsedValue = rawValue ? JSON.parse(rawValue) : undefined;
  } catch (error) {
    console.error("Failed to read story settings from localStorage", error);
  }

  const settings = normalizeStorySettings(parsedValue);

  cachedSnapshots.set(storageKey, {
    rawValue,
    settings,
  });

  return settings;
}

function subscribeToStorySettings(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorageChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(settingsStorageEvent, handleStorageChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(settingsStorageEvent, handleStorageChange);
  };
}

export function notifyStorySettingsChanged() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(settingsStorageEvent));
}

export function StorySettingsProvider({
  storyId,
  children,
}: StorySettingsProviderProps) {
  const getSnapshot = useMemo(
    () => () => readStorySettingsSnapshot(storyId),
    [storyId],
  );

  const settings = useSyncExternalStore(
    subscribeToStorySettings,
    getSnapshot,
    () => defaultSettings,
  );

  return (
    <div
      className={cn(
        "app-story-settings-scope",
        `app-story-font-${settings.fontSize}`,
        `app-story-width-${settings.readingWidth}`,
        `app-story-density-${settings.density}`,
      )}
      data-story-auto-save-drafts={String(settings.autoSaveDrafts)}
      data-story-density={settings.density}
      data-story-font-size={settings.fontSize}
      data-story-mock-ai-mode={settings.mockAiMode}
      data-story-reading-width={settings.readingWidth}
      data-story-show-metadata={String(settings.showMetadata)}
    >
      {children}
    </div>
  );
}
