import { StorySettingsClient } from "@/components/story/story-settings-client";

interface StorySettingsPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StorySettingsPage({
  params,
}: StorySettingsPageProps) {
  const { storyId } = await params;

  return <StorySettingsClient storyId={storyId} />;
}
