import { StoryWorkspaceClient } from "@/components/story/story-workspace-client";

interface StoryWorkspacePageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryWorkspacePage({
  params,
}: StoryWorkspacePageProps) {
  const { storyId } = await params;

  return <StoryWorkspaceClient storyId={storyId} />;
}
