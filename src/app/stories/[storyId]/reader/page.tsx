import { StoryReaderClient } from "@/components/story/story-reader-client";

interface StoryReaderPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryReaderPage({
  params,
}: StoryReaderPageProps) {
  const { storyId } = await params;

  return <StoryReaderClient storyId={storyId} />;
}
