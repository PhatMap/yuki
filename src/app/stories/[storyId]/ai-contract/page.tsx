import { StoryAiContractClient } from "@/components/story/story-ai-contract-client";

interface StoryAiContractPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryAiContractPage({
  params,
}: StoryAiContractPageProps) {
  const { storyId } = await params;

  return <StoryAiContractClient storyId={storyId} />;
}
