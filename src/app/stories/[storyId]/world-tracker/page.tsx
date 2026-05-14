import { StoryWorldTrackerClient } from "@/components/story/story-world-tracker-client";

interface StoryWorldTrackerPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryWorldTrackerPage({
  params,
}: StoryWorldTrackerPageProps) {
  const { storyId } = await params;

  return <StoryWorldTrackerClient storyId={storyId} />;
}
