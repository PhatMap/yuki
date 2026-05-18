import type { ReactNode } from "react";

import { StoryNavigation } from "@/components/app/story-navigation";
import { StorySettingsProvider } from "@/components/app/story-settings-provider";

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
    <StorySettingsProvider storyId={storyId}>
      <div className="app-story-shell">
        <div className="app-story-shell-nav">
          <div className="app-story-shell-nav-inner">
            <div className="app-story-shell-title">
              <p className="app-story-shell-eyebrow">Yuki Story OS</p>
              <h2 className="app-story-shell-heading">Hành trình viết truyện</h2>
            </div>

            <StoryNavigation storyId={storyId} />
          </div>
        </div>

        <div className="app-story-shell-body">{children}</div>
      </div>
    </StorySettingsProvider>
  );
}
