import {
  GEMINI_CORE_DEFAULT_ENDPOINT,
  getActiveRuntimeModel,
} from "@/lib/settings/ai-runtime-settings";
import { getPromptTemplates } from "@/lib/prompts/prompt-registry";
import {
  runGeminiProxyModelDiagnostics,
  runGeminiProxyRouteDiagnostics,
} from "@/lib/settings/gemini-proxy-runtime-diagnostics";
import { runOllamaConnectivityDiagnostics } from "@/lib/settings/ollama-runtime-diagnostics";
import { runRuntimeDiagnosticsWorkerSmokeTest } from "@/lib/settings/run-runtime-diagnostics-worker-smoke-test";
import type { AiRuntimeSettings } from "@/lib/settings/ai-runtime-settings";

export type RuntimeDiagnosticStatus = "pass" | "warning" | "fail";

export interface RuntimeDiagnosticItem {
  id: string;
  label: string;
  status: RuntimeDiagnosticStatus;
  message: string;
  detail?: string;
}

export interface RuntimeDiagnosticsReport {
  generatedAt: string;
  overallStatus: RuntimeDiagnosticStatus;
  items: RuntimeDiagnosticItem[];
}

function hasIndexedDb() {
  return typeof globalThis.indexedDB !== "undefined";
}

function hasWorker() {
  return typeof Worker !== "undefined";
}

function getOverallStatus(
  items: RuntimeDiagnosticItem[],
): RuntimeDiagnosticStatus {
  if (items.some((item) => item.status === "fail")) return "fail";
  if (items.some((item) => item.status === "warning")) return "warning";

  return "pass";
}

function createItem(item: RuntimeDiagnosticItem): RuntimeDiagnosticItem {
  return item;
}

const requiredPromptTemplateIds = [
  "story-system-identity",
  "import-analysis",
  "rewrite-impact-planner",
  "rewrite-draft",
  "new-story-from-framework",
];

function getGeminiProxyEndpointDiagnostic(endpoint: string) {
  const trimmedEndpoint = endpoint.trim();

  if (!trimmedEndpoint || trimmedEndpoint === "not configured") {
    return createItem({
      id: "provider",
      label: "AI provider",
      status: "warning",
      message: `Gemini proxy provider needs an endpoint before real use. Recommended: ${GEMINI_CORE_DEFAULT_ENDPOINT}.`,
      detail: trimmedEndpoint || "empty endpoint",
    });
  }

  if (trimmedEndpoint.startsWith("/")) {
    return createItem({
      id: "provider",
      label: "AI provider",
      status: "pass",
      message: "Gemini proxy provider has a relative app endpoint configured.",
      detail: "relative app proxy endpoint",
    });
  }

  if (
    trimmedEndpoint.startsWith("http://") ||
    trimmedEndpoint.startsWith("https://")
  ) {
    return createItem({
      id: "provider",
      label: "AI provider",
      status: "pass",
      message: "Gemini proxy provider has an absolute endpoint configured.",
      detail: "absolute proxy endpoint",
    });
  }

  return createItem({
    id: "provider",
    label: "AI provider",
    status: "warning",
    message:
      "Gemini proxy endpoint is configured but should be a relative path or absolute URL.",
    detail: trimmedEndpoint,
  });
}

function promptLooksLikeImportAnalysis(editablePrompt: string) {
  const normalizedPrompt = editablePrompt.toLocaleLowerCase("en-US");

  return ["chapter", "chapters", "canon", "analysis"].some((term) =>
    normalizedPrompt.includes(term),
  );
}

function isValidGeminiProxyModel(model: string) {
  const normalizedModel = model.trim();

  return (
    normalizedModel.length > 0 &&
    normalizedModel !== "mock-local" &&
    normalizedModel !== "custom-model-not-set" &&
    normalizedModel !== "gemini-proxy-default"
  );
}

interface BrowserStorageEstimateSnapshot {
  supported: boolean;
  usage?: number;
  quota?: number;
  persisted?: boolean;
  errorMessage?: string;
}

function formatBytes(value: number | undefined) {
  if (!Number.isFinite(value)) return "unknown";

  const bytes = value ?? 0;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = bytes;
  let unitIndex = 0;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  return `${current.toFixed(current >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getStorageUsagePercent(snapshot: BrowserStorageEstimateSnapshot) {
  if (!snapshot.usage || !snapshot.quota || snapshot.quota <= 0) return undefined;

  return Math.round((snapshot.usage / snapshot.quota) * 100);
}

async function readBrowserStorageEstimate(): Promise<BrowserStorageEstimateSnapshot> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return {
      supported: false,
      errorMessage: "Storage estimate API is not available in this browser.",
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted
      ? await navigator.storage.persisted()
      : undefined;

    return {
      supported: true,
      usage: estimate.usage,
      quota: estimate.quota,
      persisted,
    };
  } catch (error) {
    return {
      supported: true,
      errorMessage:
        error instanceof Error ? error.message : "Could not read browser storage estimate.",
    };
  }
}

export async function runRuntimeDiagnostics(
  settings: AiRuntimeSettings,
): Promise<RuntimeDiagnosticsReport> {
  const model = getActiveRuntimeModel(settings);
  const promptTemplates = await getPromptTemplates({ persistDefaults: false });
  const geminiProxyRouteDiagnostics =
    settings.providerId === "gemini-proxy"
      ? await runGeminiProxyRouteDiagnostics(settings.geminiProxyEndpoint)
      : undefined;
  const geminiProxyModelDiagnostics =
    settings.providerId === "gemini-proxy"
      ? await runGeminiProxyModelDiagnostics(settings.geminiProxyEndpoint)
      : undefined;
  const ollamaDiagnostics =
    settings.providerId === "ollama"
      ? await runOllamaConnectivityDiagnostics({
          baseUrl: settings.ollamaBaseUrl,
          model,
        })
      : undefined;
  const indexedDbAvailable = hasIndexedDb();
  const workerAvailable = hasWorker();
  const workerSmokeTest = workerAvailable
    ? await runRuntimeDiagnosticsWorkerSmokeTest()
    : undefined;
  const storageEstimate = await readBrowserStorageEstimate();
  const storageUsagePercent = getStorageUsagePercent(storageEstimate);

  const items: RuntimeDiagnosticItem[] = [
    createItem({
      id: "indexed-db",
      label: "IndexedDB",
      status: indexedDbAvailable ? "pass" : "fail",
      message: indexedDbAvailable
        ? "IndexedDB is available for local-first storage."
        : "IndexedDB is not available in this browser/runtime.",
    }),
    createItem({
      id: "storage-quota",
      label: "Browser storage quota",
      status: storageEstimate.errorMessage
        ? "warning"
        : storageUsagePercent !== undefined && storageUsagePercent >= 85
          ? "warning"
          : storageEstimate.supported
            ? "pass"
            : "warning",
      message: storageEstimate.errorMessage
        ? storageEstimate.errorMessage
        : storageEstimate.supported
          ? `Storage usage is ${formatBytes(storageEstimate.usage)} / ${formatBytes(
              storageEstimate.quota,
            )}${storageUsagePercent !== undefined ? ` (${storageUsagePercent}%)` : ""}.`
          : "Browser storage quota could not be estimated.",
      detail:
        storageEstimate.persisted === undefined
          ? undefined
          : storageEstimate.persisted
            ? "Persistent storage is enabled."
            : "Persistent storage is not enabled.",
    }),
    createItem({
      id: "storage-persistence",
      label: "Storage persistence",
      status:
        storageEstimate.persisted === true
          ? "pass"
          : storageEstimate.persisted === false
            ? "warning"
            : "warning",
      message:
        storageEstimate.persisted === true
          ? "Browser reports persistent storage for this origin."
          : storageEstimate.persisted === false
            ? "Browser may evict local data under storage pressure. Keep export/backup features on the roadmap."
            : "Storage persistence status is unavailable.",
    }),
    createItem({
      id: "web-worker",
      label: "Web Worker",
      status: workerAvailable ? "pass" : "warning",
      message: workerAvailable
        ? "Web Worker is available for local-worker jobs."
        : "Web Worker is unavailable. Use local-browser runtime as fallback.",
    }),
    createItem({
      id: "web-worker-smoke-test",
      label: "Worker smoke test",
      status: !workerAvailable
        ? "warning"
        : workerSmokeTest?.ok && workerSmokeTest.indexedDbAvailableInWorker
          ? "pass"
          : settings.jobRuntime === "local-worker"
            ? "fail"
            : "warning",
      message:
        workerSmokeTest?.message ??
        "Worker smoke test was skipped because Web Worker is unavailable.",
      detail: workerSmokeTest?.generatedAt,
    }),
  ];

  if (settings.jobRuntime === "local-worker") {
    items.push(
      createItem({
        id: "job-runtime",
        label: "Job runtime",
        status: workerAvailable ? "pass" : "fail",
        message: workerAvailable
          ? "local-worker runtime can run local analysis orchestration off the UI thread."
          : "local-worker requires Web Worker support.",
        detail: settings.jobRuntime,
      }),
    );
  } else if (settings.jobRuntime === "local-browser") {
    items.push(
      createItem({
        id: "job-runtime",
        label: "Job runtime",
        status: "pass",
        message: "local-browser runtime can run as compatibility fallback.",
        detail: settings.jobRuntime,
      }),
    );
  } else {
    items.push(
      createItem({
        id: "job-runtime",
        label: "Job runtime",
        status: "warning",
        message: "cloud-queue is a future runtime and currently falls back safely.",
        detail: settings.jobRuntime,
      }),
    );
  }

  if (settings.providerId === "mock") {
    items.push(
      createItem({
        id: "provider",
        label: "AI provider",
        status: "pass",
        message: "Mock provider is ready and does not call external APIs.",
        detail: model,
      }),
    );
  } else if (settings.providerId === "gemini-proxy") {
    const endpointDiagnostic = getGeminiProxyEndpointDiagnostic(
      settings.geminiProxyEndpoint,
    );
    const geminiProxyModel = settings.defaultModel.trim();
    const trimmedEndpoint = settings.geminiProxyEndpoint.trim();
    const isRelativeEndpoint = trimmedEndpoint.startsWith("/");
    const geminiBatchSize = settings.geminiBatchSize;
    const geminiBatchConcurrency = settings.geminiBatchConcurrency;
    const geminiRequestDelayMs = settings.geminiRequestDelayMs;
    const hasAggressiveGeminiBatchControls =
      geminiBatchConcurrency > 2 || geminiRequestDelayMs < 500;

    items.push(
      endpointDiagnostic,
      createItem({
        id: "gemini-proxy-model",
        label: "Gemini proxy model",
        status: isValidGeminiProxyModel(geminiProxyModel) ? "pass" : "warning",
        message: isValidGeminiProxyModel(geminiProxyModel)
          ? `Gemini Proxy model is set to ${geminiProxyModel}.`
          : "Gemini Proxy model should be a Gemini model such as gemini-2.5-flash.",
        detail: geminiProxyModel || "empty model",
      }),
      createItem({
        id: "gemini-batch-controls",
        label: "Gemini batch controls",
        status: hasAggressiveGeminiBatchControls ? "warning" : "pass",
        message: `Batch size ${geminiBatchSize}, concurrency ${geminiBatchConcurrency}, delay ${geminiRequestDelayMs}ms.`,
        detail: hasAggressiveGeminiBatchControls
          ? "Aggressive settings may hit provider rate limits faster."
          : undefined,
      }),
      createItem({
        id: "gemini-proxy-route",
        label: "Gemini proxy route",
        status: !geminiProxyRouteDiagnostics?.checked
          ? "warning"
          : geminiProxyRouteDiagnostics.ok &&
              geminiProxyRouteDiagnostics.configured
            ? "pass"
            : geminiProxyRouteDiagnostics.ok &&
                !geminiProxyRouteDiagnostics.configured
              ? "warning"
              : isRelativeEndpoint
                ? "fail"
                : "warning",
        message:
          geminiProxyRouteDiagnostics?.message ??
          "Gemini proxy route diagnostics were not run.",
        detail: [
          `endpoint=${settings.geminiProxyEndpoint || "empty"}`,
          `adapter=${geminiProxyRouteDiagnostics?.adapter ?? "unknown"}`,
          `keyCount=${String(geminiProxyRouteDiagnostics?.keyCount ?? 0)}`,
          `baseUrlConfigured=${String(
            geminiProxyRouteDiagnostics?.baseUrlConfigured ?? false,
          )}`,
          `maxAttempts=${String(
            geminiProxyRouteDiagnostics?.retryPolicy?.maxAttempts ?? 0,
          )}`,
        ].join(" | "),
      }),
      createItem({
        id: "gemini-proxy-retry-policy",
        label: "Gemini proxy retry policy",
        status:
          geminiProxyRouteDiagnostics?.retryPolicy?.keyFailoverEnabled &&
          (geminiProxyRouteDiagnostics?.retryPolicy?.maxAttempts ?? 0) >= 2
            ? "pass"
            : "warning",
        message:
          geminiProxyRouteDiagnostics?.retryPolicy?.keyFailoverEnabled &&
          (geminiProxyRouteDiagnostics?.retryPolicy?.maxAttempts ?? 0) >= 2
            ? `Key failover is enabled with up to ${geminiProxyRouteDiagnostics.retryPolicy.maxAttempts} attempt(s).`
            : "Only one attempt is configured. Large jobs may fail faster under rate limits.",
        detail: geminiProxyRouteDiagnostics?.retryPolicy?.retryableStatuses
          ?.length
          ? geminiProxyRouteDiagnostics.retryPolicy.retryableStatuses.join(", ")
          : undefined,
      }),
      createItem({
        id: "gemini-proxy-key-pool",
        label: "Gemini proxy key pool",
        status:
          (geminiProxyRouteDiagnostics?.keyCount ?? 0) > 0 ? "pass" : "warning",
        message:
          (geminiProxyRouteDiagnostics?.keyCount ?? 0) > 0
            ? `Server-side key pool has ${geminiProxyRouteDiagnostics?.keyCount} key(s).`
            : "No server-side Gemini proxy key is configured.",
        detail: "Keys are server-only and not exposed to browser.",
      }),
      createItem({
        id: "gemini-proxy-model-discovery",
        label: "Gemini proxy model discovery",
        status:
          geminiProxyModelDiagnostics?.ok &&
          (geminiProxyModelDiagnostics.modelCount ?? 0) > 0
            ? "pass"
            : "warning",
        message:
          geminiProxyModelDiagnostics?.message ??
          "Gemini proxy model discovery was not run.",
        detail:
          geminiProxyModelDiagnostics?.models.length
            ? geminiProxyModelDiagnostics.models.slice(0, 8).join(", ")
            : undefined,
      }),
    );
  } else if (settings.providerId === "ollama") {
    const ollamaReady = Boolean(
      ollamaDiagnostics?.ok && ollamaDiagnostics.modelFound,
    );

    items.push(
      createItem({
        id: "provider",
        label: "AI provider",
        status: ollamaReady ? "pass" : "warning",
        message:
          "Ollama is wired into the browser analysis pipeline. It still requires a reachable local Ollama server and browser CORS access.",
        detail: `${settings.providerId} / ${model}`,
      }),
      createItem({
        id: "ollama-connectivity",
        label: "Ollama connectivity",
        status: ollamaDiagnostics?.ok ? "pass" : "warning",
        message:
          ollamaDiagnostics?.message ??
          "Ollama connectivity diagnostics were not run.",
        detail: ollamaDiagnostics?.ok
          ? `${ollamaDiagnostics.baseUrl} (browser calls may still fail if CORS is blocked)`
          : ollamaDiagnostics?.baseUrl,
      }),
      createItem({
        id: "ollama-selected-model",
        label: "Ollama selected model",
        status: ollamaDiagnostics?.modelFound ? "pass" : "warning",
        message: ollamaDiagnostics?.modelFound
          ? `Selected Ollama model ${model} was found locally.`
          : `Selected Ollama model ${model} was not found locally.`,
        detail: ollamaDiagnostics?.modelNames.length
          ? ollamaDiagnostics.modelNames.slice(0, 8).join(", ")
          : "No local model names returned.",
      }),
    );
  } else {
    items.push(
      createItem({
        id: "provider",
        label: "AI provider",
        status: "warning",
        message:
          "This provider is saved in settings but is not wired into the browser analysis pipeline yet.",
        detail: `${settings.providerId} / ${model}`,
      }),
    );
  }

  const promptTemplateIds = new Set(
    promptTemplates.map((template) => template.id),
  );
  const missingPromptTemplateIds = requiredPromptTemplateIds.filter(
    (id) => !promptTemplateIds.has(id),
  );
  const importAnalysisPrompt = promptTemplates.find(
    (template) => template.id === "import-analysis",
  );

  items.push(
    createItem({
      id: "prompt-templates",
      label: "Prompt templates",
      status: promptTemplates.length >= 5 ? "pass" : "warning",
      message: `${promptTemplates.length} prompt template(s) are readable.`,
    }),
    createItem({
      id: "required-prompt-templates",
      label: "Required prompt templates",
      status: missingPromptTemplateIds.length === 0 ? "pass" : "fail",
      message:
        missingPromptTemplateIds.length === 0
          ? "All required prompt templates are present."
          : "Required prompt templates are missing.",
      detail: missingPromptTemplateIds.length
        ? missingPromptTemplateIds.join(", ")
        : undefined,
    }),
    createItem({
      id: "import-analysis-prompt",
      label: "Import analysis prompt",
      status:
        importAnalysisPrompt?.editablePrompt.trim() &&
        promptLooksLikeImportAnalysis(importAnalysisPrompt.editablePrompt)
          ? "pass"
          : "warning",
      message:
        importAnalysisPrompt?.editablePrompt.trim() &&
        promptLooksLikeImportAnalysis(importAnalysisPrompt.editablePrompt)
          ? "Import analysis prompt has analysis-oriented content."
          : "Import analysis prompt may be empty or missing analysis keywords.",
    }),
    createItem({
      id: "temperature",
      label: "Temperature",
      status:
        settings.temperature >= 0 && settings.temperature <= 2
          ? "pass"
          : "warning",
      message: `Temperature is set to ${settings.temperature}.`,
    }),
    createItem({
      id: "max-output-tokens",
      label: "Max output tokens",
      status:
        settings.maxOutputTokens >= 512 && settings.maxOutputTokens <= 65536
          ? "pass"
          : "warning",
      message: `Max output tokens is set to ${settings.maxOutputTokens}.`,
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: getOverallStatus(items),
    items,
  };
}
