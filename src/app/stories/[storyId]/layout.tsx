import type { ReactNode } from "react";

import { StoryNavigation } from "@/components/app/story-navigation";

interface StoryLayoutProps {
  children: ReactNode;
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryLayout({
  children,
  params,
}: StoryLayoutProps) {
  const { storyId } = await params;

  return (
    <div className="app-story-shell">
      <div className="app-story-shell-nav">
        <div className="app-story-shell-nav-inner">
          <div className="app-story-shell-title">
            <p className="app-page-eyebrow">Story Workspace</p>
            <h1 className="text-base font-semibold leading-tight sm:text-lg">
              Story tools
            </h1>
          </div>
          <StoryNavigation storyId={storyId} />
        </div>
      </div>
      {children}
    </div>
  );
}
