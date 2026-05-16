import { NextResponse } from "next/server";

import {
  createOpenAiCompatibleModelsEndpoint,
  extractGeminiProxyModelNames,
  getGeminiProxyServerConfig,
  readServerKeyPoolFromEnv,
  selectGeminiProxyKey,
} from "@/lib/ai/gemini-proxy-server";
import type { GeminiProxyModelListResult } from "@/lib/ai/gemini-proxy-adapter-types";

export const runtime = "nodejs";

const staticGoogleGeminiModels = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

function createResponseBody(
  payload: GeminiProxyModelListResult & { source?: "static" | "remote" },
) {
  return {
    ...payload,
    modelCount: payload.models.length,
  };
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
        message: "GEMINI_PROXY_BASE_URL is not configured.",
      }),
    );
  }

  const keyPool = readServerKeyPoolFromEnv(config.adapter);
  const selectedKey = selectGeminiProxyKey(keyPool.keys);

  if (!selectedKey) {
    return NextResponse.json(
      createResponseBody({
        ok: false,
        adapter: config.adapter,
        models: [],
        source: "remote",
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
        message: "Could not build models endpoint from GEMINI_PROXY_BASE_URL.",
      }),
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        authorization: `Bearer ${selectedKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json(
        createResponseBody({
          ok: false,
          adapter: config.adapter,
          models: [],
          source: "remote",
          message: `Model discovery failed with HTTP ${response.status}.`,
        }),
      );
    }

    const payload = (await response.json()) as unknown;
    const models = extractGeminiProxyModelNames(payload);

    return NextResponse.json(
      createResponseBody({
        ok: models.length > 0,
        adapter: config.adapter,
        models,
        source: "remote",
        message:
          models.length > 0
            ? `Discovered ${models.length} model(s) from proxy endpoint.`
            : "Model discovery returned no models.",
      }),
    );
  } catch (error) {
    const isAbortError = error instanceof DOMException && error.name === "AbortError";

    return NextResponse.json(
      createResponseBody({
        ok: false,
        adapter: config.adapter,
        models: [],
        source: "remote",
        message: isAbortError
          ? "Model discovery timed out after 5000ms."
          : error instanceof Error
            ? `Model discovery failed: ${error.message}`
            : "Model discovery failed.",
      }),
    );
  } finally {
    clearTimeout(timeout);
  }
}
