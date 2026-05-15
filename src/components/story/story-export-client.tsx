"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Clipboard,
  Database,
  Download,
  FileJson,
  RefreshCw,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import {
  buildStoryExportSnapshot,
  createStoryExportFilename,
  stringifyStoryExportSnapshot,
  type StoryExportSnapshot,
} from "@/lib/export/story-export";

interface StoryExportClientProps {
  storyId: string;
}

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

function downloadTextFile({
  filename,
  content,
  type,
}: {
  filename: string;
  content: string;
  type: string;
}) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function StoryExportClient({ storyId }: StoryExportClientProps) {
  const [snapshot, setSnapshot] = useState<StoryExportSnapshot>();
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const jsonPreview = useMemo(() => {
    if (!snapshot) return "";

    const compactPreview = {
      exportVersion: snapshot.exportVersion,
      exportedAt: snapshot.exportedAt,
      storyId: snapshot.storyId,
      story: snapshot.story
        ? {
            id: snapshot.story.id,
            title: snapshot.story.title,
            author: snapshot.story.author,
            source: snapshot.story.source,
            updatedAt: snapshot.story.updatedAt,
          }
        : null,
      summary: snapshot.summary,
    };

    return JSON.stringify(compactPreview, null, 2);
  }, [snapshot]);

  async function handleBuildSnapshot() {
    setIsLoading(true);
    setActionMessage("");
    setErrorMessage("");

    try {
      const nextSnapshot = await buildStoryExportSnapshot(storyId);

      setSnapshot(nextSnapshot);
      setActionMessage("IndexedDB export snapshot generated.");
    } catch (error) {
      console.error("Failed to build story export snapshot", error);
      setErrorMessage("Could not read story data from IndexedDB.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleDownloadJson() {
    if (!snapshot) return;

    downloadTextFile({
      filename: createStoryExportFilename(snapshot),
      content: stringifyStoryExportSnapshot(snapshot),
      type: "application/json;charset=utf-8",
    });

    setActionMessage("JSON export downloaded.");
  }

  async function handleCopyJsonPreview() {
    if (!snapshot) return;

    try {
      await navigator.clipboard.writeText(
        stringifyStoryExportSnapshot(snapshot),
      );
      setActionMessage("Full JSON export copied to clipboard.");
    } catch (error) {
      console.error("Failed to copy export JSON", error);
      setActionMessage("Could not copy JSON export.");
    }
  }

  const title = snapshot?.story?.title ?? "Story Export";
  const description = snapshot
    ? `Export snapshot generated at ${formatDateTime(snapshot.exportedAt)}.`
    : "Generate a downloadable JSON backup from IndexedDB story data.";

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="IndexedDB Export"
          title={title}
          description={description}
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/workspace`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Workspace
                </Link>
              </Button>

              <Button
                type="button"
                onClick={handleBuildSnapshot}
                disabled={isLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {isLoading ? "Reading..." : "Generate Snapshot"}
              </Button>
            </>
          }
        />

        {errorMessage ? (
          <section className="app-warning-box border-destructive/40 bg-destructive/10 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{errorMessage}</p>
          </section>
        ) : null}

        {actionMessage ? (
          <section className="app-warning-box">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>{actionMessage}</p>
          </section>
        ) : null}

        {!snapshot ? (
          <EmptyState
            title="No export snapshot yet"
            description="Generate a snapshot to inspect and download this story's IndexedDB data as JSON."
            action={
              <Button
                type="button"
                onClick={handleBuildSnapshot}
                disabled={isLoading}
              >
                <FileJson className="mr-2 h-4 w-4" />
                {isLoading ? "Reading IndexedDB..." : "Generate Snapshot"}
              </Button>
            }
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                title="Chapters"
                value={formatNumber(snapshot.summary.chapterCount)}
                description={`${formatNumber(snapshot.summary.totalWordCount)} words`}
              />
              <StatCard
                icon={<Database className="h-4 w-4" />}
                title="Chunks"
                value={formatNumber(snapshot.summary.chunkCount)}
                description="IndexedDB chunk records"
              />
              <StatCard
                icon={<FileJson className="h-4 w-4" />}
                title="Analysis"
                value={snapshot.summary.hasAnalysisResult ? "Included" : "None"}
                description={
                  snapshot.summary.hasAnalysisStatus
                    ? "Analysis status included"
                    : "No status record"
                }
              />
              <StatCard
                icon={<RefreshCw className="h-4 w-4" />}
                title="Rewrite drafts"
                value={formatNumber(snapshot.summary.rewriteDraftCount)}
                description={`${formatNumber(snapshot.summary.branchChangeCount)} branch changes`}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <SectionCard
                title="Export preview"
                description="Preview is shortened for readability. Download or copy includes the full JSON payload."
              >
                <pre className="app-json-panel">
                  <code>{jsonPreview}</code>
                </pre>
              </SectionCard>

              <aside className="space-y-4">
                <SectionCard title="Download">
                  <div className="space-y-3">
                    <Button className="w-full" onClick={handleDownloadJson}>
                      <Download className="mr-2 h-4 w-4" />
                      Download JSON
                    </Button>

                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleCopyJsonPreview}
                    >
                      <Clipboard className="mr-2 h-4 w-4" />
                      Copy Full JSON
                    </Button>

                    <p className="app-muted-text">
                      Filename:{" "}
                      <span className="font-mono">
                        {createStoryExportFilename(snapshot)}
                      </span>
                    </p>
                  </div>
                </SectionCard>

                <SectionCard title="Included data">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Story metadata</li>
                    <li>Story setup fields</li>
                    <li>Imported chapters</li>
                    <li>Chapter chunks</li>
                    <li>Analysis status/result</li>
                    <li>Branches and branch changes</li>
                    <li>Continuity issues</li>
                    <li>Rewrite drafts</li>
                  </ul>
                </SectionCard>

                <SectionCard title="Not included">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>UI display settings</li>
                    <li>AI provider selection</li>
                    <li>Legacy localStorage keys</li>
                    <li>API keys or server config</li>
                  </ul>
                </SectionCard>
              </aside>
            </section>
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}
