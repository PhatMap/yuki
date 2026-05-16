import { runMockAnalysis } from "@/lib/mock-analysis";
import { runAiPipelineWithSettings } from "@/lib/ai/pipeline";
import type { AiPipelineInput } from "@/lib/ai/types";
import type { StoryAnalysisTaskInput } from "@/lib/ai/jobs/story-analysis-job-planner";
import type { AiJob, AiJobTask } from "@/lib/ai/jobs/types";
import type { AiRuntimeSettings } from "@/lib/settings/ai-runtime-settings";
import {
  getActiveRuntimeEndpoint,
  getActiveRuntimeModel,
} from "@/lib/settings/ai-runtime-settings";
import type {
  ChapterChunk,
  ImportedChapter,
  Story,
  StoryAnalysisResult,
} from "@/lib/types";

export interface LocalStoryAnalysisTaskSource {
  storyId: string;
  story?: Story;
  chapters: ImportedChapter[];
  chunks: ChapterChunk[];
  runtimeSettings?: AiRuntimeSettings;
}

export interface LocalStoryAnalysisTaskOutput {
  taskId: string;
  jobId: string;
  kind: string;
  providerId: string;
  model?: string;
  endpoint?: string;
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

async function delayWithAbort(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    function onAbort() {
      cleanup();
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    }

    function cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
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
  }).sort((left, right) => left.chapterNumber - right.chapterNumber);
}

function selectTaskChunks(
  taskInput: StoryAnalysisTaskInput,
  source: LocalStoryAnalysisTaskSource,
) {
  const chunkIdSet = new Set(taskInput.chunkIds);

  return source.chunks
    .filter((chunk) => chunkIdSet.has(chunk.id))
    .sort((left, right) => {
      if (left.chapterNumber !== right.chapterNumber) {
        return left.chapterNumber - right.chapterNumber;
      }

      return left.chunkIndex - right.chunkIndex;
    });
}

function createTaskPipelineInput(
  taskInput: StoryAnalysisTaskInput,
  source: LocalStoryAnalysisTaskSource,
  selectedChapters: ImportedChapter[],
  selectedChunks: ChapterChunk[],
): AiPipelineInput {
  return {
    storyId: source.storyId,
    story: source.story,
    chapters: selectedChapters,
    chunks:
      taskInput.chunkIds.length > 0
        ? selectedChunks
        : selectedChunks.length > 0
          ? selectedChunks
          : undefined,
  };
}

export async function runLocalStoryAnalysisTask(
  task: AiJobTask<StoryAnalysisTaskInput>,
  job: AiJob,
  source: LocalStoryAnalysisTaskSource,
  signal?: AbortSignal,
): Promise<LocalStoryAnalysisTaskOutput> {
  waitForAbort(signal);

  const selectedChapters = selectTaskChapters(task.input, source);
  const selectedChunks = selectTaskChunks(task.input, source);
  const providerId = source.runtimeSettings?.providerId ?? "mock";
  const model = source.runtimeSettings
    ? getActiveRuntimeModel(source.runtimeSettings)
    : "mock-local";
  const endpoint = source.runtimeSettings
    ? getActiveRuntimeEndpoint(source.runtimeSettings)
    : "local mock runtime";
  let partialResult: StoryAnalysisResult;
  let summary = "";

  if (providerId === "mock") {
    partialResult = runMockAnalysis(source.storyId, selectedChapters);
    summary = `Local mock analysis processed ${selectedChapters.length} chapter(s).`;
  } else if (providerId === "gemini-proxy") {
    if (!source.runtimeSettings) {
      throw new Error(
        "Gemini Proxy batch task requires runtime settings in local source.",
      );
    }

    const pipelineInput = createTaskPipelineInput(
      task.input,
      source,
      selectedChapters,
      selectedChunks,
    );
    waitForAbort(signal);
    await delayWithAbort(source.runtimeSettings.geminiRequestDelayMs, signal);
    waitForAbort(signal);
    const pipelineResult = await runAiPipelineWithSettings(
      pipelineInput,
      source.runtimeSettings,
    );
    waitForAbort(signal);

    if (pipelineResult.status !== "completed" || !pipelineResult.analysisResult) {
      throw new Error(
        pipelineResult.errorMessage ??
          "Gemini Proxy batch task did not return analysis result.",
      );
    }

    partialResult = pipelineResult.analysisResult;
    summary = `Gemini Proxy analysis processed chapter(s): ${task.input.chapterNumbers.join(
      ", ",
    )}.`;
  } else {
    throw new Error(
      `Provider ${providerId} is not supported by local batch analysis yet.`,
    );
  }

  waitForAbort(signal);

  return {
    taskId: task.id,
    jobId: job.id,
    kind: task.kind,
    providerId,
    model,
    endpoint,
    cacheKey: task.cacheKey,
    processedAt: new Date().toISOString(),
    chapterIds: task.input.chapterIds,
    chunkIds: task.input.chunkIds,
    chapterNumbers: task.input.chapterNumbers,
    partialResult,
    summary,
  };
}
