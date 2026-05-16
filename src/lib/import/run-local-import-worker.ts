import type {
  LocalImportWorkerCompleteMessage,
  LocalImportWorkerMessage,
  LocalImportWorkerProgressSnapshot,
  LocalImportWorkerRequest,
} from "@/lib/import/local-import-worker-types";

export interface RunLocalImportWorkerOptions {
  signal?: AbortSignal;
  onProgress?: (snapshot: LocalImportWorkerProgressSnapshot) => void;
}

function createRequestId() {
  return `local-import-worker:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createAbortError() {
  return new DOMException("Local import worker aborted.", "AbortError");
}

export function runLocalImportWorker(
  input: Omit<LocalImportWorkerRequest, "requestId"> & {
    requestId?: string;
  },
  options: RunLocalImportWorkerOptions = {},
): Promise<LocalImportWorkerCompleteMessage["result"]> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Local import worker can only run in the browser."));
  }

  if (typeof Worker === "undefined") {
    return Promise.reject(new Error("Web Worker is not available in this browser."));
  }

  const requestId = input.requestId ?? createRequestId();

  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const worker = new Worker(new URL("./local-import.worker.ts", import.meta.url), {
      type: "module",
    });
    let settled = false;

    function cleanup() {
      worker.terminate();
      options.signal?.removeEventListener("abort", handleAbort);
    }

    function settleReject(error: unknown) {
      if (settled) return;

      settled = true;
      cleanup();
      reject(error);
    }

    function settleResolve(result: LocalImportWorkerCompleteMessage["result"]) {
      if (settled) return;

      settled = true;
      cleanup();
      resolve(result);
    }

    function handleAbort() {
      settleReject(createAbortError());
    }

    options.signal?.addEventListener("abort", handleAbort, { once: true });

    worker.onerror = (event) => {
      settleReject(
        new Error(event.message || "Local import worker failed unexpectedly."),
      );
    };

    worker.onmessage = (event: MessageEvent<LocalImportWorkerMessage>) => {
      const message = event.data;

      if (!message || message.requestId !== requestId) return;

      if (message.type === "progress") {
        options.onProgress?.(message.snapshot);
        return;
      }

      if (message.type === "complete") {
        settleResolve(message.result);
        return;
      }

      if (message.type === "error") {
        settleReject(new Error(message.errorMessage));
      }
    };

    worker.postMessage({
      ...input,
      requestId,
    } satisfies LocalImportWorkerRequest);
  });
}
