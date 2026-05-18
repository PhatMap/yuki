"use client";

import { useMemo, useState } from "react";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { getAiProxySmokeTestEndpoint } from "@/lib/ai/proxy-config";

interface StoryAiProxyTestClientProps {
  storyId: string;
}

type TestResponse = {
  status: number;
  ok: boolean;
  body: unknown;
  receivedAt: string;
};

const endpoint = getAiProxySmokeTestEndpoint();

function createSmokeTestPayload(storyId: string) {
  const createdAt = new Date().toISOString();

  return {
    provider: "gemini-proxy",
    task: "story-analysis",
    input: {
      storyId,
      story: {
        id: storyId,
        title: "Smoke Test Story",
        author: "Local Test",
        description:
          "Minimal smoke test story used to validate the server-side AI proxy route.",
        createdAt,
        updatedAt: createdAt,
      },
      chapters: [
        {
          id: "smoke-chapter-1",
          storyId,
          chapterNumber: 1,
          title: "Smoke Test Chapter",
          rawContent:
            "Nhân vật chính nhặt được một vật phẩm cổ và bắt đầu chuyến hành trình.",
          cleanContent:
            "Nhân vật chính nhặt được một vật phẩm cổ và bắt đầu chuyến hành trình.",
          wordCount: 16,
          status: "imported",
          createdAt,
        },
      ],
      chunks: [
        {
          id: "smoke-chunk-1",
          storyId,
          chapterId: "smoke-chapter-1",
          chapterNumber: 1,
          chunkIndex: 0,
          content:
            "Nhân vật chính nhặt được một vật phẩm cổ và bắt đầu chuyến hành trình.",
          wordCount: 16,
          status: "created",
        },
      ],
    },
  };
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function StoryAiProxyTestClient({
  storyId,
}: StoryAiProxyTestClientProps) {
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isPostingTest, setIsPostingTest] = useState(false);
  const [statusResponse, setStatusResponse] = useState<TestResponse | null>(
    null,
  );
  const [postResponse, setPostResponse] = useState<TestResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const samplePayload = useMemo(
    () => createSmokeTestPayload(storyId),
    [storyId],
  );

  async function handleCheckStatus() {
    setIsCheckingStatus(true);
    setErrorMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "GET",
      });

      setStatusResponse({
        status: response.status,
        ok: response.ok,
        body: await readJsonResponse(response),
        receivedAt: new Date().toISOString(),
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Không thể kiểm tra proxy status: ${error.message}`
          : "Không thể kiểm tra proxy status.",
      );
    } finally {
      setIsCheckingStatus(false);
    }
  }

  async function handlePostSmokeTest() {
    setIsPostingTest(true);
    setErrorMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(samplePayload),
      });

      setPostResponse({
        status: response.status,
        ok: response.ok,
        body: await readJsonResponse(response),
        receivedAt: new Date().toISOString(),
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Không thể chạy proxy smoke test: ${error.message}`
          : "Không thể chạy proxy smoke test.",
      );
    } finally {
      setIsPostingTest(false);
    }
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          title="AI Proxy Test"
          description="Kiểm tra proxy route local mà không ghi dữ liệu truyện, không lộ API key và không gọi Gemini trực tiếp từ browser."
        />

        {errorMessage ? (
          <section className="app-warning-box border-destructive/40 bg-destructive/10 text-destructive">
            {errorMessage}
          </section>
        ) : null}

        <section className="app-three-column">
          <InfoCard title="Proxy route" value={endpoint} />
          <InfoCard title="Provider" value="gemini-proxy" />
          <InfoCard title="Task" value="story-analysis" />
        </section>

        <section className="app-two-column">
          <SectionCard
            title="GET status check"
            description="Gọi proxy route bằng GET để kiểm tra route có truy cập được và Gemini đã cấu hình server-side chưa."
          >
            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={isCheckingStatus}
              className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCheckingStatus ? "Đang kiểm tra..." : "Kiểm tra proxy status"}
            </button>
          </SectionCard>

          <SectionCard
            title="POST smoke test"
            description="Gửi AiPipelineInput tối thiểu. Nếu GEMINI_API_KEY chưa cấu hình, response failed an toàn là kết quả hợp lệ."
          >
            <button
              type="button"
              onClick={handlePostSmokeTest}
              disabled={isPostingTest}
              className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPostingTest ? "Đang chạy..." : "Chạy POST smoke test"}
            </button>
          </SectionCard>
        </section>

        <ContractBlock
          title="POST request payload"
          description="Payload này tạo local và không đọc dữ liệu truyện thật."
          code={formatJson(samplePayload)}
        />

        {statusResponse ? (
          <ContractBlock
            title={`GET response — HTTP ${statusResponse.status}`}
            description={`Nhận lúc ${new Date(
              statusResponse.receivedAt,
            ).toLocaleString()}. ok=${String(statusResponse.ok)}`}
            code={formatJson(statusResponse.body)}
          />
        ) : null}

        {postResponse ? (
          <ContractBlock
            title={`POST response — HTTP ${postResponse.status}`}
            description={`Nhận lúc ${new Date(
              postResponse.receivedAt,
            ).toLocaleString()}. ok=${String(postResponse.ok)}`}
            code={formatJson(postResponse.body)}
          />
        ) : null}

        <SectionCard title="Kết quả mong đợi">
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Khi chưa có{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                GEMINI_API_KEY
              </code>
              , POST test nên fail an toàn và trả provider error body.
            </p>
            <p>
              Khi đã có{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                GEMINI_API_KEY
              </code>
              , route có thể thử gọi Gemini server-side tùy proxy implementation hiện tại.
            </p>
            <p>
              Trang này không lưu gì vào IndexedDB hoặc browser key-value storage.
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
