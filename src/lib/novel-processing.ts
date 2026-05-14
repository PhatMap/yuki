import type {
  AnalysisStatus,
  ChapterChunk,
  ImportedChapter,
} from "@/lib/types";

const chapterHeadingRegex = /(^|\n)\s*((chương|chapter)\s+\d+[:.\-\s]*(.*)?)/gi;

export function estimateWordCount(text: string): number {
  const normalizedText = text.trim();

  if (!normalizedText) return 0;

  return normalizedText.split(/\s+/).filter(Boolean).length;
}

export function cleanNovelText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function detectChaptersFromText(
  input: string,
  storyId: string,
): ImportedChapter[] {
  const cleanText = cleanNovelText(input);
  const createdAt = new Date().toISOString();

  if (!cleanText) return [];

  const matches = Array.from(cleanText.matchAll(chapterHeadingRegex));

  if (matches.length === 0) {
    return [
      {
        id: `${storyId}-chapter-1`,
        storyId,
        chapterNumber: 1,
        title: "Chương 1",
        rawContent: cleanText,
        cleanContent: cleanText,
        wordCount: estimateWordCount(cleanText),
        status: "imported",
        createdAt,
      },
    ];
  }

  return matches.map((match, index) => {
    const newlinePrefix = match[1] ?? "";
    const headingStart = (match.index ?? 0) + newlinePrefix.length;
    const nextHeadingStart = matches[index + 1]?.index ?? cleanText.length;
    const rawContent = cleanText.slice(headingStart, nextHeadingStart).trim();
    const cleanContent = cleanNovelText(rawContent);
    const title = (match[2] || `Chương ${index + 1}`).trim();
    const chapterNumber = getChapterNumber(title, index);

    return {
      id: `${storyId}-chapter-${chapterNumber}`,
      storyId,
      chapterNumber,
      title,
      rawContent,
      cleanContent,
      wordCount: estimateWordCount(cleanContent),
      status: "imported",
      createdAt,
    };
  });
}

export function chunkChapter(
  chapter: ImportedChapter,
  targetWords = 700,
): ChapterChunk[] {
  const normalizedTargetWords = Math.max(1, targetWords);
  const units = splitIntoChunkUnits(
    chapter.cleanContent,
    normalizedTargetWords,
  );
  const chunks: string[] = [];
  let currentUnits: string[] = [];
  let currentWordCount = 0;

  for (const unit of units) {
    const unitWordCount = estimateWordCount(unit);

    if (
      currentUnits.length > 0 &&
      currentWordCount + unitWordCount > normalizedTargetWords
    ) {
      chunks.push(currentUnits.join("\n\n").trim());
      currentUnits = [];
      currentWordCount = 0;
    }

    currentUnits.push(unit);
    currentWordCount += unitWordCount;
  }

  if (currentUnits.length > 0) {
    chunks.push(currentUnits.join("\n\n").trim());
  }

  return chunks
    .filter(Boolean)
    .map((content, index) => ({
      id: `${chapter.id}-chunk-${index + 1}`,
      storyId: chapter.storyId,
      chapterId: chapter.id,
      chapterNumber: chapter.chapterNumber,
      chunkIndex: index + 1,
      content,
      wordCount: estimateWordCount(content),
      status: "created",
    }));
}

export function chunkChapters(
  chapters: ImportedChapter[],
  targetWords?: number,
): ChapterChunk[] {
  return chapters.flatMap((chapter) => chunkChapter(chapter, targetWords));
}

export function createInitialAnalysisStatus(
  storyId: string,
  chapters: ImportedChapter[],
  chunks: ChapterChunk[],
): AnalysisStatus {
  const chunkedChapterIds = new Set(chunks.map((chunk) => chunk.chapterId));
  const createdAt = new Date().toISOString();

  return {
    storyId,
    totalChapters: chapters.length,
    parsedChapters: chapters.length,
    chunkedChapters: chunkedChapterIds.size,
    analyzedChapters: 0,
    totalChunks: chunks.length,
    createdAt,
    updatedAt: createdAt,
  };
}

function getChapterNumber(title: string, index: number) {
  const numberMatch = title.match(/\d+/);

  return numberMatch ? Number(numberMatch[0]) : index + 1;
}

function splitIntoChunkUnits(text: string, targetWords: number) {
  return cleanNovelText(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => splitOversizedParagraph(paragraph, targetWords));
}

function splitOversizedParagraph(paragraph: string, targetWords: number) {
  if (estimateWordCount(paragraph) <= targetWords) return [paragraph];

  const sentences =
    paragraph.match(/[^.!?。！？]+[.!?。！？]?/g)?.map((sentence) =>
      sentence.trim(),
    ) ?? [];
  const safeSentences = sentences.length > 0 ? sentences : [paragraph];
  const units: string[] = [];
  let currentSentences: string[] = [];
  let currentWordCount = 0;

  for (const sentence of safeSentences) {
    const sentenceWordCount = estimateWordCount(sentence);

    if (sentenceWordCount > targetWords) {
      if (currentSentences.length > 0) {
        units.push(currentSentences.join(" ").trim());
        currentSentences = [];
        currentWordCount = 0;
      }

      units.push(...splitByWords(sentence, targetWords));
      continue;
    }

    if (
      currentSentences.length > 0 &&
      currentWordCount + sentenceWordCount > targetWords
    ) {
      units.push(currentSentences.join(" ").trim());
      currentSentences = [];
      currentWordCount = 0;
    }

    currentSentences.push(sentence);
    currentWordCount += sentenceWordCount;
  }

  if (currentSentences.length > 0) {
    units.push(currentSentences.join(" ").trim());
  }

  return units.filter(Boolean);
}

function splitByWords(text: string, targetWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  for (let index = 0; index < words.length; index += targetWords) {
    chunks.push(words.slice(index, index + targetWords).join(" "));
  }

  return chunks;
}
