import type {
  RuntimeDiagnosticsWorkerIncomingMessage,
  RuntimeDiagnosticsWorkerOutgoingMessage,
} from "@/lib/settings/runtime-diagnostics-worker-types";

function postWorkerMessage(message: RuntimeDiagnosticsWorkerOutgoingMessage) {
  globalThis.postMessage(message);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

globalThis.addEventListener(
  "message",
  (event: MessageEvent<RuntimeDiagnosticsWorkerIncomingMessage>) => {
    const message = event.data;

    try {
      if (!message || message.type !== "ping") return;

      postWorkerMessage({
        type: "pong",
        requestId: message.requestId,
        indexedDbAvailable: typeof globalThis.indexedDB !== "undefined",
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      postWorkerMessage({
        type: "error",
        requestId: message?.requestId ?? "unknown",
        errorMessage: getErrorMessage(error),
      });
    }
  },
);

export {};
