import type { AiPipelineInput } from "@/lib/ai/types";
import type { StoryAnalysisResult } from "@/lib/types";

export type GeminiProxyTask = "story-analysis";

export interface GeminiProxyRuntimeOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiProxyPromptTemplateSnapshot {
  id: string;
  title: string;
  missingVariables: string[];
  usedVariables: string[];
}

export interface GeminiProxyRenderedPromptPackageSnapshot {
  promptId: string;
  promptVersion: number;
  category: string;
  scope: "global" | "story-specific";
  storyId?: string;
  outputSchemaId: string;
  estimatedTokens?: number;
}

export interface GeminiProxyRequestBody {
  provider?: string;
  task: GeminiProxyTask;
  model: string;
  runtime?: GeminiProxyRuntimeOptions;
  prompt: string;
  promptTemplate?: GeminiProxyPromptTemplateSnapshot;
  promptPackage?: GeminiProxyRenderedPromptPackageSnapshot;
  input: AiPipelineInput;
}

export interface GeminiProxySuccessResponse {
  provider: "gemini-proxy";
  model: string;
  analysisResult: StoryAnalysisResult;
  completedAt: string;
}

export interface GeminiProxyErrorResponse {
  provider: "gemini-proxy";
  errorMessage: string;
  completedAt: string;
}
