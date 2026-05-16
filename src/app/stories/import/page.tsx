"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpenCheck, FileText, Upload } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { ProgressMeter } from "@/components/app/progress-meter";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveImportedStoryData } from "@/lib/db/indexed-db";
import {
  runLocalImportWorker,
} from "@/lib/import/run-local-import-worker";
import type { LocalImportWorkerProgressSnapshot } from "@/lib/import/local-import-worker-types";
import type { ChapterChunk, ImportedChapter, Story } from "@/lib/types";

const tempStoryId = "preview-import-story";

export default function ImportNovelPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [novelText, setNovelText] = useState("");
  const [detectedChapters, setDetectedChapters] = useState<ImportedChapter[]>(
    [],
  );
  const [detectedChunks, setDetectedChunks] = useState<ChapterChunk[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [importProgress, setImportProgress] =
    useState<LocalImportWorkerProgressSnapshot>();

  const totalWordCount = useMemo(() => {
    return detectedChapters.reduce(
      (total, chapter) => total + chapter.wordCount,
      0,
    );
  }, [detectedChapters]);

  const chunkCountsByChapterId = useMemo(() => {
    return detectedChunks.reduce<Record<string, number>>((counts, chunk) => {
      counts[chunk.chapterId] = (counts[chunk.chapterId] ?? 0) + 1;

      return counts;
    }, {});
  }, [detectedChunks]);

  async function handleDetectChapters() {
    setCreateError("");
    setImportProgress(undefined);

    try {
      const result = await runLocalImportWorker({
        storyId: tempStoryId,
        text: novelText,
      }, {
        onProgress: setImportProgress,
      });

      setDetectedChapters(result.chapters);
      setDetectedChunks(result.chunks);
      setImportProgress({
        status: "completed",
        message: "Import preview is ready.",
        chapterCount: result.chapters.length,
        chunkCount: result.chunks.length,
        percentComplete: 100,
      });
    } catch (error) {
      console.error("Failed to process import preview", error);
      setCreateError(
        error instanceof Error
          ? `Import preview failed: ${error.message}`
          : "Import preview failed.",
      );
    }
  }

  async function handleCreateStoryFromImport() {
    if (isCreating) return;

    setIsCreating(true);
    setCreateError("");

    const storyId = `story-${Date.now()}`;

    try {
      const processedImport = await runLocalImportWorker(
        {
          storyId,
          text: novelText,
        },
        {
          onProgress: setImportProgress,
        },
      );

      const importedChapters = processedImport.chapters;
      const chunks = processedImport.chunks;

      if (importedChapters.length === 0) {
        setIsCreating(false);
        setCreateError("KhÃ´ng thá»ƒ táº¡o chÆ°Æ¡ng tá»« ná»™i dung Ä‘Ã£ nháº­p.");
        return;
      }

      const analysisStatus = processedImport.analysisStatus;
      const now = new Date().toISOString();
      const storyTitle = title.trim() || "Imported Novel";

      const newStory: Story = {
        id: storyId,
        title: storyTitle,
        description:
          importedChapters[0]?.cleanContent.slice(0, 240) ||
          "Imported long-form novel.",
        author: author.trim(),
        genre: "adventure",
        tone: "dramatic",
        canonAdherence: "completely-different",
        isFanwork: false,
        source: "import",
        createdAt: now,
        updatedAt: now,
      };

      await saveImportedStoryData({
        story: newStory,
        chapters: importedChapters,
        chunks,
        analysisStatus,
      });
    } catch (error) {
      console.error("Failed to save imported novel to IndexedDB", error);
      setCreateError("Could not save imported story data to IndexedDB.");
      setIsCreating(false);
      return;
    }

    router.push(`/stories/${storyId}/analysis`);
  }

  return (
    <PageShell>
      <PageContainer className="max-w-6xl">
        <PageHeader
          eyebrow="Import Novel"
          title="Import Novel"
          description="Náº¡p truyá»‡n cÃ³ sáºµn Ä‘á»ƒ phÃ¢n tÃ­ch chÆ°Æ¡ng, nhÃ¢n váº­t, timeline, váº­t pháº©m, thuáº­t ngá»¯ vÃ  vÄƒn phong."
        />

        <div className="space-y-3">
          <div className="app-warning-box max-w-3xl">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>
              IndexedDB is the source of truth for long story, chapter, and
              chunk data in this local-first prototype.
            </p>
          </div>
          <div className="flex max-w-3xl gap-3 rounded-lg border bg-background p-4 text-sm text-muted-foreground">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>
              Browser key-value storage is reserved for small UI preferences
              and temporary compatibility reads, not new large imports.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <SectionCard
            icon={<Upload className="h-5 w-5" />}
            title="Novel source"
            contentClassName="space-y-5"
          >
            <div className="app-form-grid">
              <div className="grid gap-2">
                <Label htmlFor="novel-title">TÃªn truyá»‡n</Label>
                <Input
                  id="novel-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="VÃ­ dá»¥: ThiÃªn Kiáº¿m LÆ°u VÃ¢n"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="novel-author">TÃ¡c giáº£</Label>
                <Input
                  id="novel-author"
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="TÃªn tÃ¡c giáº£ hoáº·c nguá»“n"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="novel-content">Ná»™i dung truyá»‡n</Label>
              <Textarea
                id="novel-content"
                className="min-h-[520px] text-sm leading-6"
                value={novelText}
                onChange={(event) => setNovelText(event.target.value)}
                placeholder="Paste toÃ n bá»™ truyá»‡n hoáº·c nhiá»u chÆ°Æ¡ng vÃ o Ä‘Ã¢y..."
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleDetectChapters}
              >
                <BookOpenCheck className="mr-2 h-4 w-4" />
                Detect chapters
              </Button>
              <Button
                type="button"
                onClick={handleCreateStoryFromImport}
                disabled={!novelText.trim() || isCreating}
              >
                <FileText className="mr-2 h-4 w-4" />
                {isCreating ? "Äang táº¡o..." : "Create story from import"}
              </Button>
            </div>

            {importProgress ? (
              <div className="rounded-lg border bg-background p-4">
                <ProgressMeter
                  value={importProgress.percentComplete}
                  label={importProgress.status}
                  description={`${importProgress.message} ${importProgress.chapterCount.toLocaleString("vi-VN")} chapters Â· ${importProgress.chunkCount.toLocaleString("vi-VN")} chunks`}
                />
              </div>
            ) : null}

            {createError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {createError}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Preview chÆ°Æ¡ng">
            {detectedChapters.length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">
                    {detectedChapters.length} chÆ°Æ¡ng detected
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Khoáº£ng {totalWordCount.toLocaleString("vi-VN")} tá»« Â·{" "}
                    {detectedChunks.length.toLocaleString("vi-VN")} chunks
                  </p>
                </div>

                <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
                  {detectedChapters.map((chapter) => (
                    <article
                      className="rounded-lg border bg-background p-3"
                      key={chapter.id}
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        ChÆ°Æ¡ng {chapter.chapterNumber}
                      </p>
                      <h2 className="mt-1 text-sm font-semibold">
                        {chapter.title}
                      </h2>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {chapter.wordCount.toLocaleString("vi-VN")} tá»« Æ°á»›c tÃ­nh
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(
                          chunkCountsByChapterId[chapter.id] ?? 0
                        ).toLocaleString("vi-VN")}{" "}
                        chunks
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title="ChÆ°a detect chÆ°Æ¡ng"
                description="Paste ná»™i dung truyá»‡n rá»“i báº¥m Detect chapters Ä‘á»ƒ xem preview."
              />
            )}
          </SectionCard>
        </div>
      </PageContainer>
    </PageShell>
  );
}
