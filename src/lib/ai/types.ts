import type {
  ChapterChunk,
  ImportedChapter,
  Story,
  StoryAnalysisResult,
} from "@/lib/types";
import type { AiRuntimeSettings } from "@/lib/settings/ai-runtime-settings";
import type { PromptRenderResult } from "@/lib/prompts/prompt-runtime";

export type AiPipelineStatus = "idle" | "running" | "completed" | "failed";

export type AiPipelineStep =
  | "prepare-input"
  | "render-prompt"
  | "analyze-characters"
  | "analyze-events"
  | "analyze-world"
  | "analyze-style"
  | "call-provider"
  | "validate-output"
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

export interface AiPipelinePromptContext {
  templateId: string;
  templateTitle: string;
  systemIdentityTitle?: string;
  prompt: string;
  missingVariables: string[];
  usedVariables: string[];
}

export interface AiPipelineRuntimeContext {
  settings: AiRuntimeSettings;
  providerId: string;
  providerLabel: string;
  endpoint: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
}

export interface AiPipelineExecutionContext {
  runtime: AiPipelineRuntimeContext;
  renderedPrompt: PromptRenderResult;
}

export interface AiPipelineResult {
  providerId: string;
  providerLabel: string;
  status: AiPipelineStatus;
  analysisResult?: StoryAnalysisResult;
  errorMessage?: string;
  steps: AiPipelineProgress[];
  startedAt: string;
  completedAt: string;
  runtime?: AiPipelineRuntimeContext;
  promptContext?: AiPipelinePromptContext;
}

export interface AiPipelineProvider {
  id: string;
  label: string;
  description: string;
  isConfigured?: () => boolean;
  run(
    input: AiPipelineInput,
    context: AiPipelineExecutionContext,
  ): Promise<AiPipelineResult>;
}
