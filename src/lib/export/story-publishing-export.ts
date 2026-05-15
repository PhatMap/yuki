import {
  getAnalysisResult,
  getAnalysisStatus,
  getBranches,
  getBranchChanges,
  getChapterChunks,
  getContinuityIssues,
  getImportedChapters,
  getRewriteDrafts,
  getStoryById,
  getStorySetup,
  type StorySetupData,
} from "@/lib/db/indexed-db";
import type {
  AnalysisStatus,
  BranchChange,
  BranchContinuityIssue,
  ChapterChunk,
  ImportedChapter,
  RewriteDraft,
  Story,
  StoryAnalysisResult,
  StoryBranchV2,
} from "@/lib/types";

export interface StoryPublishingExportSnapshot {
  exportVersion: 1;
  exportedAt: string;
  app: {
    name: "yuki";
    storage: "indexeddb";
  };
  storyId: string;
  story?: Story;
  setup?: StorySetupData;
  chapters: ImportedChapter[];
  chunks: ChapterChunk[];
  analysisStatus?: AnalysisStatus;
  analysisResult?: StoryAnalysisResult;
  branches: StoryBranchV2[];
  branchChanges: BranchChange[];
  continuityIssues: BranchContinuityIssue[];
  rewriteDrafts: RewriteDraft[];
  summary: {
    hasStory: boolean;
    hasSetup: boolean;
    hasAnalysisStatus: boolean;
    hasAnalysisResult: boolean;
    chapterCount: number;
    chunkCount: number;
    characterCount: number;
    eventCount: number;
    itemCount: number;
    termCount: number;
    locationCount: number;
    branchCount: number;
    branchChangeCount: number;
    continuityIssueCount: number;
    rewriteDraftCount: number;
    totalWordCount: number;
  };
}

export interface StoryPublishingExportBundle {
  snapshot: StoryPublishingExportSnapshot;
  manuscriptText: string;
  frameworkMarkdown: string;
  snapshotJson: string;
  filenames: {
    manuscriptText: string;
    frameworkMarkdown: string;
    snapshotJson: string;
  };
}

export async function buildStoryPublishingExportBundle(
  storyId: string,
): Promise<StoryPublishingExportBundle> {
  const [
    story,
    setup,
    chapters,
    chunks,
    analysisStatus,
    analysisResult,
    branches,
    branchChanges,
    continuityIssues,
    rewriteDrafts,
  ] = await Promise.all([
    getStoryById(storyId),
    getStorySetup(storyId),
    getImportedChapters(storyId),
    getChapterChunks(storyId),
    getAnalysisStatus(storyId),
    getAnalysisResult(storyId),
    getBranches(storyId),
    getBranchChanges(storyId),
    getContinuityIssues(storyId),
    getRewriteDrafts(storyId),
  ]);

  const sortedChapters = [...chapters].sort(
    (firstChapter, secondChapter) =>
      firstChapter.chapterNumber - secondChapter.chapterNumber,
  );

  const totalWordCount = sortedChapters.reduce(
    (total, chapter) => total + chapter.wordCount,
    0,
  );

  const snapshot: StoryPublishingExportSnapshot = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    app: {
      name: "yuki",
      storage: "indexeddb",
    },
    storyId,
    story,
    setup,
    chapters: sortedChapters,
    chunks,
    analysisStatus,
    analysisResult,
    branches,
    branchChanges,
    continuityIssues,
    rewriteDrafts,
    summary: {
      hasStory: Boolean(story),
      hasSetup: Boolean(setup),
      hasAnalysisStatus: Boolean(analysisStatus),
      hasAnalysisResult: Boolean(analysisResult),
      chapterCount: sortedChapters.length,
      chunkCount: chunks.length,
      characterCount: analysisResult?.characters.length ?? 0,
      eventCount: analysisResult?.events.length ?? 0,
      itemCount: analysisResult?.items.length ?? 0,
      termCount: analysisResult?.terms.length ?? 0,
      locationCount: analysisResult?.locations.length ?? 0,
      branchCount: branches.length,
      branchChangeCount: branchChanges.length,
      continuityIssueCount: continuityIssues.length,
      rewriteDraftCount: rewriteDrafts.length,
      totalWordCount,
    },
  };

  return {
    snapshot,
    manuscriptText: buildManuscriptText(snapshot),
    frameworkMarkdown: buildFrameworkMarkdown(snapshot),
    snapshotJson: JSON.stringify(snapshot, null, 2),
    filenames: {
      manuscriptText: `${createExportBaseName(snapshot)}-manuscript.txt`,
      frameworkMarkdown: `${createExportBaseName(snapshot)}-framework.md`,
      snapshotJson: `${createExportBaseName(snapshot)}-snapshot.json`,
    },
  };
}

function buildManuscriptText(snapshot: StoryPublishingExportSnapshot) {
  const storyTitle = snapshot.story?.title ?? "Untitled Story";
  const author = snapshot.story?.author?.trim();

  const header = [
    storyTitle,
    author ? `Tác giả: ${author}` : "",
    `Exported from yuki: ${snapshot.exportedAt}`,
    "",
    "========================================",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const body = snapshot.chapters
    .map((chapter) => {
      return [
        `# Chương ${chapter.chapterNumber}: ${chapter.title}`,
        "",
        chapter.cleanContent.trim() || chapter.rawContent.trim(),
      ].join("\n");
    })
    .join("\n\n\n");

  return `${header}${body}\n`;
}

function buildFrameworkMarkdown(snapshot: StoryPublishingExportSnapshot) {
  const story = snapshot.story;
  const setup = snapshot.setup;
  const analysis = snapshot.analysisResult;
  const lines: string[] = [];

  lines.push(`# ${story?.title ?? "Untitled Story"} — Story Framework`);
  lines.push("");
  lines.push(`- Story ID: \`${snapshot.storyId}\``);
  lines.push(`- Exported at: ${snapshot.exportedAt}`);
  lines.push(`- Chapters: ${snapshot.summary.chapterCount}`);
  lines.push(`- Estimated words: ${snapshot.summary.totalWordCount}`);
  lines.push("");

  lines.push("## Story Metadata");
  lines.push("");
  lines.push(`- Title: ${story?.title ?? "N/A"}`);
  lines.push(`- Author: ${story?.author || "N/A"}`);
  lines.push(`- Genre: ${story?.genre ?? "N/A"}`);
  lines.push(`- Tone: ${story?.tone ?? "N/A"}`);
  lines.push(`- Canon adherence: ${story?.canonAdherence ?? "N/A"}`);
  lines.push(`- Fanwork: ${story?.isFanwork ? "Yes" : "No"}`);
  lines.push(`- Description: ${story?.description || "N/A"}`);
  lines.push("");

  lines.push("## Source Setup");
  lines.push("");
  lines.push(`- Original title: ${setup?.originalTitle || "N/A"}`);
  lines.push(`- Original author: ${setup?.originalAuthor || "N/A"}`);
  lines.push(`- Must keep: ${setup?.mustKeep || "N/A"}`);
  lines.push(`- Must change: ${setup?.mustChange || "N/A"}`);
  lines.push("");

  lines.push("## Chapter Map");
  lines.push("");
  if (snapshot.chapters.length > 0) {
    snapshot.chapters.forEach((chapter) => {
      lines.push(
        `- Chapter ${chapter.chapterNumber}: ${chapter.title} (${chapter.wordCount} words)`,
      );
    });
  } else {
    lines.push("- No imported chapters.");
  }
  lines.push("");

  lines.push("## Characters");
  lines.push("");
  if (analysis?.characters.length) {
    analysis.characters.forEach((character) => {
      lines.push(`### ${character.name}`);
      lines.push("");
      if (character.aliases?.length) {
        lines.push(`- Aliases: ${character.aliases.join(", ")}`);
      }
      lines.push(`- Description: ${character.description}`);
      lines.push(
        `- Chapters: ${formatChapterNumbers(character.relatedChapterNumbers)}`,
      );
      lines.push(`- Confidence: ${formatOptionalNumber(character.confidence)}`);
      lines.push("");
    });
  } else {
    lines.push("No character analysis yet.");
    lines.push("");
  }

  lines.push("## Timeline / Events");
  lines.push("");
  if (analysis?.events.length) {
    analysis.events
      .slice()
      .sort(
        (firstEvent, secondEvent) =>
          firstEvent.chapterNumber - secondEvent.chapterNumber,
      )
      .forEach((event) => {
        lines.push(`### Chapter ${event.chapterNumber}: ${event.title}`);
        lines.push("");
        lines.push(`- Importance: ${event.importance}`);
        lines.push(`- Description: ${event.description}`);
        lines.push(
          `- Characters: ${event.charactersInvolved.join(", ") || "N/A"}`,
        );
        lines.push(
          `- Locations: ${event.locationsInvolved.join(", ") || "N/A"}`,
        );
        lines.push(`- Consequences: ${event.consequences.join("; ") || "N/A"}`);
        lines.push("");
      });
  } else {
    lines.push("No timeline analysis yet.");
    lines.push("");
  }

  lines.push("## Items");
  lines.push("");
  appendEntityList(lines, analysis?.items);

  lines.push("## Terms");
  lines.push("");
  appendEntityList(lines, analysis?.terms);

  lines.push("## Locations");
  lines.push("");
  appendEntityList(lines, analysis?.locations);

  lines.push("## Writing Style");
  lines.push("");
  if (analysis?.writingStyleProfiles.length) {
    analysis.writingStyleProfiles.forEach((profile) => {
      lines.push(`### ${profile.scope}`);
      lines.push("");
      lines.push(`- Narration: ${profile.narrationStyle}`);
      lines.push(`- Sentence style: ${profile.sentenceStyle}`);
      lines.push(`- Dialogue style: ${profile.dialogueStyle}`);
      lines.push(`- Pacing: ${profile.pacing}`);
      lines.push(`- Tone: ${profile.tone}`);
      lines.push(`- Common patterns: ${profile.commonPatterns.join("; ")}`);
      lines.push(`- Taboo patterns: ${profile.tabooPatterns.join("; ")}`);
      lines.push("");
    });
  } else {
    lines.push("No writing style profile yet.");
    lines.push("");
  }

  lines.push("## Rewrite / Branch Change Requests");
  lines.push("");
  if (snapshot.branchChanges.length > 0) {
    snapshot.branchChanges.forEach((change) => {
      lines.push(`### ${change.title}`);
      lines.push("");
      lines.push(`- Type: ${change.type}`);
      lines.push(`- Status: ${change.status}`);
      lines.push(`- Chapter: ${change.chapterNumber ?? "N/A"}`);
      lines.push(`- Impact scope: ${change.impactScope}`);
      lines.push(
        `- Affected chapters: ${formatChapterNumbers(
          change.affectedChapterNumbers,
        )}`,
      );
      lines.push(`- Description: ${change.description}`);
      if (change.newValue) {
        lines.push(`- Desired change: ${change.newValue}`);
      }
      lines.push("");
    });
  } else {
    lines.push("No rewrite change requests yet.");
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function appendEntityList(
  lines: string[],
  entities:
    | {
        name: string;
        description: string;
        relatedChapterNumbers: number[];
        confidence?: number;
      }[]
    | undefined,
) {
  if (!entities?.length) {
    lines.push("No data yet.");
    lines.push("");
    return;
  }

  entities.forEach((entity) => {
    lines.push(`### ${entity.name}`);
    lines.push("");
    lines.push(`- Description: ${entity.description}`);
    lines.push(
      `- Chapters: ${formatChapterNumbers(entity.relatedChapterNumbers)}`,
    );
    lines.push(`- Confidence: ${formatOptionalNumber(entity.confidence)}`);
    lines.push("");
  });
}

function formatChapterNumbers(chapterNumbers: number[]) {
  if (chapterNumbers.length === 0) return "N/A";

  return [...chapterNumbers].sort((a, b) => a - b).join(", ");
}

function formatOptionalNumber(value?: number) {
  if (typeof value !== "number") return "N/A";

  return Number(value.toFixed(2)).toString();
}

function createExportBaseName(snapshot: StoryPublishingExportSnapshot) {
  const date = snapshot.exportedAt.slice(0, 10);
  const safeTitle =
    snapshot.story?.title
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u1EF9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || snapshot.storyId;

  return `yuki-${safeTitle}-${date}`;
}
