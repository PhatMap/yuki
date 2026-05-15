"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

interface StorySettingsProviderProps {
  storyId: string;
  children: ReactNode;
}

type StoryFontSize = "small" | "medium" | "large";
type StoryReadingWidth = "compact" | "comfortable" | "wide";
type StoryDensity = "compact" | "comfortable";

interface StoredStorySettings {
  fontSize?: StoryFontSize;
  readingWidth?: StoryReadingWidth;
  density?: StoryDensity;
  showMetadata?: boolean;
  autoSaveDrafts?: boolean;
  mockAiMode?: string;
  updatedAt?: string;
}

const settingsStorageKeyPrefix = "ai-story-app:settings";
const settingsStorageEvent = "yuki-story-settings-storage-change";

const defaultSettings: Required<
  Pick<StoredStorySettings, "fontSize" | "readingWidth" | "density">
> = {
  fontSize: "medium",
  readingWidth: "comfortable",
  density: "comfortable",
};

function getSettingsStorageKey(storyId: string) {
  return `${settingsStorageKeyPrefix}:${storyId}`;
}

function isFontSize(value: unknown): value is StoryFontSize {
  return value === "small" || value === "medium" || value === "large";
}

function isReadingWidth(value: unknown): value is StoryReadingWidth {
  return value === "compact" || value === "comfortable" || value === "wide";
}

function isDensity(value: unknown): value is StoryDensity {
  return value === "compact" || value === "comfortable";
}

function readStorySettings(storyId: string) {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const rawValue = localStorage.getItem(getSettingsStorageKey(storyId));

    if (!rawValue) return defaultSettings;

    const parsedValue = JSON.parse(rawValue) as StoredStorySettings;

    return {
      fontSize: isFontSize(parsedValue.fontSize)
        ? parsedValue.fontSize
        : defaultSettings.fontSize,
      readingWidth: isReadingWidth(parsedValue.readingWidth)
        ? parsedValue.readingWidth
        : defaultSettings.readingWidth,
      density: isDensity(parsedValue.density)
        ? parsedValue.density
        : defaultSettings.density,
    };
  } catch (error) {
    console.error("Failed to read story settings from localStorage", error);

    return defaultSettings;
  }
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
  const settings = useSyncExternalStore(
    subscribeToStorySettings,
    () => readStorySettings(storyId),
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
      data-story-font-size={settings.fontSize}
      data-story-reading-width={settings.readingWidth}
      data-story-density={settings.density}
    >
      {children}
    </div>
  );
}
