import { StoryRelationshipsClient } from "@/components/story/story-relationships-client";

interface StoryRelationshipsPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryRelationshipsPage({
  params,
}: StoryRelationshipsPageProps) {
  const { storyId } = await params;

  return <StoryRelationshipsClient storyId={storyId} />;
}
