import Dexie, { type Table } from "dexie";
import type { PublicJobRuntime } from "@/lib/runtime/runtime-config";

export type AiRuntimeProviderId =
  | "mock"
  | "gemini-proxy"
  | "custom-openai"
  | "gemini-direct"
  | "ollama";

export interface AiRuntimeSettings {
  id: "global";
  providerId: AiRuntimeProviderId;
  jobRuntime: PublicJobRuntime;
  defaultModel: string;
  geminiProxyEndpoint: string;
  customOpenAiBaseUrl: string;
  customOpenAiModel: string;
  geminiDirectBaseUrl: string;
  geminiDirectModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  temperature: number;
  maxOutputTokens: number;
  updatedAt: string;
}

class AiRuntimeSettingsDatabase extends Dexie {
  runtimeSettings!: Table<AiRuntimeSettings, string>;

  constructor() {
    super("yuki-ai-runtime-settings-db");

    this.version(1).stores({
      runtimeSettings: "id, providerId, updatedAt",
    });
  }
}

const db = new AiRuntimeSettingsDatabase();

export const defaultAiRuntimeSettings: AiRuntimeSettings = {
  id: "global",
  providerId: "mock",
  jobRuntime: "local-worker",
  defaultModel: "mock-local",
  geminiProxyEndpoint: "/api/ai/gemini",
  customOpenAiBaseUrl: "",
  customOpenAiModel: "",
  geminiDirectBaseUrl: "https://generativelanguage.googleapis.com",
  geminiDirectModel: "gemini-2.5-flash",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "llama3.1",
  temperature: 0.7,
  maxOutputTokens: 8192,
  updatedAt: new Date().toISOString(),
};

export const aiRuntimeProviderOptions: {
  id: AiRuntimeProviderId;
  title: string;
  description: string;
  status: "ready" | "draft" | "local";
}[] = [
  {
    id: "mock",
    title: "Mock Local",
    description: "Không gọi API. Dùng để test flow và build UI an toàn.",
    status: "ready",
  },
  {
    id: "gemini-proxy",
    title: "Gemini Proxy",
    description: "Provider chính dự kiến cho deploy. Gọi qua endpoint proxy.",
    status: "draft",
  },
  {
    id: "custom-openai",
    title: "Custom OpenAI-compatible",
    description: "Dành cho one-api, NewAPI hoặc proxy clone.",
    status: "draft",
  },
  {
    id: "gemini-direct",
    title: "Gemini Direct",
    description:
      "Dành cho Google AI Studio. Không nên lưu key raw trong app public.",
    status: "draft",
  },
  {
    id: "ollama",
    title: "Ollama Local",
    description: "Dành cho local AI trên máy cá nhân.",
    status: "local",
  },
];

export function getAiRuntimeProviderLabel(providerId: AiRuntimeProviderId) {
  return (
    aiRuntimeProviderOptions.find((provider) => provider.id === providerId)
      ?.title ?? providerId
  );
}

const jobRuntimeOptions = [
  "local-browser",
  "local-worker",
  "cloud-queue",
] as const;

export function normalizeJobRuntime(
  value: string | undefined,
): PublicJobRuntime {
  if (!value) return defaultAiRuntimeSettings.jobRuntime;

  return jobRuntimeOptions.includes(value as PublicJobRuntime)
    ? (value as PublicJobRuntime)
    : defaultAiRuntimeSettings.jobRuntime;
}

function normalizeAiRuntimeSettings(
  settings?: Partial<AiRuntimeSettings>,
): AiRuntimeSettings {
  return {
    ...defaultAiRuntimeSettings,
    ...settings,
    id: "global",
    providerId: settings?.providerId ?? defaultAiRuntimeSettings.providerId,
    jobRuntime: normalizeJobRuntime(settings?.jobRuntime),
    temperature: normalizeTemperature(
      Number(settings?.temperature ?? defaultAiRuntimeSettings.temperature),
    ),
    maxOutputTokens: normalizeMaxOutputTokens(
      Number(
        settings?.maxOutputTokens ?? defaultAiRuntimeSettings.maxOutputTokens,
      ),
    ),
    updatedAt: settings?.updatedAt ?? new Date().toISOString(),
  };
}

export async function getAiRuntimeSettings() {
  const storedSettings = await db.runtimeSettings.get("global");

  return normalizeAiRuntimeSettings(storedSettings);
}

export async function saveAiRuntimeSettings(settings: AiRuntimeSettings) {
  const nextSettings = normalizeAiRuntimeSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });

  await db.runtimeSettings.put(nextSettings);

  return nextSettings;
}

export async function resetAiRuntimeSettings() {
  const nextSettings = normalizeAiRuntimeSettings({
    ...defaultAiRuntimeSettings,
    updatedAt: new Date().toISOString(),
  });

  await db.runtimeSettings.put(nextSettings);

  return nextSettings;
}

export function normalizeTemperature(value: number) {
  if (!Number.isFinite(value)) return defaultAiRuntimeSettings.temperature;

  return Math.min(2, Math.max(0, value));
}

export function normalizeMaxOutputTokens(value: number) {
  if (!Number.isFinite(value)) return defaultAiRuntimeSettings.maxOutputTokens;

  return Math.min(65536, Math.max(512, Math.round(value)));
}

export function getActiveRuntimeModel(settings: AiRuntimeSettings) {
  if (settings.providerId === "gemini-proxy") {
    return settings.defaultModel || "gemini-proxy-default";
  }

  if (settings.providerId === "custom-openai") {
    return settings.customOpenAiModel || "custom-model-not-set";
  }

  if (settings.providerId === "gemini-direct") {
    return settings.geminiDirectModel || "gemini-2.5-flash";
  }

  if (settings.providerId === "ollama") {
    return settings.ollamaModel || "llama3.1";
  }

  return "mock-local";
}

export function getActiveRuntimeEndpoint(settings: AiRuntimeSettings) {
  if (settings.providerId === "gemini-proxy") {
    return settings.geminiProxyEndpoint || "/api/ai/gemini";
  }

  if (settings.providerId === "custom-openai") {
    return settings.customOpenAiBaseUrl || "not configured";
  }

  if (settings.providerId === "gemini-direct") {
    return (
      settings.geminiDirectBaseUrl ||
      "https://generativelanguage.googleapis.com"
    );
  }

  if (settings.providerId === "ollama") {
    return settings.ollamaBaseUrl || "http://localhost:11434";
  }

  return "local mock runtime";
}
