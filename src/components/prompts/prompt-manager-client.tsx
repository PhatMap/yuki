"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Database, RotateCcw, Save, Sparkles } from "lucide-react";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getDefaultPromptTemplates,
  getPromptTemplates,
  resetAllPromptTemplates,
  resetPromptTemplate,
  savePromptTemplates,
} from "@/lib/prompts/prompt-registry";
import type {
  GlobalPromptTemplate,
  PromptTemplateCategory,
} from "@/lib/types";

type CategoryFilter = PromptTemplateCategory | "all";

const categoryLabels: Record<CategoryFilter, string> = {
  all: "All",
  system: "System",
  analysis: "Analysis",
  planning: "Planning",
  rewrite: "Rewrite",
  generation: "Generation",
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("vi-VN");
}

function getCategoryFilters(templates: GlobalPromptTemplate[]) {
  const categories = Array.from(
    new Set(templates.map((template) => template.category)),
  ).sort();

  return ["all", ...categories] as CategoryFilter[];
}

export function PromptManagerClient() {
  const [templates, setTemplates] = useState<GlobalPromptTemplate[]>(() =>
    getDefaultPromptTemplates(),
  );
  const [activeCategory, setActiveCategory] =
    useState<CategoryFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadTemplates() {
      setIsLoading(true);
      setStatusMessage("");

      try {
        const storedTemplates = await getPromptTemplates();

        if (!isActive) return;

        setTemplates(storedTemplates);
      } catch (error) {
        console.error("Failed to load prompt templates", error);

        if (!isActive) return;

        setStatusMessage("Could not load prompt templates from IndexedDB.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadTemplates();

    return () => {
      isActive = false;
    };
  }, []);

  const categoryFilters = useMemo(
    () => getCategoryFilters(templates),
    [templates],
  );
  const visibleTemplates = useMemo(() => {
    if (activeCategory === "all") return templates;

    return templates.filter((template) => template.category === activeCategory);
  }, [activeCategory, templates]);

  function updateEditablePrompt(templateId: string, editablePrompt: string) {
    setTemplates((currentTemplates) =>
      currentTemplates.map((template) =>
        template.id === templateId
          ? {
              ...template,
              editablePrompt,
            }
          : template,
      ),
    );
  }

  async function handleSaveAll() {
    setIsSaving(true);
    setStatusMessage("");

    try {
      await savePromptTemplates(templates);
      const storedTemplates = await getPromptTemplates();

      setTemplates(storedTemplates);
      setStatusMessage("Prompt templates saved to IndexedDB.");
    } catch (error) {
      console.error("Failed to save prompt templates", error);
      setStatusMessage("Could not save prompt templates.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetTemplate(templateId: string) {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const resetTemplate = await resetPromptTemplate(templateId);

      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === templateId ? resetTemplate : template,
        ),
      );
      setStatusMessage(`${resetTemplate.title} reset to default.`);
    } catch (error) {
      console.error("Failed to reset prompt template", error);
      setStatusMessage("Could not reset prompt template.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetAll() {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const resetTemplates = await resetAllPromptTemplates();

      setTemplates(resetTemplates);
      setStatusMessage("All prompt templates reset to defaults.");
    } catch (error) {
      console.error("Failed to reset prompt templates", error);
      setStatusMessage("Could not reset prompt templates.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageShell>
      <PageContainer className="max-w-7xl">
        <PageHeader
          eyebrow="AI Runtime"
          title="Prompt Manager"
          description="Edit global prompt templates stored in IndexedDB. Prompt contracts protect required output shapes for analysis and rewrite flows."
          action={
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isLoading || isSaving}
                onClick={handleResetAll}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset all
              </Button>
              <Button
                type="button"
                disabled={isLoading || isSaving}
                onClick={handleSaveAll}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save all"}
              </Button>
            </>
          }
        />

        {statusMessage ? (
          <section className="app-warning-box">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>{statusMessage}</p>
          </section>
        ) : null}

        <SectionCard title="Prompt Safety">
          <div className="space-y-2">
            <PromptManagerHint>
              Editable prompt text controls model behavior.
            </PromptManagerHint>
            <PromptManagerHint>
              Locked contract describes required output shape and should not be
              bypassed.
            </PromptManagerHint>
            <PromptManagerHint>
              Variables are inserted at runtime.
            </PromptManagerHint>
            <PromptManagerHint>
              Reset restores the selected template or all templates to defaults.
            </PromptManagerHint>
          </div>
        </SectionCard>

        <SectionCard
          icon={<Database className="h-5 w-5" />}
          title="Category"
          description="Filter prompt templates by workflow area."
        >
          <div className="app-chip-row">
            {categoryFilters.map((category) => (
              <button
                key={category}
                type="button"
                className={
                  activeCategory === category ? "app-chip-primary" : "app-chip"
                }
                onClick={() => setActiveCategory(category)}
              >
                {categoryLabels[category]}
              </button>
            ))}
          </div>
        </SectionCard>

        {isLoading ? (
          <SectionCard title="Loading prompt registry">
            <p className="app-muted-text">
              Reading global prompt templates from IndexedDB...
            </p>
          </SectionCard>
        ) : (
          <section className="space-y-4">
            {visibleTemplates.map((template) => (
              <PromptTemplateEditor
                key={template.id}
                template={template}
                disabled={isSaving}
                onPromptChange={updateEditablePrompt}
                onReset={handleResetTemplate}
              />
            ))}
          </section>
        )}
      </PageContainer>
    </PageShell>
  );
}

function PromptTemplateEditor({
  template,
  disabled,
  onPromptChange,
  onReset,
}: {
  template: GlobalPromptTemplate;
  disabled: boolean;
  onPromptChange: (templateId: string, editablePrompt: string) => void;
  onReset: (templateId: string) => void;
}) {
  return (
    <SectionCard
      title={template.title}
      description={template.description}
      contentClassName="space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Variables
          </p>
          <div className="app-chip-row">
          <span className="app-chip-primary">Template: {template.title}</span>
          <span className="app-chip">Category: {template.category}</span>
          {template.variables.map((variable) => (
            <span className="app-chip" key={variable}>
              {"{{" + variable + "}}"}
            </span>
          ))}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onReset(template.id)}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset this prompt
        </Button>
      </div>

      <PromptManagerHint>
        Variables are filled by the runtime. Missing variables will be reported
        before provider output is trusted.
      </PromptManagerHint>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Editable prompt</span>
          <PromptManagerHint>
            Edit instructions carefully. Keep structure requirements aligned with
            the locked contract.
          </PromptManagerHint>
          <Textarea
            className="app-editor-textarea min-h-[260px]"
            value={template.editablePrompt}
            disabled={disabled}
            onChange={(event) =>
              onPromptChange(template.id, event.target.value)
            }
          />
        </label>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Locked contract</p>
            <span className="text-xs text-muted-foreground">
              Updated {formatDate(template.updatedAt)}
            </span>
          </div>
          <pre className="app-code-block min-h-[260px] overflow-auto">
            {template.lockedContract}
          </pre>
        </div>
      </div>

      <PromptManagerHint>
        Reset affects prompt templates only. It does not delete stories,
        analysis results, jobs, or cache.
      </PromptManagerHint>
    </SectionCard>
  );
}

function PromptManagerHint({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>;
}
