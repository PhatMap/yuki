import { StoryTimelineClient } from "@/components/story/story-timeline-client";

interface StoryTimelinePageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryTimelinePage({
  params,
}: StoryTimelinePageProps) {
  const { storyId } = await params;

  return <StoryTimelineClient storyId={storyId} />;
}
