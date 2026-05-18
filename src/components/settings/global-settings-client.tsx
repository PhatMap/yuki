"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ExternalLink, Save, TestTube } from "lucide-react";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addProviderApiKey,
  addProviderApiKeysFromLines,
  deleteProviderApiKey,
  listAllProviderApiKeys,
  saveProviderTestStatus,
  type AiProviderApiKeyRecord,
  type ApiKeyProviderId,
} from "@/lib/settings/ai-api-key-store";
import {
  getAiSetupReadiness,
  runAiProviderConnectionTest,
  type AiSetupReadiness,
} from "@/lib/settings/ai-setup-readiness";
import {
  defaultAiRuntimeSettings,
  getAiRuntimeSettings,
  saveAiRuntimeSettings,
  type AiRuntimeProviderId,
  type AiRuntimeSettings,
} from "@/lib/settings/ai-runtime-settings";

const geminiProxyModelOptions = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-3.1-pro-preview",
];

const geminiDirectModelOptions = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
];

type ProviderKeyDraft = {
  single: string;
  bulk: string;
  showBulk: boolean;
};

const providerChoices: {
  id: Exclude<AiRuntimeProviderId, "mock">;
  title: string;
  description: string;
  practical: boolean;
  unlockedWorkflow: boolean;
}[] = [
  {
    id: "gemini-proxy",
    title: "Gemini Proxy",
    description: "Khuyen nghi cho workflow chinh cua Yuki.",
    practical: true,
    unlockedWorkflow: true,
  },
  {
    id: "ollama",
    title: "Ollama",
    description: "Local AI, phu hop khi ban da chay Ollama o may ca nhan.",
    practical: true,
    unlockedWorkflow: true,
  },
  {
    id: "gemini-direct",
    title: "Gemini Direct",
    description: "Co the cau hinh, nhung hien chua mo workflow.",
    practical: false,
    unlockedWorkflow: false,
  },
  {
    id: "custom-openai",
    title: "Custom OpenAI-compatible",
    description: "Co the cau hinh, nhung hien chua mo workflow.",
    practical: false,
    unlockedWorkflow: false,
  },
];

function createEmptyKeyDraft(): ProviderKeyDraft {
  return {
    single: "",
    bulk: "",
    showBulk: false,
  };
}

function createInitialKeyDrafts() {
  return {
    "gemini-proxy": createEmptyKeyDraft(),
    "gemini-direct": createEmptyKeyDraft(),
    "custom-openai": createEmptyKeyDraft(),
  } as Record<ApiKeyProviderId, ProviderKeyDraft>;
}

function formatDateTime(value?: string) {
  if (!value) return "Chua cap nhat";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("vi-VN");
}

function getModelFieldLabel(providerId: AiRuntimeProviderId) {
  if (providerId === "gemini-proxy") return "Model Gemini Proxy";
  if (providerId === "gemini-direct") return "Model Gemini Direct";
  if (providerId === "custom-openai") return "Model Custom OpenAI-compatible";
  if (providerId === "ollama") return "Model Ollama";
  return "Model";
}

function getActiveModel(settings: AiRuntimeSettings) {
  if (settings.providerId === "gemini-proxy") return settings.defaultModel;
  if (settings.providerId === "gemini-direct") return settings.geminiDirectModel;
  if (settings.providerId === "custom-openai") return settings.customOpenAiModel;
  if (settings.providerId === "ollama") return settings.ollamaModel;
  return settings.defaultModel;
}

function getCurrentEndpointValue(settings: AiRuntimeSettings) {
  if (settings.providerId === "gemini-proxy") return settings.geminiProxyEndpoint;
  if (settings.providerId === "gemini-direct") return settings.geminiDirectBaseUrl;
  if (settings.providerId === "custom-openai") return settings.customOpenAiBaseUrl;
  if (settings.providerId === "ollama") return settings.ollamaBaseUrl;
  return "";
}

export function GlobalSettingsClient() {
  const [settings, setSettings] = useState<AiRuntimeSettings>(defaultAiRuntimeSettings);
  const [readiness, setReadiness] = useState<AiSetupReadiness>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [isMutatingKeys, setIsMutatingKeys] = useState(false);
  const [providerKeys, setProviderKeys] = useState<
    Record<ApiKeyProviderId, AiProviderApiKeyRecord[]>
  >({
    "gemini-proxy": [],
    "gemini-direct": [],
    "custom-openai": [],
  });
  const [keyDrafts, setKeyDrafts] = useState(createInitialKeyDrafts());

  async function refreshReadiness() {
    const result = await getAiSetupReadiness();
    setReadiness(result);
  }

  async function refreshProviderKeys() {
    const allKeys = await listAllProviderApiKeys();
    setProviderKeys(allKeys);
  }

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const [runtimeSettings] = await Promise.all([getAiRuntimeSettings()]);
        if (!active) return;
        setSettings(runtimeSettings);
        await Promise.all([refreshProviderKeys(), refreshReadiness()]);
      } catch (error) {
        console.error("Failed to load AI setup data", error);
        if (active) {
          setMessage("Khong the doc du lieu setup AI.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  const activeModel = useMemo(() => getActiveModel(settings), [settings]);
  const activeProvider = useMemo(
    () => providerChoices.find((provider) => provider.id === settings.providerId),
    [settings.providerId],
  );

  function updateSetting<K extends keyof AiRuntimeSettings>(
    key: K,
    value: AiRuntimeSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateKeyDraft(
    providerId: ApiKeyProviderId,
    patch: Partial<ProviderKeyDraft>,
  ) {
    setKeyDrafts((current) => ({
      ...current,
      [providerId]: {
        ...current[providerId],
        ...patch,
      },
    }));
  }

  async function handleSaveSettings() {
    setIsSaving(true);
    setMessage("");

    try {
      const saved = await saveAiRuntimeSettings(settings);
      setSettings(saved);
      await refreshReadiness();
      setMessage("Da luu settings AI.");
    } catch (error) {
      console.error("Failed to save AI settings", error);
      setMessage("Khong the luu settings AI.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddSingleKey(providerId: ApiKeyProviderId) {
    const value = keyDrafts[providerId].single.trim();
    if (!value) return;

    setIsMutatingKeys(true);
    setMessage("");
    try {
      await addProviderApiKey(providerId, value);
      await Promise.all([refreshProviderKeys(), refreshReadiness()]);
      updateKeyDraft(providerId, { single: "" });
      setMessage(`Da them API key cho ${providerId}.`);
    } catch (error) {
      console.error("Failed to add API key", error);
      setMessage("Khong the them API key.");
    } finally {
      setIsMutatingKeys(false);
    }
  }

  async function handleAddBulkKeys(providerId: ApiKeyProviderId) {
    const bulk = keyDrafts[providerId].bulk;
    if (!bulk.trim()) return;

    setIsMutatingKeys(true);
    setMessage("");
    try {
      const result = await addProviderApiKeysFromLines(providerId, bulk);
      await Promise.all([refreshProviderKeys(), refreshReadiness()]);
      updateKeyDraft(providerId, { bulk: "" });
      setMessage(`Da them ${result.added} API key cho ${providerId}.`);
    } catch (error) {
      console.error("Failed to add API keys in bulk", error);
      setMessage("Khong the them nhieu API key.");
    } finally {
      setIsMutatingKeys(false);
    }
  }

  async function handleDeleteKey(id: string) {
    setIsMutatingKeys(true);
    setMessage("");
    try {
      await deleteProviderApiKey(id);
      await Promise.all([refreshProviderKeys(), refreshReadiness()]);
      setMessage("Da xoa API key.");
    } catch (error) {
      console.error("Failed to delete API key", error);
      setMessage("Khong the xoa API key.");
    } finally {
      setIsMutatingKeys(false);
    }
  }

  async function handleTestProvider() {
    setIsTestingProvider(true);
    setTestMessage("");
    setMessage("");

    try {
      const result = await runAiProviderConnectionTest();
      await saveProviderTestStatus({
        providerId: settings.providerId,
        ok: result.ok,
        message: result.message,
        testedAt: new Date().toISOString(),
      });
      await refreshReadiness();
      setTestMessage(result.message);
    } catch (error) {
      console.error("Failed to test provider", error);
      setTestMessage("Khong the test provider.");
    } finally {
      setIsTestingProvider(false);
    }
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          title="Thiet lap AI"
          description="Chon provider, nhap API key, chon model, roi test ket noi truoc khi dung Yuki."
          action={
            <Button
              type="button"
              onClick={handleSaveSettings}
              disabled={isLoading || isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Dang luu..." : "Luu settings"}
            </Button>
          }
        />

        {message ? (
          <section className="app-warning-box">
            <p>{message}</p>
          </section>
        ) : null}

        <SectionCard title="Tien trinh setup AI">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {["Provider", "API key", "Model", "Test"].map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="rounded-md border bg-background px-2 py-1 font-medium">
                    {index + 1}. {step}
                  </span>
                  {index < 3 ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : null}
                </div>
              ))}
            </div>
            <div className="text-sm">
              <strong>{readiness?.isReady ? "San sang" : "Chua san sang"}</strong>
            </div>
          </div>
          {readiness?.missingReasons?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {readiness.missingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </SectionCard>

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <SectionCard title="1) Chon provider">
              <div className="grid gap-2">
                {providerChoices
                  .sort((a, b) => Number(b.practical) - Number(a.practical))
                  .map((provider) => {
                    const selected = settings.providerId === provider.id;
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        className={
                          selected
                            ? "w-full rounded-xl border border-primary/40 bg-primary/10 px-3 py-3 text-left"
                            : "w-full rounded-xl border bg-background px-3 py-3 text-left"
                        }
                        onClick={() => updateSetting("providerId", provider.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{provider.title}</p>
                          {!provider.unlockedWorkflow ? (
                            <span className="app-chip">chua mo workflow</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {provider.description}
                        </p>
                      </button>
                    );
                  })}
              </div>
            </SectionCard>

            <SectionCard title="2) Nhap API key">
              <p className="mb-3 text-xs text-muted-foreground">
                API key duoc luu local trong trinh duyet (IndexedDB).
              </p>
              <div className="space-y-4">
                {(["gemini-proxy", "gemini-direct", "custom-openai"] as const).map(
                  (providerId) => (
                    <ProviderKeySection
                      key={providerId}
                      providerId={providerId}
                      title={
                        providerId === "gemini-proxy"
                          ? "Gemini Proxy"
                          : providerId === "gemini-direct"
                            ? "Gemini Direct"
                            : "Custom OpenAI-compatible"
                      }
                      keys={providerKeys[providerId]}
                      draft={keyDrafts[providerId]}
                      isMutating={isMutatingKeys}
                      onDraftChange={(patch) => updateKeyDraft(providerId, patch)}
                      onAddSingle={() => void handleAddSingleKey(providerId)}
                      onAddBulk={() => void handleAddBulkKeys(providerId)}
                      onDelete={(id) => void handleDeleteKey(id)}
                    />
                  ),
                )}
              </div>
            </SectionCard>

            <SectionCard title="3) Chon model">
              <p className="text-sm text-muted-foreground">
                {getModelFieldLabel(settings.providerId)}
              </p>
              <div className="mt-3 space-y-3">
                {settings.providerId === "gemini-proxy" ? (
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={settings.defaultModel}
                    onChange={(event) =>
                      updateSetting("defaultModel", event.target.value)
                    }
                  >
                    {geminiProxyModelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : null}

                {settings.providerId === "gemini-direct" ? (
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={settings.geminiDirectModel}
                    onChange={(event) =>
                      updateSetting("geminiDirectModel", event.target.value)
                    }
                  >
                    {geminiDirectModelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : null}

                {settings.providerId === "custom-openai" ? (
                  <Input
                    value={settings.customOpenAiModel}
                    onChange={(event) =>
                      updateSetting("customOpenAiModel", event.target.value)
                    }
                    placeholder="gpt-4o-mini / custom-model"
                  />
                ) : null}

                {settings.providerId === "ollama" ? (
                  <Input
                    value={settings.ollamaModel}
                    onChange={(event) => updateSetting("ollamaModel", event.target.value)}
                    placeholder="llama3.1 / qwen2.5"
                  />
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="4) Test ket noi">
              <Button
                type="button"
                onClick={handleTestProvider}
                disabled={isLoading || isTestingProvider}
              >
                <TestTube className="mr-2 h-4 w-4" />
                {isTestingProvider ? "Dang test..." : "Test ket noi"}
              </Button>
              {testMessage ? (
                <p className="mt-3 text-sm text-muted-foreground">{testMessage}</p>
              ) : null}

              {readiness?.isReady ? (
                <div className="mt-4">
                  <Button asChild>
                    <Link href="/stories/import">Bat dau nap truyen</Link>
                  </Button>
                </div>
              ) : null}
            </SectionCard>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <SectionCard title="Tom tat nhanh">
              <div className="space-y-2 text-sm">
                <p>
                  Provider: <strong>{readiness?.providerLabel || "Dang tai..."}</strong>
                </p>
                <p>
                  Model: <strong>{activeModel || "chua cau hinh"}</strong>
                </p>
                <p className="text-muted-foreground">
                  {activeProvider?.unlockedWorkflow
                    ? "Provider co the mo workflow khi du dieu kien setup."
                    : "Provider nay hien chua mo workflow phan tich."}
                </p>
              </div>
            </SectionCard>

            <details className="rounded-xl border bg-card/70">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Nang cao
              </summary>
              <div className="space-y-4 border-t p-4">
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-sm font-medium">Endpoint / Base URL</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Chi chinh khi ban can route hoac host khac.
                  </p>
                  <div className="mt-2">
                    {settings.providerId === "gemini-proxy" ? (
                      <SettingInput
                        id="gemini-proxy-endpoint"
                        label="Gemini Proxy endpoint"
                        value={settings.geminiProxyEndpoint}
                        onChange={(value) => updateSetting("geminiProxyEndpoint", value)}
                        placeholder="/api/ai/gemini"
                      />
                    ) : null}
                    {settings.providerId === "gemini-direct" ? (
                      <SettingInput
                        id="gemini-direct-url"
                        label="Gemini Direct base URL"
                        value={settings.geminiDirectBaseUrl}
                        onChange={(value) => updateSetting("geminiDirectBaseUrl", value)}
                        placeholder="https://generativelanguage.googleapis.com"
                      />
                    ) : null}
                    {settings.providerId === "custom-openai" ? (
                      <SettingInput
                        id="custom-openai-url"
                        label="Custom OpenAI base URL"
                        value={settings.customOpenAiBaseUrl}
                        onChange={(value) => updateSetting("customOpenAiBaseUrl", value)}
                        placeholder="https://your-endpoint.example.com/v1"
                      />
                    ) : null}
                    {settings.providerId === "ollama" ? (
                      <SettingInput
                        id="ollama-url"
                        label="Ollama base URL"
                        value={settings.ollamaBaseUrl}
                        onChange={(value) => updateSetting("ollamaBaseUrl", value)}
                        placeholder="http://localhost:11434"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border bg-background p-3">
                  <p className="text-sm font-medium">Runtime settings</p>
                  <div className="mt-3 space-y-3">
                    <NumericInput
                      id="gemini-batch-size"
                      label="Batch size"
                      value={settings.geminiBatchSize}
                      min={1}
                      onChange={(value) => updateSetting("geminiBatchSize", value)}
                    />
                    <NumericInput
                      id="gemini-batch-concurrency"
                      label="Concurrency"
                      value={settings.geminiBatchConcurrency}
                      min={1}
                      onChange={(value) => updateSetting("geminiBatchConcurrency", value)}
                    />
                    <NumericInput
                      id="gemini-request-delay"
                      label="Request delay (ms)"
                      value={settings.geminiRequestDelayMs}
                      min={0}
                      onChange={(value) => updateSetting("geminiRequestDelayMs", value)}
                    />
                    <NumericInput
                      id="max-output-tokens"
                      label="Max output tokens"
                      value={settings.maxOutputTokens}
                      min={512}
                      onChange={(value) => updateSetting("maxOutputTokens", value)}
                    />
                    <FloatInput
                      id="temperature"
                      label="Temperature"
                      value={settings.temperature}
                      min={0}
                      max={2}
                      step={0.1}
                      onChange={(value) => updateSetting("temperature", value)}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-background p-3">
                  <p className="text-sm font-medium">Mock Local (test only)</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Khong khuyen nghi cho workflow that.
                  </p>
                  <Button
                    type="button"
                    className="mt-3"
                    variant="outline"
                    size="sm"
                    onClick={() => updateSetting("providerId", "mock")}
                  >
                    Chuyen sang Mock Local
                  </Button>
                </div>

                <div className="rounded-xl border bg-background p-3">
                  <p className="text-sm font-medium">Cong cu ky thuat</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/stories/data-health">Data Health</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/prompt-manager">Prompt Manager</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a
                        href="https://aistudio.google.com/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Google AI Studio
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </details>
          </aside>
        </section>

        <SectionCard title="Thong tin hien tai">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Provider" value={settings.providerId} />
            <SummaryCard label="Model" value={activeModel || "chua cau hinh"} />
            <SummaryCard
              label="Endpoint/Base URL"
              value={getCurrentEndpointValue(settings) || "chua cau hinh"}
            />
            <SummaryCard label="San sang" value={readiness?.isReady ? "Yes" : "No"} />
          </div>
        </SectionCard>
      </PageContainer>
    </PageShell>
  );
}

function SettingInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function NumericInput({
  id,
  label,
  value,
  min,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function FloatInput({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function ProviderKeySection({
  providerId,
  title,
  keys,
  draft,
  isMutating,
  onDraftChange,
  onAddSingle,
  onAddBulk,
  onDelete,
}: {
  providerId: ApiKeyProviderId;
  title: string;
  keys: AiProviderApiKeyRecord[];
  draft: ProviderKeyDraft;
  isMutating: boolean;
  onDraftChange: (patch: Partial<ProviderKeyDraft>) => void;
  onAddSingle: () => void;
  onAddBulk: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <span className="app-chip">{keys.length} key</span>
      </div>

      <div className="flex gap-2">
        <Input
          value={draft.single}
          onChange={(event) => onDraftChange({ single: event.target.value })}
          placeholder={`Them 1 key cho ${providerId}`}
        />
        <Button type="button" onClick={onAddSingle} disabled={isMutating}>
          Them key
        </Button>
      </div>

      <div className="mt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onDraftChange({ showBulk: !draft.showBulk })}
        >
          Nhap nhieu key
        </Button>
      </div>

      {draft.showBulk ? (
        <div className="mt-2 space-y-2">
          <Textarea
            className="min-h-24"
            value={draft.bulk}
            onChange={(event) => onDraftChange({ bulk: event.target.value })}
            placeholder="Moi dong mot key"
          />
          <Button type="button" onClick={onAddBulk} disabled={isMutating}>
            Them tat ca key hop le
          </Button>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {keys.length > 0 ? (
          keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between gap-2 rounded-lg border px-2 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{key.maskedKey}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDateTime(key.updatedAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(key.id)}
                disabled={isMutating}
              >
                Xoa
              </Button>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">Chua co API key.</p>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/80 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
