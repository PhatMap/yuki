"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ScalePreset = 1500 | 3000;

type ScaleResult = {
  chapters: number;
  characters: number;
  approxSizeMb: number;
  generateMs: number;
  parseMs: number;
  localStorageWriteMs: number | null;
  localStorageReadMs: number | null;
  warnings: string[];
  createdAt: string;
};

type StoryImportScaleTestClientProps = {
  storyId: string;
};

const STORAGE_KEY_PREFIX = "ai-story-app:scale-test";

function createMockChapter(index: number) {
  const chapterNumber = index + 1;

  return [
    `Chương ${chapterNumber}: Mock Scale Test Chapter`,
    "",
    `Đây là nội dung giả lập cho chương ${chapterNumber}.`,
    "Mục tiêu của dữ liệu này là kiểm tra khả năng xử lý truyện dài trong browser.",
    "Nội dung bao gồm nhân vật, địa điểm, vật phẩm, timeline, thuật ngữ và các chi tiết canon giả lập.",
    `Nhân vật A gặp nhân vật B tại địa điểm ${chapterNumber % 25}.`,
    `Vật phẩm ${chapterNumber % 40} được nhắc lại để kiểm tra continuity tracking.`,
    `Sự kiện timeline ${chapterNumber % 100} tạo ảnh hưởng tới các chương sau.`,
    "",
  ].join("\n");
}

function generateMockNovel(chapterCount: number) {
  return Array.from({ length: chapterCount }, (_, index) =>
    createMockChapter(index),
  ).join("\n");
}

function parseMockNovel(rawText: string) {
  const matches = rawText.split(/(?=Chương\s+\d+[:：])/g);

  return matches
    .map((text, index) => {
      const trimmed = text.trim();
      const firstLine = trimmed.split("\n")[0] ?? `Chapter ${index + 1}`;

      return {
        id: `scale-chapter-${index + 1}`,
        index: index + 1,
        title: firstLine,
        content: trimmed,
        characterCount: trimmed.length,
      };
    })
    .filter((chapter) => chapter.content.length > 0);
}

function bytesToMb(bytes: number) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}

function nowMs() {
  return performance.now();
}

export function StoryImportScaleTestClient({
  storyId,
}: StoryImportScaleTestClientProps) {
  const [preset, setPreset] = useState<ScalePreset>(1500);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ScaleResult | null>(null);
  const storageKey = `${STORAGE_KEY_PREFIX}:${storyId}`;

  const storyLinks = useMemo(
    () => [
      { label: "Workspace", href: `/stories/${storyId}/workspace` },
      { label: "Import", href: "/stories/import" },
      { label: "Data Health", href: `/stories/${storyId}/data-health` },
      { label: "Settings", href: `/stories/${storyId}/settings` },
    ],
    [storyId],
  );

  function runScaleTest() {
    setIsRunning(true);

    window.setTimeout(() => {
      const warnings: string[] = [];

      const generateStart = nowMs();
      const rawText = generateMockNovel(preset);
      const generateEnd = nowMs();

      const parseStart = nowMs();
      const chapters = parseMockNovel(rawText);
      const parseEnd = nowMs();

      const payload = {
        storyId,
        preset,
        chapters,
        createdAt: new Date().toISOString(),
      };

      const serialized = JSON.stringify(payload);
      const approxSizeMb = bytesToMb(new Blob([serialized]).size);

      let localStorageWriteMs: number | null = null;
      let localStorageReadMs: number | null = null;

      try {
        const writeStart = nowMs();
        localStorage.setItem(storageKey, serialized);
        const writeEnd = nowMs();
        localStorageWriteMs = Number((writeEnd - writeStart).toFixed(2));

        const readStart = nowMs();
        const saved = localStorage.getItem(storageKey);
        const readEnd = nowMs();
        localStorageReadMs = Number((readEnd - readStart).toFixed(2));

        if (!saved) {
          warnings.push("localStorage read returned empty data.");
        }
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `localStorage write/read failed: ${error.message}`
            : "localStorage write/read failed.",
        );
      }

      if (chapters.length !== preset) {
        warnings.push(
          `Expected ${preset} chapters, parsed ${chapters.length}.`,
        );
      }

      if (approxSizeMb > 20) {
        warnings.push(
          "Generated payload is large for localStorage. IndexedDB should be preferred.",
        );
      }

      if (localStorageWriteMs !== null && localStorageWriteMs > 1000) {
        warnings.push("localStorage write took more than 1000ms.");
      }

      setResult({
        chapters: chapters.length,
        characters: rawText.length,
        approxSizeMb,
        generateMs: Number((generateEnd - generateStart).toFixed(2)),
        parseMs: Number((parseEnd - parseStart).toFixed(2)),
        localStorageWriteMs,
        localStorageReadMs,
        warnings,
        createdAt: new Date().toISOString(),
      });

      setIsRunning(false);
    }, 0);
  }

  function clearScaleData() {
    localStorage.removeItem(storageKey);
    setResult(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-2xl border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Step 28</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Import Scale Test
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Test browser-side handling for 1500–3000 mock chapters without
            touching real story import data.
          </p>
        </div>

        <nav className="flex flex-wrap gap-2">
          {storyLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border bg-background p-5 shadow-sm">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Scale preset</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Generate mock chapter content, parse it, then test localStorage
              write/read timing using a separate diagnostic key.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input
                type="radio"
                name="preset"
                checked={preset === 1500}
                onChange={() => setPreset(1500)}
              />
              1500 chapters
            </label>

            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input
                type="radio"
                name="preset"
                checked={preset === 3000}
                onChange={() => setPreset(3000)}
              />
              3000 chapters
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={runScaleTest}
              disabled={isRunning}
              className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunning ? "Running test..." : "Run scale test"}
            </button>

            <button
              type="button"
              onClick={clearScaleData}
              disabled={isRunning}
              className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear scale test data
            </button>
          </div>
        </div>

        <aside className="rounded-2xl border bg-background p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Storage key</h2>
          <p className="mt-2 break-all rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            {storageKey}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This page does not overwrite real import, chapters, chunks,
            analysis, branch, or rewrite draft data.
          </p>
        </aside>
      </section>

      {result ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Parsed chapters"
            value={result.chapters.toLocaleString()}
          />
          <Stat label="Characters" value={result.characters.toLocaleString()} />
          <Stat label="Approx payload" value={`${result.approxSizeMb} MB`} />
          <Stat label="Parse time" value={`${result.parseMs} ms`} />
          <Stat label="Generate time" value={`${result.generateMs} ms`} />
          <Stat
            label="localStorage write"
            value={
              result.localStorageWriteMs === null
                ? "Failed"
                : `${result.localStorageWriteMs} ms`
            }
          />
          <Stat
            label="localStorage read"
            value={
              result.localStorageReadMs === null
                ? "Failed"
                : `${result.localStorageReadMs} ms`
            }
          />
          <Stat
            label="Created at"
            value={new Date(result.createdAt).toLocaleString()}
          />
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed bg-background p-8 text-center">
          <h2 className="text-lg font-semibold">No scale test result yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a preset and run the test to inspect browser-side import
            scale behavior.
          </p>
        </section>
      )}

      {result?.warnings.length ? (
        <section className="rounded-2xl border bg-background p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Warnings</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold">{value}</p>
    </div>
  );
}
