"use client";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";

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
  "Frontend chỉ gọi proxy endpoint đã cấu hình.",
  "Frontend không lưu Gemini API key.",
  "Proxy response phải trả StoryAnalysisResult hợp lệ trực tiếp hoặc nằm trong analysisResult.",
  "StoryAnalysisResult phải giữ shape hiện tại cho Analysis, Workspace, Story Bible, Timeline, Relationships, World Tracker và Rewrite Planner.",
  "Nếu proxy lỗi hoặc trả dữ liệu không hợp lệ, provider phải trả trạng thái failed an toàn.",
];

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function StoryAiContractClient() {
  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          title="AI Contract"
          description="Tài liệu kỹ thuật cho request/response của Gemini Proxy. Trang này không gọi AI và không tạo backend."
        />

        <section className="app-three-column">
          <InfoCard title="Provider" value="gemini-proxy" />
          <InfoCard title="Method" value="POST" />
          <InfoCard title="Env key" value={proxyEndpointEnvKey} />
        </section>

        <SectionCard
          title="Quy tắc contract"
          description="Các rule tối thiểu để backend/proxy tương thích với pipeline hiện tại."
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {contractChecks.map((check) => (
              <li key={check} className="app-status-item">
                <p className="app-status-item-body mt-0">{check}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <ContractBlock
          title="Ví dụ request body"
          description="Frontend provider gửi shape này tới NEXT_PUBLIC_AI_PROXY_ENDPOINT."
          code={formatJson(requestBodyExample)}
        />

        <ContractBlock
          title="Ví dụ response hợp lệ: raw StoryAnalysisResult"
          description="Proxy có thể trả StoryAnalysisResult trực tiếp."
          code={formatJson(rawStoryAnalysisResultExample)}
        />

        <ContractBlock
          title="Ví dụ response hợp lệ: pipeline wrapper"
          description="Proxy cũng có thể trả object chứa analysisResult."
          code={formatJson(wrappedPipelineResponseExample)}
        />

        <ContractBlock
          title="Ví dụ response lỗi"
          description="Frontend xử lý failed provider status mà không làm vỡ storage hoặc UI."
          code={formatJson(errorResponseExample)}
        />

        <SectionCard title="Ghi chú triển khai">
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Backend/proxy chưa nằm trong scope trang này. Mục tiêu là khóa
              contract để endpoint thật có thể làm sau mà không cần đổi UI.
            </p>
            <p>
              Response phải tương thích với StoryAnalysisResult hiện tại:
              characters, events, items, terms, locations,
              writingStyleProfiles, storyId và updatedAt.
            </p>
            <p>
              API key phải ở server side. Browser chỉ biết proxy URL từ {proxyEndpointEnvKey}.
            </p>
          </div>
        </SectionCard>
      </PageContainer>
    </PageShell>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <SectionCard contentClassName="space-y-2">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="break-words font-mono text-sm font-semibold">{value}</p>
    </SectionCard>
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
    <SectionCard title={title} description={description}>
      <pre className="app-json-panel">
        <code>{code}</code>
      </pre>
    </SectionCard>
  );
}
