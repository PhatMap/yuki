import { renderPromptTemplate } from "@/lib/prompts/prompt-runtime";
import type {
  BranchChange,
  BranchContinuityIssue,
  ExtractedEntity,
  Story,
  StoryAnalysisResult,
  StoryEvent,
  WritingStyleProfile,
} from "@/lib/types";

type PromptValue = string | number | boolean | null | undefined;

interface RewritePlannerPromptInput {
  story?: Story;
  analysisResult: StoryAnalysisResult | null;
  selectedChapter: number;
  selectedEvent?: StoryEvent;
  changeRequest: string;
  affectedChapters: number[];
  affectedCharacters: ExtractedEntity[];
  affectedEvents: StoryEvent[];
  affectedItems: ExtractedEntity[];
  affectedTerms: ExtractedEntity[];
  affectedLocations: ExtractedEntity[];
  affectedRelationships: string[];
  existingBranchChanges: BranchChange[];
  existingContinuityIssues: BranchContinuityIssue[];
}

interface RewriteDraftPromptInput {
  story?: Story;
  selectedChange?: BranchChange;
  selectedChapter?: {
    chapterNumber: number;
    title: string;
    content: string;
    source: string;
  };
  analysisResult: StoryAnalysisResult | null;
  relatedIssues: BranchContinuityIssue[];
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function compactEntities(entities: ExtractedEntity[]) {
  return entities.map((entity) => ({
    name: entity.name,
    type: entity.type,
    description: entity.description,
    chapters: entity.relatedChapterNumbers,
  }));
}

function compactEvents(events: StoryEvent[]) {
  return events.map((event) => ({
    chapterNumber: event.chapterNumber,
    title: event.title,
    description: event.description,
    charactersInvolved: event.charactersInvolved,
    locationsInvolved: event.locationsInvolved,
    consequences: event.consequences,
    importance: event.importance,
  }));
}

function compactStyleProfile(profile?: WritingStyleProfile) {
  if (!profile) return "";

  return safeJson({
    narrationStyle: profile.narrationStyle,
    sentenceStyle: profile.sentenceStyle,
    dialogueStyle: profile.dialogueStyle,
    pacing: profile.pacing,
    tone: profile.tone,
    commonPatterns: profile.commonPatterns,
    tabooPatterns: profile.tabooPatterns,
  });
}

function createBaseStoryVariables(story?: Story): Record<string, PromptValue> {
  return {
    storyTitle: story?.title ?? "Untitled Story",
    storyGenre: story?.genre ?? "",
    storyTone: story?.tone ?? "",
    authorIntent: story?.description ?? "",
  };
}

export async function renderRewritePlannerPrompt({
  story,
  analysisResult,
  selectedChapter,
  selectedEvent,
  changeRequest,
  affectedChapters,
  affectedCharacters,
  affectedEvents,
  affectedItems,
  affectedTerms,
  affectedLocations,
  affectedRelationships,
  existingBranchChanges,
  existingContinuityIssues,
}: RewritePlannerPromptInput) {
  const affectedCanon = {
    events: compactEvents(affectedEvents),
    characters: compactEntities(affectedCharacters),
    items: compactEntities(affectedItems),
    terms: compactEntities(affectedTerms),
    locations: compactEntities(affectedLocations),
    relationships: affectedRelationships,
  };
  const currentCanon = {
    selectedEvent: selectedEvent
      ? {
          chapterNumber: selectedEvent.chapterNumber,
          title: selectedEvent.title,
          description: selectedEvent.description,
          consequences: selectedEvent.consequences,
        }
      : null,
    affectedCanon,
    styleProfile: analysisResult?.writingStyleProfiles[0] ?? null,
  };

  return renderPromptTemplate({
    templateId: "rewrite-impact-planner",
    includeSystemIdentity: true,
    variables: {
      ...createBaseStoryVariables(story),
      currentChapter: selectedChapter,
      selectedChapter,
      selectedEvent: selectedEvent
        ? `${selectedEvent.title}: ${selectedEvent.description}`
        : "",
      changeRequest,
      affectedChapters: affectedChapters.join(", "),
      affectedChapterRange:
        affectedChapters.length > 0
          ? `${affectedChapters[0]}-${affectedChapters.at(-1)}`
          : "",
      affectedCharacters: affectedCharacters.map((entity) => entity.name).join(", "),
      affectedItems: affectedItems.map((entity) => entity.name).join(", "),
      affectedTerms: affectedTerms.map((entity) => entity.name).join(", "),
      affectedLocations: affectedLocations.map((entity) => entity.name).join(", "),
      affectedRelationships: affectedRelationships.join(", "),
      affectedEvents: safeJson(compactEvents(affectedEvents)),
      currentCanon: safeJson(currentCanon),
      canonContext: safeJson(currentCanon),
      analysisResult: safeJson(analysisResult),
      existingAnalysisData: safeJson(analysisResult),
      existingBranchChanges: safeJson(existingBranchChanges),
      existingContinuityIssues: safeJson(existingContinuityIssues),
    },
  });
}

export async function renderRewriteDraftPrompt({
  story,
  selectedChange,
  selectedChapter,
  analysisResult,
  relatedIssues,
}: RewriteDraftPromptInput) {
  const styleProfile = analysisResult?.writingStyleProfiles[0];
  const chapterNumber = selectedChapter?.chapterNumber ?? "";
  const continuityIssueText = relatedIssues
    .map((issue) => `${issue.severity}: ${issue.title}. ${issue.description}`)
    .join("\n");
  const affectedContinuity = {
    characters: selectedChange?.affectedCharacters ?? [],
    items: selectedChange?.affectedItems ?? [],
    terms: selectedChange?.affectedTerms ?? [],
    locations: selectedChange?.affectedLocations ?? [],
    chapterNumbers: selectedChange?.affectedChapterNumbers ?? [],
    issues: relatedIssues,
  };

  return renderPromptTemplate({
    templateId: "rewrite-draft",
    includeSystemIdentity: true,
    variables: {
      ...createBaseStoryVariables(story),
      currentChapter: chapterNumber,
      selectedChapter: chapterNumber,
      selectedChapterTitle: selectedChapter?.title ?? "",
      originalChapter: selectedChapter?.content ?? "",
      selectedChapterText: selectedChapter?.content ?? "",
      changeRequest: selectedChange?.description ?? "",
      branchChange: selectedChange ? safeJson(selectedChange) : "",
      rewritePlannerResult: selectedChange ? safeJson(selectedChange) : "",
      continuityIssues: continuityIssueText,
      affectedContinuityNotes: safeJson(affectedContinuity),
      canonConstraints: safeJson({
        story: story
          ? {
              title: story.title,
              genre: story.genre,
              tone: story.tone,
              description: story.description,
            }
          : null,
        affectedContinuity,
      }),
      styleNotes: compactStyleProfile(styleProfile),
      styleProfile: compactStyleProfile(styleProfile),
      analysisResult: safeJson(analysisResult),
    },
  });
}
