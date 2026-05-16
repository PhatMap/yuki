export interface GeminiProxyRouteDiagnosticsResult {
  checked: boolean;
  ok: boolean;
  configured: boolean;
  endpoint: string;
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

    let payload: unknown;

    try {
      payload = (await response.json()) as unknown;
    } catch (error) {
      return {
        checked: true,
        ok: false,
        configured: false,
        endpoint: normalizedEndpoint,
        message:
          error instanceof Error
            ? `Gemini proxy route returned invalid JSON: ${error.message}`
            : "Gemini proxy route returned invalid JSON.",
      };
    }

    const configured =
      isObject(payload) && typeof payload.configured === "boolean"
        ? payload.configured
        : false;
    const message =
      isObject(payload) && typeof payload.message === "string"
        ? payload.message
        : configured
          ? "Gemini proxy route responded and looks configured."
          : "Gemini proxy route responded but configuration is unknown.";

    return {
      checked: true,
      ok: true,
      configured,
      endpoint: normalizedEndpoint,
      message,
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
