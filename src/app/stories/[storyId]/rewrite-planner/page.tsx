import { StoryRewritePlannerClient } from "@/components/story/story-rewrite-planner-client";

interface StoryRewritePlannerPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryRewritePlannerPage({
  params,
}: StoryRewritePlannerPageProps) {
  const { storyId } = await params;

  return <StoryRewritePlannerClient storyId={storyId} />;
}
