import { runLocalStoryAnalysisJob } from "@/lib/ai/jobs/local/run-local-story-analysis-job";
import type {
  LocalStoryAnalysisWorkerMessage,
  LocalStoryAnalysisWorkerRequest,
  LocalStoryAnalysisWorkerProgressSnapshot,
} from "@/lib/ai/jobs/local/worker/local-story-analysis-worker-types";

function postWorkerMessage(message: LocalStoryAnalysisWorkerMessage) {
  globalThis.postMessage(message);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createProgressSnapshot({
  jobId,
  status,
  totalTasks,
  completedTasks,
  skippedTasks,
  failedTasks,
  percentComplete,
  message,
}: LocalStoryAnalysisWorkerProgressSnapshot): LocalStoryAnalysisWorkerProgressSnapshot {
  return {
    jobId,
    status,
    totalTasks,
    completedTasks,
    skippedTasks,
    failedTasks,
    percentComplete,
    message,
  };
}

globalThis.addEventListener(
  "message",
  async (event: MessageEvent<LocalStoryAnalysisWorkerRequest>) => {
    const request = event.data;

    try {
      const result = await runLocalStoryAnalysisJob({
        storyId: request.storyId,
        story: request.story,
        chapters: request.chapters,
        chunks: request.chunks,
        runtimeSettings: request.runtimeSettings,
        providerTarget: request.providerTarget,
        runtimeTarget: "local-worker",
        batchSize: request.batchSize,
        onProgress: (progress, tasks) => {
          const jobId = tasks[0]?.jobId ?? "";

          postWorkerMessage({
            type: "progress",
            requestId: request.requestId,
            snapshot: createProgressSnapshot({
              jobId,
              status: "running",
              totalTasks: progress.totalTasks,
              completedTasks: progress.completedTasks,
              skippedTasks: progress.skippedTasks,
              failedTasks: progress.failedTasks,
              percentComplete: progress.percentComplete,
              message: progress.message,
            }),
          });
        },
      });

      postWorkerMessage({
        type: "complete",
        requestId: request.requestId,
        summary: createProgressSnapshot({
          jobId: result.job.id,
          status: result.job.status,
          totalTasks: result.progress.totalTasks,
          completedTasks: result.completedTasks,
          skippedTasks: result.skippedTasks,
          failedTasks: result.failedTasks,
          percentComplete: result.progress.percentComplete,
          message: result.progress.message,
        }),
        analysisResult: result.analysisResult,
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
