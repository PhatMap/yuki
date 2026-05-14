import type {
  ExtractedEntity,
  ExtractedEntityType,
  ImportedChapter,
  StoryAnalysisResult,
  StoryEvent,
  WritingStyleProfile,
} from "@/lib/types";

const maxScannedChapters = 20;

const fallbackCharacterNames = [
  "Nhân vật chính",
  "Đối thủ bí ẩn",
  "Người dẫn đường",
];

const itemKeywords = ["kiếm", "đan", "sách", "lệnh bài", "ngọc", "pháp bảo", "bí kíp"];
const termKeywords = [
  "cảnh giới",
  "linh khí",
  "tông môn",
  "công pháp",
  "trận pháp",
  "ma pháp",
  "huyết mạch",
  "thần thức",
];
const locationKeywords = [
  "thành",
  "núi",
  "rừng",
  "học viện",
  "tông",
  "điện",
  "bí cảnh",
];

const ignoredNameParts = new Set([
  "AI",
  "Chương",
  "Chapter",
  "Hồi",
  "Phần",
  "Quyển",
  "Ngày",
  "Đêm",
]);

type EntityDraft = Omit<ExtractedEntity, "id" | "relatedChapterNumbers"> & {
  relatedChapterNumbers: Set<number>;
};

export function runMockAnalysis(
  storyId: string,
  chapters: ImportedChapter[],
): StoryAnalysisResult {
  const scannedChapters = chapters.slice(0, maxScannedChapters);
  const characters = extractCharacters(storyId, scannedChapters);
  const events = createEvents(storyId, scannedChapters, chapters);
  const items = extractKeywordEntities(storyId, scannedChapters, "item", itemKeywords);
  const terms = extractKeywordEntities(storyId, scannedChapters, "term", termKeywords);
  const locations = extractKeywordEntities(
    storyId,
    scannedChapters,
    "location",
    locationKeywords,
  );
  const writingStyleProfiles = createWritingStyleProfiles(
    storyId,
    scannedChapters,
  );

  return {
    storyId,
    characters,
    events,
    items,
    terms,
    locations,
    writingStyleProfiles,
    updatedAt: new Date().toISOString(),
  };
}

function extractCharacters(
  storyId: string,
  chapters: ImportedChapter[],
): ExtractedEntity[] {
  const drafts = new Map<string, EntityDraft>();
  const namePattern =
    /\b[\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+){1,3}\b/gu;

  for (const chapter of chapters) {
    const content = getChapterContent(chapter);
    const matches = content.match(namePattern) ?? [];

    for (const match of matches) {
      const name = match.trim();

      if (!isLikelyCharacterName(name)) continue;

      upsertEntityDraft(drafts, {
        storyId,
        type: "character",
        name,
        description: `Nhân vật được phát hiện gần chương ${chapter.chapterNumber}.`,
        firstSeenChapter: chapter.chapterNumber,
        lastSeenChapter: chapter.chapterNumber,
        relatedChapterNumbers: new Set([chapter.chapterNumber]),
        confidence: 0.62,
      });
    }
  }

  if (drafts.size === 0) {
    fallbackCharacterNames.forEach((name, index) => {
      const chapterNumber = chapters[index]?.chapterNumber ?? 1;

      upsertEntityDraft(drafts, {
        storyId,
        type: "character",
        name,
        description: "Nhân vật fallback được tạo để mô phỏng kết quả phân tích.",
        firstSeenChapter: chapterNumber,
        lastSeenChapter: chapterNumber,
        relatedChapterNumbers: new Set([chapterNumber]),
        confidence: 0.35,
      });
    });
  }

  return materializeEntities(drafts);
}

function extractKeywordEntities(
  storyId: string,
  chapters: ImportedChapter[],
  type: ExtractedEntityType,
  keywords: string[],
): ExtractedEntity[] {
  const drafts = new Map<string, EntityDraft>();

  for (const chapter of chapters) {
    const lowerContent = getChapterContent(chapter).toLocaleLowerCase("vi-VN");

    for (const keyword of keywords) {
      if (!lowerContent.includes(keyword)) continue;

      upsertEntityDraft(drafts, {
        storyId,
        type,
        name: titleCaseKeyword(keyword),
        description: createKeywordDescription(type, keyword, chapter.chapterNumber),
        firstSeenChapter: chapter.chapterNumber,
        lastSeenChapter: chapter.chapterNumber,
        relatedChapterNumbers: new Set([chapter.chapterNumber]),
        confidence: 0.58,
      });
    }
  }

  return materializeEntities(drafts);
}

function createEvents(
  storyId: string,
  scannedChapters: ImportedChapter[],
  allChapters: ImportedChapter[],
): StoryEvent[] {
  const finalChapterNumber = allChapters.at(-1)?.chapterNumber;

  return scannedChapters
    .filter((_, index) => index % 2 === 0)
    .map((chapter, index) => {
      const excerpt = createExcerpt(getChapterContent(chapter), 180);
      const chapterNumber = chapter.chapterNumber;
      const isCritical =
        chapterNumber === 1 || chapterNumber === finalChapterNumber;
      const importance = isCritical
        ? "critical"
        : chapterNumber % 10 === 0
          ? "high"
          : "medium";

      return {
        id: `${storyId}-mock-event-${index + 1}`,
        storyId,
        chapterNumber,
        title: `Sự kiện chính chương ${chapterNumber}`,
        description:
          excerpt ||
          `Mock event dựa trên tiêu đề "${chapter.title}" trong chương ${chapterNumber}.`,
        charactersInvolved: [],
        locationsInvolved: [],
        consequences: [
          "Tạo điểm neo để dashboard và workspace hiển thị timeline tạm thời.",
        ],
        importance,
      };
    });
}

function createWritingStyleProfiles(
  storyId: string,
  chapters: ImportedChapter[],
): WritingStyleProfile[] {
  const sample = chapters.map(getChapterContent).join("\n\n");
  const hasDialogue = /["“”]|(^|\n)\s*[-–—]\s+/m.test(sample);
  const sentences = sample
    .split(/[.!?。！？]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const wordCount = sample.trim() ? sample.trim().split(/\s+/).length : 0;
  const averageSentenceWords =
    sentences.length > 0 ? Math.round(wordCount / sentences.length) : 0;
  const pacing =
    averageSentenceWords > 24
      ? "Chậm, thiên về miêu tả và nội tâm."
      : averageSentenceWords > 12
        ? "Vừa phải, cân bằng giữa kể chuyện và diễn biến."
        : "Nhanh, nhiều câu ngắn và nhịp chuyển cảnh gọn.";
  const tone = inferTone(sample);

  return [
    {
      id: `${storyId}-style-story`,
      storyId,
      scope: "story",
      chapterRangeStart: chapters[0]?.chapterNumber,
      chapterRangeEnd: chapters.at(-1)?.chapterNumber,
      narrationStyle:
        "Mock profile: lời kể bám theo sự kiện chính, ưu tiên tóm tắt diễn biến và trạng thái nhân vật.",
      sentenceStyle:
        averageSentenceWords > 0
          ? `Câu trung bình khoảng ${averageSentenceWords} từ trong mẫu scan.`
          : "Chưa đủ dữ liệu để ước tính độ dài câu.",
      dialogueStyle: hasDialogue
        ? "Có dấu hiệu hội thoại trực tiếp trong mẫu."
        : "Ít dấu hiệu hội thoại trực tiếp trong mẫu.",
      pacing,
      tone,
      commonPatterns: [
        "Mở cảnh bằng bối cảnh hoặc hành động.",
        "Nhấn vào thay đổi trạng thái sau mỗi chương.",
        "Dùng thuật ngữ lặp lại để giữ world bible tạm thời.",
      ],
      tabooPatterns: [
        "Không đổi tên nhân vật khi viết tiếp.",
        "Không bỏ qua hệ thống thuật ngữ đã phát hiện.",
        "Không tạo bước nhảy timeline nếu chưa có sự kiện nối.",
      ],
    },
  ];
}

function getChapterContent(chapter: ImportedChapter) {
  return chapter.cleanContent || chapter.rawContent || "";
}

function isLikelyCharacterName(name: string) {
  const parts = name.split(/\s+/);

  if (parts.length < 2 || parts.length > 4) return false;
  if (parts.some((part) => ignoredNameParts.has(part))) return false;
  if (/^(Chương|Chapter)\s+\d+/i.test(name)) return false;

  return name.length <= 40;
}

function upsertEntityDraft(
  drafts: Map<string, EntityDraft>,
  draft: EntityDraft,
) {
  const key = `${draft.type}:${draft.name.toLocaleLowerCase("vi-VN")}`;
  const existingDraft = drafts.get(key);

  if (!existingDraft) {
    drafts.set(key, draft);
    return;
  }

  for (const chapterNumber of draft.relatedChapterNumbers) {
    existingDraft.relatedChapterNumbers.add(chapterNumber);
  }

  existingDraft.firstSeenChapter = Math.min(
    existingDraft.firstSeenChapter ?? Number.POSITIVE_INFINITY,
    draft.firstSeenChapter ?? Number.POSITIVE_INFINITY,
  );
  existingDraft.lastSeenChapter = Math.max(
    existingDraft.lastSeenChapter ?? 0,
    draft.lastSeenChapter ?? 0,
  );
  existingDraft.confidence = Math.max(
    existingDraft.confidence ?? 0,
    draft.confidence ?? 0,
  );
}

function materializeEntities(drafts: Map<string, EntityDraft>) {
  return Array.from(drafts.values()).map((draft, index) => ({
    ...draft,
    id: `${draft.storyId}-${draft.type}-${slugify(draft.name)}-${index + 1}`,
    relatedChapterNumbers: Array.from(draft.relatedChapterNumbers).sort(
      (left, right) => left - right,
    ),
  }));
}

function createKeywordDescription(
  type: ExtractedEntityType,
  keyword: string,
  chapterNumber: number,
) {
  const labels: Record<ExtractedEntityType, string> = {
    character: "nhân vật",
    event: "sự kiện",
    faction: "thế lực",
    item: "vật phẩm",
    location: "địa điểm",
    "power-system": "hệ thống sức mạnh",
    term: "thuật ngữ",
  };

  return `Mock ${labels[type]} phát hiện keyword "${keyword}" gần chương ${chapterNumber}.`;
}

function createExcerpt(text: string, maxLength: number) {
  const compactText = text.replace(/\s+/g, " ").trim();

  if (compactText.length <= maxLength) return compactText;

  return `${compactText.slice(0, maxLength).trim()}...`;
}

function inferTone(sample: string) {
  const lowerSample = sample.toLocaleLowerCase("vi-VN");

  if (/(máu|chết|bóng đêm|ác mộng|thù hận)/i.test(lowerSample)) {
    return "U tối, căng thẳng, có dấu hiệu xung đột mạnh.";
  }

  if (/(cười|ấm áp|dịu dàng|ánh nắng|hạnh phúc)/i.test(lowerSample)) {
    return "Nhẹ hơn, có sắc thái ấm và cảm xúc mềm.";
  }

  if (/(kiếm|linh khí|tông môn|cảnh giới|bí cảnh)/i.test(lowerSample)) {
    return "Phiêu lưu tu luyện, nhấn vào tiến cấp và bí ẩn thế giới.";
  }

  return "Trung tính, phù hợp để mock dashboard trước khi có AI thật.";
}

function titleCaseKeyword(keyword: string) {
  return keyword
    .split(" ")
    .map((part) => part.charAt(0).toLocaleUpperCase("vi-VN") + part.slice(1))
    .join(" ");
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
