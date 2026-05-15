import { redirect } from "next/navigation";

interface StoryLandingPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryLandingPage({
  params,
}: StoryLandingPageProps) {
  const { storyId } = await params;

  redirect(`/stories/${storyId}/reader`);
}
