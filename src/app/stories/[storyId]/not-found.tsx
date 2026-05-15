import Link from "next/link";
import { ArrowLeft, FileQuestion, Upload } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageShell } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";

export default function StoryNotFound() {
  return (
    <PageShell>
      <PageContainer>
        <EmptyState
          icon={<FileQuestion className="h-5 w-5" />}
          title="Story page not found"
          description="This story workspace page could not be found. The story may not exist locally, or the route may be unavailable."
          action={
            <>
              <Button asChild variant="outline">
                <Link href="/stories/import">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Story
                </Link>
              </Button>

              <Button asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back Home
                </Link>
              </Button>
            </>
          }
        />
      </PageContainer>
    </PageShell>
  );
}
