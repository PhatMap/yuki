import type {
  BranchChange,
  BranchChangeType,
  BranchContinuityIssue,
  ImpactScope,
  StoryBranchV2,
} from "@/lib/types";

interface CreateAlternateBranchParams {
  storyId: string;
  name: string;
  description: string;
  divergesFromChapter: number;
  baseBranchId?: string;
}

interface CreateBranchChangeParams {
  storyId: string;
  branchId: string;
  type: BranchChangeType;
  title: string;
  description: string;
  targetName?: string;
  originalValue?: string;
  newValue?: string;
  chapterNumber?: number;
  chapterRangeStart?: number;
  chapterRangeEnd?: number;
  impactScope: ImpactScope;
}

export function createCanonBranch(storyId: string): StoryBranchV2 {
  const now = new Date().toISOString();

  return {
    id: `${storyId}-branch-canon`,
    storyId,
    name: "Canon gốc",
    type: "canon",
    status: "active",
    description: "Dữ liệu canon gốc được import và không sửa đè.",
    createdAt: now,
    updatedAt: now,
  };
}

export function createAlternateBranch(
  params: CreateAlternateBranchParams,
): StoryBranchV2 {
  const now = new Date().toISOString();

  return {
    id: `${params.storyId}-branch-${slugify(params.name)}-${Date.now()}`,
    storyId: params.storyId,
    name: params.name,
    type: "alternate",
    status: "active",
    baseBranchId: params.baseBranchId,
    divergesFromChapter: params.divergesFromChapter,
    description: params.description,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBranchChange(
  params: CreateBranchChangeParams,
): BranchChange {
  const now = new Date().toISOString();

  return {
    id: `${params.branchId}-change-${Date.now()}`,
    storyId: params.storyId,
    branchId: params.branchId,
    type: params.type,
    title: params.title,
    description: params.description,
    targetName: params.targetName,
    originalValue: params.originalValue,
    newValue: params.newValue,
    chapterNumber: params.chapterNumber,
    chapterRangeStart: params.chapterRangeStart,
    chapterRangeEnd: params.chapterRangeEnd,
    impactScope: params.impactScope,
    affectedCharacters: [],
    affectedItems: [],
    affectedTerms: [],
    affectedLocations: [],
    affectedChapterNumbers: [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function estimateAffectedChapters(
  change: BranchChange,
  totalChapters: number,
): number[] {
  const boundedTotal = Math.max(0, totalChapters);

  if (boundedTotal === 0) return [];

  if (
    change.impactScope === "single_chapter" ||
    change.impactScope === "single_scene"
  ) {
    return change.chapterNumber ? [change.chapterNumber] : [];
  }

  if (change.impactScope === "chapter_range") {
    const start = change.chapterRangeStart ?? change.chapterNumber;
    const end = change.chapterRangeEnd ?? start;

    if (!start || !end) return [];

    return createChapterRange(start, Math.min(boundedTotal, end));
  }

  if (change.impactScope === "from_chapter_forward") {
    if (!change.chapterNumber) return [];

    return createChapterRange(
      change.chapterNumber,
      Math.min(boundedTotal, change.chapterNumber + 50),
    );
  }

  if (change.impactScope === "entire_branch") {
    return createChapterRange(1, Math.min(boundedTotal, 100));
  }

  return [];
}

export function createMockContinuityIssues(
  change: BranchChange,
): BranchContinuityIssue[] {
  const issues: BranchContinuityIssue[] = [];

  if (change.impactScope === "from_chapter_forward") {
    issues.push({
      id: `${change.id}-issue-forward-impact`,
      storyId: change.storyId,
      branchId: change.branchId,
      changeId: change.id,
      severity: "high",
      title: "Các chương sau có thể không còn khớp với thay đổi này",
      description:
        "Thay đổi có phạm vi từ chương hiện tại trở về sau, nên timeline, foreshadowing và trạng thái nhân vật cần được rà lại.",
      affectedChapterNumbers: change.affectedChapterNumbers,
      suggestedFix:
        "Tạo adjusted timeline cho nhánh trước khi rewrite hoặc viết tiếp chương mới.",
      status: "open",
    });
  }

  if (change.type === "relationship_change") {
    issues.push({
      id: `${change.id}-issue-relationship`,
      storyId: change.storyId,
      branchId: change.branchId,
      changeId: change.id,
      severity: "medium",
      title: "Quan hệ nhân vật cần được cập nhật trong các cảnh liên quan",
      description:
        "Các cảnh dùng quan hệ cũ có thể mâu thuẫn với alternate canon mới.",
      affectedChapterNumbers: change.affectedChapterNumbers,
      suggestedFix:
        "Cập nhật relationship state và các đoạn hội thoại liên quan trong branch.",
      status: "open",
    });
  }

  if (change.type === "item_change") {
    issues.push({
      id: `${change.id}-issue-item`,
      storyId: change.storyId,
      branchId: change.branchId,
      changeId: change.id,
      severity: "medium",
      title: "Quyền sở hữu hoặc tác dụng vật phẩm cần kiểm tra lại",
      description:
        "Nếu vật phẩm đổi chủ hoặc đổi tác dụng, các sự kiện dùng vật phẩm đó cần được soát lại.",
      affectedChapterNumbers: change.affectedChapterNumbers,
      suggestedFix:
        "Kiểm tra item state theo từng chương bị ảnh hưởng trong branch.",
      status: "open",
    });
  }

  return issues;
}

function createChapterRange(start: number, end: number) {
  const normalizedStart = Math.max(1, Math.min(start, end));
  const normalizedEnd = Math.max(normalizedStart, end);

  return Array.from(
    { length: normalizedEnd - normalizedStart + 1 },
    (_, index) => normalizedStart + index,
  );
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
