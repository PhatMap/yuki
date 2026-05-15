import { StoryPublishingExportClient } from "@/components/story/story-publishing-export-client";

interface StoryPublishingExportPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryPublishingExportPage({
  params,
}: StoryPublishingExportPageProps) {
  const { storyId } = await params;

  return <StoryPublishingExportClient storyId={storyId} />;
}
