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
  geminiBatchSize: number;
  geminiBatchConcurrency: number;
  geminiRequestDelayMs: number;
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

export const GEMINI_CORE_DEFAULT_MODEL = "gemini-2.5-flash";
export const GEMINI_CORE_DEFAULT_ENDPOINT = "/api/ai/gemini";

export const defaultAiRuntimeSettings: AiRuntimeSettings = {
  id: "global",
  providerId: "gemini-proxy",
  jobRuntime: "local-worker",
  defaultModel: GEMINI_CORE_DEFAULT_MODEL,
  geminiProxyEndpoint: GEMINI_CORE_DEFAULT_ENDPOINT,
  geminiBatchSize: 10,
  geminiBatchConcurrency: 1,
  geminiRequestDelayMs: 1200,
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
    description: "Test-only provider for UI flows. Not for real story workflow.",
    status: "local",
  },
  {
    id: "gemini-proxy",
    title: "Gemini Proxy",
    description:
      "Recommended core real-AI provider via server proxy endpoint.",
    status: "ready",
  },
  {
    id: "custom-openai",
    title: "Custom OpenAI-compatible",
    description: "For one-api, NewAPI, or OpenAI-compatible proxy.",
    status: "draft",
  },
  {
    id: "gemini-direct",
    title: "Gemini Direct",
    description:
      "For Google AI Studio. Do not store raw keys in a public app.",
    status: "draft",
  },
  {
    id: "ollama",
    title: "Ollama Local",
    description: "Local fallback / offline experiment provider.",
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

export function normalizeGeminiProxyModel(value: string | undefined): string {
  const normalized = value?.trim() ?? "";

  if (
    !normalized ||
    normalized === "mock-local" ||
    normalized === "custom-model-not-set" ||
    normalized === "gemini-proxy-default"
  ) {
    return GEMINI_CORE_DEFAULT_MODEL;
  }

  return normalized;
}

export function normalizeGeminiBatchSize(value: number) {
  if (!Number.isFinite(value)) return defaultAiRuntimeSettings.geminiBatchSize;

  return Math.min(50, Math.max(1, Math.round(value)));
}

export function normalizeGeminiBatchConcurrency(value: number) {
  if (!Number.isFinite(value)) {
    return defaultAiRuntimeSettings.geminiBatchConcurrency;
  }

  return Math.min(4, Math.max(1, Math.round(value)));
}

export function normalizeGeminiRequestDelayMs(value: number) {
  if (!Number.isFinite(value)) {
    return defaultAiRuntimeSettings.geminiRequestDelayMs;
  }

  return Math.min(30000, Math.max(0, Math.round(value)));
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
    defaultModel: normalizeGeminiProxyModel(settings?.defaultModel),
    geminiProxyEndpoint:
      settings?.geminiProxyEndpoint?.trim() || GEMINI_CORE_DEFAULT_ENDPOINT,
    geminiBatchSize: normalizeGeminiBatchSize(
      Number(settings?.geminiBatchSize ?? defaultAiRuntimeSettings.geminiBatchSize),
    ),
    geminiBatchConcurrency: normalizeGeminiBatchConcurrency(
      Number(
        settings?.geminiBatchConcurrency ??
          defaultAiRuntimeSettings.geminiBatchConcurrency,
      ),
    ),
    geminiRequestDelayMs: normalizeGeminiRequestDelayMs(
      Number(
        settings?.geminiRequestDelayMs ??
          defaultAiRuntimeSettings.geminiRequestDelayMs,
      ),
    ),
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
    return normalizeGeminiProxyModel(settings.defaultModel);
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
    return settings.geminiProxyEndpoint || GEMINI_CORE_DEFAULT_ENDPOINT;
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

export function createGeminiCoreRuntimeSettings(
  current: AiRuntimeSettings,
): AiRuntimeSettings {
  return {
    ...current,
    providerId: "gemini-proxy",
    jobRuntime: "local-worker",
    defaultModel: normalizeGeminiProxyModel(current.defaultModel),
    geminiProxyEndpoint:
      current.geminiProxyEndpoint?.trim() || GEMINI_CORE_DEFAULT_ENDPOINT,
    geminiBatchSize: normalizeGeminiBatchSize(current.geminiBatchSize),
    geminiBatchConcurrency: normalizeGeminiBatchConcurrency(
      current.geminiBatchConcurrency,
    ),
    geminiRequestDelayMs: normalizeGeminiRequestDelayMs(
      current.geminiRequestDelayMs,
    ),
    temperature: normalizeTemperature(current.temperature),
    maxOutputTokens: normalizeMaxOutputTokens(current.maxOutputTokens),
    updatedAt: new Date().toISOString(),
  };
}

export function createGeminiSafeBatchProfile(
  current: AiRuntimeSettings,
): AiRuntimeSettings {
  return {
    ...createGeminiCoreRuntimeSettings(current),
    geminiBatchSize: 5,
    geminiBatchConcurrency: 1,
    geminiRequestDelayMs: 2500,
    updatedAt: new Date().toISOString(),
  };
}

export function createGeminiFastBatchProfile(
  current: AiRuntimeSettings,
): AiRuntimeSettings {
  return {
    ...createGeminiCoreRuntimeSettings(current),
    geminiBatchSize: 20,
    geminiBatchConcurrency: 2,
    geminiRequestDelayMs: 800,
    updatedAt: new Date().toISOString(),
  };
}
