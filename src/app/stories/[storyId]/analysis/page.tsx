import { StoryAnalysisClient } from "@/components/story/story-analysis-client";

interface StoryAnalysisPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryAnalysisPage({
  params,
}: StoryAnalysisPageProps) {
  const { storyId } = await params;

  return <StoryAnalysisClient storyId={storyId} />;
}
