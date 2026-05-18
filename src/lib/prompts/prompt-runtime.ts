import {
  getDefaultPromptTemplates,
  getPromptTemplates,
} from "@/lib/prompts/prompt-registry";
import type { GlobalPromptTemplate } from "@/lib/types";

export type PromptTemplateId =
  | "story-system-identity"
  | "import-analysis"
  | "chapter-scout"
  | "arc-map"
  | "rewrite-impact-planner"
  | "rewrite-draft"
  | "new-story-from-framework";

export interface RenderedPromptPackage {
  promptId: string;
  promptVersion: number;
  category: string;
  scope: "global" | "story-specific";
  storyId?: string;
  systemInstruction: string;
  globalTaskInstruction: string;
  storyInstruction?: string;
  lockedContract: string;
  variables: Record<string, unknown>;
  renderedPrompt: string;
  inputPayload: unknown;
  outputSchemaId: string;
  missingVariables: string[];
  estimatedTokens?: number;
}

export interface PromptRenderInput {
  templateId: PromptTemplateId;
  variables?: Record<string, string | number | boolean | null | undefined>;
  includeSystemIdentity?: boolean;
  throwOnMissingTemplate?: boolean;
  storyId?: string;
  storyInstruction?: string;
  inputPayload?: unknown;
}

export interface PromptRenderResult {
  template: GlobalPromptTemplate;
  systemIdentity?: GlobalPromptTemplate;
  prompt: string;
  missingVariables: string[];
  usedVariables: string[];
  source: "indexed-db" | "default";
  package: RenderedPromptPackage;
}

const variablePattern = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;
const outputSchemaPattern = /"outputSchemaId"\s*:\s*"([^"]+)"/;

function inferPromptVersion(template: GlobalPromptTemplate) {
  const matched = template.updatedAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!matched) return 1;

  const [, year, month, day] = matched;
  return Number(`${year}${month}${day}`);
}

function inferOutputSchemaId(template: GlobalPromptTemplate) {
  const matched = template.lockedContract.match(outputSchemaPattern);
  if (matched?.[1]) return matched[1];

  return `${template.id}.v1`;
}

function estimatePromptTokens(value: string) {
  if (!value.trim()) return 0;
  return Math.ceil(value.length / 4);
}

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

async function getRuntimePromptTemplates() {
  if (typeof window === "undefined") {
    return {
      templates: getDefaultPromptTemplates(),
      source: "default" as const,
    };
  }

  try {
    return {
      templates: await getPromptTemplates(),
      source: "indexed-db" as const,
    };
  } catch (error) {
    console.warn("Falling back to default prompt templates", error);

    return {
      templates: getDefaultPromptTemplates(),
      source: "default" as const,
    };
  }
}

export async function getPromptTemplateById(templateId: PromptTemplateId) {
  const { templates } = await getRuntimePromptTemplates();

  return templates.find((template) => template.id === templateId);
}

export async function renderPromptTemplate({
  templateId,
  variables = {},
  includeSystemIdentity = true,
  throwOnMissingTemplate = false,
  storyId,
  storyInstruction,
  inputPayload,
}: PromptRenderInput): Promise<PromptRenderResult> {
  const defaultTemplates = getDefaultPromptTemplates();
  const runtimeTemplates = await getRuntimePromptTemplates();
  const template =
    runtimeTemplates.templates.find((item) => item.id === templateId) ??
    defaultTemplates.find((item) => item.id === templateId);

  if (!template) {
    if (throwOnMissingTemplate) {
      throw new Error(`Prompt template not found: ${templateId}`);
    }

    const fallbackTemplate = defaultTemplates[0];

    return {
      template: fallbackTemplate,
      prompt: "",
      missingVariables: [],
      usedVariables: [],
      source: "default",
      package: {
        promptId: fallbackTemplate.id,
        promptVersion: inferPromptVersion(fallbackTemplate),
        category: fallbackTemplate.category,
        scope: "global",
        storyId,
        systemInstruction: "",
        globalTaskInstruction: fallbackTemplate.editablePrompt,
        storyInstruction,
        lockedContract: fallbackTemplate.lockedContract,
        variables,
        renderedPrompt: "",
        inputPayload,
        outputSchemaId: inferOutputSchemaId(fallbackTemplate),
        missingVariables: [],
        estimatedTokens: 0,
      },
    };
  }

  const systemIdentity =
    includeSystemIdentity && templateId !== "story-system-identity"
      ? (runtimeTemplates.templates.find(
          (item) => item.id === "story-system-identity",
        ) ?? defaultTemplates.find((item) => item.id === "story-system-identity"))
      : undefined;

  const rawPrompt = [
    systemIdentity?.editablePrompt,
    template.editablePrompt,
    storyInstruction,
    template.lockedContract,
  ]
    .filter(Boolean)
    .join("\n\n");

  const rendered = interpolatePromptTemplate(rawPrompt, variables);
  const renderedPrompt = rendered.prompt.trim();
  const renderedPackage: RenderedPromptPackage = {
    promptId: template.id,
    promptVersion: inferPromptVersion(template),
    category: template.category,
    scope: storyInstruction ? "story-specific" : "global",
    storyId,
    systemInstruction: systemIdentity?.editablePrompt ?? "",
    globalTaskInstruction: template.editablePrompt,
    storyInstruction,
    lockedContract: template.lockedContract,
    variables,
    renderedPrompt,
    inputPayload,
    outputSchemaId: inferOutputSchemaId(template),
    missingVariables: rendered.missingVariables,
    estimatedTokens: estimatePromptTokens(renderedPrompt),
  };

  return {
    template,
    systemIdentity,
    prompt: renderedPrompt,
    missingVariables: rendered.missingVariables,
    usedVariables: rendered.usedVariables,
    source: runtimeTemplates.source,
    package: renderedPackage,
  };
}

export function createPromptVariableReport(result: PromptRenderResult) {
  if (result.missingVariables.length === 0) {
    return "All prompt variables resolved.";
  }

  return `Missing variables: ${result.missingVariables.join(", ")}`;
}
