export type GeminiProxyAdapter =
  | "google-generative-language"
  | "openai-compatible";

export interface GeminiProxyRetryPolicy {
  maxAttempts: number;
  retryableStatuses: number[];
  keyFailoverEnabled: boolean;
}

export interface GeminiProxyUpstreamError {
  message: string;
  status?: number;
  retryable: boolean;
  source: "network" | "http" | "parse" | "validation" | "config";
}

export interface GeminiProxyServerConfig {
  adapter: GeminiProxyAdapter;
  configured: boolean;
  keyCount: number;
  baseUrl?: string;
  modelSource: "static" | "remote" | "unavailable";
  retryPolicy: GeminiProxyRetryPolicy;
  message: string;
}

export interface GeminiProxyModelListResult {
  ok: boolean;
  adapter: GeminiProxyAdapter;
  models: string[];
  message: string;
}

export interface GeminiProxyKeyPool {
  keys: string[];
  keyCount: number;
}
