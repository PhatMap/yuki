import { mockAiPipelineProvider } from "@/lib/ai/mock-pipeline";
import type {
  AiPipelineInput,
  AiPipelineProvider,
  AiPipelineResult,
} from "@/lib/ai/types";

const providers = {
  mock: mockAiPipelineProvider,
} satisfies Record<string, AiPipelineProvider>;

export type AiPipelineProviderId = keyof typeof providers;

export function getAiPipelineProvider(
  providerId: AiPipelineProviderId = "mock",
) {
  return providers[providerId];
}

export function listAiPipelineProviders() {
  return Object.values(providers);
}

export async function runAiPipeline(
  input: AiPipelineInput,
  providerId: AiPipelineProviderId = "mock",
): Promise<AiPipelineResult> {
  const provider = getAiPipelineProvider(providerId);

  return provider.run(input);
}
