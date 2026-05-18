import { db } from "@/lib/db/indexed-db";
import type { GlobalPromptTemplate } from "@/lib/types";

const defaultPromptCreatedAt = "2026-01-01T00:00:00.000Z";

function formatContract(value: unknown) {
  return JSON.stringify(value, null, 2);
}

const defaultPromptTemplates: GlobalPromptTemplate[] = [
  {
    id: "story-system-identity",
    title: "Story System Identity",
    description:
      "Global system identity for Yuki as a long-form story continuity OS.",
    category: "system",
    editablePrompt:
      "You are Yuki, a meticulous Story OS for long novels. Preserve canon, track cause and effect, respect the author's intent, and explain uncertainty clearly before suggesting changes.",
    lockedContract: formatContract({
      role: "system",
      outputMode: "instruction",
      mustPreserve: ["canon", "timeline", "character memory", "author intent"],
      forbidden: ["invent unsupported facts", "ignore provided chapter data"],
    }),
    variables: ["storyTitle", "storyGenre", "storyTone", "authorIntent"],
    createdAt: defaultPromptCreatedAt,
    updatedAt: defaultPromptCreatedAt,
  },
  {
    id: "import-analysis",
    title: "Import Analysis",
    description:
      "Extracts canon facts, characters, timeline, world terms, items, and style from imported chapters.",
    category: "analysis",
    editablePrompt: [
      "Phân tích dữ liệu truyện đã nạp làm nguồn canon chính.",
      "Chỉ dùng dữ liệu được cung cấp. Không bịa nội dung không có trong chapter/chunk.",
      "Trả về JSON đúng contract. Không markdown, không prose ngoài JSON.",
      "",
      "Story: {{storyTitle}}",
      "Chapter range: {{chapterRange}}",
      "Tổng chương: {{chapterCount}}",
      "Tổng chunk: {{chunkCount}}",
      "",
      "Chapter context:",
      "{{chapters}}",
      "",
      "Chunk context:",
      "{{chunks}}",
    ].join("\n"),
    lockedContract: formatContract({
      input: ["story", "chapters", "chunks"],
      output: {
        characters: "ExtractedEntity[]",
        events: "StoryEvent[]",
        items: "ExtractedEntity[]",
        terms: "ExtractedEntity[]",
        locations: "ExtractedEntity[]",
        writingStyleProfiles: "WritingStyleProfile[]",
      },
      rules: ["include chapter references", "mark uncertain facts clearly"],
    }),
    variables: ["storyTitle", "chapterRange", "chapters", "chunks"],
    createdAt: defaultPromptCreatedAt,
    updatedAt: defaultPromptCreatedAt,
  },
  {
    id: "chapter-scout",
    title: "Chapter Scout",
    description:
      "Quét nhanh chapter samples để đề xuất skip/light/deep trước khi phân tích sâu.",
    category: "scout",
    editablePrompt: [
      "Bạn là Chapter Scout cho Yuki.",
      "Đọc chapter samples và đánh dấu mức ưu tiên cho từng chương.",
      "Không bịa nội dung ngoài dữ liệu đã cung cấp.",
      "Trả về JSON thuần theo contract.",
      "",
      "Mục tiêu: {{goal}}",
      "Story: {{storyTitle}}",
      "Story instruction: {{storyInstruction}}",
      "Chapter samples:",
      "{{chapterSamples}}",
    ].join("\n"),
    lockedContract: formatContract({
      outputSchemaId: "chapter-scout.v1",
      output: {
        results: [
          {
            chapterIndex: "number",
            priority: "low | medium | high | critical",
            recommendation: "skip | light_load | deep_load",
            detectedSignals: "string[]",
            reason: "string",
            confidence: "number",
          },
        ],
      },
      rules: [
        "strict json only",
        "no markdown",
        "no invented chapter content",
      ],
    }),
    variables: ["goal", "storyTitle", "storyInstruction", "chapterSamples"],
    createdAt: defaultPromptCreatedAt,
    updatedAt: defaultPromptCreatedAt,
  },
  {
    id: "arc-map",
    title: "Arc Map",
    description:
      "Gom kết quả scout thành arcs để chọn phần cần deep analysis.",
    category: "arc",
    editablePrompt: [
      "Bạn là Arc Mapper cho Yuki.",
      "Nhóm scout results thành các arc hợp lý để phục vụ deep analysis.",
      "Chỉ dùng dữ liệu có trong scout results.",
      "Trả về JSON thuần theo contract.",
      "",
      "Window: {{windowLabel}}",
      "Tổng chương: {{chapterCount}}",
      "Story instruction: {{storyInstruction}}",
      "Scout results:",
      "{{scoutResults}}",
    ].join("\n"),
    lockedContract: formatContract({
      outputSchemaId: "arc-map.v1",
      output: {
        arcs: [
          {
            id: "string",
            title: "string",
            chapterStart: "number",
            chapterEnd: "number",
            summary: "string",
            importance: "low | medium | high | critical",
            whyLoad: "string",
            recommendedDeepChapters: "number[]",
          },
        ],
      },
      rules: [
        "strict json only",
        "no markdown",
        "no invented chapter content",
      ],
    }),
    variables: [
      "windowLabel",
      "chapterCount",
      "storyInstruction",
      "scoutResults",
    ],
    createdAt: defaultPromptCreatedAt,
    updatedAt: defaultPromptCreatedAt,
  },
  {
    id: "rewrite-impact-planner",
    title: "Rewrite Impact Planner",
    description:
      "Plans downstream impact for a requested plot or canon change.",
    category: "planning",
    editablePrompt:
      [
        "Given a change request at a specific chapter, estimate downstream consequences. Identify affected chapters, characters, relationships, items, world rules, timeline events, and continuity risks. Keep the proposed branch coherent.",
        "",
        "Story: {{storyTitle}}",
        "Current chapter: {{currentChapter}}",
        "Change request: {{changeRequest}}",
        "Affected chapters: {{affectedChapters}}",
        "Current canon/context: {{currentCanon}}",
        "Existing analysis data: {{analysisResult}}",
        "Existing branch changes: {{existingBranchChanges}}",
      ].join("\n"),
    lockedContract: formatContract({
      input: ["changeRequest", "analysisResult", "branchChanges"],
      output: {
        branchChange: "BranchChange",
        continuityIssues: "BranchContinuityIssue[]",
      },
      rules: ["do not rewrite prose", "focus on impact and dependencies"],
    }),
    variables: [
      "storyTitle",
      "currentChapter",
      "changeRequest",
      "affectedChapters",
      "currentCanon",
      "analysisResult",
      "existingBranchChanges",
    ],
    createdAt: defaultPromptCreatedAt,
    updatedAt: defaultPromptCreatedAt,
  },
  {
    id: "rewrite-draft",
    title: "Rewrite Draft",
    description:
      "Drafts revised chapter prose from a selected change request and canon context.",
    category: "rewrite",
    editablePrompt:
      [
        "Rewrite the selected chapter according to the approved change request. Preserve voice, pacing, character memory, and necessary canon details while making the requested divergence clear.",
        "",
        "Story: {{storyTitle}}",
        "Selected chapter: {{selectedChapterTitle}}",
        "Change request: {{changeRequest}}",
        "Planner result: {{branchChange}}",
        "Canon constraints: {{canonConstraints}}",
        "Style notes: {{styleNotes}}",
        "Affected continuity notes: {{affectedContinuityNotes}}",
        "Original chapter text: {{originalChapter}}",
      ].join("\n"),
    lockedContract: formatContract({
      input: ["originalChapter", "branchChange", "continuityIssues"],
      output: {
        title: "string",
        rewrittenText: "string",
        notes: "string",
      },
      rules: ["maintain style", "avoid unrelated changes", "surface tradeoffs"],
    }),
    variables: [
      "storyTitle",
      "selectedChapterTitle",
      "changeRequest",
      "originalChapter",
      "branchChange",
      "canonConstraints",
      "styleNotes",
      "affectedContinuityNotes",
    ],
    createdAt: defaultPromptCreatedAt,
    updatedAt: defaultPromptCreatedAt,
  },
  {
    id: "new-story-from-framework",
    title: "New Story From Framework",
    description:
      "Uses extracted framework signals to create a new original story plan later in the product flow.",
    category: "generation",
    editablePrompt:
      "Use the extracted framework as inspiration for a new original story. Keep structural lessons such as pacing, archetype roles, conflict rhythm, and world complexity, but avoid copying protected names, scenes, or exact plot beats.",
    lockedContract: formatContract({
      input: ["framework", "authorPreferences", "constraints"],
      output: {
        premise: "string",
        cast: "string[]",
        worldRules: "string[]",
        outline: "string[]",
      },
      rules: ["create original material", "avoid direct copying"],
    }),
    variables: ["framework", "genre", "tone", "mustKeep", "mustChange"],
    createdAt: defaultPromptCreatedAt,
    updatedAt: defaultPromptCreatedAt,
  },
];

function cloneTemplate(template: GlobalPromptTemplate): GlobalPromptTemplate {
  return {
    ...template,
    variables: [...template.variables],
  };
}

function cloneTemplates(templates: GlobalPromptTemplate[]) {
  return templates.map(cloneTemplate);
}

function mergeWithDefaults(savedTemplates: GlobalPromptTemplate[]) {
  const savedById = new Map(
    savedTemplates.map((template) => [template.id, template]),
  );

  return defaultPromptTemplates.map((defaultTemplate) => {
    const savedTemplate = savedById.get(defaultTemplate.id);

    return cloneTemplate(savedTemplate ?? defaultTemplate);
  });
}

export function getDefaultPromptTemplates() {
  return cloneTemplates(defaultPromptTemplates);
}

interface GetPromptTemplatesOptions {
  persistDefaults?: boolean;
}

export async function getPromptTemplates(
  options: GetPromptTemplatesOptions = {},
) {
  const { persistDefaults = true } = options;
  const savedTemplates = await db.globalPromptTemplates.toArray();
  const templates = mergeWithDefaults(savedTemplates);

  if (persistDefaults && savedTemplates.length !== templates.length) {
    await db.globalPromptTemplates.bulkPut(templates);
  }

  return templates;
}

export async function savePromptTemplates(
  templates: GlobalPromptTemplate[],
) {
  const now = new Date().toISOString();

  await db.globalPromptTemplates.bulkPut(
    templates.map((template) => ({
      ...template,
      variables: [...template.variables],
      updatedAt: now,
    })),
  );
}

export async function replacePromptTemplates(
  templates: GlobalPromptTemplate[],
) {
  const now = new Date().toISOString();

  await db.globalPromptTemplates.clear();
  await db.globalPromptTemplates.bulkPut(
    templates.map((template) => ({
      ...template,
      variables: [...template.variables],
      updatedAt: now,
    })),
  );
}

export async function resetPromptTemplate(templateId: string) {
  const defaultTemplate = defaultPromptTemplates.find(
    (template) => template.id === templateId,
  );

  if (!defaultTemplate) {
    throw new Error(`Unknown prompt template: ${templateId}`);
  }

  const template = {
    ...cloneTemplate(defaultTemplate),
    updatedAt: new Date().toISOString(),
  };

  await db.globalPromptTemplates.put(template);

  return template;
}

export async function resetAllPromptTemplates() {
  const now = new Date().toISOString();
  const templates = defaultPromptTemplates.map((template) => ({
    ...cloneTemplate(template),
    updatedAt: now,
  }));

  await db.globalPromptTemplates.clear();
  await db.globalPromptTemplates.bulkPut(templates);

  return templates;
}
