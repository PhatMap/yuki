export type GeminiProxyAdapter =
  | "google-generative-language"
  | "openai-compatible";

export interface GeminiProxyServerConfig {
  adapter: GeminiProxyAdapter;
  configured: boolean;
  keyCount: number;
  baseUrl?: string;
  modelSource: "static" | "remote" | "unavailable";
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
