"use client";

import type { ReactNode } from "react";
import { useMemo, useSyncExternalStore } from "react";

import {
  defaultStoryDisplaySettings,
  readStoryDisplaySettingsSnapshot,
  subscribeToStorySettings,
} from "@/lib/storage/story-settings-storage";
import { cn } from "@/lib/utils";

interface StorySettingsProviderProps {
  storyId: string;
  children: ReactNode;
}

export function StorySettingsProvider({
  storyId,
  children,
}: StorySettingsProviderProps) {
  const getSnapshot = useMemo(
    () => () => readStoryDisplaySettingsSnapshot(storyId),
    [storyId],
  );

  const settings = useSyncExternalStore(
    subscribeToStorySettings,
    getSnapshot,
    () => defaultStoryDisplaySettings,
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
