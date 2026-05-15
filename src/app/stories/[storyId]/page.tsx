import { redirect } from "next/navigation";

interface StoryIndexPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryIndexPage({ params }: StoryIndexPageProps) {
  const { storyId } = await params;

  redirect(`/stories/${storyId}/workspace`);
}
