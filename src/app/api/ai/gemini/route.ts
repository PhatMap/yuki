import { NextResponse } from "next/server";

import {
  callGeminiGenerateContent,
  getGeminiProxyServerConfig,
  isGeminiProxyConfigError,
  normalizeGeminiModel,
  validateGeminiProxyRequestBody,
} from "@/lib/ai/gemini-proxy-server";
import type {
  GeminiProxyRequestBody,
  GeminiProxyErrorResponse,
  GeminiProxySuccessResponse,
} from "@/lib/ai/gemini-proxy-request-types";

export const runtime = "nodejs";

function createErrorResponse(errorMessage: string): GeminiProxyErrorResponse {
  return {
    provider: "gemini-proxy",
    errorMessage,
    completedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const config = getGeminiProxyServerConfig();

  return NextResponse.json(
    {
      provider: "gemini-proxy",
      ok: true,
      configured: config.configured,
      adapter: config.adapter,
      keyCount: config.keyCount,
      baseUrlConfigured: Boolean(config.baseUrl),
      modelSource: config.modelSource,
      message: config.message,
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      createErrorResponse("Invalid JSON request body."),
      { status: 400 },
    );
  }

  let validatedBody: GeminiProxyRequestBody;

  try {
    validatedBody = validateGeminiProxyRequestBody(rawBody);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse(
        error instanceof Error
          ? `Invalid request: ${error.message}`
          : "Invalid request body.",
      ),
      { status: 400 },
    );
  }

  try {
    const analysisResult = await callGeminiGenerateContent({
      body: validatedBody,
    });
    const responseBody: GeminiProxySuccessResponse = {
      provider: "gemini-proxy",
      model: normalizeGeminiModel(validatedBody.model),
      analysisResult,
      completedAt: new Date().toISOString(),
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Gemini proxy request failed.";

    return NextResponse.json(
      createErrorResponse(errorMessage),
      { status: isGeminiProxyConfigError(error) ? 500 : 502 },
    );
  }
}
