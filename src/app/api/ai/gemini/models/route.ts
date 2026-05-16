import { NextResponse } from "next/server";

import {
  createOpenAiCompatibleModelsEndpoint,
  extractGeminiProxyModelNames,
  getGeminiProxyKeyAttemptOrder,
  getGeminiProxyServerConfig,
  isRetryableStatus,
  readServerKeyPoolFromEnv,
} from "@/lib/ai/gemini-proxy-server";
import type {
  GeminiProxyModelListResult,
  GeminiProxyUpstreamError,
} from "@/lib/ai/gemini-proxy-adapter-types";

export const runtime = "nodejs";

const staticGoogleGeminiModels = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

function createResponseBody(
  payload: GeminiProxyModelListResult & {
    source?: "static" | "remote";
    retryPolicy?: {
      maxAttempts: number;
      retryableStatuses: number[];
      keyFailoverEnabled: boolean;
    };
  },
) {
  return {
    ...payload,
    modelCount: payload.models.length,
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchModelsOnce({
  endpoint,
  apiKey,
  timeoutMs,
}: {
  endpoint: string;
  apiKey: string;
  timeoutMs: number;
}): Promise<
  | { ok: true; models: string[] }
  | { ok: false; error: GeminiProxyUpstreamError }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          message: `Model discovery failed with HTTP ${response.status}.`,
          status: response.status,
          retryable: isRetryableStatus(response.status),
          source: "http",
        } satisfies GeminiProxyUpstreamError,
      };
    }

    const payload = (await response.json()) as unknown;
    const models = extractGeminiProxyModelNames(payload);

    return {
      ok: true,
      models,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: isAbortError(error)
          ? `Model discovery timed out after ${timeoutMs}ms.`
          : error instanceof Error
            ? `Model discovery failed: ${error.message}`
            : "Model discovery failed.",
        retryable: true,
        source: "network",
      } satisfies GeminiProxyUpstreamError,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const config = getGeminiProxyServerConfig();

  if (config.adapter === "google-generative-language") {
    return NextResponse.json(
      createResponseBody({
        ok: true,
        adapter: config.adapter,
        models: staticGoogleGeminiModels,
        source: "static",
        retryPolicy: config.retryPolicy,
        message: "Using static recommended Gemini model list.",
      }),
    );
  }

  if (!config.baseUrl) {
    return NextResponse.json(
      createResponseBody({
        ok: false,
        adapter: config.adapter,
        models: [],
        source: "remote",
        retryPolicy: config.retryPolicy,
        message: "GEMINI_PROXY_BASE_URL is not configured.",
      }),
    );
  }

  const keyPool = readServerKeyPoolFromEnv(config.adapter);
  const keyAttemptOrder = getGeminiProxyKeyAttemptOrder(keyPool.keys);

  if (keyAttemptOrder.length === 0) {
    return NextResponse.json(
      createResponseBody({
        ok: false,
        adapter: config.adapter,
        models: [],
        source: "remote",
        retryPolicy: config.retryPolicy,
        message: "No server-side Gemini proxy key is configured.",
      }),
    );
  }

  const endpoint = createOpenAiCompatibleModelsEndpoint(config.baseUrl);

  if (!endpoint) {
    return NextResponse.json(
      createResponseBody({
        ok: false,
        adapter: config.adapter,
        models: [],
        source: "remote",
        retryPolicy: config.retryPolicy,
        message: "Could not build models endpoint from GEMINI_PROXY_BASE_URL.",
      }),
    );
  }

  const maxAttempts = Math.min(config.retryPolicy.maxAttempts, keyAttemptOrder.length);
  let lastError: GeminiProxyUpstreamError | undefined;

  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
    const apiKey = keyAttemptOrder[attemptIndex];
    const attemptResult = await fetchModelsOnce({
      endpoint,
      apiKey,
      timeoutMs: 5000,
    });

    if (attemptResult.ok) {
      const models = attemptResult.models;

      return NextResponse.json(
        createResponseBody({
          ok: models.length > 0,
          adapter: config.adapter,
          models,
          source: "remote",
          retryPolicy: config.retryPolicy,
          message:
            models.length > 0
              ? `Discovered ${models.length} model(s) from proxy endpoint.`
              : "Model discovery returned no models.",
        }),
      );
    }

    lastError = attemptResult.error;
    const hasMoreAttempts = attemptIndex < maxAttempts - 1;

    if (!attemptResult.error.retryable || !hasMoreAttempts) {
      break;
    }
  }

  return NextResponse.json(
    createResponseBody({
      ok: false,
      adapter: config.adapter,
      models: [],
      source: "remote",
      retryPolicy: config.retryPolicy,
      message: `Model discovery failed after ${maxAttempts} attempt(s): ${
        lastError?.message ?? "Unknown upstream failure."
      }`,
    }),
  );
}
