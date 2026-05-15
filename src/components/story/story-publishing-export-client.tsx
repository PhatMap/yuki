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
  FileText,
  RefreshCw,
  ScrollText,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import {
  buildStoryPublishingExportBundle,
  type StoryPublishingExportBundle,
} from "@/lib/export/story-publishing-export";

interface StoryPublishingExportClientProps {
  storyId: string;
}

type ExportPreviewMode = "manuscript" | "framework" | "snapshot";

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

function getPreviewContent(
  bundle: StoryPublishingExportBundle,
  mode: ExportPreviewMode,
) {
  if (mode === "framework") return bundle.frameworkMarkdown;
  if (mode === "snapshot") return bundle.snapshotJson;

  return bundle.manuscriptText;
}

function getPreviewFilename(
  bundle: StoryPublishingExportBundle,
  mode: ExportPreviewMode,
) {
  if (mode === "framework") return bundle.filenames.frameworkMarkdown;
  if (mode === "snapshot") return bundle.filenames.snapshotJson;

  return bundle.filenames.manuscriptText;
}

function getPreviewType(mode: ExportPreviewMode) {
  if (mode === "framework") return "text/markdown;charset=utf-8";
  if (mode === "snapshot") return "application/json;charset=utf-8";

  return "text/plain;charset=utf-8";
}

export function StoryPublishingExportClient({
  storyId,
}: StoryPublishingExportClientProps) {
  const [bundle, setBundle] = useState<StoryPublishingExportBundle>();
  const [previewMode, setPreviewMode] =
    useState<ExportPreviewMode>("manuscript");
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const previewContent = useMemo(() => {
    if (!bundle) return "";

    const content = getPreviewContent(bundle, previewMode);

    if (content.length <= 12000) return content;

    return `${content.slice(0, 12000)}\n\n... Preview truncated. Download or copy to get the full export.`;
  }, [bundle, previewMode]);

  async function handleBuildBundle() {
    setIsLoading(true);
    setActionMessage("");
    setErrorMessage("");

    try {
      const nextBundle = await buildStoryPublishingExportBundle(storyId);

      setBundle(nextBundle);
      setActionMessage("Export bundle generated from IndexedDB.");
    } catch (error) {
      console.error("Failed to build export bundle", error);
      setErrorMessage("Could not read story data from IndexedDB.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleDownloadCurrentPreview() {
    if (!bundle) return;

    downloadTextFile({
      filename: getPreviewFilename(bundle, previewMode),
      content: getPreviewContent(bundle, previewMode),
      type: getPreviewType(previewMode),
    });

    setActionMessage(`Downloaded ${getPreviewFilename(bundle, previewMode)}.`);
  }

  function handleDownloadAll() {
    if (!bundle) return;

    downloadTextFile({
      filename: bundle.filenames.manuscriptText,
      content: bundle.manuscriptText,
      type: "text/plain;charset=utf-8",
    });

    downloadTextFile({
      filename: bundle.filenames.frameworkMarkdown,
      content: bundle.frameworkMarkdown,
      type: "text/markdown;charset=utf-8",
    });

    downloadTextFile({
      filename: bundle.filenames.snapshotJson,
      content: bundle.snapshotJson,
      type: "application/json;charset=utf-8",
    });

    setActionMessage(
      "Downloaded manuscript TXT, framework MD, and snapshot JSON.",
    );
  }

  async function handleCopyCurrentPreview() {
    if (!bundle) return;

    try {
      await navigator.clipboard.writeText(
        getPreviewContent(bundle, previewMode),
      );
      setActionMessage(`Copied ${getPreviewFilename(bundle, previewMode)}.`);
    } catch (error) {
      console.error("Failed to copy export content", error);
      setActionMessage("Could not copy export content.");
    }
  }

  const title = bundle?.snapshot.story?.title ?? "Publishing Export";
  const description = bundle
    ? `Export bundle generated at ${formatDateTime(bundle.snapshot.exportedAt)}.`
    : "Export imported manuscript and extracted story framework from IndexedDB.";

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Publishing"
          title={title}
          description={description}
          action={
            <>
              <Button asChild variant="outline">
                <Link href={`/stories/${storyId}/reader`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Reader
                </Link>
              </Button>

              <Button
                type="button"
                onClick={handleBuildBundle}
                disabled={isLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {isLoading ? "Reading..." : "Generate Export"}
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

        {!bundle ? (
          <EmptyState
            title="No export generated yet"
            description="Generate an export bundle from IndexedDB. This does not call AI and does not touch localStorage."
            action={
              <Button
                type="button"
                onClick={handleBuildBundle}
                disabled={isLoading}
              >
                <ScrollText className="mr-2 h-4 w-4" />
                {isLoading ? "Reading IndexedDB..." : "Generate Export"}
              </Button>
            }
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                title="Chapters"
                value={formatNumber(bundle.snapshot.summary.chapterCount)}
                description={`${formatNumber(
                  bundle.snapshot.summary.totalWordCount,
                )} estimated words`}
              />
              <StatCard
                icon={<Database className="h-4 w-4" />}
                title="Chunks"
                value={formatNumber(bundle.snapshot.summary.chunkCount)}
                description="IndexedDB chunk records"
              />
              <StatCard
                icon={<FileJson className="h-4 w-4" />}
                title="Framework"
                value={
                  bundle.snapshot.summary.hasAnalysisResult
                    ? "Analysis ready"
                    : "Basic only"
                }
                description={`${formatNumber(
                  bundle.snapshot.summary.characterCount,
                )} characters · ${formatNumber(
                  bundle.snapshot.summary.eventCount,
                )} events`}
              />
              <StatCard
                icon={<FileText className="h-4 w-4" />}
                title="Rewrite data"
                value={formatNumber(bundle.snapshot.summary.branchChangeCount)}
                description={`${formatNumber(
                  bundle.snapshot.summary.rewriteDraftCount,
                )} rewrite drafts`}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <SectionCard
                title="Export preview"
                description="Preview may be truncated for long novels. Download or copy gets the full selected export."
              >
                <div className="mb-4 flex flex-wrap gap-2">
                  <PreviewModeButton
                    active={previewMode === "manuscript"}
                    label="Manuscript TXT"
                    onClick={() => setPreviewMode("manuscript")}
                  />
                  <PreviewModeButton
                    active={previewMode === "framework"}
                    label="Framework MD"
                    onClick={() => setPreviewMode("framework")}
                  />
                  <PreviewModeButton
                    active={previewMode === "snapshot"}
                    label="Snapshot JSON"
                    onClick={() => setPreviewMode("snapshot")}
                  />
                </div>

                <pre className="app-json-panel">
                  <code>{previewContent}</code>
                </pre>
              </SectionCard>

              <aside className="space-y-4">
                <SectionCard title="Download">
                  <div className="space-y-3">
                    <Button
                      className="w-full"
                      onClick={handleDownloadCurrentPreview}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download selected
                    </Button>

                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleCopyCurrentPreview}
                    >
                      <Clipboard className="mr-2 h-4 w-4" />
                      Copy selected
                    </Button>

                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleDownloadAll}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download all
                    </Button>

                    <p className="app-muted-text">
                      Selected file:{" "}
                      <span className="font-mono">
                        {getPreviewFilename(bundle, previewMode)}
                      </span>
                    </p>
                  </div>
                </SectionCard>

                <SectionCard title="Export types">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>
                      <strong className="text-foreground">TXT:</strong> readable
                      full manuscript from imported chapters.
                    </li>
                    <li>
                      <strong className="text-foreground">MD:</strong> shareable
                      story framework extracted from analysis.
                    </li>
                    <li>
                      <strong className="text-foreground">JSON:</strong> full
                      local data snapshot for backup or later import.
                    </li>
                  </ul>
                </SectionCard>

                <SectionCard title="Not included yet">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>True `.docx` generation</li>
                    <li>Supabase sync</li>
                    <li>Vector DB export</li>
                    <li>Server-side publishing pipeline</li>
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

function PreviewModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "rounded-full bg-foreground px-3 py-1.5 text-sm font-medium text-background"
          : "rounded-full border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
      }
      onClick={onClick}
    >
      {label}
    </button>
  );
}
