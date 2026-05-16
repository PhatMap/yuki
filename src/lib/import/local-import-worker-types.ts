import type { AnalysisStatus, ChapterChunk, ImportedChapter } from "@/lib/types";

export interface LocalImportWorkerRequest {
  requestId: string;
  storyId: string;
  text: string;
}

export interface LocalImportWorkerProgressSnapshot {
  status: "detecting" | "chunking" | "completed";
  message: string;
  chapterCount: number;
  chunkCount: number;
  percentComplete: number;
}

export interface LocalImportWorkerResult {
  chapters: ImportedChapter[];
  chunks: ChapterChunk[];
  analysisStatus: AnalysisStatus;
}

export interface LocalImportWorkerProgressMessage {
  type: "progress";
  requestId: string;
  snapshot: LocalImportWorkerProgressSnapshot;
}

export interface LocalImportWorkerCompleteMessage {
  type: "complete";
  requestId: string;
  result: LocalImportWorkerResult;
}

export interface LocalImportWorkerErrorMessage {
  type: "error";
  requestId: string;
  errorMessage: string;
}

export type LocalImportWorkerMessage =
  | LocalImportWorkerProgressMessage
  | LocalImportWorkerCompleteMessage
  | LocalImportWorkerErrorMessage;
