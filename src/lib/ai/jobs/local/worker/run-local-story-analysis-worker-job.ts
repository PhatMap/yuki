import type {
  LocalStoryAnalysisWorkerCompleteMessage,
  LocalStoryAnalysisWorkerMessage,
  LocalStoryAnalysisWorkerProgressSnapshot,
  LocalStoryAnalysisWorkerRequest,
} from "@/lib/ai/jobs/local/worker/local-story-analysis-worker-types";

export interface RunLocalStoryAnalysisWorkerJobOptions {
  signal?: AbortSignal;
  onProgress?: (snapshot: LocalStoryAnalysisWorkerProgressSnapshot) => void;
}

function createWorkerRequestId() {
  return `local-story-analysis-worker:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createAbortError() {
  return new DOMException("Local story analysis worker job aborted.", "AbortError");
}

export function runLocalStoryAnalysisWorkerJob(
  input: Omit<LocalStoryAnalysisWorkerRequest, "requestId"> & {
    requestId?: string;
  },
  options: RunLocalStoryAnalysisWorkerJobOptions = {},
): Promise<LocalStoryAnalysisWorkerCompleteMessage["summary"]> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Local story analysis worker can only run in the browser."),
    );
  }

  if (typeof Worker === "undefined") {
    return Promise.reject(
      new Error("Web Worker is not available in this browser."),
    );
  }

  const requestId = input.requestId ?? createWorkerRequestId();

  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const worker = new Worker(
      new URL("./local-story-analysis.worker.ts", import.meta.url),
      { type: "module" },
    );
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

    function settleResolve(
      summary: LocalStoryAnalysisWorkerCompleteMessage["summary"],
    ) {
      if (settled) return;

      settled = true;
      cleanup();
      resolve(summary);
    }

    function handleAbort() {
      settleReject(createAbortError());
    }

    options.signal?.addEventListener("abort", handleAbort, { once: true });

    worker.onerror = (event) => {
      settleReject(
        new Error(
          event.message || "Local story analysis worker failed unexpectedly.",
        ),
      );
    };

    worker.onmessage = (event: MessageEvent<LocalStoryAnalysisWorkerMessage>) => {
      const message = event.data;

      if (!message || message.requestId !== requestId) return;

      if (message.type === "progress") {
        options.onProgress?.(message.snapshot);
        return;
      }

      if (message.type === "complete") {
        settleResolve(message.summary);
        return;
      }

      if (message.type === "error") {
        settleReject(new Error(message.errorMessage));
      }
    };

    worker.postMessage({
      ...input,
      requestId,
    } satisfies LocalStoryAnalysisWorkerRequest);
  });
}
