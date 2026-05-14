export const AI_PROXY_ENDPOINT_ENV_KEY = "NEXT_PUBLIC_AI_PROXY_ENDPOINT";
export const AI_PROXY_DEFAULT_ENDPOINT = "/api/ai/story-analysis";

export function getPublicAiProxyEndpoint() {
  return process.env.NEXT_PUBLIC_AI_PROXY_ENDPOINT?.trim();
}

export function isPublicAiProxyConfigured() {
  return Boolean(getPublicAiProxyEndpoint());
}

export function getAiProxySmokeTestEndpoint() {
  return AI_PROXY_DEFAULT_ENDPOINT;
}
