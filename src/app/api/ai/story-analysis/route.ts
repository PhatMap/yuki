import { NextResponse } from "next/server";

import type { AiPipelineInput, AiPipelineResult } from "@/lib/ai/types";

const providerId = "gemini-proxy";
const providerLabel = "Gemini proxy";

type ProxyRequestBody = {
  provider?: unknown;
  task?: unknown;
  input?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isChapterArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((chapter) => {
      if (!isRecord(chapter)) return false;

      return (
        isString(chapter.id) &&
        isString(chapter.storyId) &&
        typeof chapter.chapterNumber === "number" &&
        isString(chapter.title) &&
        typeof chapter.rawContent === "string" &&
        typeof chapter.cleanContent === "string" &&
        typeof chapter.wordCount === "number" &&
        isString(chapter.status) &&
        isString(chapter.createdAt)
      );
    })
  );
}

function isChunkArray(value: unknown) {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every((chunk) => {
        if (!isRecord(chunk)) return false;

        return (
          isString(chunk.id) &&
          isString(chunk.storyId) &&
          isString(chunk.chapterId) &&
          typeof chunk.chapterNumber === "number" &&
          typeof chunk.chunkIndex === "number" &&
          typeof chunk.content === "string" &&
          typeof chunk.wordCount === "number" &&
          isString(chunk.status)
        );
      }))
  );
}

function isAiPipelineInput(value: unknown): value is AiPipelineInput {
  if (!isRecord(value)) return false;

  return (
    isString(value.storyId) &&
    isChapterArray(value.chapters) &&
    isChunkArray(value.chunks)
  );
}

function createFailedResult({
  message,
  startedAt,
}: {
  message: string;
  startedAt: string;
}): AiPipelineResult {
  return {
    providerId,
    providerLabel,
    status: "failed",
    errorMessage: message,
    steps: [
      {
        status: "failed",
        currentStep: "prepare-input",
        message,
        completedSteps: [],
        totalSteps: 1,
      },
    ],
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  const startedAt = new Date().toISOString();

  let body: ProxyRequestBody;

  try {
    body = (await request.json()) as ProxyRequestBody;
  } catch {
    return NextResponse.json(
      createFailedResult({
        startedAt,
        message: "Invalid JSON request body.",
      }),
      { status: 400 },
    );
  }

  if (body.provider !== providerId) {
    return NextResponse.json(
      createFailedResult({
        startedAt,
        message: "Invalid provider. Expected gemini-proxy.",
      }),
      { status: 400 },
    );
  }

  if (body.task !== "story-analysis") {
    return NextResponse.json(
      createFailedResult({
        startedAt,
        message: "Invalid task. Expected story-analysis.",
      }),
      { status: 400 },
    );
  }

  if (!isAiPipelineInput(body.input)) {
    return NextResponse.json(
      createFailedResult({
        startedAt,
        message:
          "Invalid input. Expected AiPipelineInput with storyId, chapters, and optional chunks.",
      }),
      { status: 400 },
    );
  }

  return NextResponse.json(
    createFailedResult({
      startedAt,
      message:
        "Local AI proxy route is reachable, but real Gemini integration is not implemented yet.",
    }),
    { status: 501 },
  );
}

export async function GET() {
  return NextResponse.json({
    providerId,
    providerLabel,
    status: "not-implemented",
    method: "POST",
    task: "story-analysis",
    message:
      "Use POST with { provider: 'gemini-proxy', task: 'story-analysis', input: AiPipelineInput }. Real Gemini integration is not implemented yet.",
  });
}
