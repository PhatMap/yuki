import { runMockAnalysis } from "@/lib/mock-analysis";
import type {
  AiPipelineInput,
  AiPipelineProgress,
  AiPipelineProvider,
  AiPipelineResult,
  AiPipelineStep,
} from "@/lib/ai/types";

const mockPipelineSteps: {
  step: AiPipelineStep;
  message: string;
}[] = [
  {
    step: "prepare-input",
    message: "Preparing imported chapters for local mock analysis.",
  },
  {
    step: "analyze-characters",
    message: "Extracting mock character signals.",
  },
  {
    step: "analyze-events",
    message: "Creating mock timeline events.",
  },
  {
    step: "analyze-world",
    message: "Detecting mock items, terms, and locations.",
  },
  {
    step: "analyze-style",
    message: "Building mock writing style profile.",
  },
  {
    step: "complete",
    message: "Mock analysis result is ready.",
  },
];

function createProgressTimeline(): AiPipelineProgress[] {
  return mockPipelineSteps.map((item, index) => ({
    status: index === mockPipelineSteps.length - 1 ? "completed" : "running",
    currentStep: item.step,
    message: item.message,
    completedSteps: mockPipelineSteps
      .slice(0, index + 1)
      .map((stepItem) => stepItem.step),
    totalSteps: mockPipelineSteps.length,
  }));
}

export const mockAiPipelineProvider: AiPipelineProvider = {
  id: "mock",
  label: "Mock pipeline",
  description:
    "Local deterministic analysis provider used before real AI integration.",
  async run(input: AiPipelineInput): Promise<AiPipelineResult> {
    const startedAt = new Date().toISOString();
    const analysisResult = runMockAnalysis(input.storyId, input.chapters);

    return {
      providerId: mockAiPipelineProvider.id,
      providerLabel: mockAiPipelineProvider.label,
      status: "completed",
      analysisResult,
      steps: createProgressTimeline(),
      startedAt,
      completedAt: new Date().toISOString(),
    };
  },
};
