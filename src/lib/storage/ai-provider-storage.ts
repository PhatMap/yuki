import type { AiPipelineProviderId } from "@/lib/ai/pipeline";

const aiProviderStorageKeyPrefix = "ai-story-app:ai-provider";
export const aiProviderStorageEvent = "yuki-ai-provider-storage-change";

export const defaultAiProviderId: AiPipelineProviderId = "mock";

export function getAiProviderStorageKey(storyId: string) {
  return `${aiProviderStorageKeyPrefix}:${storyId}`;
}

export function isAiPipelineProviderId(
  value: unknown,
): value is AiPipelineProviderId {
  return value === "mock" || value === "gemini-proxy";
}

export function readStoredAiProviderId(storyId: string): AiPipelineProviderId {
  if (typeof window === "undefined") return defaultAiProviderId;

  try {
    const storedValue = localStorage.getItem(getAiProviderStorageKey(storyId));

    if (isAiPipelineProviderId(storedValue)) {
      return storedValue;
    }
  } catch (error) {
    console.error(
      "Failed to read AI provider selection from localStorage",
      error,
    );
  }

  return defaultAiProviderId;
}

export function saveStoredAiProviderId(
  storyId: string,
  providerId: AiPipelineProviderId,
) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(getAiProviderStorageKey(storyId), providerId);
    notifyAiProviderStorageChanged();
  } catch (error) {
    console.error(
      "Failed to save AI provider selection to localStorage",
      error,
    );
  }
}

export function notifyAiProviderStorageChanged() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(aiProviderStorageEvent));
}

export function subscribeToAiProviderStorage(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorageChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(aiProviderStorageEvent, handleStorageChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(aiProviderStorageEvent, handleStorageChange);
  };
}
