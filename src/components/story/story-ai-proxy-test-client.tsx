"use client";

import { useMemo, useState } from "react";

import { StoryNavigation } from "@/components/app/story-navigation";

interface StoryAiProxyTestClientProps {
  storyId: string;
}

type TestResponse = {
  status: number;
  ok: boolean;
  body: unknown;
  receivedAt: string;
};

const endpoint = "/api/ai/story-analysis";

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
          ? `Failed to check proxy status: ${error.message}`
          : "Failed to check proxy status.",
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
          ? `Failed to run proxy smoke test: ${error.message}`
          : "Failed to run proxy smoke test.",
      );
    } finally {
      setIsPostingTest(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-2xl border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">Step 36</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            AI Proxy Smoke Test
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Test the local server-side proxy route without writing story data,
            exposing API keys, or calling Gemini directly from the browser.
          </p>
        </div>

        <StoryNavigation storyId={storyId} />
      </header>

      {errorMessage ? (
        <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <InfoCard title="Proxy route" value={endpoint} />
        <InfoCard title="Provider" value="gemini-proxy" />
        <InfoCard title="Task" value="story-analysis" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border bg-background p-5 shadow-sm">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">GET status check</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Calls the proxy route with GET to verify that the route is
              reachable and reports whether Gemini is configured server-side.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={isCheckingStatus}
            className="mt-5 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCheckingStatus ? "Checking..." : "Check proxy status"}
          </button>
        </article>

        <article className="rounded-2xl border bg-background p-5 shadow-sm">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">POST smoke test</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Sends a minimal valid AiPipelineInput. If GEMINI_API_KEY is not
              configured, a safe failed response is expected.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePostSmokeTest}
            disabled={isPostingTest}
            className="mt-5 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPostingTest ? "Running..." : "Run POST smoke test"}
          </button>
        </article>
      </section>

      <ContractBlock
        title="POST request payload"
        description="This payload is generated locally and does not read real story data."
        code={formatJson(samplePayload)}
      />

      {statusResponse ? (
        <ContractBlock
          title={`GET response — HTTP ${statusResponse.status}`}
          description={`Received at ${new Date(
            statusResponse.receivedAt,
          ).toLocaleString()}. ok=${String(statusResponse.ok)}`}
          code={formatJson(statusResponse.body)}
        />
      ) : null}

      {postResponse ? (
        <ContractBlock
          title={`POST response — HTTP ${postResponse.status}`}
          description={`Received at ${new Date(
            postResponse.receivedAt,
          ).toLocaleString()}. ok=${String(postResponse.ok)}`}
          code={formatJson(postResponse.body)}
        />
      ) : null}

      <section className="rounded-2xl border bg-background p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Expected result</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            Without{" "}
            <code className="rounded bg-muted px-1 py-0.5">GEMINI_API_KEY</code>
            , the POST test should fail safely and return a provider error body.
          </p>
          <p>
            With{" "}
            <code className="rounded bg-muted px-1 py-0.5">GEMINI_API_KEY</code>
            , the route may attempt the server-side Gemini call, depending on
            the current proxy implementation.
          </p>
          <p>This page does not save anything to IndexedDB or localStorage.</p>
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
