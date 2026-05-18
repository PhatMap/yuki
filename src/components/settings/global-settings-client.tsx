"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TestTube } from "lucide-react";

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

const GEMINI_PROXY_PRESET_ENDPOINT = "/api/proxy";

interface GeminiProxyRemoteModel {
  id: string;
  displayName: string;
  isGemini: boolean;
}

type ProviderKeyDraft = {
  single: string;
  bulk: string;
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
    description: "Khuyên dùng cho workflow chính của Yuki.",
    practical: true,
    unlockedWorkflow: true,
  },
  {
    id: "ollama",
    title: "Ollama",
    description: "Local AI, phù hợp khi bạn đã chạy Ollama ở máy cá nhân.",
    practical: true,
    unlockedWorkflow: true,
  },
  {
    id: "gemini-direct",
    title: "Gemini Direct",
    description: "Có thể cấu hình, nhưng hiện chưa mở workflow.",
    practical: false,
    unlockedWorkflow: false,
  },
  {
    id: "custom-openai",
    title: "Custom OpenAI-compatible",
    description: "Có thể cấu hình, nhưng hiện chưa mở workflow.",
    practical: false,
    unlockedWorkflow: false,
  },
];

function createEmptyKeyDraft(): ProviderKeyDraft {
  return {
    single: "",
    bulk: "",
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
  if (!value) return "Chưa cập nhật";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("vi-VN");
}

function getActiveModel(settings: AiRuntimeSettings) {
  if (settings.providerId === "gemini-proxy") return settings.defaultModel;
  if (settings.providerId === "gemini-direct") return settings.geminiDirectModel;
  if (settings.providerId === "custom-openai") return settings.customOpenAiModel;
  if (settings.providerId === "ollama") return settings.ollamaModel;
  return settings.defaultModel;
}

export function GlobalSettingsClient() {
  const [settings, setSettings] = useState<AiRuntimeSettings>(defaultAiRuntimeSettings);
  const [readiness, setReadiness] = useState<AiSetupReadiness>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [lastProxyTestOk, setLastProxyTestOk] = useState<boolean | null>(null);
  const [isMutatingKeys, setIsMutatingKeys] = useState(false);
  const [isLoadingGeminiModels, setIsLoadingGeminiModels] = useState(false);
  const [geminiProxyModels, setGeminiProxyModels] = useState<GeminiProxyRemoteModel[]>([]);
  const [modelLoadMessage, setModelLoadMessage] = useState("");
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
        const runtimeSettings = await getAiRuntimeSettings();
        if (!active) return;
        setSettings(runtimeSettings);
        await Promise.all([refreshProviderKeys(), refreshReadiness()]);
      } catch (error) {
        console.error("Failed to load AI setup data", error);
        if (active) {
          setMessage("Không thể đọc dữ liệu setup AI.");
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
      setMessage("Đã lưu cấu hình provider.");
    } catch (error) {
      console.error("Failed to save AI settings", error);
      setMessage("Không thể lưu cấu hình provider.");
    } finally {
      setIsSaving(false);
    }
  }

  function buildGeminiModelsEndpoint(endpoint: string) {
    const trimmed = endpoint.trim();
    if (!trimmed) return "/api/proxy/v1/models";
    if (trimmed === GEMINI_PROXY_PRESET_ENDPOINT) return "/api/proxy/v1/models";

    const normalized = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
    return `${normalized}/v1/models`;
  }

  async function handleLoadGeminiProxyModels() {
    setIsLoadingGeminiModels(true);
    setModelLoadMessage("");

    try {
      const modelsEndpoint = buildGeminiModelsEndpoint(settings.geminiProxyEndpoint);
      const response = await fetch(modelsEndpoint, {
        method: "GET",
        headers: {
          "content-type": "application/json",
        },
      });

      if (!response.ok) {
        setModelLoadMessage(`Không thể tải models: HTTP ${response.status}.`);
        return;
      }

      const payload = (await response.json()) as unknown;
      if (!payload || typeof payload !== "object") {
        setModelLoadMessage("Không thể tải models: response không hợp lệ.");
        return;
      }

      const record = payload as Record<string, unknown>;
      if (record.object !== "list" || !Array.isArray(record.data)) {
        setModelLoadMessage("Không thể tải models: response không đúng định dạng list.");
        return;
      }

      const parsedModels: GeminiProxyRemoteModel[] = [];
      for (const item of record.data) {
        if (!item || typeof item !== "object") continue;
        const modelRecord = item as Record<string, unknown>;
        if (typeof modelRecord.id !== "string") continue;

        const id = modelRecord.id.trim();
        if (!id) continue;
        const displayName =
          typeof modelRecord.display_name === "string" && modelRecord.display_name.trim()
            ? modelRecord.display_name.trim()
            : id;
        parsedModels.push({
          id,
          displayName,
          isGemini: id.toLowerCase().includes("gemini"),
        });
      }

      const uniqueById = new Map<string, GeminiProxyRemoteModel>();
      parsedModels.forEach((model) => uniqueById.set(model.id, model));
      const merged = Array.from(uniqueById.values()).sort((left, right) =>
        left.displayName.localeCompare(right.displayName),
      );

      setGeminiProxyModels(merged);
      setModelLoadMessage(`Đã tải ${merged.length} model.`);
    } catch (error) {
      console.error("Failed to load Gemini Proxy models", error);
      setModelLoadMessage(
        error instanceof Error
          ? `Không thể tải models: ${error.message}`
          : "Không thể tải models.",
      );
    } finally {
      setIsLoadingGeminiModels(false);
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
      setMessage(`Đã thêm API key cho ${providerId}.`);
    } catch (error) {
      console.error("Failed to add API key", error);
      setMessage("Không thể thêm API key.");
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
      setMessage(`Đã thêm ${result.added} API key cho ${providerId}.`);
    } catch (error) {
      console.error("Failed to add API keys in bulk", error);
      setMessage("Không thể thêm nhiều API key.");
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
      setMessage("Đã xóa API key.");
    } catch (error) {
      console.error("Failed to delete API key", error);
      setMessage("Không thể xóa API key.");
    } finally {
      setIsMutatingKeys(false);
    }
  }

  async function handleTestProvider() {
    setIsTestingProvider(true);
    setTestMessage("");
    setMessage("");

    try {
      const saved = await saveAiRuntimeSettings(settings);
      setSettings(saved);

      const result = await runAiProviderConnectionTest();
      await saveProviderTestStatus({
        providerId: saved.providerId,
        ok: result.ok,
        message: result.message,
        testedAt: new Date().toISOString(),
      });
      if (saved.providerId === "gemini-proxy") {
        setLastProxyTestOk(result.ok);
      }
      await refreshReadiness();
      setTestMessage(result.message);
    } catch (error) {
      console.error("Failed to test provider", error);
      setTestMessage("Không thể test provider.");
    } finally {
      setIsTestingProvider(false);
    }
  }

  const selectedGeminiProxyModel = useMemo(
    () => settings.defaultModel.trim(),
    [settings.defaultModel],
  );
  const geminiModelsOnly = useMemo(
    () => geminiProxyModels.filter((model) => model.isGemini),
    [geminiProxyModels],
  );
  const nonGeminiModels = useMemo(
    () => geminiProxyModels.filter((model) => !model.isGemini),
    [geminiProxyModels],
  );
  const selectedGeminiModelOption = useMemo(() => {
    const all = [...geminiModelsOnly, ...nonGeminiModels];
    return all.find((model) => model.id === selectedGeminiProxyModel);
  }, [geminiModelsOnly, nonGeminiModels, selectedGeminiProxyModel]);

  return (
    <PageShell>
      <PageContainer className="max-w-[1120px]">
        <PageHeader
          title="Thiết lập AI"
          description="Chọn provider, cấu hình đúng provider đó, rồi test kết nối trước khi dùng Yuki."
        />

        {message ? (
          <section className="app-warning-box">
            <p>{message}</p>
          </section>
        ) : null}

        <SectionCard title={readiness?.isReady ? "Sẵn sàng" : "Chưa sẵn sàng"}>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Provider: <strong>{readiness?.providerLabel ?? "Đang tải..."}</strong> · Model:{" "}
              <strong>{activeModel || "chưa cấu hình"}</strong>
            </p>
            {!readiness?.isReady ? (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {(readiness?.missingReasons ?? []).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <Button asChild>
                <Link href="/stories/import">Bắt đầu nạp truyện</Link>
              </Button>
            )}
          </div>
        </SectionCard>

        <section className="space-y-4">
          <SectionCard title="1) Chọn provider">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                        {provider.id === "gemini-proxy" ? (
                          <span className="app-chip-primary">Khuyên dùng</span>
                        ) : !provider.unlockedWorkflow ? (
                          <span className="app-chip">chưa mở workflow</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{provider.description}</p>
                    </button>
                  );
                })}
            </div>
          </SectionCard>

          <SectionCard title="2) Cấu hình provider hiện tại">
            {settings.providerId === "gemini-proxy" ? (
              <div className="space-y-4">
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-sm font-medium">Gemini Proxy mặc định</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ag.beijixingxing - OpenAI-compatible qua /api/proxy để tránh CORS trên Vercel.
                  </p>
                  <div className="mt-3 grid gap-2">
                    <Label htmlFor="gemini-proxy-endpoint">Proxy URL</Label>
                    <Input
                      id="gemini-proxy-endpoint"
                      value={GEMINI_PROXY_PRESET_ENDPOINT}
                      readOnly
                      placeholder="/api/proxy"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateSetting("geminiProxyEndpoint", GEMINI_PROXY_PRESET_ENDPOINT)
                      }
                    >
                      Dùng preset
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="Test Gemini Proxy"
                      onClick={handleTestProvider}
                      disabled={isLoading || isTestingProvider}
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mặc định: /api/proxy (Vercel rewrite -&gt; ag.beijixingxing.com). Không cần đổi trừ khi dùng proxy khác.
                  </p>
                  {settings.providerId === "gemini-proxy" && lastProxyTestOk === true ? (
                    <p className="mt-2 text-xs text-emerald-600">Kết nối OK</p>
                  ) : null}
                  {settings.providerId === "gemini-proxy" &&
                  lastProxyTestOk === false &&
                  testMessage ? (
                    <p className="mt-2 text-xs text-destructive">{testMessage}</p>
                  ) : null}
                </div>

                <ProviderKeySection
                  providerId="gemini-proxy"
                  title="API key Gemini Proxy"
                  keys={providerKeys["gemini-proxy"]}
                  draft={keyDrafts["gemini-proxy"]}
                  isMutating={isMutatingKeys}
                  onDraftChange={(patch) => updateKeyDraft("gemini-proxy", patch)}
                  onAddSingle={() => void handleAddSingleKey("gemini-proxy")}
                  onAddBulk={() => void handleAddBulkKeys("gemini-proxy")}
                  onDelete={(id) => void handleDeleteKey(id)}
                />

                <p className="text-xs text-muted-foreground">
                  API key được lưu cục bộ trong trình duyệt dưới dạng plaintext.
                </p>

                <div className="rounded-xl border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">Model mặc định đang dùng</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleLoadGeminiProxyModels}
                      disabled={isLoadingGeminiModels}
                    >
                      {isLoadingGeminiModels ? "Đang tải..." : "Lấy models"}
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedGeminiModelOption?.displayName ?? selectedGeminiProxyModel}
                  </p>
                  {modelLoadMessage ? (
                    <p className="mt-2 text-xs text-muted-foreground">{modelLoadMessage}</p>
                  ) : null}
                  <div className="mt-3 grid gap-2">
                    <Label htmlFor="gemini-proxy-model">Model Gemini Proxy</Label>
                    <select
                      id="gemini-proxy-model"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={settings.defaultModel}
                      onChange={(event) =>
                        updateSetting("defaultModel", event.target.value)
                      }
                    >
                      {geminiModelsOnly.length > 0
                        ? geminiModelsOnly.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.displayName}
                            </option>
                          ))
                        : geminiProxyModelOptions.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                      {!geminiModelsOnly.some(
                        (model) => model.id === settings.defaultModel,
                      ) ? (
                        <option value={settings.defaultModel}>
                          {settings.defaultModel} (giữ cấu hình hiện tại)
                        </option>
                      ) : null}
                    </select>
                  </div>
                  {geminiModelsOnly.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {geminiModelsOnly.slice(0, 8).map((model) => (
                        <Button
                          key={model.id}
                          type="button"
                          size="sm"
                          variant={
                            settings.defaultModel === model.id ? "default" : "outline"
                          }
                          onClick={() => updateSetting("defaultModel", model.id)}
                        >
                          {model.displayName}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {nonGeminiModels.length > 0 ? (
                    <details className="mt-3 rounded-lg border bg-muted/20">
                      <summary className="cursor-pointer px-3 py-2 text-sm">
                        Model khác
                      </summary>
                      <div className="space-y-2 border-t p-3">
                        {nonGeminiModels.map((model) => (
                          <Button
                            key={model.id}
                            type="button"
                            size="sm"
                            variant={
                              settings.defaultModel === model.id
                                ? "default"
                                : "outline"
                            }
                            onClick={() => updateSetting("defaultModel", model.id)}
                          >
                            {model.displayName}
                          </Button>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </div>
            ) : null}

            {settings.providerId === "gemini-direct" ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Gemini Direct hiện chưa mở workflow phân tích.</p>
                <SettingInput
                  id="gemini-direct-url"
                  label="Gemini Direct base URL"
                  value={settings.geminiDirectBaseUrl}
                  onChange={(value) => updateSetting("geminiDirectBaseUrl", value)}
                  placeholder="https://generativelanguage.googleapis.com"
                />
                <div className="grid gap-2">
                  <Label>Model Gemini Direct</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={settings.geminiDirectModel}
                    onChange={(event) => updateSetting("geminiDirectModel", event.target.value)}
                  >
                    {geminiDirectModelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
                <ProviderKeySection
                  providerId="gemini-direct"
                  title="API key Gemini Direct"
                  keys={providerKeys["gemini-direct"]}
                  draft={keyDrafts["gemini-direct"]}
                  isMutating={isMutatingKeys}
                  onDraftChange={(patch) => updateKeyDraft("gemini-direct", patch)}
                  onAddSingle={() => void handleAddSingleKey("gemini-direct")}
                  onAddBulk={() => void handleAddBulkKeys("gemini-direct")}
                  onDelete={(id) => void handleDeleteKey(id)}
                />
              </div>
            ) : null}

            {settings.providerId === "custom-openai" ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Custom OpenAI-compatible hiện chưa mở workflow phân tích.
                </p>
                <SettingInput
                  id="custom-openai-url"
                  label="Custom OpenAI base URL"
                  value={settings.customOpenAiBaseUrl}
                  onChange={(value) => updateSetting("customOpenAiBaseUrl", value)}
                  placeholder="https://your-endpoint.example.com/v1"
                />
                <SettingInput
                  id="custom-openai-model"
                  label="Model Custom OpenAI-compatible"
                  value={settings.customOpenAiModel}
                  onChange={(value) => updateSetting("customOpenAiModel", value)}
                  placeholder="gpt-4o-mini / custom-model"
                />
                <ProviderKeySection
                  providerId="custom-openai"
                  title="API key Custom OpenAI-compatible"
                  keys={providerKeys["custom-openai"]}
                  draft={keyDrafts["custom-openai"]}
                  isMutating={isMutatingKeys}
                  onDraftChange={(patch) => updateKeyDraft("custom-openai", patch)}
                  onAddSingle={() => void handleAddSingleKey("custom-openai")}
                  onAddBulk={() => void handleAddBulkKeys("custom-openai")}
                  onDelete={(id) => void handleDeleteKey(id)}
                />
              </div>
            ) : null}

            {settings.providerId === "ollama" ? (
              <div className="space-y-4">
                <SettingInput
                  id="ollama-url"
                  label="Ollama base URL"
                  value={settings.ollamaBaseUrl}
                  onChange={(value) => updateSetting("ollamaBaseUrl", value)}
                  placeholder="http://localhost:11434"
                />
                <SettingInput
                  id="ollama-model"
                  label="Model Ollama"
                  value={settings.ollamaModel}
                  onChange={(value) => updateSetting("ollamaModel", value)}
                  placeholder="llama3.1 / qwen2.5"
                />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="3) Test kết nối">
            <Button
              type="button"
              className="h-11 px-6"
              onClick={handleTestProvider}
              disabled={isLoading || isTestingProvider}
            >
              <TestTube className="mr-2 h-4 w-4" />
              {isTestingProvider ? "Đang test..." : "Test kết nối"}
            </Button>

            {testMessage ? <p className="mt-3 text-sm text-muted-foreground">{testMessage}</p> : null}

            {readiness?.isReady ? (
              <div className="mt-4">
                <Button asChild>
                  <Link href="/stories/import">Bắt đầu nạp truyện</Link>
                </Button>
              </div>
            ) : null}
          </SectionCard>

          <details className="rounded-xl border bg-card/70">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Nâng cao</summary>
            <div className="space-y-3 border-t p-4">
              <p className="text-sm font-medium">Mock Local (test only)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Không khuyến nghị cho workflow thật.
              </p>
              <Button
                type="button"
                className="mt-3"
                variant="outline"
                size="sm"
                onClick={() => updateSetting("providerId", "mock")}
              >
                Chuyển sang Mock Local
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSaveSettings}
                disabled={isLoading || isSaving}
              >
                {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
              </Button>
            </div>
          </details>
        </section>
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
          placeholder={`Thêm 1 key cho ${providerId}`}
        />
        <Button type="button" onClick={onAddSingle} disabled={isMutating}>
          Thêm key
        </Button>
      </div>

      <details className="mt-2 rounded-lg border bg-muted/20">
        <summary className="cursor-pointer px-3 py-2 text-sm">Nhập nhiều key</summary>
        <div className="space-y-2 border-t p-3">
          <Textarea
            className="min-h-24"
            value={draft.bulk}
            onChange={(event) => onDraftChange({ bulk: event.target.value })}
            placeholder="Mỗi dòng một key"
          />
          <Button type="button" onClick={onAddBulk} disabled={isMutating}>
            Thêm tất cả key hợp lệ
          </Button>
        </div>
      </details>

      <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
        {keys.length > 0 ? (
          keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between gap-2 rounded-lg border px-2 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{key.maskedKey}</p>
                <p className="text-[11px] text-muted-foreground">{formatDateTime(key.updatedAt)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(key.id)}
                disabled={isMutating}
              >
                Xóa
              </Button>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">Chưa có API key.</p>
        )}
      </div>
    </div>
  );
}
