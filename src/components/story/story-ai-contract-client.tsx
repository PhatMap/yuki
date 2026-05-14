"use client";

import { StoryNavigation } from "@/components/app/story-navigation";

interface StoryAiContractClientProps {
  storyId: string;
}

const proxyEndpointEnvKey = "NEXT_PUBLIC_AI_PROXY_ENDPOINT";

const requestBodyExample = {
  provider: "gemini-proxy",
  task: "story-analysis",
  input: {
    storyId: "story-id",
    story: {
      id: "story-id",
      title: "Example Story",
      description: "Long novel imported into yuki.",
      author: "Unknown",
      genre: "fantasy",
      tone: "epic",
      canonAdherence: "moderate",
      isFanwork: false,
      source: "import",
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:00.000Z",
    },
    chapters: [
      {
        id: "chapter-1",
        storyId: "story-id",
        chapterNumber: 1,
        title: "Chapter 1",
        rawContent: "Original imported chapter text.",
        cleanContent: "Cleaned chapter text.",
        wordCount: 1200,
        status: "imported",
        createdAt: "2026-05-14T00:00:00.000Z",
      },
    ],
    chunks: [
      {
        id: "chunk-1",
        storyId: "story-id",
        chapterId: "chapter-1",
        chapterNumber: 1,
        chunkIndex: 0,
        content: "Chunked chapter text for analysis.",
        wordCount: 600,
        status: "created",
      },
    ],
  },
};

const rawStoryAnalysisResultExample = {
  storyId: "story-id",
  characters: [
    {
      id: "character-1",
      storyId: "story-id",
      type: "character",
      name: "Main Character",
      aliases: ["MC"],
      description: "Primary character detected from the story.",
      firstSeenChapter: 1,
      lastSeenChapter: 1,
      relatedChapterNumbers: [1],
      confidence: 0.9,
    },
  ],
  events: [
    {
      id: "event-1",
      storyId: "story-id",
      chapterNumber: 1,
      title: "Opening event",
      description: "The first important event detected in the story.",
      charactersInvolved: ["Main Character"],
      locationsInvolved: ["Starting Location"],
      consequences: ["Starts the main plot."],
      importance: "high",
    },
  ],
  items: [
    {
      id: "item-1",
      storyId: "story-id",
      type: "item",
      name: "Important Item",
      description: "A canon-relevant item.",
      firstSeenChapter: 1,
      lastSeenChapter: 1,
      relatedChapterNumbers: [1],
      confidence: 0.8,
    },
  ],
  terms: [
    {
      id: "term-1",
      storyId: "story-id",
      type: "term",
      name: "Canon Term",
      description: "A recurring term or concept.",
      firstSeenChapter: 1,
      lastSeenChapter: 1,
      relatedChapterNumbers: [1],
      confidence: 0.8,
    },
  ],
  locations: [
    {
      id: "location-1",
      storyId: "story-id",
      type: "location",
      name: "Starting Location",
      description: "A location detected from the story.",
      firstSeenChapter: 1,
      lastSeenChapter: 1,
      relatedChapterNumbers: [1],
      confidence: 0.8,
    },
  ],
  writingStyleProfiles: [
    {
      id: "style-1",
      storyId: "story-id",
      scope: "story",
      narrationStyle: "Third-person narration.",
      sentenceStyle: "Medium-length descriptive sentences.",
      dialogueStyle: "Direct dialogue with occasional exposition.",
      pacing: "Balanced",
      tone: "Epic",
      commonPatterns: ["Chapter cliffhanger", "Power reveal"],
      tabooPatterns: ["Out-of-character speech"],
    },
  ],
  updatedAt: "2026-05-14T00:00:00.000Z",
};

const wrappedPipelineResponseExample = {
  providerId: "gemini-proxy",
  providerLabel: "Gemini proxy",
  status: "completed",
  analysisResult: rawStoryAnalysisResultExample,
  steps: [
    {
      status: "completed",
      currentStep: "complete",
      message: "Gemini proxy analysis completed.",
      completedSteps: ["complete"],
      totalSteps: 1,
    },
  ],
  startedAt: "2026-05-14T00:00:00.000Z",
  completedAt: "2026-05-14T00:00:10.000Z",
};

const errorResponseExample = {
  providerId: "gemini-proxy",
  providerLabel: "Gemini proxy",
  status: "failed",
  errorMessage:
    "Gemini proxy response did not include a valid StoryAnalysisResult.",
  steps: [
    {
      status: "failed",
      currentStep: "prepare-input",
      message: "Proxy validation failed.",
      completedSteps: [],
      totalSteps: 1,
    },
  ],
  startedAt: "2026-05-14T00:00:00.000Z",
  completedAt: "2026-05-14T00:00:01.000Z",
};

const contractChecks = [
  "Frontend must call only the configured proxy endpoint.",
  "Frontend must never store Gemini API keys.",
  "Proxy response must include a valid StoryAnalysisResult directly or under analysisResult.",
  "StoryAnalysisResult must preserve the existing shape used by Analysis, Workspace, Bible, Timeline, Relationships, World Tracker, and Rewrite Planner.",
  "If the proxy fails or returns invalid data, the provider must return a safe failed status.",
];

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function StoryAiContractClient({ storyId }: StoryAiContractClientProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-2xl border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">Step 33</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            AI Proxy Contract Preview
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Documentation-only preview for the Gemini proxy request and response
            shape. This page does not call AI and does not create a backend.
          </p>
        </div>

        <StoryNavigation storyId={storyId} />
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <InfoCard title="Provider" value="gemini-proxy" />
        <InfoCard title="Method" value="POST" />
        <InfoCard title="Env key" value={proxyEndpointEnvKey} />
      </section>

      <section className="rounded-2xl border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Contract rules</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            These rules describe the minimum backend/proxy contract required by
            the current frontend pipeline.
          </p>
        </div>

        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {contractChecks.map((check) => (
            <li
              key={check}
              className="rounded-xl border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground"
            >
              {check}
            </li>
          ))}
        </ul>
      </section>

      <ContractBlock
        title="Request body example"
        description="The frontend provider sends this shape to NEXT_PUBLIC_AI_PROXY_ENDPOINT."
        code={formatJson(requestBodyExample)}
      />

      <ContractBlock
        title="Valid response example: raw StoryAnalysisResult"
        description="The proxy may return StoryAnalysisResult directly."
        code={formatJson(rawStoryAnalysisResultExample)}
      />

      <ContractBlock
        title="Valid response example: pipeline wrapper"
        description="The proxy may also return an object containing analysisResult."
        code={formatJson(wrappedPipelineResponseExample)}
      />

      <ContractBlock
        title="Error response example"
        description="The frontend should handle failed provider status safely without breaking storage or UI."
        code={formatJson(errorResponseExample)}
      />

      <section className="rounded-2xl border bg-background p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Implementation notes</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            Backend/proxy implementation is intentionally not included in this
            step. The current app only documents the expected contract so the
            later endpoint can be implemented without changing UI pages.
          </p>
          <p>
            The response must remain compatible with the current
            StoryAnalysisResult fields: characters, events, items, terms,
            locations, writingStyleProfiles, storyId, and updatedAt.
          </p>
          <p>
            API keys must stay on the server side only. The browser should know
            only the proxy URL from {proxyEndpointEnvKey}.
          </p>
        </div>
      </section>
    </main>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-2xl border bg-background p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 break-words font-mono text-sm font-semibold">
        {value}
      </p>
    </article>
  );
}

function ContractBlock({
  title,
  description,
  code,
}: {
  title: string;
  description: string;
  code: string;
}) {
  return (
    <section className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl border bg-muted p-4 text-xs leading-5">
        <code>{code}</code>
      </pre>
    </section>
  );
}
