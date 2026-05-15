import { getPromptTemplates } from "@/lib/prompts/prompt-registry";
import type { GlobalPromptTemplate } from "@/lib/types";

export type PromptTemplateId =
  | "story-system-identity"
  | "import-analysis"
  | "rewrite-impact-planner"
  | "rewrite-draft"
  | "new-story-from-framework";

export interface PromptRenderInput {
  templateId: PromptTemplateId;
  variables?: Record<string, string | number | boolean | null | undefined>;
  includeSystemIdentity?: boolean;
}

export interface PromptRenderResult {
  template: GlobalPromptTemplate;
  systemIdentity?: GlobalPromptTemplate;
  prompt: string;
  missingVariables: string[];
  usedVariables: string[];
}

const variablePattern = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

function stringifyPromptVariable(
  value: string | number | boolean | null | undefined,
) {
  if (value === null || value === undefined) return "";

  return String(value);
}

export function extractPromptVariables(content: string) {
  const variables = new Set<string>();

  for (const match of content.matchAll(variablePattern)) {
    const variableName = match[1];

    if (variableName) {
      variables.add(variableName);
    }
  }

  return [...variables];
}

export function interpolatePromptTemplate(
  content: string,
  variables: Record<string, string | number | boolean | null | undefined> = {},
) {
  const missingVariables = new Set<string>();
  const usedVariables = new Set<string>();

  const prompt = content.replace(variablePattern, (_, variableName: string) => {
    usedVariables.add(variableName);

    if (!(variableName in variables)) {
      missingVariables.add(variableName);
      return "";
    }

    return stringifyPromptVariable(variables[variableName]);
  });

  return {
    prompt,
    missingVariables: [...missingVariables],
    usedVariables: [...usedVariables],
  };
}

export async function getPromptTemplateById(templateId: PromptTemplateId) {
  const templates = await getPromptTemplates();

  return templates.find((template) => template.id === templateId);
}

export async function renderPromptTemplate({
  templateId,
  variables = {},
  includeSystemIdentity = true,
}: PromptRenderInput): Promise<PromptRenderResult> {
  const templates = await getPromptTemplates();
  const template = templates.find((item) => item.id === templateId);

  if (!template) {
    throw new Error(`Prompt template not found: ${templateId}`);
  }

  const systemIdentity =
    includeSystemIdentity && templateId !== "story-system-identity"
      ? templates.find((item) => item.id === "story-system-identity")
      : undefined;

  const rawPrompt = [
    systemIdentity?.editablePrompt,
    template.editablePrompt,
    template.lockedContract,
  ]
    .filter(Boolean)
    .join("\n\n");

  const rendered = interpolatePromptTemplate(rawPrompt, variables);

  return {
    template,
    systemIdentity,
    prompt: rendered.prompt.trim(),
    missingVariables: rendered.missingVariables,
    usedVariables: rendered.usedVariables,
  };
}

export function createPromptVariableReport(result: PromptRenderResult) {
  if (result.missingVariables.length === 0) {
    return "All prompt variables resolved.";
  }

  return `Missing variables: ${result.missingVariables.join(", ")}`;
}
