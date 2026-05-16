export type PublicAiRuntime = "mock" | "gemini-proxy" | "ollama";
export type PublicStorageRuntime = "indexed-db" | "supabase";
export type PublicJobRuntime = "local-browser" | "local-worker" | "cloud-queue";

export interface PublicRuntimeConfig {
  aiRuntime: PublicAiRuntime;
  storageRuntime: PublicStorageRuntime;
  jobRuntime: PublicJobRuntime;
  aiProxyEndpoint: string;
  isAiProxyConfigured: boolean;
}

function normalizeValue<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
  fallback: T,
): T {
  if (!value) return fallback;

  return allowedValues.includes(value as T) ? (value as T) : fallback;
}

export function getPublicRuntimeConfig(): PublicRuntimeConfig {
  const aiProxyEndpoint =
    process.env.NEXT_PUBLIC_AI_PROXY_ENDPOINT?.trim() ?? "";

  return {
    aiRuntime: normalizeValue(
      process.env.NEXT_PUBLIC_AI_RUNTIME,
      ["mock", "gemini-proxy", "ollama"],
      "mock",
    ),
    storageRuntime: normalizeValue(
      process.env.NEXT_PUBLIC_STORAGE_RUNTIME,
      ["indexed-db", "supabase"],
      "indexed-db",
    ),
    jobRuntime: normalizeValue(
      process.env.NEXT_PUBLIC_JOB_RUNTIME,
      ["local-browser", "local-worker", "cloud-queue"],
      "local-browser",
    ),
    aiProxyEndpoint,
    isAiProxyConfigured: Boolean(aiProxyEndpoint),
  };
}
