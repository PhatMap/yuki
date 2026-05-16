import type { StoryBackupPayload } from "@/lib/backup/story-backup";

export interface StoryBackupValidationIssue {
  severity: "error" | "warning";
  message: string;
}

export interface StoryBackupValidationResult {
  isValid: boolean;
  payload?: StoryBackupPayload;
  issues: StoryBackupValidationIssue[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function addIssue(
  issues: StoryBackupValidationIssue[],
  severity: StoryBackupValidationIssue["severity"],
  message: string,
) {
  issues.push({ severity, message });
}

export function validateStoryBackupPayload(
  value: unknown,
  expectedStoryId?: string,
): StoryBackupValidationResult {
  const issues: StoryBackupValidationIssue[] = [];

  if (!isObject(value)) {
    return {
      isValid: false,
      issues: [
        {
          severity: "error",
          message: "Backup file must contain a JSON object.",
        },
      ],
    };
  }

  const manifest = value.manifest;
  const data = value.data;

  if (!isObject(manifest)) {
    addIssue(issues, "error", "Missing backup manifest.");
  }

  if (!isObject(data)) {
    addIssue(issues, "error", "Missing backup data section.");
  }

  if (!isObject(manifest) || !isObject(data)) {
    return {
      isValid: false,
      issues,
    };
  }

  if (manifest.schemaVersion !== 1) {
    addIssue(
      issues,
      "error",
      `Unsupported backup schema version: ${String(manifest.schemaVersion)}.`,
    );
  }

  if (!isString(manifest.storyId) || !manifest.storyId.trim()) {
    addIssue(issues, "error", "Backup manifest is missing storyId.");
  }

  if (!isString(manifest.exportedAt) || !manifest.exportedAt.trim()) {
    addIssue(issues, "warning", "Backup manifest is missing exportedAt.");
  }

  if (
    expectedStoryId &&
    isString(manifest.storyId) &&
    manifest.storyId !== expectedStoryId
  ) {
    addIssue(
      issues,
      "warning",
      `Backup storyId (${manifest.storyId}) does not match current storyId (${expectedStoryId}).`,
    );
  }

  const counts = manifest.counts;

  if (!isObject(counts)) {
    addIssue(issues, "warning", "Backup manifest is missing counts.");
  }

  const requiredArrays = [
    "chapters",
    "chunks",
    "branches",
    "branchChanges",
    "continuityIssues",
    "rewriteDrafts",
    "aiJobs",
    "aiJobTasks",
    "aiJobCacheEntries",
  ] as const;

  for (const key of requiredArrays) {
    if (!isArray(data[key])) {
      addIssue(issues, "error", `Backup data.${key} must be an array.`);
    }
  }

  if (isObject(counts)) {
    for (const key of requiredArrays) {
      const actualValue = data[key];
      const expectedCount = counts[key];

      if (isArray(actualValue) && isNumber(expectedCount)) {
        if (actualValue.length !== expectedCount) {
          addIssue(
            issues,
            "warning",
            `Backup count mismatch for ${key}: manifest says ${expectedCount}, file contains ${actualValue.length}.`,
          );
        }
      }
    }
  }

  const hasErrors = issues.some((issue) => issue.severity === "error");

  return {
    isValid: !hasErrors,
    payload: hasErrors ? undefined : (value as unknown as StoryBackupPayload),
    issues,
  };
}

export async function readStoryBackupFile(
  file: File,
  expectedStoryId?: string,
): Promise<StoryBackupValidationResult> {
  if (!file.name.toLowerCase().endsWith(".json")) {
    return {
      isValid: false,
      issues: [
        {
          severity: "error",
          message: "Backup file must be a .json file.",
        },
      ],
    };
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;

    return validateStoryBackupPayload(parsed, expectedStoryId);
  } catch (error) {
    return {
      isValid: false,
      issues: [
        {
          severity: "error",
          message:
            error instanceof Error
              ? `Could not parse backup JSON: ${error.message}`
              : "Could not parse backup JSON.",
        },
      ],
    };
  }
}
