import { runLocalStoryAnalysisJob } from "@/lib/ai/jobs/local/run-local-story-analysis-job";
import { resumeLocalStoryAnalysisJob } from "@/lib/ai/jobs/local/resume-local-story-analysis-job";
import type {
  LocalStoryAnalysisWorkerCancelRequest,
  LocalStoryAnalysisWorkerIncomingMessage,
  LocalStoryAnalysisWorkerMessage,
  LocalStoryAnalysisWorkerProgressSnapshot,
  LocalStoryAnalysisWorkerResumeRequest,
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
  hasFailedTasks,
  hasCompletedAllTasks,
  canSaveAggregatedResult,
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
    hasFailedTasks,
    hasCompletedAllTasks,
    canSaveAggregatedResult,
  };
}

let activeAbortController: AbortController | null = null;
let activeRequestId: string | null = null;

function isCancelRequest(
  message: LocalStoryAnalysisWorkerIncomingMessage,
): message is LocalStoryAnalysisWorkerCancelRequest {
  return "type" in message && message.type === "cancel";
}

function isResumeRequest(
  message: LocalStoryAnalysisWorkerIncomingMessage,
): message is LocalStoryAnalysisWorkerResumeRequest {
  return "type" in message && message.type === "resume";
}

globalThis.addEventListener(
  "message",
  async (event: MessageEvent<LocalStoryAnalysisWorkerIncomingMessage>) => {
    const request = event.data;

    if (isCancelRequest(request)) {
      if (activeAbortController && activeRequestId === request.requestId) {
        activeAbortController.abort(
          new DOMException(
            "Local worker analysis job cancelled.",
            "AbortError",
          ),
        );
      }

      return;
    }

    const controller = new AbortController();
    activeAbortController = controller;
    activeRequestId = request.requestId;

    try {
      const isResume = isResumeRequest(request);
      const result = isResume
        ? await resumeLocalStoryAnalysisJob({
            storyId: request.storyId,
            jobId: request.jobId,
            story: request.story,
            chapters: request.chapters,
            chunks: request.chunks,
            runtimeSettings: request.runtimeSettings,
            signal: controller.signal,
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
          })
        : await runLocalStoryAnalysisJob({
            storyId: request.storyId,
            story: request.story,
            chapters: request.chapters,
            chunks: request.chunks,
            runtimeSettings: request.runtimeSettings,
            providerTarget: "providerTarget" in request ? request.providerTarget : undefined,
            runtimeTarget: "local-worker",
            batchSize: "batchSize" in request ? request.batchSize : undefined,
            signal: controller.signal,
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
          hasFailedTasks: result.hasFailedTasks,
          hasCompletedAllTasks: result.hasCompletedAllTasks,
          canSaveAggregatedResult: result.canSaveAggregatedResult,
        }),
        analysisResult: result.analysisResult,
      });
    } catch (error) {
      postWorkerMessage({
        type: "error",
        requestId: request.requestId,
        errorMessage: getErrorMessage(error),
      });
    } finally {
      if (activeRequestId === request.requestId) {
        activeAbortController = null;
        activeRequestId = null;
      }
    }
  },
);

export {};
