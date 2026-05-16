import type { AiRuntimeSettings } from "@/lib/settings/ai-runtime-settings";
import type { ChapterChunk, ImportedChapter, Story } from "@/lib/types";

export interface LocalStoryAnalysisWorkerProviderTarget {
  providerId: string;
  model: string;
  endpoint?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LocalStoryAnalysisWorkerRequest {
  requestId: string;
  storyId: string;
  story?: Story;
  chapters: ImportedChapter[];
  chunks: ChapterChunk[];
  runtimeSettings?: AiRuntimeSettings;
  providerTarget?: LocalStoryAnalysisWorkerProviderTarget;
  batchSize?: number;
}

export interface LocalStoryAnalysisWorkerProgressSnapshot {
  jobId: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  skippedTasks: number;
  failedTasks: number;
  percentComplete: number;
  message?: string;
}

export interface LocalStoryAnalysisWorkerProgressMessage {
  type: "progress";
  requestId: string;
  snapshot: LocalStoryAnalysisWorkerProgressSnapshot;
}

export interface LocalStoryAnalysisWorkerCompleteMessage {
  type: "complete";
  requestId: string;
  summary: LocalStoryAnalysisWorkerProgressSnapshot;
}

export interface LocalStoryAnalysisWorkerErrorMessage {
  type: "error";
  requestId: string;
  errorMessage: string;
}

export type LocalStoryAnalysisWorkerMessage =
  | LocalStoryAnalysisWorkerProgressMessage
  | LocalStoryAnalysisWorkerCompleteMessage
  | LocalStoryAnalysisWorkerErrorMessage;
