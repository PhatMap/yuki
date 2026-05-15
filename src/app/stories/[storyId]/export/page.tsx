import { StoryExportClient } from "@/components/story/story-export-client";

interface StoryExportPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryExportPage({
  params,
}: StoryExportPageProps) {
  const { storyId } = await params;

  return <StoryExportClient storyId={storyId} />;
}
