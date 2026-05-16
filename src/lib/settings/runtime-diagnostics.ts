import {
  getActiveRuntimeEndpoint,
  getActiveRuntimeModel,
} from "@/lib/settings/ai-runtime-settings";
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

export async function runRuntimeDiagnostics(
  settings: AiRuntimeSettings,
): Promise<RuntimeDiagnosticsReport> {
  const endpoint = getActiveRuntimeEndpoint(settings);
  const model = getActiveRuntimeModel(settings);
  const indexedDbAvailable = hasIndexedDb();
  const workerAvailable = hasWorker();

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
      id: "web-worker",
      label: "Web Worker",
      status: workerAvailable ? "pass" : "warning",
      message: workerAvailable
        ? "Web Worker is available for local-worker jobs."
        : "Web Worker is unavailable. Use local-browser runtime as fallback.",
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
    items.push(
      createItem({
        id: "provider",
        label: "AI provider",
        status: endpoint.trim() ? "pass" : "warning",
        message: endpoint.trim()
          ? "Gemini proxy provider has an endpoint configured."
          : "Gemini proxy provider needs an endpoint before real use.",
        detail: endpoint,
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

  items.push(
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
