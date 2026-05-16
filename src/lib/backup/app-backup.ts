import { getAllStories } from "@/lib/db/indexed-db";
import {
  getPromptTemplates,
  replacePromptTemplates,
} from "@/lib/prompts/prompt-registry";
import {
  getAiRuntimeSettings,
  saveAiRuntimeSettings,
  type AiRuntimeSettings,
} from "@/lib/settings/ai-runtime-settings";
import type { GlobalPromptTemplate, Story } from "@/lib/types";

export interface AppBackupManifest {
  schemaVersion: 1;
  exportedAt: string;
  app: "yuki";
  counts: {
    stories: number;
    promptTemplates: number;
  };
}

export interface AppBackupPayload {
  manifest: AppBackupManifest;
  data: {
    runtimeSettings: AiRuntimeSettings;
    promptTemplates: GlobalPromptTemplate[];
    stories: Story[];
  };
}

export interface AppBackupRestoreSummary {
  restoredAt: string;
  restoredRuntimeProvider: string;
  restoredJobRuntime: string;
  promptTemplates: number;
  storyIndexEntries: number;
}

export async function createAppBackupPayload(): Promise<AppBackupPayload> {
  const [runtimeSettings, promptTemplates, stories] = await Promise.all([
    getAiRuntimeSettings(),
    getPromptTemplates(),
    getAllStories(),
  ]);

  return {
    manifest: {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      app: "yuki",
      counts: {
        stories: stories.length,
        promptTemplates: promptTemplates.length,
      },
    },
    data: {
      runtimeSettings,
      promptTemplates,
      stories,
    },
  };
}

export function createAppBackupFileName(payload: AppBackupPayload) {
  const timestamp = payload.manifest.exportedAt
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");

  return `yuki-app-backup-${timestamp}.json`;
}

export function downloadAppBackup(payload: AppBackupPayload) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("App backup download is only available in the browser.");
  }

  const fileName = createAppBackupFileName(payload);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return fileName;
}

export async function restoreAppBackupPayload(
  payload: AppBackupPayload,
): Promise<AppBackupRestoreSummary> {
  if (payload.manifest.schemaVersion !== 1) {
    throw new Error(
      `Unsupported app backup schema version: ${payload.manifest.schemaVersion}.`,
    );
  }

  if (payload.manifest.app !== "yuki") {
    throw new Error(`Unsupported app backup target: ${payload.manifest.app}.`);
  }

  if (!payload.data.runtimeSettings) {
    throw new Error("App backup is missing runtime settings.");
  }

  if (!Array.isArray(payload.data.promptTemplates)) {
    throw new Error("App backup prompt templates must be an array.");
  }

  const restoredSettings = await saveAiRuntimeSettings({
    ...payload.data.runtimeSettings,
    id: "global",
  });

  await replacePromptTemplates(payload.data.promptTemplates);

  return {
    restoredAt: new Date().toISOString(),
    restoredRuntimeProvider: restoredSettings.providerId,
    restoredJobRuntime: restoredSettings.jobRuntime,
    promptTemplates: payload.data.promptTemplates.length,
    storyIndexEntries: payload.data.stories.length,
  };
}
