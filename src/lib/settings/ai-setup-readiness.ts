import {
  GEMINI_CORE_DEFAULT_ENDPOINT,
  getAiRuntimeProviderLabel,
  getAiRuntimeSettings,
  normalizeGeminiProxyModel,
  type AiRuntimeProviderId,
} from "@/lib/settings/ai-runtime-settings";
import {
  getAllProviderApiKeyCounts,
  getProviderTestStatus,
  type ApiKeyProviderId,
} from "@/lib/settings/ai-api-key-store";
import {
  runGeminiProxyModelDiagnostics,
  runGeminiProxyRouteDiagnostics,
} from "@/lib/settings/gemini-proxy-runtime-diagnostics";
import { runOllamaConnectivityDiagnostics } from "@/lib/settings/ollama-runtime-diagnostics";

export interface AiSetupReadiness {
  isReady: boolean;
  canUseStoryWorkflow: boolean;
  activeProviderId: AiRuntimeProviderId;
  providerLabel: string;
  providerStatusSummary: string;
  missingReasons: string[];
  nextSetupRoute: "/settings";
}

export interface AiProviderConnectionTestResult {
  ok: boolean;
  providerId: AiRuntimeProviderId;
  message: string;
}

function hasPipelineSupport(providerId: AiRuntimeProviderId) {
  return providerId === "gemini-proxy" || providerId === "ollama";
}

function hasAnyApiKey(
  providerId: ApiKeyProviderId,
  keyCounts: Awaited<ReturnType<typeof getAllProviderApiKeyCounts>>,
) {
  return (keyCounts[providerId] ?? 0) > 0;
}

export async function runAiProviderConnectionTest() {
  const settings = await getAiRuntimeSettings();
  const providerId = settings.providerId;

  if (providerId === "mock") {
    return {
      ok: false,
      providerId,
      message: "Mock Local chỉ dùng test UI và không mở khóa workflow thật.",
    } satisfies AiProviderConnectionTestResult;
  }

  if (providerId === "gemini-proxy") {
    const endpoint = settings.geminiProxyEndpoint.trim() || GEMINI_CORE_DEFAULT_ENDPOINT;
    const routeCheck = await runGeminiProxyRouteDiagnostics(endpoint);
    const modelCheck = await runGeminiProxyModelDiagnostics(endpoint);
    const model = normalizeGeminiProxyModel(settings.defaultModel);
    const modelValid = Boolean(model.trim());

    const ok = routeCheck.ok && routeCheck.configured && modelValid;
    const message = ok
      ? "Gemini Proxy sẵn sàng. Dùng server proxy."
      : routeCheck.message || modelCheck.message || "Gemini Proxy chưa sẵn sàng.";

    return {
      ok,
      providerId,
      message,
    } satisfies AiProviderConnectionTestResult;
  }

  if (providerId === "ollama") {
    const result = await runOllamaConnectivityDiagnostics({
      baseUrl: settings.ollamaBaseUrl,
      model: settings.ollamaModel,
    });

    return {
      ok: result.ok && result.modelFound,
      providerId,
      message: result.message,
    } satisfies AiProviderConnectionTestResult;
  }

  if (providerId === "custom-openai") {
    return {
      ok: false,
      providerId,
      message: "Custom OpenAI-compatible chưa hỗ trợ chạy analysis trong bản hiện tại.",
    } satisfies AiProviderConnectionTestResult;
  }

  return {
    ok: false,
    providerId,
    message: "Gemini Direct chưa hỗ trợ chạy analysis trong bản hiện tại.",
  } satisfies AiProviderConnectionTestResult;
}

export async function getAiSetupReadiness(): Promise<AiSetupReadiness> {
  const settings = await getAiRuntimeSettings();
  const [keyCounts, testStatus] = await Promise.all([
    getAllProviderApiKeyCounts(),
    getProviderTestStatus(settings.providerId),
  ]);

  const activeProviderId = settings.providerId;
  const providerLabel = getAiRuntimeProviderLabel(activeProviderId);
  const missingReasons: string[] = [];
  let providerStatusSummary = "";

  if (activeProviderId === "mock") {
    missingReasons.push("Mock Local chỉ dùng test và không mở khóa workflow viết truyện.");
    providerStatusSummary = "Mock Local (test-only)";
  }

  if (activeProviderId === "gemini-proxy") {
    const endpoint = settings.geminiProxyEndpoint.trim();
    const model = normalizeGeminiProxyModel(settings.defaultModel).trim();
    if (!endpoint) {
      missingReasons.push("Thiếu endpoint Gemini Proxy.");
    }
    if (!model) {
      missingReasons.push("Thiếu model Gemini Proxy.");
    }
    if (!testStatus?.ok) {
      missingReasons.push("Chưa test kết nối Gemini Proxy.");
    }

    providerStatusSummary = "Gemini Proxy (Dùng server proxy)";
  }

  if (activeProviderId === "custom-openai") {
    if (!settings.customOpenAiBaseUrl.trim()) {
      missingReasons.push("Thiếu Base URL cho Custom OpenAI-compatible.");
    }
    if (!settings.customOpenAiModel.trim()) {
      missingReasons.push("Thiếu model cho Custom OpenAI-compatible.");
    }
    if (!hasAnyApiKey("custom-openai", keyCounts)) {
      missingReasons.push("Thiếu API key cho Custom OpenAI-compatible.");
    }
    if (!hasPipelineSupport(activeProviderId)) {
      missingReasons.push("Custom OpenAI-compatible chưa hỗ trợ chạy analysis trong bản hiện tại.");
    }
    if (!testStatus?.ok) {
      missingReasons.push("Chưa test kết nối Custom OpenAI-compatible.");
    }
    providerStatusSummary = "Custom OpenAI-compatible";
  }

  if (activeProviderId === "gemini-direct") {
    if (!settings.geminiDirectBaseUrl.trim()) {
      missingReasons.push("Thiếu Base URL cho Gemini Direct.");
    }
    if (!settings.geminiDirectModel.trim()) {
      missingReasons.push("Thiếu model cho Gemini Direct.");
    }
    if (!hasAnyApiKey("gemini-direct", keyCounts)) {
      missingReasons.push("Thiếu API key cho Gemini Direct.");
    }
    if (!hasPipelineSupport(activeProviderId)) {
      missingReasons.push("Gemini Direct chưa hỗ trợ chạy analysis trong bản hiện tại.");
    }
    if (!testStatus?.ok) {
      missingReasons.push("Chưa test kết nối Gemini Direct.");
    }
    providerStatusSummary = "Gemini Direct";
  }

  if (activeProviderId === "ollama") {
    if (!settings.ollamaBaseUrl.trim()) {
      missingReasons.push("Thiếu Base URL cho Ollama.");
    }
    if (!settings.ollamaModel.trim()) {
      missingReasons.push("Thiếu model cho Ollama.");
    }
    if (!testStatus?.ok) {
      missingReasons.push("Chưa test kết nối Ollama.");
    }
    providerStatusSummary = "Ollama Local";
  }

  const isReady = missingReasons.length === 0;

  return {
    isReady,
    canUseStoryWorkflow: isReady,
    activeProviderId,
    providerLabel,
    providerStatusSummary,
    missingReasons,
    nextSetupRoute: "/settings",
  };
}
