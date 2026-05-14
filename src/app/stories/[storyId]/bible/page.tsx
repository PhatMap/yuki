import { StoryBibleClient } from "@/components/story/story-bible-client";

interface StoryBiblePageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryBiblePage({ params }: StoryBiblePageProps) {
  const { storyId } = await params;

  return <StoryBibleClient storyId={storyId} />;
}
