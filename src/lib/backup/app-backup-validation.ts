import type { AppBackupPayload } from "@/lib/backup/app-backup";

export interface AppBackupValidationIssue {
  severity: "error" | "warning";
  message: string;
}

export interface AppBackupValidationResult {
  isValid: boolean;
  payload?: AppBackupPayload;
  issues: AppBackupValidationIssue[];
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
  issues: AppBackupValidationIssue[],
  severity: AppBackupValidationIssue["severity"],
  message: string,
) {
  issues.push({ severity, message });
}

export function validateAppBackupPayload(
  value: unknown,
): AppBackupValidationResult {
  const issues: AppBackupValidationIssue[] = [];

  if (!isObject(value)) {
    return {
      isValid: false,
      issues: [
        {
          severity: "error",
          message: "App backup file must contain a JSON object.",
        },
      ],
    };
  }

  const manifest = value.manifest;
  const data = value.data;

  if (!isObject(manifest)) {
    addIssue(issues, "error", "Missing app backup manifest.");
  }

  if (!isObject(data)) {
    addIssue(issues, "error", "Missing app backup data section.");
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
      `Unsupported app backup schema version: ${String(
        manifest.schemaVersion,
      )}.`,
    );
  }

  if (manifest.app !== "yuki") {
    addIssue(
      issues,
      "error",
      `Unsupported app backup target: ${String(manifest.app)}.`,
    );
  }

  if (!isString(manifest.exportedAt) || !manifest.exportedAt.trim()) {
    addIssue(issues, "warning", "App backup manifest is missing exportedAt.");
  }

  const counts = manifest.counts;

  if (!isObject(counts)) {
    addIssue(issues, "warning", "App backup manifest is missing counts.");
  }

  if (!isObject(data.runtimeSettings)) {
    addIssue(issues, "error", "App backup data.runtimeSettings is missing.");
  }

  if (!isArray(data.promptTemplates)) {
    addIssue(issues, "error", "App backup data.promptTemplates must be an array.");
  }

  if (!isArray(data.stories)) {
    addIssue(issues, "error", "App backup data.stories must be an array.");
  }

  if (isObject(counts)) {
    if (isArray(data.promptTemplates) && isNumber(counts.promptTemplates)) {
      if (data.promptTemplates.length !== counts.promptTemplates) {
        addIssue(
          issues,
          "warning",
          `Prompt template count mismatch: manifest says ${counts.promptTemplates}, file contains ${data.promptTemplates.length}.`,
        );
      }
    }

    if (isArray(data.stories) && isNumber(counts.stories)) {
      if (data.stories.length !== counts.stories) {
        addIssue(
          issues,
          "warning",
          `Story index count mismatch: manifest says ${counts.stories}, file contains ${data.stories.length}.`,
        );
      }
    }
  }

  if (isObject(data.runtimeSettings)) {
    if (data.runtimeSettings.id !== "global") {
      addIssue(
        issues,
        "warning",
        "Runtime settings id is not global. Restore should normalize this later.",
      );
    }

    if (!isString(data.runtimeSettings.providerId)) {
      addIssue(
        issues,
        "error",
        "Runtime settings providerId must be a string.",
      );
    }
  }

  const hasErrors = issues.some((issue) => issue.severity === "error");

  return {
    isValid: !hasErrors,
    payload: hasErrors ? undefined : (value as unknown as AppBackupPayload),
    issues,
  };
}

export async function readAppBackupFile(
  file: File,
): Promise<AppBackupValidationResult> {
  if (!file.name.toLowerCase().endsWith(".json")) {
    return {
      isValid: false,
      issues: [
        {
          severity: "error",
          message: "App backup file must be a .json file.",
        },
      ],
    };
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;

    return validateAppBackupPayload(parsed);
  } catch (error) {
    return {
      isValid: false,
      issues: [
        {
          severity: "error",
          message:
            error instanceof Error
              ? `Could not parse app backup JSON: ${error.message}`
              : "Could not parse app backup JSON.",
        },
      ],
    };
  }
}
