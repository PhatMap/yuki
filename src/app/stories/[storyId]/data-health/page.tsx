import { StoryDataHealthClient } from "@/components/story/story-data-health-client";

interface StoryDataHealthPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryDataHealthPage({
  params,
}: StoryDataHealthPageProps) {
  const { storyId } = await params;

  return <StoryDataHealthClient storyId={storyId} />;
}
