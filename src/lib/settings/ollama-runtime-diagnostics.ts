export interface OllamaConnectivityDiagnosticsInput {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

export interface OllamaConnectivityDiagnosticsResult {
  ok: boolean;
  baseUrl: string;
  model: string;
  modelFound: boolean;
  modelNames: string[];
  message: string;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/g, "");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function parseOllamaModelNames(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  const models = (value as { models?: unknown }).models;

  if (!Array.isArray(models)) return [];

  return models
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return undefined;
      }

      const record = item as { name?: unknown; model?: unknown };

      if (typeof record.name === "string") return record.name;
      if (typeof record.model === "string") return record.model;

      return undefined;
    })
    .filter((name): name is string => Boolean(name));
}

export async function runOllamaConnectivityDiagnostics({
  baseUrl,
  model,
  timeoutMs = 3000,
}: OllamaConnectivityDiagnosticsInput): Promise<OllamaConnectivityDiagnosticsResult> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedModel = model.trim();

  if (!normalizedBaseUrl) {
    return {
      ok: false,
      baseUrl: normalizedBaseUrl,
      model: normalizedModel,
      modelFound: false,
      modelNames: [],
      message: "Ollama base URL is empty.",
    };
  }

  if (!normalizedModel) {
    return {
      ok: false,
      baseUrl: normalizedBaseUrl,
      model: normalizedModel,
      modelFound: false,
      modelNames: [],
      message: "Ollama model is empty.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${normalizedBaseUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        baseUrl: normalizedBaseUrl,
        model: normalizedModel,
        modelFound: false,
        modelNames: [],
        message: `Ollama tags endpoint returned HTTP ${response.status}.`,
      };
    }

    const data = (await response.json()) as unknown;
    const modelNames = parseOllamaModelNames(data);
    const modelFound = modelNames.includes(normalizedModel);

    return {
      ok: true,
      baseUrl: normalizedBaseUrl,
      model: normalizedModel,
      modelFound,
      modelNames,
      message: modelFound
        ? `Ollama is reachable and model ${normalizedModel} is installed.`
        : `Ollama is reachable, but model ${normalizedModel} was not found.`,
    };
  } catch (error) {
    return {
      ok: false,
      baseUrl: normalizedBaseUrl,
      model: normalizedModel,
      modelFound: false,
      modelNames: [],
      message: isAbortError(error)
        ? `Ollama connectivity check timed out after ${timeoutMs}ms.`
        : error instanceof Error
          ? `Ollama connectivity check failed: ${error.message}`
          : "Ollama connectivity check failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
