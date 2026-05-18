"use client";

import Link from "next/link";
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  aiRuntimeProviderOptions,
  createGeminiFastBatchProfile,
  createGeminiCoreRuntimeSettings,
  createGeminiSafeBatchProfile,
  defaultAiRuntimeSettings,
  GEMINI_CORE_DEFAULT_ENDPOINT,
  getActiveRuntimeEndpoint,
  getActiveRuntimeModel,
  getAiRuntimeProviderLabel,
  getAiRuntimeSettings,
  normalizeGeminiBatchConcurrency,
  normalizeGeminiBatchSize,
  normalizeGeminiRequestDelayMs,
  normalizeMaxOutputTokens,
  normalizeTemperature,
  resetAiRuntimeSettings,
  saveAiRuntimeSettings,
  type AiRuntimeProviderId,
  type AiRuntimeSettings,
} from "@/lib/settings/ai-runtime-settings";
import {
  runRuntimeDiagnostics,
  type RuntimeDiagnosticStatus,
  type RuntimeDiagnosticsReport,
} from "@/lib/settings/runtime-diagnostics";
import { downloadRuntimeDiagnosticsReport } from "@/lib/settings/runtime-diagnostics-export";
import { requestBrowserStoragePersistence } from "@/lib/settings/browser-storage-persistence";
import {
  createAppBackupPayload,
  downloadAppBackup,
  restoreAppBackupPayload,
} from "@/lib/backup/app-backup";
import {
  readAppBackupFile,
  type AppBackupValidationResult,
} from "@/lib/backup/app-backup-validation";

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

function getRuntimeDiagnosticBadgeVariant(status: RuntimeDiagnosticStatus) {
  if (status === "pass") return "secondary";
  if (status === "fail") return "destructive";

  return "outline";
}

function isInvalidGeminiProxyModel(model: string) {
  const normalized = model.trim();

  return (
    !normalized ||
    normalized === "mock-local" ||
    normalized === "custom-model-not-set" ||
    normalized === "gemini-proxy-default"
  );
}

export function GlobalSettingsClient() {
  const [settings, setSettings] = useState<AiRuntimeSettings>(
    defaultAiRuntimeSettings,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [runtimeDiagnostics, setRuntimeDiagnostics] =
    useState<RuntimeDiagnosticsReport>();
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [isExportingRuntimeDiagnostics, setIsExportingRuntimeDiagnostics] =
    useState(false);
  const [isRequestingStoragePersistence, setIsRequestingStoragePersistence] =
    useState(false);
  const [isExportingAppBackup, setIsExportingAppBackup] = useState(false);
  const [isValidatingAppBackup, setIsValidatingAppBackup] = useState(false);
  const [isRestoringAppBackup, setIsRestoringAppBackup] = useState(false);
  const [geminiProxyDiscoveredModels, setGeminiProxyDiscoveredModels] =
    useState<string[]>([]);
  const [isFetchingGeminiProxyModels, setIsFetchingGeminiProxyModels] =
    useState(false);
  const [appBackupValidationResult, setAppBackupValidationResult] =
    useState<AppBackupValidationResult>();

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
  const shouldWarnGeminiModel =
    settings.providerId === "gemini-proxy" &&
    isInvalidGeminiProxyModel(settings.defaultModel);
  const geminiProxyModelPickerOptions = useMemo(() => {
    const normalizedCurrentModel = settings.defaultModel.trim();
    const combinedModels = [
      ...geminiProxyModelOptions,
      ...geminiProxyDiscoveredModels,
    ].map((model) => model.trim());
    const deduplicatedModels = Array.from(
      new Set(combinedModels.filter((model) => model.length > 0)),
    );

    if (
      normalizedCurrentModel &&
      !deduplicatedModels.includes(normalizedCurrentModel)
    ) {
      deduplicatedModels.unshift(normalizedCurrentModel);
    }

    return deduplicatedModels;
  }, [geminiProxyDiscoveredModels, settings.defaultModel]);

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

  function handleUseGeminiCoreProfile() {
    const nextSettings = createGeminiCoreRuntimeSettings(settings);

    setSettings(nextSettings);
    setMessage(
      "Đã áp dụng Gemini Core profile ở local. Bấm Lưu settings để ghi lại.",
    );
  }

  function handleUseGeminiSafeBatchProfile() {
    const nextSettings = createGeminiSafeBatchProfile(settings);

    setSettings(nextSettings);
    setMessage(
      "Đã áp dụng Gemini Safe Batch profile ở local. Bấm Lưu settings để ghi lại.",
    );
  }

  function handleUseGeminiFastBatchProfile() {
    const nextSettings = createGeminiFastBatchProfile(settings);

    setSettings(nextSettings);
    setMessage(
      "Đã áp dụng Gemini Fast Batch profile ở local. Bấm Lưu settings để ghi lại.",
    );
  }

  async function handleFetchGeminiProxyModels() {
    setIsFetchingGeminiProxyModels(true);
    setMessage("");

    try {
      const endpoint =
        settings.geminiProxyEndpoint.trim() || GEMINI_CORE_DEFAULT_ENDPOINT;

      if (
        endpoint.startsWith("http://") ||
        endpoint.startsWith("https://")
      ) {
        setMessage(
          "Endpoint Gemini Proxy dạng tuyệt đối không được tải trực tiếp từ UI trình duyệt. Hãy dùng Runtime Diagnostics hoặc route models phía server.",
        );
        return;
      }

      if (!endpoint.startsWith("/")) {
        setMessage(
          "Gemini Proxy endpoint nên là route tương đối như /api/ai/gemini.",
        );
        return;
      }

      const normalizedEndpoint = endpoint.replace(/\/+$/g, "");
      const modelsEndpoint =
        normalizedEndpoint === "/api/ai/gemini" ||
        normalizedEndpoint.endsWith("/api/ai/gemini")
          ? `${normalizedEndpoint}/models`
          : `${normalizedEndpoint}/models`;
      const response = await fetch(modelsEndpoint, {
        method: "GET",
      });

      if (!response.ok) {
        setMessage(
          `Không thể tải Gemini Proxy models (HTTP ${response.status}).`,
        );
        return;
      }

      const payload = (await response.json()) as unknown;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        setMessage("Phản hồi Gemini Proxy models không hợp lệ.");
        return;
      }
      const payloadRecord = payload as Record<string, unknown>;

      const models = Array.isArray(payloadRecord.models)
        ? payloadRecord.models.filter(
            (model): model is string => typeof model === "string",
          )
        : [];
      const deduplicatedModels = Array.from(
        new Set(models.map((model) => model.trim()).filter((model) => model)),
      );

      if (deduplicatedModels.length === 0) {
        const maybeMessage =
          typeof payloadRecord.message === "string"
            ? payloadRecord.message
            : "Gemini Proxy model discovery không trả về model nào.";

        setMessage(maybeMessage);
        return;
      }

      setGeminiProxyDiscoveredModels(deduplicatedModels);
      setMessage(`Đã tải Gemini Proxy models: ${deduplicatedModels.length}.`);

      if (
        isInvalidGeminiProxyModel(settings.defaultModel) &&
        deduplicatedModels[0]
      ) {
        updateSettings("defaultModel", deduplicatedModels[0]);
      }
    } catch (error) {
      console.error("Failed to fetch Gemini proxy models", error);
      setMessage("Không thể tải Gemini Proxy models.");
    } finally {
      setIsFetchingGeminiProxyModels(false);
    }
  }

  async function handleRunRuntimeDiagnostics() {
    setIsRunningDiagnostics(true);
    setMessage("");

    try {
      const report = await runRuntimeDiagnostics(settings);

      setRuntimeDiagnostics(report);
      setMessage(`Đã chạy Runtime diagnostics: ${report.overallStatus}.`);
    } catch (error) {
      console.error("Failed to run runtime diagnostics", error);
      setMessage("Không thể chạy Runtime diagnostics.");
    } finally {
      setIsRunningDiagnostics(false);
    }
  }

  async function handleExportRuntimeDiagnostics() {
    setIsExportingRuntimeDiagnostics(true);
    setMessage("");

    try {
      const report = runtimeDiagnostics ?? (await runRuntimeDiagnostics(settings));

      if (!runtimeDiagnostics) {
        setRuntimeDiagnostics(report);
      }

      const fileName = downloadRuntimeDiagnosticsReport(report);

      setMessage(`Đã export Runtime diagnostics: ${fileName}`);
    } catch (error) {
      console.error("Failed to export runtime diagnostics", error);
      setMessage("Không thể export Runtime diagnostics.");
    } finally {
      setIsExportingRuntimeDiagnostics(false);
    }
  }

  async function handleRequestStoragePersistence() {
    setIsRequestingStoragePersistence(true);
    setMessage("");

    try {
      const result = await requestBrowserStoragePersistence();

      setMessage(result.message);

      const report = await runRuntimeDiagnostics(settings);
      setRuntimeDiagnostics(report);
    } catch (error) {
      console.error("Failed to request persistent browser storage", error);
      setMessage("Không thể request persistent browser storage.");
    } finally {
      setIsRequestingStoragePersistence(false);
    }
  }

  async function handleExportAppBackup() {
    setIsExportingAppBackup(true);
    setMessage("");

    try {
      const payload = await createAppBackupPayload();
      const fileName = downloadAppBackup(payload);

      setMessage(`App backup exported: ${fileName}`);
    } catch (error) {
      console.error("Failed to export app backup", error);
      setMessage("Không thể export app backup.");
    } finally {
      setIsExportingAppBackup(false);
    }
  }

  async function handleValidateAppBackupFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsValidatingAppBackup(true);
    setMessage("");
    setAppBackupValidationResult(undefined);

    try {
      const result = await readAppBackupFile(file);

      setAppBackupValidationResult(result);
      setMessage(
        result.isValid
          ? "File app backup hợp lệ."
          : "File app backup có lỗi validation.",
      );
    } catch (error) {
      console.error("Failed to validate app backup", error);
      setMessage("Không thể validate app backup.");
    } finally {
      setIsValidatingAppBackup(false);
      event.target.value = "";
    }
  }

  function canRestoreValidatedAppBackup() {
    return appBackupValidationResult?.isValid === true;
  }

  async function handleRestoreValidatedAppBackup() {
    const payload = appBackupValidationResult?.payload;

    if (!payload) {
      setMessage("Chưa chọn app backup hợp lệ.");
      return;
    }

    const confirmed = window.confirm(
      "Restore app backup settings? Hành động này sẽ ghi đè global runtime settings và prompt templates. Story content không được restore ở bước này.",
    );

    if (!confirmed) return;

    setIsRestoringAppBackup(true);
    setMessage("");

    try {
      const summary = await restoreAppBackupPayload(payload);
      const refreshedSettings = await getAiRuntimeSettings();

      setSettings(refreshedSettings);
      setMessage(
        `App backup restored. Provider: ${summary.restoredRuntimeProvider}, job runtime: ${summary.restoredJobRuntime}, prompt templates: ${summary.promptTemplates.toLocaleString(
          "vi-VN",
        )}. Story index entries were kept as reference only: ${summary.storyIndexEntries.toLocaleString(
          "vi-VN",
        )}.`,
      );
    } catch (error) {
      console.error("Failed to restore app backup", error);
      setMessage(
        error instanceof Error
          ? `Không thể restore app backup: ${error.message}`
          : "Không thể restore app backup.",
      );
    } finally {
      setIsRestoringAppBackup(false);
    }
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHeader
          eyebrow="Nâng cao"
          title="Cài đặt kỹ thuật"
          description="Quản lý Runtime và model cho toàn bộ app. Dùng khi bạn cần tinh chỉnh nâng cao."
          action={
            <>
              <Button asChild variant="outline">
                <Link href="/prompt-manager">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Mở Prompt Manager
                </Link>
              </Button>

              <Button
                type="button"
                onClick={handleSaveSettings}
                disabled={isLoading || isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Đang lưu..." : "Lưu settings"}
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
            description="Global Runtime provider"
          />
          <StatCard
            icon={<Gauge className="h-4 w-4" />}
            title="Job runtime"
            value={settings.jobRuntime}
            description="Chế độ orchestration cho analysis"
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            title="Model"
            value={activeModel}
            description="Tên model đang active"
          />
          <StatCard
            icon={<Database className="h-4 w-4" />}
            title="Storage"
            value="IndexedDB"
            description="Không dùng localStorage cho runtime config"
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

        <SectionCard
          title="Gemini Proxy Core"
          description="Recommended real-AI path for Yuki. Browser calls the app proxy route; API keys remain server-only."
        >
          <div className="space-y-4">
            <SettingsHint>
              Recommended setup: Gemini Proxy + /api/ai/gemini + gemini-2.5-flash + local-worker. Use this for real analysis after GEMINI_API_KEY is configured in .env.local or deployment env.
            </SettingsHint>
            <div className="grid gap-3 md:grid-cols-2">
              <PreviewRow
                label="Provider"
                value={getAiRuntimeProviderLabel(settings.providerId)}
              />
              <PreviewRow label="Endpoint" value={activeEndpoint} />
              <PreviewRow label="Model" value={activeModel} />
              <PreviewRow
                label="Batch"
                value={`${settings.geminiBatchSize} / ${settings.geminiBatchConcurrency} / ${settings.geminiRequestDelayMs}ms`}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleUseGeminiCoreProfile}
              disabled={isLoading || isSaving}
            >
              <Server className="mr-2 h-4 w-4" />
              Sử dụng Gemini Core Profile
            </Button>
            <SettingsHint>
              Điều này chỉ áp dụng cục bộ. Nhấp Lưu settings để duy trì.
            </SettingsHint>
          </div>
        </SectionCard>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <SectionCard
              title="Core AI Runtime"
              description="Choose the default AI provider. Mock is safe for first launch. Gemini Proxy is the recommended real-AI core. Ollama is local fallback/experiment."
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
              description="Choose where local analysis job orchestration runs. Local Worker is recommended for large stories."
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
              title="Gemini Batch Controls"
              description="Tune batch size, local concurrency, and per-task delay for long Gemini Proxy story analysis."
            >
              <div className="space-y-4">
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="gemini-batch-size">Batch size</Label>
                    <Input
                      id="gemini-batch-size"
                      type="number"
                      min="1"
                      max="50"
                      value={settings.geminiBatchSize}
                      onChange={(event) =>
                        updateSettings(
                          "geminiBatchSize",
                          normalizeGeminiBatchSize(Number(event.target.value)),
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gemini-batch-concurrency">
                      Batch concurrency
                    </Label>
                    <Input
                      id="gemini-batch-concurrency"
                      type="number"
                      min="1"
                      max="4"
                      value={settings.geminiBatchConcurrency}
                      onChange={(event) =>
                        updateSettings(
                          "geminiBatchConcurrency",
                          normalizeGeminiBatchConcurrency(
                            Number(event.target.value),
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gemini-request-delay-ms">
                      Request delay (ms)
                    </Label>
                    <Input
                      id="gemini-request-delay-ms"
                      type="number"
                      min="0"
                      max="30000"
                      step="100"
                      value={settings.geminiRequestDelayMs}
                      onChange={(event) =>
                        updateSettings(
                          "geminiRequestDelayMs",
                          normalizeGeminiRequestDelayMs(
                            Number(event.target.value),
                          ),
                        )
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUseGeminiSafeBatchProfile}
                    disabled={isLoading || isSaving}
                  >
                    Use Safe Batch Profile
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUseGeminiFastBatchProfile}
                    disabled={isLoading || isSaving}
                  >
                    Use Fast Batch Profile
                  </Button>
                </div>
                <p className="app-muted-text">
                  Safe: 5 per batch, concurrency 1, delay 2500ms. Fast: 20 per
                  batch, concurrency 2, delay 800ms. Values are local settings
                  and require Save Settings to persist.
                </p>
              </div>
            </SectionCard>

            <SectionCard
              title="Gemini Proxy Setup"
              description="Configure the browser-facing proxy endpoint and model discovery. Keys stay server-only."
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
                    {geminiProxyModelPickerOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFetchGeminiProxyModels}
                  disabled={isFetchingGeminiProxyModels}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isFetchingGeminiProxyModels
                    ? "Đang tải model..."
                    : "Tải Gemini Proxy Models"}
                </Button>
                <SettingsHint>
                  Models are fetched from the server proxy route. API keys stay
                  server-only.
                </SettingsHint>
                <SettingsHint>
                  Default endpoint: /api/ai/gemini. Server route reads GEMINI_API_KEY or proxy key pool from env.
                </SettingsHint>
              </div>
            </SectionCard>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Advanced / Experimental
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                These providers are kept for future adapters or local experiments.
                Gemini Proxy remains the recommended core path.
              </p>
            </div>

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
                {shouldWarnGeminiModel ? (
                  <p className="text-xs text-destructive">
                    Gemini Proxy should use a Gemini model, not mock-local.
                  </p>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="Chi tiết kỹ thuật">
              {runtimeDiagnostics ? (
                <div className="space-y-2">
                  <div className="rounded-xl border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Overall status</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(runtimeDiagnostics.generatedAt).toLocaleString("vi-VN")}
                        </p>
                      </div>
                      <Badge
                        variant={getRuntimeDiagnosticBadgeVariant(
                          runtimeDiagnostics.overallStatus,
                        )}
                      >
                        {runtimeDiagnostics.overallStatus}
                      </Badge>
                    </div>
                  </div>

                  {runtimeDiagnostics.items.map((item) => (
                    <div key={item.id} className="rounded-xl border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {item.message}
                          </p>
                          {item.detail ? (
                            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                              {item.detail}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant={getRuntimeDiagnosticBadgeVariant(item.status)}>
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="app-muted-text">
                  Chạy diagnostics để kiểm tra IndexedDB, Web Worker, job runtime đã chọn,
                  và wiring của provider.
                </p>
              )}
              <div className="mt-3 space-y-2">
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={handleRunRuntimeDiagnostics}
                  disabled={isRunningDiagnostics}
                >
                  <TestTube className="mr-2 h-4 w-4" />
                  {isRunningDiagnostics ? "Đang kiểm tra runtime..." : "Chạy Runtime Diagnostics"}
                </Button>

                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={handleExportRuntimeDiagnostics}
                  disabled={isExportingRuntimeDiagnostics}
                >
                  <Database className="mr-2 h-4 w-4" />
                  {isExportingRuntimeDiagnostics
                    ? "Đang export diagnostics..."
                    : "Export Runtime diagnostics JSON"}
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Backup & khôi phục">
              <div className="space-y-3">
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={handleRequestStoragePersistence}
                  disabled={isRequestingStoragePersistence}
                >
                  <Database className="mr-2 h-4 w-4" />
                  {isRequestingStoragePersistence
                    ? "Đang request storage..."
                    : "Request Persistent Storage"}
                </Button>
                <p className="app-muted-text">
                  Request persistent storage ở cấp trình duyệt cho origin này. Cách này có thể
                  giảm rủi ro bị browser dọn dữ liệu IndexedDB lớn, nhưng browser vẫn có thể từ chối.
                </p>

                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={handleExportAppBackup}
                  disabled={isExportingAppBackup}
                >
                  <Database className="mr-2 h-4 w-4" />
                  {isExportingAppBackup ? "Đang export app backup..." : "Export app backup JSON"}
                </Button>
                <p className="app-muted-text">
                  Export global runtime settings, prompt templates và story index thành
                  một file JSON local. Backup full story content vẫn xử lý theo từng story trong
                  Data Health.
                </p>

                <div className="rounded-xl border bg-background p-3">
                  <label className="block">
                    <span className="text-sm font-medium">Validate app backup JSON</span>
                    <input
                      className="mt-2 block w-full text-sm"
                      type="file"
                      accept="application/json,.json"
                      disabled={isValidatingAppBackup}
                      onChange={handleValidateAppBackupFile}
                    />
                  </label>

                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Đọc file app backup tại local và chỉ validate schema/counts. Bước này
                    không restore hay ghi settings.
                  </p>
                </div>

                {appBackupValidationResult ? (
                  <div className="rounded-xl border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">App backup validation</p>
                      <Badge
                        variant={
                          appBackupValidationResult.isValid ? "secondary" : "destructive"
                        }
                      >
                        {appBackupValidationResult.isValid ? "valid" : "invalid"}
                      </Badge>
                    </div>

                    {appBackupValidationResult.payload ? (
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                        <p>
                          Exported:{" "}
                          {new Date(
                            appBackupValidationResult.payload.manifest.exportedAt,
                          ).toLocaleString("vi-VN")}
                        </p>
                        <p>
                          Stories:{" "}
                          {appBackupValidationResult.payload.manifest.counts.stories.toLocaleString(
                            "vi-VN",
                          )}{" "}
                          · Prompt templates:{" "}
                          {appBackupValidationResult.payload.manifest.counts.promptTemplates.toLocaleString(
                            "vi-VN",
                          )}
                        </p>
                        <p>
                          Runtime provider:{" "}
                          {appBackupValidationResult.payload.data.runtimeSettings.providerId}
                        </p>
                        <p>
                          Job runtime:{" "}
                          {appBackupValidationResult.payload.data.runtimeSettings.jobRuntime}
                        </p>
                      </div>
                    ) : null}

                    {appBackupValidationResult.issues.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {appBackupValidationResult.issues.map((issue, index) => (
                          <li key={`${issue.severity}-${index}`}>
                            [{issue.severity}] {issue.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Không phát hiện lỗi validation.
                      </p>
                    )}
                  </div>
                ) : null}

                {appBackupValidationResult?.payload ? (
                  <div className="rounded-xl border bg-background p-3">
                    <Button
                      className="w-full"
                      type="button"
                      variant="outline"
                      disabled={!canRestoreValidatedAppBackup() || isRestoringAppBackup}
                      onClick={handleRestoreValidatedAppBackup}
                    >
                      <Database className="mr-2 h-4 w-4" />
                      {isRestoringAppBackup
                        ? "Đang restore app backup..."
                        : "Restore app settings và prompt"}
                    </Button>

                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Chỉ restore global runtime settings và prompt templates. Story index
                      trong app backup chỉ giữ để tham chiếu; dữ liệu story đầy đủ phải
                      restore từ file backup theo từng story trong Data Health.
                    </p>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="Lưu và reset">
              <div className="space-y-3">
                <Button
                  className="w-full"
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isLoading || isSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Lưu vào IndexedDB
                </Button>

                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={handleLocalTest}
                >
                  <TestTube className="mr-2 h-4 w-4" />
                  Xem trước local test
                </Button>

                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={handleResetSettings}
                  disabled={isSaving}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset mặc định
                </Button>

                <Button asChild className="w-full" variant="outline">
                  <Link href="/prompt-manager">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Mở Prompt Manager
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

            <SectionCard title="Liên kết ngoài">
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
                    Quay lại Stories
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

function SettingsHint({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>;
}
