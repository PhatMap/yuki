"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Cpu,
  Database,
  ExternalLink,
  Gauge,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Settings,
  Sparkles,
  TestTube,
} from "lucide-react";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { PageShell } from "@/components/app/page-shell";
import { SectionCard } from "@/components/app/section-card";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  aiRuntimeProviderOptions,
  defaultAiRuntimeSettings,
  getActiveRuntimeEndpoint,
  getActiveRuntimeModel,
  getAiRuntimeProviderLabel,
  getAiRuntimeSettings,
  normalizeMaxOutputTokens,
  normalizeTemperature,
  resetAiRuntimeSettings,
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

const jobRuntimeOptions: {
  id: AiRuntimeSettings["jobRuntime"];
  title: string;
  description: string;
  status: "ready" | "draft";
}[] = [
  {
    id: "local-browser",
    title: "Local Browser",
    description:
      "Runs job orchestration in the main browser context. Useful as a compatibility fallback.",
    status: "ready",
  },
  {
    id: "local-worker",
    title: "Local Worker",
    description:
      "Runs local job orchestration through Web Worker. Recommended for large stories.",
    status: "ready",
  },
  {
    id: "cloud-queue",
    title: "Cloud Queue",
    description:
      "Future Supabase/Redis/Cloudflare queue runtime. Currently falls back safely.",
    status: "draft",
  },
];

const testPrompt = `Bạn là Yuki AI runtime. Trả lời một câu ngắn: runtime settings đã sẵn sàng.`;

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("vi-VN");
}

function getProviderIcon(providerId: AiRuntimeProviderId) {
  if (providerId === "mock") return <Cpu className="h-5 w-5" />;
  if (providerId === "ollama") return <Cpu className="h-5 w-5" />;
  if (providerId === "custom-openai") return <Server className="h-5 w-5" />;
  if (providerId === "gemini-direct") return <Sparkles className="h-5 w-5" />;

  return <Server className="h-5 w-5" />;
}

function getJobRuntimeIcon(jobRuntime: AiRuntimeSettings["jobRuntime"]) {
  if (jobRuntime === "cloud-queue") return <Server className="h-5 w-5" />;
  if (jobRuntime === "local-worker") return <Cpu className="h-5 w-5" />;

  return <Gauge className="h-5 w-5" />;
}

export function GlobalSettingsClient() {
  const [settings, setSettings] = useState<AiRuntimeSettings>(
    defaultAiRuntimeSettings,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const storedSettings = await getAiRuntimeSettings();

        if (!isMounted) return;

        setSettings(storedSettings);
      } catch (error) {
        console.error("Failed to load AI runtime settings", error);
        setMessage("Không thể đọc AI runtime settings từ IndexedDB.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeEndpoint = useMemo(
    () => getActiveRuntimeEndpoint(settings),
    [settings],
  );
  const activeModel = useMemo(
    () => getActiveRuntimeModel(settings),
    [settings],
  );

  function updateSettings<K extends keyof AiRuntimeSettings>(
    key: K,
    value: AiRuntimeSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
    setMessage("");
  }

  async function handleSaveSettings() {
    setIsSaving(true);
    setMessage("");

    try {
      const savedSettings = await saveAiRuntimeSettings(settings);

      setSettings(savedSettings);
      setMessage("Đã lưu AI runtime settings vào IndexedDB.");
    } catch (error) {
      console.error("Failed to save AI runtime settings", error);
      setMessage("Không thể lưu AI runtime settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetSettings() {
    setIsSaving(true);
    setMessage("");

    try {
      const resetSettings = await resetAiRuntimeSettings();

      setSettings(resetSettings);
      setMessage("Đã khôi phục AI runtime settings mặc định.");
    } catch (error) {
      console.error("Failed to reset AI runtime settings", error);
      setMessage("Không thể reset AI runtime settings.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleLocalTest() {
    const report = [
      "Runtime test preview",
      `Provider: ${getAiRuntimeProviderLabel(settings.providerId)}`,
      `Endpoint: ${activeEndpoint}`,
      `Model: ${activeModel}`,
      `Temperature: ${settings.temperature}`,
      `Max output tokens: ${settings.maxOutputTokens}`,
      "",
      "Test prompt:",
      testPrompt,
      "",
      "Ghi chú: bước này chỉ kiểm tra config local, chưa gọi API thật.",
    ].join("\n");

    setMessage(report);
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Global Settings"
          title="AI Runtime Control Center"
          description="Quản lý provider, model, endpoint và runtime mặc định cho toàn bộ Yuki. Prompt templates nằm ở Prompt Manager."
          action={
            <>
              <Button asChild variant="outline">
                <Link href="/prompt-manager">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Prompt Manager
                </Link>
              </Button>

              <Button
                type="button"
                onClick={handleSaveSettings}
                disabled={isLoading || isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Đang lưu..." : "Save Settings"}
              </Button>
            </>
          }
        />

        {message ? (
          <section className="app-warning-box whitespace-pre-wrap">
            <Settings className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <p>{message}</p>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={<Gauge className="h-4 w-4" />}
            title="Provider"
            value={getAiRuntimeProviderLabel(settings.providerId)}
            description="Global runtime provider"
          />
          <StatCard
            icon={<Gauge className="h-4 w-4" />}
            title="Job runtime"
            value={settings.jobRuntime}
            description="Analysis orchestration mode"
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            title="Model"
            value={activeModel}
            description="Active model name"
          />
          <StatCard
            icon={<Database className="h-4 w-4" />}
            title="Storage"
            value="IndexedDB"
            description="No localStorage for runtime config"
          />
          <StatCard
            icon={<RefreshCw className="h-4 w-4" />}
            title="Updated"
            value={
              settings.updatedAt ? formatDateTime(settings.updatedAt) : "Never"
            }
            description="Last saved runtime settings"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <SectionCard
              title="Provider đang dùng"
              description="Chọn một provider mặc định cho các tác vụ AI. Các bước sau sẽ nối runtime này vào analysis/planner/rewrite."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {aiRuntimeProviderOptions.map((provider) => {
                  const isActive = settings.providerId === provider.id;

                  return (
                    <button
                      key={provider.id}
                      type="button"
                      className={
                        isActive
                          ? "rounded-2xl border bg-primary/10 p-4 text-left ring-2 ring-primary"
                          : "rounded-2xl border bg-background p-4 text-left transition hover:bg-muted/60"
                      }
                      onClick={() => updateSettings("providerId", provider.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="app-dashboard-card-icon">
                          {getProviderIcon(provider.id)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{provider.title}</p>
                            {isActive ? (
                              <span className="app-chip-primary">
                                <Check className="mr-1 h-3 w-3" />
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {provider.description}
                          </p>
                          <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
                            {provider.status}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard
              title="Job runtime"
              description="Chọn cách chạy job phân tích cục bộ. Local Worker là lựa chọn khuyến nghị cho truyện lớn."
            >
              <div className="grid gap-3 md:grid-cols-3">
                {jobRuntimeOptions.map((runtime) => {
                  const isActive = settings.jobRuntime === runtime.id;

                  return (
                    <button
                      key={runtime.id}
                      type="button"
                      className={
                        isActive
                          ? "rounded-2xl border bg-primary/10 p-4 text-left ring-2 ring-primary"
                          : "rounded-2xl border bg-background p-4 text-left transition hover:bg-muted/60"
                      }
                      onClick={() => updateSettings("jobRuntime", runtime.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="app-dashboard-card-icon">
                          {getJobRuntimeIcon(runtime.id)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{runtime.title}</p>
                            {isActive ? (
                              <span className="app-chip-primary">
                                <Check className="mr-1 h-3 w-3" />
                                Active
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {runtime.description}
                          </p>

                          <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
                            {runtime.status}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard
              title="Gemini Proxy"
              description="Provider dự kiến dùng cho deploy. Endpoint là route proxy của app hoặc API server sau này."
            >
              <div className="space-y-4">
                <SettingsTextInput
                  id="gemini-proxy-endpoint"
                  label="Proxy endpoint"
                  value={settings.geminiProxyEndpoint}
                  onChange={(value) =>
                    updateSettings("geminiProxyEndpoint", value)
                  }
                  placeholder="/api/ai/gemini"
                />

                <div className="grid gap-2">
                  <Label htmlFor="gemini-proxy-model">Default model</Label>
                  <select
                    id="gemini-proxy-model"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={settings.defaultModel}
                    onChange={(event) =>
                      updateSettings("defaultModel", event.target.value)
                    }
                  >
                    <option value="mock-local">mock-local</option>
                    {geminiProxyModelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Custom OpenAI-compatible"
              description="Dành cho one-api/NewAPI/proxy clone. Bước này chỉ lưu base URL và model, chưa lưu raw API key."
            >
              <div className="space-y-4">
                <SettingsTextInput
                  id="custom-openai-url"
                  label="Base URL"
                  value={settings.customOpenAiBaseUrl}
                  onChange={(value) =>
                    updateSettings("customOpenAiBaseUrl", value)
                  }
                  placeholder="https://your-proxy.example.com/v1"
                />

                <SettingsTextInput
                  id="custom-openai-model"
                  label="Model"
                  value={settings.customOpenAiModel}
                  onChange={(value) =>
                    updateSettings("customOpenAiModel", value)
                  }
                  placeholder="gpt-4o-mini / claude-compatible-model / ..."
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Gemini Direct"
              description="Dành cho AI Studio. Không nên lưu API key raw trong app public; sau này nên dùng server/proxy."
            >
              <div className="space-y-4">
                <SettingsTextInput
                  id="gemini-direct-url"
                  label="Base URL"
                  value={settings.geminiDirectBaseUrl}
                  onChange={(value) =>
                    updateSettings("geminiDirectBaseUrl", value)
                  }
                  placeholder="https://generativelanguage.googleapis.com"
                />

                <div className="grid gap-2">
                  <Label htmlFor="gemini-direct-model">Model</Label>
                  <select
                    id="gemini-direct-model"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={settings.geminiDirectModel}
                    onChange={(event) =>
                      updateSettings("geminiDirectModel", event.target.value)
                    }
                  >
                    {geminiDirectModelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Ollama Local"
              description="Dành cho local AI. Cần chạy Ollama trên máy người dùng."
            >
              <div className="space-y-4">
                <SettingsTextInput
                  id="ollama-url"
                  label="Ollama URL"
                  value={settings.ollamaBaseUrl}
                  onChange={(value) => updateSettings("ollamaBaseUrl", value)}
                  placeholder="http://localhost:11434"
                />

                <SettingsTextInput
                  id="ollama-model"
                  label="Model"
                  value={settings.ollamaModel}
                  onChange={(value) => updateSettings("ollamaModel", value)}
                  placeholder="llama3.1 / qwen2.5 / gemma2"
                />
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <SectionCard title="Runtime Parameters">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(event) =>
                      updateSettings(
                        "temperature",
                        normalizeTemperature(Number(event.target.value)),
                      )
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="max-output-tokens">Max output tokens</Label>
                  <Input
                    id="max-output-tokens"
                    type="number"
                    min="512"
                    max="65536"
                    step="512"
                    value={settings.maxOutputTokens}
                    onChange={(event) =>
                      updateSettings(
                        "maxOutputTokens",
                        normalizeMaxOutputTokens(Number(event.target.value)),
                      )
                    }
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Runtime Preview">
              <div className="space-y-3 text-sm">
                <PreviewRow label="Provider" value={settings.providerId} />
                <PreviewRow label="Job runtime" value={settings.jobRuntime} />
                <PreviewRow label="Endpoint" value={activeEndpoint} />
                <PreviewRow label="Model" value={activeModel} />
                <PreviewRow
                  label="Temperature"
                  value={String(settings.temperature)}
                />
                <PreviewRow
                  label="Max output"
                  value={String(settings.maxOutputTokens)}
                />
              </div>
            </SectionCard>

            <SectionCard title="Actions">
              <div className="space-y-3">
                <Button
                  className="w-full"
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isLoading || isSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save to IndexedDB
                </Button>

                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={handleLocalTest}
                >
                  <TestTube className="mr-2 h-4 w-4" />
                  Local Test Preview
                </Button>

                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={handleResetSettings}
                  disabled={isSaving}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset Defaults
                </Button>

                <Button asChild className="w-full" variant="outline">
                  <Link href="/prompt-manager">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Open Prompt Manager
                  </Link>
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="API Key Policy">
              <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>
                  Không lưu raw API key trong bước này. Với app deploy public,
                  key nên đi qua server/proxy hoặc vault sau này.
                </p>
                <p>
                  Runtime settings hiện chỉ lưu provider, model, endpoint và
                  tham số generation vào IndexedDB.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="External Links">
              <div className="space-y-2">
                <Button asChild className="w-full" variant="outline">
                  <a
                    href="https://aistudio.google.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Google AI Studio
                  </a>
                </Button>

                <Button asChild className="w-full" variant="outline">
                  <Link href="/stories">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Back to Stories
                  </Link>
                </Button>
              </div>
            </SectionCard>
          </aside>
        </section>
      </PageContainer>
    </PageShell>
  );
}

function SettingsTextInput({
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

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-xs">{value}</p>
    </div>
  );
}
