import type {
  RuntimeDiagnosticsWorkerIncomingMessage,
  RuntimeDiagnosticsWorkerOutgoingMessage,
} from "@/lib/settings/runtime-diagnostics-worker-types";

export interface RuntimeDiagnosticsWorkerSmokeTestResult {
  ok: boolean;
  indexedDbAvailableInWorker: boolean;
  message: string;
  generatedAt?: string;
}

function createRequestId() {
  return `runtime-diagnostics-worker:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function runRuntimeDiagnosticsWorkerSmokeTest(
  timeoutMs = 3000,
): Promise<RuntimeDiagnosticsWorkerSmokeTestResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({
      ok: false,
      indexedDbAvailableInWorker: false,
      message: "Worker smoke test can only run in the browser.",
    });
  }

  if (typeof Worker === "undefined") {
    return Promise.resolve({
      ok: false,
      indexedDbAvailableInWorker: false,
      message: "Web Worker is not available in this browser.",
    });
  }

  const requestId = createRequestId();

  return new Promise((resolve) => {
    const worker = new Worker(
      new URL("./runtime-diagnostics.worker.ts", import.meta.url),
      { type: "module" },
    );

    let settled = false;

    function finish(result: RuntimeDiagnosticsWorkerSmokeTestResult) {
      if (settled) return;

      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      resolve(result);
    }

    const timeout = setTimeout(() => {
      finish({
        ok: false,
        indexedDbAvailableInWorker: false,
        message: "Worker smoke test timed out.",
      });
    }, timeoutMs);

    worker.onerror = (event) => {
      finish({
        ok: false,
        indexedDbAvailableInWorker: false,
        message:
          event.message || "Worker smoke test failed before responding.",
      });
    };

    worker.onmessage = (
      event: MessageEvent<RuntimeDiagnosticsWorkerOutgoingMessage>,
    ) => {
      const message = event.data;

      if (!message || message.requestId !== requestId) return;

      if (message.type === "pong") {
        finish({
          ok: true,
          indexedDbAvailableInWorker: message.indexedDbAvailable,
          generatedAt: message.generatedAt,
          message: message.indexedDbAvailable
            ? "Worker spawned successfully and can access IndexedDB."
            : "Worker spawned successfully, but IndexedDB is unavailable inside the worker.",
        });
        return;
      }

      if (message.type === "error") {
        finish({
          ok: false,
          indexedDbAvailableInWorker: false,
          message: message.errorMessage,
        });
      }
    };

    worker.postMessage({
      type: "ping",
      requestId,
    } satisfies RuntimeDiagnosticsWorkerIncomingMessage);
  });
}
