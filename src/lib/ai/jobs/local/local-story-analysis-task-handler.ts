import { runMockAnalysis } from "@/lib/mock-analysis";
import type { StoryAnalysisTaskInput } from "@/lib/ai/jobs/story-analysis-job-planner";
import type { AiJob, AiJobTask } from "@/lib/ai/jobs/types";
import type {
  ChapterChunk,
  ImportedChapter,
  StoryAnalysisResult,
} from "@/lib/types";

export interface LocalStoryAnalysisTaskSource {
  storyId: string;
  chapters: ImportedChapter[];
  chunks: ChapterChunk[];
}

export interface LocalStoryAnalysisTaskOutput {
  taskId: string;
  jobId: string;
  kind: string;
  cacheKey?: string;
  processedAt: string;
  chapterIds: string[];
  chunkIds: string[];
  chapterNumbers: number[];
  partialResult: StoryAnalysisResult;
  summary: string;
}

function waitForAbort(signal?: AbortSignal) {
  if (!signal?.aborted) return;

  throw signal.reason ?? new DOMException("Aborted", "AbortError");
}

function getChapterContentFromChunks(chunks: ChapterChunk[]) {
  return chunks
    .slice()
    .sort((left, right) => left.chunkIndex - right.chunkIndex)
    .map((chunk) => chunk.content)
    .join("\n\n");
}

function createFallbackChaptersFromChunks({
  storyId,
  chunks,
}: {
  storyId: string;
  chunks: ChapterChunk[];
}): ImportedChapter[] {
  const chunksByChapterId = new Map<string, ChapterChunk[]>();

  for (const chunk of chunks) {
    const current = chunksByChapterId.get(chunk.chapterId) ?? [];
    current.push(chunk);
    chunksByChapterId.set(chunk.chapterId, current);
  }

  return Array.from(chunksByChapterId.entries()).map(
    ([chapterId, chapterChunks]) => {
      const firstChunk = chapterChunks[0];
      const content = getChapterContentFromChunks(chapterChunks);

      return {
        id: chapterId,
        storyId,
        chapterNumber: firstChunk?.chapterNumber ?? 0,
        title: `Chapter ${firstChunk?.chapterNumber ?? "unknown"}`,
        rawContent: content,
        cleanContent: content,
        wordCount: chapterChunks.reduce(
          (total, chunk) => total + chunk.wordCount,
          0,
        ),
        status: "parsed",
        createdAt: "1970-01-01T00:00:00.000Z",
      } satisfies ImportedChapter;
    },
  );
}

function selectTaskChapters(
  taskInput: StoryAnalysisTaskInput,
  source: LocalStoryAnalysisTaskSource,
) {
  const chapterIdSet = new Set(taskInput.chapterIds);
  const chunkIdSet = new Set(taskInput.chunkIds);

  const selectedChapters = source.chapters.filter((chapter) =>
    chapterIdSet.has(chapter.id),
  );

  if (selectedChapters.length > 0) {
    return selectedChapters;
  }

  const selectedChunks = source.chunks.filter((chunk) => chunkIdSet.has(chunk.id));

  return createFallbackChaptersFromChunks({
    storyId: source.storyId,
    chunks: selectedChunks,
  });
}

export async function runLocalStoryAnalysisTask(
  task: AiJobTask<StoryAnalysisTaskInput>,
  job: AiJob,
  source: LocalStoryAnalysisTaskSource,
  signal?: AbortSignal,
): Promise<LocalStoryAnalysisTaskOutput> {
  waitForAbort(signal);

  const selectedChapters = selectTaskChapters(task.input, source);
  const partialResult = runMockAnalysis(source.storyId, selectedChapters);

  waitForAbort(signal);

  return {
    taskId: task.id,
    jobId: job.id,
    kind: task.kind,
    cacheKey: task.cacheKey,
    processedAt: new Date().toISOString(),
    chapterIds: task.input.chapterIds,
    chunkIds: task.input.chunkIds,
    chapterNumbers: task.input.chapterNumbers,
    partialResult,
    summary: `Local mock analysis processed ${selectedChapters.length} chapter(s).`,
  };
}
