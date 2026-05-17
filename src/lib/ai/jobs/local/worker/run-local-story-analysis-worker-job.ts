import type {
  LocalStoryAnalysisWorkerCompleteMessage,
  LocalStoryAnalysisWorkerMessage,
  LocalStoryAnalysisWorkerProgressSnapshot,
  LocalStoryAnalysisWorkerRequest,
  LocalStoryAnalysisWorkerResumeRequest,
} from "@/lib/ai/jobs/local/worker/local-story-analysis-worker-types";
import type { StoryAnalysisResult } from "@/lib/types";

export interface RunLocalStoryAnalysisWorkerJobOptions {
  signal?: AbortSignal;
  onProgress?: (snapshot: LocalStoryAnalysisWorkerProgressSnapshot) => void;
}

export interface LocalStoryAnalysisWorkerJobResult {
  summary: LocalStoryAnalysisWorkerCompleteMessage["summary"];
  analysisResult?: StoryAnalysisResult;
}

function createWorkerRequestId() {
  return `local-story-analysis-worker:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createAbortError() {
  return new DOMException(
    "Local story analysis worker job aborted.",
    "AbortError",
  );
}

export function runLocalStoryAnalysisWorkerJob(
  input: Omit<LocalStoryAnalysisWorkerRequest, "requestId"> & {
    requestId?: string;
  },
  options: RunLocalStoryAnalysisWorkerJobOptions = {},
): Promise<LocalStoryAnalysisWorkerJobResult> {
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
    let cancelFallbackTimeout: ReturnType<typeof setTimeout> | undefined;

    function cleanup() {
      if (cancelFallbackTimeout) {
        clearTimeout(cancelFallbackTimeout);
      }

      worker.terminate();
      options.signal?.removeEventListener("abort", handleAbort);
    }

    function settleReject(error: unknown) {
      if (settled) return;

      settled = true;
      cleanup();
      reject(error);
    }

    function settleResolve(result: LocalStoryAnalysisWorkerJobResult) {
      if (settled) return;

      settled = true;
      cleanup();
      resolve(result);
    }

    function handleAbort() {
      if (settled) return;

      worker.postMessage({
        type: "cancel",
        requestId,
      });

      cancelFallbackTimeout = setTimeout(() => {
        settleReject(createAbortError());
      }, 3000);
    }

    options.signal?.addEventListener("abort", handleAbort, { once: true });

    worker.onerror = (event) => {
      settleReject(
        new Error(
          event.message || "Local story analysis worker failed unexpectedly.",
        ),
      );
    };

    worker.onmessage = (
      event: MessageEvent<LocalStoryAnalysisWorkerMessage>,
    ) => {
      const message = event.data;

      if (!message || message.requestId !== requestId) return;

      if (message.type === "progress") {
        options.onProgress?.(message.snapshot);
        return;
      }

      if (message.type === "complete") {
        settleResolve({
          summary: message.summary,
          analysisResult: message.analysisResult,
        });
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

export function runResumeLocalStoryAnalysisWorkerJob(
  input: Omit<LocalStoryAnalysisWorkerResumeRequest, "requestId" | "type"> & {
    requestId?: string;
  },
  options: RunLocalStoryAnalysisWorkerJobOptions = {},
): Promise<LocalStoryAnalysisWorkerJobResult> {
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
    let cancelFallbackTimeout: ReturnType<typeof setTimeout> | undefined;

    function cleanup() {
      if (cancelFallbackTimeout) {
        clearTimeout(cancelFallbackTimeout);
      }

      worker.terminate();
      options.signal?.removeEventListener("abort", handleAbort);
    }

    function settleReject(error: unknown) {
      if (settled) return;

      settled = true;
      cleanup();
      reject(error);
    }

    function settleResolve(result: LocalStoryAnalysisWorkerJobResult) {
      if (settled) return;

      settled = true;
      cleanup();
      resolve(result);
    }

    function handleAbort() {
      if (settled) return;

      worker.postMessage({
        type: "cancel",
        requestId,
      });

      cancelFallbackTimeout = setTimeout(() => {
        settleReject(createAbortError());
      }, 3000);
    }

    options.signal?.addEventListener("abort", handleAbort, { once: true });

    worker.onerror = (event) => {
      settleReject(
        new Error(
          event.message || "Local story analysis worker failed unexpectedly.",
        ),
      );
    };

    worker.onmessage = (
      event: MessageEvent<LocalStoryAnalysisWorkerMessage>,
    ) => {
      const message = event.data;

      if (!message || message.requestId !== requestId) return;

      if (message.type === "progress") {
        options.onProgress?.(message.snapshot);
        return;
      }

      if (message.type === "complete") {
        settleResolve({
          summary: message.summary,
          analysisResult: message.analysisResult,
        });
        return;
      }

      if (message.type === "error") {
        settleReject(new Error(message.errorMessage));
      }
    };

    worker.postMessage({
      type: "resume",
      ...input,
      requestId,
    } satisfies LocalStoryAnalysisWorkerResumeRequest);
  });
}
