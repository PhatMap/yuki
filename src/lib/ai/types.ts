import type {
  ChapterChunk,
  ImportedChapter,
  Story,
  StoryAnalysisResult,
} from "@/lib/types";

export type AiPipelineStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed";

export type AiPipelineStep =
  | "prepare-input"
  | "analyze-characters"
  | "analyze-events"
  | "analyze-world"
  | "analyze-style"
  | "complete";

export interface AiPipelineProgress {
  status: AiPipelineStatus;
  currentStep: AiPipelineStep;
  message: string;
  completedSteps: AiPipelineStep[];
  totalSteps: number;
}

export interface AiPipelineInput {
  storyId: string;
  story?: Story;
  chapters: ImportedChapter[];
  chunks?: ChapterChunk[];
}

export interface AiPipelineResult {
  providerId: string;
  providerLabel: string;
  status: AiPipelineStatus;
  analysisResult: StoryAnalysisResult;
  steps: AiPipelineProgress[];
  startedAt: string;
  completedAt: string;
}

export interface AiPipelineProvider {
  id: string;
  label: string;
  description: string;
  run(input: AiPipelineInput): Promise<AiPipelineResult>;
}
