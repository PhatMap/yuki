import Dexie, { type Table } from "dexie";

import type { AiRuntimeProviderId } from "@/lib/settings/ai-runtime-settings";

export type ApiKeyProviderId =
  | "gemini-proxy"
  | "gemini-direct"
  | "custom-openai";

export interface AiProviderApiKeyRecord {
  id: string;
  providerId: ApiKeyProviderId;
  rawKey: string;
  maskedKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiProviderTestRecord {
  providerId: AiRuntimeProviderId;
  ok: boolean;
  message: string;
  testedAt: string;
}

class AiProviderKeysDatabase extends Dexie {
  providerKeys!: Table<AiProviderApiKeyRecord, string>;
  providerTests!: Table<AiProviderTestRecord, string>;

  constructor() {
    super("yuki-ai-provider-keys-db");

    this.version(1).stores({
      providerKeys: "id, providerId, updatedAt",
      providerTests: "providerId, testedAt",
    });
  }
}

const db = new AiProviderKeysDatabase();

function normalizeApiKey(value: string) {
  return value.trim();
}

function createMaskedKey(rawKey: string) {
  if (rawKey.length <= 8) return `${rawKey.slice(0, 2)}***${rawKey.slice(-2)}`;

  return `${rawKey.slice(0, 4)}***${rawKey.slice(-4)}`;
}

function createApiKeyId(providerId: ApiKeyProviderId) {
  return `${providerId}-key-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export async function listProviderApiKeys(providerId: ApiKeyProviderId) {
  return db.providerKeys.where("providerId").equals(providerId).sortBy("createdAt");
}

export async function listAllProviderApiKeys() {
  const allKeys = await db.providerKeys.toArray();
  const keysByProvider: Record<ApiKeyProviderId, AiProviderApiKeyRecord[]> = {
    "gemini-proxy": [],
    "gemini-direct": [],
    "custom-openai": [],
  };

  for (const key of allKeys) {
    keysByProvider[key.providerId].push(key);
  }

  return keysByProvider;
}

export async function getProviderApiKeyCount(providerId: ApiKeyProviderId) {
  return db.providerKeys.where("providerId").equals(providerId).count();
}

export async function getAllProviderApiKeyCounts() {
  const [geminiProxy, geminiDirect, customOpenAi] = await Promise.all([
    getProviderApiKeyCount("gemini-proxy"),
    getProviderApiKeyCount("gemini-direct"),
    getProviderApiKeyCount("custom-openai"),
  ]);

  return {
    "gemini-proxy": geminiProxy,
    "gemini-direct": geminiDirect,
    "custom-openai": customOpenAi,
  } as const;
}

export async function addProviderApiKey(
  providerId: ApiKeyProviderId,
  rawKeyInput: string,
) {
  const rawKey = normalizeApiKey(rawKeyInput);
  if (!rawKey) return null;

  const now = new Date().toISOString();
  const record: AiProviderApiKeyRecord = {
    id: createApiKeyId(providerId),
    providerId,
    rawKey,
    maskedKey: createMaskedKey(rawKey),
    createdAt: now,
    updatedAt: now,
  };

  await db.providerKeys.put(record);

  return record;
}

export async function addProviderApiKeysFromLines(
  providerId: ApiKeyProviderId,
  multiLineInput: string,
) {
  const lines = multiLineInput
    .split(/\r?\n/g)
    .map((line) => normalizeApiKey(line))
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      added: 0,
    };
  }

  const uniqueKeys = Array.from(new Set(lines));
  const existingKeys = await db.providerKeys
    .where("providerId")
    .equals(providerId)
    .toArray();
  const existingRawKeys = new Set(existingKeys.map((item) => item.rawKey));

  let added = 0;
  for (const rawKey of uniqueKeys) {
    if (existingRawKeys.has(rawKey)) continue;
    await addProviderApiKey(providerId, rawKey);
    added += 1;
  }

  return { added };
}

export async function deleteProviderApiKey(id: string) {
  await db.providerKeys.delete(id);
}

export async function saveProviderTestStatus(record: AiProviderTestRecord) {
  await db.providerTests.put(record);
}

export async function getProviderTestStatus(providerId: AiRuntimeProviderId) {
  return db.providerTests.get(providerId);
}
