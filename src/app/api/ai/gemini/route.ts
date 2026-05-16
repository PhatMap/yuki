import { NextResponse } from "next/server";

import {
  callGeminiGenerateContent,
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
  const configured = Boolean(process.env.GEMINI_API_KEY?.trim());

  return NextResponse.json(
    {
      provider: "gemini-proxy",
      ok: true,
      configured,
      message: configured
        ? "Gemini proxy route is configured."
        : "GEMINI_API_KEY is missing.",
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

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      createErrorResponse("GEMINI_API_KEY is not configured on the server."),
      { status: 500 },
    );
  }

  try {
    const analysisResult = await callGeminiGenerateContent({
      apiKey,
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
    return NextResponse.json(
      createErrorResponse(
        error instanceof Error
          ? error.message
          : "Gemini proxy request failed.",
      ),
      { status: 502 },
    );
  }
}
