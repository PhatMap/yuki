import { NextResponse } from "next/server";

import type { AiPipelineInput, AiPipelineResult } from "@/lib/ai/types";
import type { StoryAnalysisResult } from "@/lib/types";

const providerId = "gemini-proxy";
const providerLabel = "Gemini proxy";
const defaultModel = "gemini-1.5-flash";

type ProxyRequestBody = {
  provider?: unknown;
  task?: unknown;
  input?: unknown;
};

type GeminiCandidateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
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

function isEntityArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!isRecord(item)) return false;

      return (
        typeof item.id === "string" &&
        typeof item.storyId === "string" &&
        typeof item.type === "string" &&
        typeof item.name === "string" &&
        typeof item.description === "string" &&
        Array.isArray(item.relatedChapterNumbers)
      );
    })
  );
}

function isEventArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!isRecord(item)) return false;

      return (
        typeof item.id === "string" &&
        typeof item.storyId === "string" &&
        typeof item.chapterNumber === "number" &&
        typeof item.title === "string" &&
        typeof item.description === "string" &&
        isStringArray(item.charactersInvolved) &&
        isStringArray(item.locationsInvolved) &&
        isStringArray(item.consequences) &&
        typeof item.importance === "string"
      );
    })
  );
}

function isWritingStyleProfileArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!isRecord(item)) return false;

      return (
        typeof item.id === "string" &&
        typeof item.storyId === "string" &&
        typeof item.scope === "string" &&
        typeof item.narrationStyle === "string" &&
        typeof item.sentenceStyle === "string" &&
        typeof item.dialogueStyle === "string" &&
        typeof item.pacing === "string" &&
        typeof item.tone === "string" &&
        isStringArray(item.commonPatterns) &&
        isStringArray(item.tabooPatterns)
      );
    })
  );
}

function isStoryAnalysisResult(value: unknown): value is StoryAnalysisResult {
  if (!isRecord(value)) return false;

  return (
    typeof value.storyId === "string" &&
    isEntityArray(value.characters) &&
    isEventArray(value.events) &&
    isEntityArray(value.items) &&
    isEntityArray(value.terms) &&
    isEntityArray(value.locations) &&
    isWritingStyleProfileArray(value.writingStyleProfiles) &&
    typeof value.updatedAt === "string"
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

function createCompletedResult({
  analysisResult,
  startedAt,
}: {
  analysisResult: StoryAnalysisResult;
  startedAt: string;
}): AiPipelineResult {
  return {
    providerId,
    providerLabel,
    status: "completed",
    analysisResult,
    steps: [
      {
        status: "completed",
        currentStep: "complete",
        message: "Gemini proxy analysis completed.",
        completedSteps: ["complete"],
        totalSteps: 1,
      },
    ],
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function extractJsonText(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function getGeminiText(payload: GeminiCandidateResponse) {
  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

function createInputSummary(input: AiPipelineInput) {
  const chapters = input.chapters.slice(0, 12);
  const chunks = input.chunks?.slice(0, 24) ?? [];

  return {
    storyId: input.storyId,
    story: input.story
      ? {
          id: input.story.id,
          title: input.story.title,
          author: input.story.author,
          description: input.story.description,
        }
      : undefined,
    totalChapters: input.chapters.length,
    totalChunks: input.chunks?.length ?? 0,
    sampledChapters: chapters.map((chapter) => ({
      id: chapter.id,
      storyId: chapter.storyId,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      cleanContent: chapter.cleanContent.slice(0, 3000),
      wordCount: chapter.wordCount,
      status: chapter.status,
    })),
    sampledChunks: chunks.map((chunk) => ({
      id: chunk.id,
      storyId: chunk.storyId,
      chapterId: chunk.chapterId,
      chapterNumber: chunk.chapterNumber,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content.slice(0, 1800),
      wordCount: chunk.wordCount,
      status: chunk.status,
    })),
  };
}

function buildPrompt(input: AiPipelineInput) {
  const summary = createInputSummary(input);

  return [
    "You are the server-side analysis proxy for a long-novel continuity tool named yuki.",
    "Analyze the provided story sample and return JSON only.",
    "Do not include markdown.",
    "Do not include explanation outside JSON.",
    "",
    "Return exactly this JSON shape:",
    JSON.stringify(
      {
        storyId: input.storyId,
        characters: [
          {
            id: "character-1",
            storyId: input.storyId,
            type: "character",
            name: "Character name",
            aliases: ["Alias"],
            description: "Short description.",
            firstSeenChapter: 1,
            lastSeenChapter: 1,
            relatedChapterNumbers: [1],
            confidence: 0.8,
          },
        ],
        events: [
          {
            id: "event-1",
            storyId: input.storyId,
            chapterNumber: 1,
            title: "Event title",
            description: "Event description.",
            charactersInvolved: ["Character name"],
            locationsInvolved: ["Location name"],
            consequences: ["Consequence"],
            importance: "medium",
          },
        ],
        items: [
          {
            id: "item-1",
            storyId: input.storyId,
            type: "item",
            name: "Item name",
            description: "Item description.",
            firstSeenChapter: 1,
            lastSeenChapter: 1,
            relatedChapterNumbers: [1],
            confidence: 0.8,
          },
        ],
        terms: [
          {
            id: "term-1",
            storyId: input.storyId,
            type: "term",
            name: "Term name",
            description: "Term definition.",
            firstSeenChapter: 1,
            lastSeenChapter: 1,
            relatedChapterNumbers: [1],
            confidence: 0.8,
          },
        ],
        locations: [
          {
            id: "location-1",
            storyId: input.storyId,
            type: "location",
            name: "Location name",
            description: "Location description.",
            firstSeenChapter: 1,
            lastSeenChapter: 1,
            relatedChapterNumbers: [1],
            confidence: 0.8,
          },
        ],
        writingStyleProfiles: [
          {
            id: "style-1",
            storyId: input.storyId,
            scope: "sample",
            narrationStyle: "Narration style.",
            sentenceStyle: "Sentence style.",
            dialogueStyle: "Dialogue style.",
            pacing: "Pacing.",
            tone: "Tone.",
            commonPatterns: ["Pattern"],
            tabooPatterns: ["Avoid this"],
          },
        ],
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "",
    "Input summary:",
    JSON.stringify(summary, null, 2),
  ].join("\n");
}

async function runGeminiAnalysis(input: AiPipelineInput) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || defaultModel;

  if (!apiKey) {
    return {
      ok: false as const,
      message:
        "Local AI proxy route is reachable, but GEMINI_API_KEY is not configured.",
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildPrompt(input),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return {
      ok: false as const,
      message: `Gemini API request failed with HTTP ${response.status}: ${errorText.slice(
        0,
        500,
      )}`,
    };
  }

  const geminiPayload = (await response.json()) as GeminiCandidateResponse;
  const text = getGeminiText(geminiPayload);
  const parsed = safeJsonParse(extractJsonText(text));

  if (!isStoryAnalysisResult(parsed)) {
    return {
      ok: false as const,
      message:
        "Gemini response did not match StoryAnalysisResult. Check prompt/schema compatibility.",
    };
  }

  return {
    ok: true as const,
    analysisResult: parsed,
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

  try {
    const result = await runGeminiAnalysis(body.input);

    if (!result.ok) {
      return NextResponse.json(
        createFailedResult({
          startedAt,
          message: result.message,
        }),
        { status: 501 },
      );
    }

    return NextResponse.json(
      createCompletedResult({
        startedAt,
        analysisResult: result.analysisResult,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      createFailedResult({
        startedAt,
        message:
          error instanceof Error
            ? `Gemini proxy failed: ${error.message}`
            : "Gemini proxy failed.",
      }),
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    providerId,
    providerLabel,
    status: process.env.GEMINI_API_KEY ? "configured" : "not-configured",
    method: "POST",
    task: "story-analysis",
    model: process.env.GEMINI_MODEL?.trim() || defaultModel,
    message:
      "Use POST with { provider: 'gemini-proxy', task: 'story-analysis', input: AiPipelineInput }. Server-side Gemini call is enabled only when GEMINI_API_KEY is configured.",
  });
}
