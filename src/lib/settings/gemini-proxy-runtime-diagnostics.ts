export interface GeminiProxyRouteDiagnosticsResult {
  checked: boolean;
  ok: boolean;
  configured: boolean;
  endpoint: string;
  adapter?: string;
  keyCount?: number;
  baseUrlConfigured?: boolean;
  modelSource?: string;
  message: string;
}

export interface GeminiProxyModelDiagnosticsResult {
  checked: boolean;
  ok: boolean;
  models: string[];
  modelCount: number;
  message: string;
}

function normalizeEndpoint(endpoint: string) {
  return endpoint.trim();
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getModelsEndpointFromProxyEndpoint(endpoint: string) {
  if (endpoint.endsWith("/api/ai/gemini")) return `${endpoint}/models`;
  if (endpoint === "/api/ai/gemini") return "/api/ai/gemini/models";

  return `${endpoint.replace(/\/+$/g, "")}/models`;
}

export async function runGeminiProxyRouteDiagnostics(
  endpoint: string,
  timeoutMs = 3000,
): Promise<GeminiProxyRouteDiagnosticsResult> {
  const normalizedEndpoint = normalizeEndpoint(endpoint);

  if (!normalizedEndpoint) {
    return {
      checked: false,
      ok: false,
      configured: false,
      endpoint: normalizedEndpoint,
      message: "Gemini proxy endpoint is empty.",
    };
  }

  if (
    normalizedEndpoint.startsWith("http://") ||
    normalizedEndpoint.startsWith("https://")
  ) {
    return {
      checked: false,
      ok: false,
      configured: false,
      endpoint: normalizedEndpoint,
      message:
        "Absolute proxy endpoints are not checked from Runtime Diagnostics.",
    };
  }

  if (!normalizedEndpoint.startsWith("/")) {
    return {
      checked: false,
      ok: false,
      configured: false,
      endpoint: normalizedEndpoint,
      message:
        "Gemini proxy endpoint should be a relative app route or absolute URL.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(normalizedEndpoint, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        checked: true,
        ok: false,
        configured: false,
        endpoint: normalizedEndpoint,
        message: `Gemini proxy route check failed with HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as unknown;

    if (!isObject(payload)) {
      return {
        checked: true,
        ok: false,
        configured: false,
        endpoint: normalizedEndpoint,
        message: "Gemini proxy route returned an invalid payload.",
      };
    }

    return {
      checked: true,
      ok: true,
      configured:
        typeof payload.configured === "boolean" ? payload.configured : false,
      endpoint: normalizedEndpoint,
      adapter: typeof payload.adapter === "string" ? payload.adapter : undefined,
      keyCount:
        typeof payload.keyCount === "number" ? payload.keyCount : undefined,
      baseUrlConfigured:
        typeof payload.baseUrlConfigured === "boolean"
          ? payload.baseUrlConfigured
          : undefined,
      modelSource:
        typeof payload.modelSource === "string"
          ? payload.modelSource
          : undefined,
      message:
        typeof payload.message === "string"
          ? payload.message
          : "Gemini proxy route responded.",
    };
  } catch (error) {
    return {
      checked: true,
      ok: false,
      configured: false,
      endpoint: normalizedEndpoint,
      message: isAbortError(error)
        ? `Gemini proxy route check timed out after ${timeoutMs}ms.`
        : error instanceof Error
          ? `Gemini proxy route check failed: ${error.message}`
          : "Gemini proxy route check failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runGeminiProxyModelDiagnostics(
  endpoint: string,
  timeoutMs = 5000,
): Promise<GeminiProxyModelDiagnosticsResult> {
  const normalizedEndpoint = normalizeEndpoint(endpoint);

  if (!normalizedEndpoint) {
    return {
      checked: false,
      ok: false,
      models: [],
      modelCount: 0,
      message: "Gemini proxy endpoint is empty.",
    };
  }

  if (
    normalizedEndpoint.startsWith("http://") ||
    normalizedEndpoint.startsWith("https://")
  ) {
    return {
      checked: false,
      ok: false,
      models: [],
      modelCount: 0,
      message:
        "Absolute proxy endpoints are not checked from Runtime Diagnostics.",
    };
  }

  if (!normalizedEndpoint.startsWith("/")) {
    return {
      checked: false,
      ok: false,
      models: [],
      modelCount: 0,
      message:
        "Gemini proxy endpoint should be a relative app route or absolute URL.",
    };
  }

  const modelsEndpoint = getModelsEndpointFromProxyEndpoint(normalizedEndpoint);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(modelsEndpoint, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        checked: true,
        ok: false,
        models: [],
        modelCount: 0,
        message: `Gemini proxy model discovery failed with HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as unknown;
    if (!isObject(payload)) {
      return {
        checked: true,
        ok: false,
        models: [],
        modelCount: 0,
        message: "Gemini proxy model discovery returned invalid JSON.",
      };
    }

    const models = Array.isArray(payload.models)
      ? payload.models.filter((item): item is string => typeof item === "string")
      : [];
    const message =
      typeof payload.message === "string"
        ? payload.message
        : models.length > 0
          ? `Discovered ${models.length} model(s).`
          : "Model discovery returned no models.";

    return {
      checked: true,
      ok:
        typeof payload.ok === "boolean"
          ? payload.ok
          : models.length > 0,
      models,
      modelCount: models.length,
      message,
    };
  } catch (error) {
    return {
      checked: true,
      ok: false,
      models: [],
      modelCount: 0,
      message: isAbortError(error)
        ? `Gemini proxy model discovery timed out after ${timeoutMs}ms.`
        : error instanceof Error
          ? `Gemini proxy model discovery failed: ${error.message}`
          : "Gemini proxy model discovery failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
