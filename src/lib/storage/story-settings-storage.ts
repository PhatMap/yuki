import type { StoryLocalSettings } from "@/lib/types";

export type StoryDisplaySettings = Pick<
  StoryLocalSettings,
  | "fontSize"
  | "readingWidth"
  | "density"
  | "showMetadata"
  | "autoSaveDrafts"
  | "mockAiMode"
>;

const settingsStorageKeyPrefix = "ai-story-app:settings";
export const storySettingsStorageEvent = "yuki-story-settings-storage-change";

export const defaultStoryDisplaySettings: StoryDisplaySettings = {
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

export function getStorySettingsStorageKey(storyId: string) {
  return `${settingsStorageKeyPrefix}:${storyId}`;
}

export function createDefaultStoryLocalSettings(
  storyId: string,
): StoryLocalSettings {
  return {
    storyId,
    ...defaultStoryDisplaySettings,
    updatedAt: new Date().toISOString(),
  };
}

function isFontSize(value: unknown): value is StoryLocalSettings["fontSize"] {
  return value === "small" || value === "medium" || value === "large";
}

function isReadingWidth(
  value: unknown,
): value is StoryLocalSettings["readingWidth"] {
  return value === "compact" || value === "comfortable" || value === "wide";
}

function isDensity(value: unknown): value is StoryLocalSettings["density"] {
  return value === "compact" || value === "comfortable";
}

function isMockAiMode(
  value: unknown,
): value is StoryLocalSettings["mockAiMode"] {
  return (
    value === "conservative" || value === "balanced" || value === "creative"
  );
}

function normalizeDisplaySettings(value: unknown): StoryDisplaySettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultStoryDisplaySettings;
  }

  const candidate = value as Partial<StoryLocalSettings>;

  return {
    fontSize: isFontSize(candidate.fontSize)
      ? candidate.fontSize
      : defaultStoryDisplaySettings.fontSize,
    readingWidth: isReadingWidth(candidate.readingWidth)
      ? candidate.readingWidth
      : defaultStoryDisplaySettings.readingWidth,
    density: isDensity(candidate.density)
      ? candidate.density
      : defaultStoryDisplaySettings.density,
    showMetadata:
      typeof candidate.showMetadata === "boolean"
        ? candidate.showMetadata
        : defaultStoryDisplaySettings.showMetadata,
    autoSaveDrafts:
      typeof candidate.autoSaveDrafts === "boolean"
        ? candidate.autoSaveDrafts
        : defaultStoryDisplaySettings.autoSaveDrafts,
    mockAiMode: isMockAiMode(candidate.mockAiMode)
      ? candidate.mockAiMode
      : defaultStoryDisplaySettings.mockAiMode,
  };
}

export function normalizeStoryLocalSettings(
  storyId: string,
  value: unknown,
): StoryLocalSettings {
  const displaySettings = normalizeDisplaySettings(value);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      storyId,
      ...displaySettings,
      updatedAt: new Date().toISOString(),
    };
  }

  const candidate = value as Partial<StoryLocalSettings>;

  return {
    storyId,
    ...displaySettings,
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt
        : new Date().toISOString(),
  };
}

export function readStoryLocalSettings(storyId: string): StoryLocalSettings {
  if (typeof window === "undefined") {
    return createDefaultStoryLocalSettings(storyId);
  }

  const storageKey = getStorySettingsStorageKey(storyId);

  try {
    const rawValue = localStorage.getItem(storageKey);
    const parsedValue = rawValue
      ? (JSON.parse(rawValue) as unknown)
      : undefined;

    return normalizeStoryLocalSettings(storyId, parsedValue);
  } catch (error) {
    console.error("Failed to read story settings from localStorage", error);
    return createDefaultStoryLocalSettings(storyId);
  }
}

export function readStoryDisplaySettingsSnapshot(
  storyId: string,
): StoryDisplaySettings {
  if (typeof window === "undefined") {
    return defaultStoryDisplaySettings;
  }

  const storageKey = getStorySettingsStorageKey(storyId);
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

  const settings = normalizeDisplaySettings(parsedValue);

  cachedSnapshots.set(storageKey, {
    rawValue,
    settings,
  });

  return settings;
}

export function saveStoryLocalSettings(settings: StoryLocalSettings) {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    getStorySettingsStorageKey(settings.storyId),
    JSON.stringify(settings),
  );

  notifyStorySettingsChanged();
}

export function notifyStorySettingsChanged() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(storySettingsStorageEvent));
}

export function subscribeToStorySettings(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorageChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(storySettingsStorageEvent, handleStorageChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(storySettingsStorageEvent, handleStorageChange);
  };
}
