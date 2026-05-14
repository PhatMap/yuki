import { StoryRewriteDraftClient } from "@/components/story/story-rewrite-draft-client";

interface StoryRewriteDraftPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryRewriteDraftPage({
  params,
}: StoryRewriteDraftPageProps) {
  const { storyId } = await params;

  return <StoryRewriteDraftClient storyId={storyId} />;
}
