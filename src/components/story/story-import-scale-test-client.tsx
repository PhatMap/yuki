"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";

type ScalePreset = 1500 | 3000;

type ScaleResult = {
  chapters: number;
  characters: number;
  approxSizeMb: number;
  generateMs: number;
  parseMs: number;
  warnings: string[];
  createdAt: string;
};

type StoryImportScaleTestClientProps = {
  storyId: string;
};

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

  const storyLinks = useMemo(
    () => [
      { label: "Workspace viết", href: `/stories/${storyId}/workspace` },
      { label: "Nạp truyện", href: "/stories/import" },
      { label: "Data Health", href: `/stories/${storyId}/data-health` },
      { label: "Cài đặt truyện", href: `/stories/${storyId}/settings` },
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

      const serialized = JSON.stringify({
        storyId,
        preset,
        chapters,
        createdAt: new Date().toISOString(),
      });
      const approxSizeMb = bytesToMb(new Blob([serialized]).size);

      if (chapters.length !== preset) {
        warnings.push(
          `Kỳ vọng ${preset} chương, nhưng parser trả ${chapters.length} chương.`,
        );
      }

      if (approxSizeMb > 20) {
        warnings.push(
          "Payload giả lập lớn. IndexedDB vẫn phải là storage chính.",
        );
      }

      setResult({
        chapters: chapters.length,
        characters: rawText.length,
        approxSizeMb,
        generateMs: Number((generateEnd - generateStart).toFixed(2)),
        parseMs: Number((parseEnd - parseStart).toFixed(2)),
        warnings,
        createdAt: new Date().toISOString(),
      });

      setIsRunning(false);
    }, 0);
  }

  function clearScaleData() {
    setResult(null);
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          title="Import Scale Test"
          description="Test xử lý 1500–3000 chương giả lập trong browser mà không đụng dữ liệu truyện thật."
          action={
            <nav className="app-chip-row" aria-label="Story utility links">
              {storyLinks.map((link) => (
                <Link key={link.href} href={link.href} className="app-chip">
                  {link.label}
                </Link>
              ))}
            </nav>
          }
        />

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <SectionCard
            title="Preset kiểm thử"
            description="Tạo nội dung chương giả lập và parse trong browser, không ghi payload lớn vào browser key-value storage."
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                <input
                  type="radio"
                  name="preset"
                  checked={preset === 1500}
                  onChange={() => setPreset(1500)}
                />
                1500 chương
              </label>

              <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                <input
                  type="radio"
                  name="preset"
                  checked={preset === 3000}
                  onChange={() => setPreset(3000)}
                />
                3000 chương
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={runScaleTest}
                disabled={isRunning}
                className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRunning ? "Đang chạy test..." : "Chạy scale test"}
              </button>

              <button
                type="button"
                onClick={clearScaleData}
                disabled={isRunning}
                className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Xóa kết quả test
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Storage policy" className="app-sticky-panel">
            <p className="app-code-block">IndexedDB primary</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Trang này không ghi đè dữ liệu import, chương, chunk, analysis, nhánh hoặc Rewrite Draft thật.
            </p>
          </SectionCard>
        </section>

        {result ? (
          <section className="app-data-grid">
            <Stat
              label="Chương đã parse"
              value={result.chapters.toLocaleString()}
            />
            <Stat
              label="Ký tự"
              value={result.characters.toLocaleString()}
            />
            <Stat label="Payload ước tính" value={`${result.approxSizeMb} MB`} />
            <Stat label="Thời gian parse" value={`${result.parseMs} ms`} />
            <Stat label="Thời gian tạo dữ liệu" value={`${result.generateMs} ms`} />
            <Stat
              label="Tạo lúc"
              value={new Date(result.createdAt).toLocaleString()}
            />
          </section>
        ) : (
          <section className="app-empty-state text-center">
            <h2 className="text-lg font-semibold text-foreground">
              Chưa có kết quả scale test
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Chọn preset rồi chạy test để kiểm tra khả năng xử lý import lớn trong browser.
            </p>
          </section>
        )}

        {result?.warnings.length ? (
          <SectionCard title="Cảnh báo">
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </PageContainer>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="app-data-stat">
      <p className="app-data-stat-label">{label}</p>
      <p className="app-data-stat-value">{value}</p>
    </article>
  );
}
