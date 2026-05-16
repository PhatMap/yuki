import {
  chunkChapters,
  createInitialAnalysisStatus,
  detectChaptersFromText,
} from "@/lib/novel-processing";
import type {
  LocalImportWorkerMessage,
  LocalImportWorkerRequest,
  LocalImportWorkerProgressSnapshot,
} from "@/lib/import/local-import-worker-types";

function postWorkerMessage(message: LocalImportWorkerMessage) {
  globalThis.postMessage(message);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function progress({
  status,
  message,
  chapterCount,
  chunkCount,
  percentComplete,
}: LocalImportWorkerProgressSnapshot): LocalImportWorkerProgressSnapshot {
  return {
    status,
    message,
    chapterCount,
    chunkCount,
    percentComplete,
  };
}

globalThis.addEventListener(
  "message",
  async (event: MessageEvent<LocalImportWorkerRequest>) => {
    const request = event.data;

    try {
      postWorkerMessage({
        type: "progress",
        requestId: request.requestId,
        snapshot: progress({
          status: "detecting",
          message: "Detecting chapters from imported text.",
          chapterCount: 0,
          chunkCount: 0,
          percentComplete: 20,
        }),
      });

      const chapters = detectChaptersFromText(request.text, request.storyId);

      postWorkerMessage({
        type: "progress",
        requestId: request.requestId,
        snapshot: progress({
          status: "chunking",
          message: "Chunking detected chapters.",
          chapterCount: chapters.length,
          chunkCount: 0,
          percentComplete: 65,
        }),
      });

      const chunks = chunkChapters(chapters);
      const analysisStatus = createInitialAnalysisStatus(
        request.storyId,
        chapters,
        chunks,
      );

      postWorkerMessage({
        type: "complete",
        requestId: request.requestId,
        result: {
          chapters,
          chunks,
          analysisStatus,
        },
      });
    } catch (error) {
      postWorkerMessage({
        type: "error",
        requestId: request.requestId,
        errorMessage: getErrorMessage(error),
      });
    }
  },
);

export {};
