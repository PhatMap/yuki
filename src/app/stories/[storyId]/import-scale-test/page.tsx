import { StoryImportScaleTestClient } from "@/components/story/story-import-scale-test-client";

type PageProps = {
  params: Promise<{ storyId: string }>;
};

export default async function ImportScaleTestPage({ params }: PageProps) {
  const { storyId } = await params;

  return <StoryImportScaleTestClient storyId={storyId} />;
}
