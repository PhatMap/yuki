import { StoryAiProxyTestClient } from "@/components/story/story-ai-proxy-test-client";

interface StoryAiProxyTestPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryAiProxyTestPage({
  params,
}: StoryAiProxyTestPageProps) {
  const { storyId } = await params;

  return <StoryAiProxyTestClient storyId={storyId} />;
}
