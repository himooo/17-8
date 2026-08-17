import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptAiKey, encryptAiKey, maskAiKey } from "@/lib/ai-key-crypto";
import { validateQuestionInput } from "@/lib/question-contract";
import { discoverModels } from "./model-discovery";
import { canUseScope, operationSpecialty, safetyCheckPrompt } from "@/lib/settings-ai-v10";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PROVIDER = "google";
const MAX_INPUT_CHARS = 20_000;
const MAX_SYSTEM_CHARS = 4_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_CONCURRENCY = 2;
const rateBuckets = new Map<string, { startedAt: number; count: number }>();
const inFlightByKey = new Map<string, number>();

type Provider = "google" | "groq" | "openai" | "mistral" | "custom" | "openrouter" | "anthropic" | "together" | "fireworks" | "deepseek" | "cohere" | "perplexity" | "replicate" | "huggingface";
type KeyStatus = "active" | "cooldown" | "failed" | "disabled" | "needs-check";

type ProviderConfig = {
  id: Provider;
  kind: "google" | "openai-compatible" | "anthropic" | "cohere" | "replicate" | "huggingface";
  baseUrl: string;
  defaultModel: string;
  envNames: string[];
};

const PROVIDER_CONFIG: Record<Provider, ProviderConfig> = {
  google: { id: "google", kind: "google", baseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.5-flash", envNames: ["GOOGLE_API_KEY", "GEMINI_API_KEY"] },
  groq: { id: "groq", kind: "openai-compatible", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", envNames: ["GROQ_API_KEY"] },
  openai: { id: "openai", kind: "openai-compatible", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", envNames: ["OPENAI_API_KEY"] },
  mistral: { id: "mistral", kind: "openai-compatible", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-small-latest", envNames: ["MISTRAL_API_KEY"] },
  custom: { id: "custom", kind: "openai-compatible", baseUrl: "", defaultModel: "custom-model", envNames: [] },
  openrouter: { id: "openrouter", kind: "openai-compatible", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini", envNames: ["OPENROUTER_API_KEY"] },
  anthropic: { id: "anthropic", kind: "anthropic", baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-sonnet-4-6", envNames: ["ANTHROPIC_API_KEY"] },
  together: { id: "together", kind: "openai-compatible", baseUrl: "https://api.together.xyz/v1", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", envNames: ["TOGETHER_API_KEY"] },
  fireworks: { id: "fireworks", kind: "openai-compatible", baseUrl: "https://api.fireworks.ai/inference/v1", defaultModel: "accounts/fireworks/models/llama-v3p1-70b-instruct", envNames: ["FIREWORKS_API_KEY"] },
  deepseek: { id: "deepseek", kind: "openai-compatible", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat", envNames: ["DEEPSEEK_API_KEY"] },
  cohere: { id: "cohere", kind: "cohere", baseUrl: "https://api.cohere.com/v2", defaultModel: "command-r-plus", envNames: ["COHERE_API_KEY"] },
  perplexity: { id: "perplexity", kind: "openai-compatible", baseUrl: "https://api.perplexity.ai", defaultModel: "sonar", envNames: ["PERPLEXITY_API_KEY"] },
  replicate: { id: "replicate", kind: "replicate", baseUrl: "https://api.replicate.com/v1", defaultModel: "", envNames: ["REPLICATE_API_TOKEN"] },
  huggingface: { id: "huggingface", kind: "huggingface", baseUrl: "https://api-inference.huggingface.co", defaultModel: "", envNames: ["HF_TOKEN", "HUGGINGFACE_API_KEY"] },
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type SafeKey = {
  id: string;
  label: string;
  provider: Provider | string;
  keyHint: string;
  model: string;
  isActive: boolean;
  priority: number;
  status: KeyStatus | string;
  cooldownUntil: Date | null;
  rpmLimit: number | null;
  dailyLimit: number | null;
  maxConcurrency: number;
  inFlight: number;
  lastUsedAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorCode: string | null;
  lastError: string | null;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  createdAt: Date;
  updatedAt: Date;
  apiKind: string;
  specialty: string;
  scopesJson: string;
  capabilitiesJson: string;
  baseUrl: string | null;
  modelsUrl: string | null;
  chatUrl: string | null;
};

type KeyCandidate = {
  id: string | null;
  provider: Provider;
  key: string;
  model: string;
  priority: number;
  maxConcurrency: number;
  apiKind: ProviderConfig["kind"] | "provider";
  specialty: string;
  scopesJson: string;
  capabilitiesJson: string;
  baseUrl: string | null;
  modelsUrl: string | null;
  chatUrl: string | null;
};

type ClassifiedProviderError = {
  code: string;
  message: string;
  retryable: boolean;
  cooldownMs: number;
  nonRetryablePayloadError: boolean;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

function errorMessage(error: unknown, fallback = "حدث خطأ غير متوقع") {
  return error instanceof Error ? error.message : fallback;
}

/** Provider responses are untrusted input. Never expose their raw text because it
 * may contain API keys, authorization headers, request URLs, or account details. */
function genericProviderError(status: number): string {
  if (status === 401 || status === 403) return "مفتاح AI غير صالح أو غير مصرح به";
  if (status === 429) return "تم تجاوز حصة مزود AI مؤقتاً";
  if (status === 408) return "انتهت مهلة مزود AI";
  if (status >= 500) return "حدث خطأ مؤقت في مزود AI";
  if (status === 400) return "طلب AI غير صالح";
  return "تعذر الاتصال بمزود AI";
}

function validateProvider(value: unknown): Provider {
  const provider = typeof value === "string" ? value.trim().toLowerCase() : DEFAULT_PROVIDER;
  if (!(provider in PROVIDER_CONFIG)) throw new Error("مزود AI غير مدعوم");
  return provider as Provider;
}

function configFor(provider: Provider) {
  return PROVIDER_CONFIG[provider];
}

function defaultModel(provider: Provider) {
  return configFor(provider).defaultModel;
}

function validateModel(value: unknown, provider: Provider = "google"): string {
  const model = typeof value === "string" && value.trim() ? value.trim() : defaultModel(provider);
  if (!/^[a-zA-Z0-9._:/-]{2,160}$/.test(model)) throw new Error("اسم النموذج غير صالح");
  return model;
}

function safeNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
}

function optionalHttpUrl(value: unknown, label: string): string | null {
  if (value == null || String(value).trim() === "") return null;
  const raw = String(value).trim().replace(/\/+$/, "");
  if (raw.length > 500) throw new Error(`${label} طويل جداً`);
  const parsed = new URL(raw);
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.hash) throw new Error(`${label} غير صالح`);
  return parsed.toString().replace(/\/$/, "");
}

/** Accept provider endpoint paths such as `/models` while storing a canonical absolute URL. */
function optionalApiEndpoint(value: unknown, label: string, baseUrl: string | null): string | null {
  if (value == null || String(value).trim() === "") return null;
  const raw = String(value).trim();
  if (raw.startsWith("/")) {
    if (!baseUrl) throw new Error(`${label} يحتاج رابط API أساسياً`);
    return optionalHttpUrl(`${baseUrl.replace(/\/+$/, "")}/${raw.replace(/^\/+/, "")}`, label);
  }
  return optionalHttpUrl(raw, label);
}

function resolveApiEndpoint(value: string | null | undefined, baseUrl: string): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  try {
    return raw.startsWith("/") ? `${baseUrl.replace(/\/+$/, "")}/${raw.replace(/^\/+/, "")}` : optionalHttpUrl(raw, "رابط API")
  } catch {
    return null;
  }
}

function enforceRateLimit(req: NextRequest) {
  const address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = rateBuckets.get(address);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(address, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > RATE_LIMIT) throw new Error("تم تجاوز حد طلبات AI مؤقتاً. حاول بعد دقيقة.");
}

function parseText(response: any): string {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const googleText = parts.map((part: any) => typeof part?.text === "string" ? part.text : "").join("").trim();
    if (googleText) return googleText;
  }
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((part: any) => typeof part?.text === "string" ? part.text : typeof part === "string" ? part : "").join("").trim();
  if (Array.isArray(response?.content)) return response.content.map((part: any) => typeof part?.text === "string" ? part.text : "").join("").trim();
  if (typeof response?.message?.content === "string") return response.message.content.trim();
  if (Array.isArray(response?.message?.content)) return response.message.content.map((part: any) => typeof part?.text === "string" ? part.text : "").join("").trim();
  return "";
}

function classifyProviderError(status: number, _message: string): ClassifiedProviderError {
  return {
    code: status ? String(status) : "network",
    message: genericProviderError(status),
    retryable: status !== 400,
    cooldownMs: status === 429 ? 60_000 : status === 408 ? 10_000 : status >= 500 ? 15_000 : status === 401 || status === 403 ? 0 : 10_000,
    nonRetryablePayloadError: status === 400,
  };
}

function classifyThrownError(error: unknown): ClassifiedProviderError {
  const message = errorMessage(error, "");
  if (error instanceof Error && (error.name === "AbortError" || /timeout/i.test(message))) return { code: "timeout", message: genericProviderError(408), retryable: true, cooldownMs: 10_000, nonRetryablePayloadError: false };
  return { code: "network", message: genericProviderError(0), retryable: true, cooldownMs: 10_000, nonRetryablePayloadError: false };
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced) {
      try { return JSON.parse(fenced); } catch {}
    }
    throw new Error("AI أعاد JSON غير صالح");
  }
}

function currentInFlight(keyId: string) {
  return inFlightByKey.get(keyId) ?? 0;
}

function acquireKey(key: KeyCandidate) {
  if (!key.id) return true;
  const current = currentInFlight(key.id);
  if (current >= key.maxConcurrency) return false;
  inFlightByKey.set(key.id, current + 1);
  return true;
}

function releaseKey(key: KeyCandidate) {
  if (!key.id) return;
  const current = currentInFlight(key.id);
  if (current <= 1) inFlightByKey.delete(key.id);
  else inFlightByKey.set(key.id, current - 1);
}

async function safeKeyRows(): Promise<SafeKey[]> {
  const rows = await db.aiProviderKey.findMany({
    orderBy: [{ priority: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, label: true, provider: true, apiKind: true, baseUrl: true, modelsUrl: true, chatUrl: true, keyHint: true, model: true, isActive: true, priority: true,
      status: true, specialty: true, scopesJson: true, capabilitiesJson: true, cooldownUntil: true, rpmLimit: true, dailyLimit: true, maxConcurrency: true,
      lastUsedAt: true, lastSuccessAt: true, lastErrorAt: true, lastErrorCode: true, lastError: true,
      successCount: true, failureCount: true, consecutiveFailures: true, createdAt: true, updatedAt: true,
    },
  });
  return rows.map((row) => ({ ...row, inFlight: currentInFlight(row.id) }));
}

async function getCandidates(requestedKeyId?: string, requestedModel?: string, operation = "generate"): Promise<KeyCandidate[]> {
  const rows = await db.aiProviderKey.findMany({
    where: { isActive: true, ...(requestedKeyId ? { id: requestedKeyId } : {}) },
    orderBy: [{ priority: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
  });
  const now = Date.now();
  const preferredSpecialty = operationSpecialty(operation);
  const candidates: KeyCandidate[] = [];
  for (const row of rows) {
    let provider: Provider;
    try { provider = validateProvider(row.provider); } catch { continue; }
    if (row.status === "disabled" || row.status === "needs-check" || row.status === "failed") continue;
    if (row.cooldownUntil && row.cooldownUntil.getTime() > now) continue;
    if (currentInFlight(row.id) >= Math.max(1, row.maxConcurrency || DEFAULT_MAX_CONCURRENCY)) continue;
    if (row.rpmLimit != null) {
      const rpmSince = new Date(now - 60_000);
      const rpmUsed = await db.aiUsageEvent.count({ where: { keyId: row.id, createdAt: { gte: rpmSince } } });
      if (rpmUsed >= row.rpmLimit) continue;
    }
    if (row.dailyLimit != null) {
      const daySince = new Date(now - 86_400_000);
      const dailyUsed = await db.aiUsageEvent.count({ where: { keyId: row.id, createdAt: { gte: daySince } } });
      if (dailyUsed >= row.dailyLimit) continue;
    }
    try {
      const configuredKind = typeof row.apiKind === "string" ? row.apiKind : "provider";
      const apiKind = configuredKind === "openai-compatible" || configuredKind === "anthropic" || configuredKind === "cohere" || configuredKind === "replicate" || configuredKind === "huggingface" ? configuredKind : configFor(provider).kind === "openai-compatible" ? "openai-compatible" : configFor(provider).kind;
      const baseUrl = typeof row.baseUrl === "string" && row.baseUrl.trim() ? row.baseUrl.trim().replace(/\/+$/, "") : configFor(provider).baseUrl;
      const modelsUrl = typeof row.modelsUrl === "string" && row.modelsUrl.trim() ? row.modelsUrl.trim() : null;
      const chatUrl = typeof row.chatUrl === "string" && row.chatUrl.trim() ? row.chatUrl.trim() : null;
      if ((provider === "custom" || provider === "replicate" || provider === "huggingface") && !baseUrl) continue;
      if (!canUseScope(row.scopesJson, requestedModel || "generate")) continue;
      candidates.push({ id: row.id, provider, key: await decryptAiKey(row.encryptedKey), model: validateModel(requestedModel || row.model || defaultModel(provider), provider), priority: row.priority + (row.specialty === preferredSpecialty ? -1000 : row.specialty === "general" ? 0 : 500), maxConcurrency: Math.max(1, row.maxConcurrency || DEFAULT_MAX_CONCURRENCY), apiKind, specialty: row.specialty || "general", scopesJson: row.scopesJson || "[\"generate\"]", capabilitiesJson: row.capabilitiesJson || "[\"text\"]", baseUrl, modelsUrl, chatUrl });
    } catch {
      await db.aiProviderKey.update({ where: { id: row.id }, data: { failureCount: { increment: 1 }, consecutiveFailures: { increment: 1 }, status: "needs-check", lastErrorCode: "decrypt", lastError: "تعذر فك تشفير المفتاح", lastErrorAt: new Date() } }).catch(() => undefined);
    }
  }
  if (candidates.length === 0 && !requestedKeyId) {
    (Object.keys(PROVIDER_CONFIG) as Provider[]).forEach((provider) => {
      const envKey = configFor(provider).envNames.map((name) => process.env[name]).find((value) => value?.trim());
      if (envKey?.trim()) candidates.push({ id: null, provider, key: envKey.trim(), model: validateModel(requestedModel || defaultModel(provider), provider), priority: 10_000, maxConcurrency: DEFAULT_MAX_CONCURRENCY, apiKind: configFor(provider).kind, specialty: operationSpecialty(operation), scopesJson: "[\"*\"]", capabilitiesJson: "[\"text\",\"vision\",\"tools\",\"streaming\"]", baseUrl: configFor(provider).baseUrl, modelsUrl: null, chatUrl: null });
    });
  }
  return candidates.sort((a, b) => a.priority - b.priority || currentInFlight(a.id ?? "") - currentInFlight(b.id ?? ""));
}

const MODEL_PRICING: Array<{ match: RegExp; input: number; output: number }> = [
  { match: /gpt-5-nano|gemini-.*flash|deepseek-chat/i, input: 0.15, output: 0.6 },
  { match: /gpt-4o-mini|mistral-small|llama|command-r/i, input: 0.3, output: 1.2 },
  { match: /claude|gpt-5|gemini-.*pro/i, input: 2, output: 8 },
];

function estimateUsage(inputChars: number, outputChars: number, provider = "unknown", model = "") {
  const inputTokens = Math.max(0, Math.ceil(inputChars / 4));
  const outputTokens = Math.max(0, Math.ceil(outputChars / 4));
  const totalTokens = inputTokens + outputTokens;
  const pricing = MODEL_PRICING.find((item) => item.match.test(model)) ?? { input: 0.5, output: 1.5 };
  const estimatedCostUsd = Number(((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000).toFixed(6));
  return { inputTokens, outputTokens, totalTokens, estimatedCostUsd, pricingSource: `${provider}:${model || "default"}` };
}

async function recordUsage(data: { provider: string; model: string; operation: string; keyId: string | null; ok: boolean; inputChars: number; outputChars: number; inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number; errorCode?: string }) {
  await db.aiUsageEvent.create({ data: { ...data, inputTokens: data.inputTokens ?? Math.ceil(data.inputChars / 4), outputTokens: data.outputTokens ?? Math.ceil(data.outputChars / 4), estimatedCostUsd: data.estimatedCostUsd ?? 0 } }).catch(() => undefined);
}

async function markSuccess(candidate: KeyCandidate) {
  if (!candidate.id) return;
  await db.aiProviderKey.update({ where: { id: candidate.id }, data: { status: "active", cooldownUntil: null, lastUsedAt: new Date(), lastSuccessAt: new Date(), lastError: null, lastErrorCode: null, consecutiveFailures: 0, successCount: { increment: 1 } } }).catch(() => undefined);
}

async function markFailure(candidate: KeyCandidate, failure: ClassifiedProviderError) {
  if (!candidate.id) return;
  const row = await db.aiProviderKey.findUnique({ where: { id: candidate.id }, select: { consecutiveFailures: true } }).catch(() => null);
  const consecutive = (row?.consecutiveFailures ?? 0) + 1;
  const status: KeyStatus = failure.code === "401" || failure.code === "403" ? "needs-check" : failure.cooldownMs > 0 ? "cooldown" : "active";
  await db.aiProviderKey.update({ where: { id: candidate.id }, data: { status, cooldownUntil: failure.cooldownMs > 0 ? new Date(Date.now() + failure.cooldownMs) : null, failureCount: { increment: 1 }, consecutiveFailures: consecutive, lastErrorCode: failure.code, lastError: failure.message, lastErrorAt: new Date() } }).catch(() => undefined);
}

async function callProvider(candidate: KeyCandidate, input: string, options: { systemInstruction?: string; temperature?: number; maxOutputTokens?: number; responseSchema?: Record<string, unknown>; images?: Array<{ url: string; detail?: string }>; tools?: unknown[]; conversationMessages?: Array<{ role: string; content: string }> }) {
  const config = configFor(candidate.provider);
  const kind = candidate.apiKind === "openai-compatible" ? "openai-compatible" : config.kind;
  const baseUrl = (candidate.baseUrl || config.baseUrl).replace(/\/+$/, "");
  if (!baseUrl) throw new Error("رابط API غير مضبوط لهذا المفتاح");
  const customChatUrl = resolveApiEndpoint(candidate.chatUrl, baseUrl);
  const temperature = Math.min(1.5, Math.max(0, options.temperature ?? 0.35));
  const maxOutputTokens = Math.min(8192, Math.max(128, Math.round(options.maxOutputTokens ?? 1200)));
  let url: string;
  let body: Record<string, unknown>;
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  if (kind === "google") {
    url = `${baseUrl}/models/${encodeURIComponent(candidate.model.replace(/^models\//, ""))}:generateContent?key=${encodeURIComponent(candidate.key)}`;
    const historyText = options.conversationMessages?.map((message) => `${message.role}: ${message.content}`).join("\n") || input;
    body = {
      contents: [{ role: "user", parts: [{ text: historyText }] }],
      generationConfig: { temperature, maxOutputTokens, ...(options.responseSchema ? { responseMimeType: "application/json", responseSchema: options.responseSchema } : {}) },
      ...(options.systemInstruction?.trim() ? { systemInstruction: { parts: [{ text: options.systemInstruction.trim() }] } } : {}),
    };
  } else if (kind === "anthropic") {
    url = (customChatUrl || `${baseUrl}/messages`).replace(/\/+$/, "");
    headers["x-api-key"] = candidate.key;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: candidate.model,
      max_tokens: maxOutputTokens,
      ...(options.systemInstruction?.trim() ? { system: options.systemInstruction.trim() } : {}),
      messages: (options.conversationMessages?.length ? options.conversationMessages : [{ role: "user", content: input }]).map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content })),
    };
  } else if (kind === "cohere") {
    url = (customChatUrl || `${baseUrl}/chat`).replace(/\/+$/, "");
    headers.Authorization = `Bearer ${candidate.key}`;
      body = { model: candidate.model, messages: (options.conversationMessages?.length ? options.conversationMessages : [{ role: "user", content: input }]), temperature, max_tokens: maxOutputTokens };
  } else if (kind === "replicate" || kind === "huggingface") {
    throw new Error(`${candidate.provider} يحتاج capability adapter متخصصاً لهذا النوع من الطلبات`);
  } else {
    url = (customChatUrl || `${baseUrl}/chat/completions`).replace(/\/+$/, "");
    headers.Authorization = `Bearer ${candidate.key}`;
    if (candidate.provider === "openrouter") { headers["HTTP-Referer"] = "https://bisalasa.app"; headers["X-Title"] = "Bisalasa Educational Platform"; }
    const userContent = options.images?.length ? [{ type: "text", text: input }, ...options.images.map((image) => ({ type: "image_url", image_url: { url: image.url, detail: image.detail || "auto" } }))] : input;
    body = {
      model: candidate.model,
      messages: [
        ...(options.systemInstruction?.trim() ? [{ role: "system", content: options.systemInstruction.trim() }] : []),
        ...(options.conversationMessages?.length ? options.conversationMessages : [{ role: "user", content: userContent }]),
      ],
      temperature,
      max_tokens: maxOutputTokens,
      ...(options.tools?.length ? { tools: options.tools, tool_choice: "auto" } : {}),
      ...(options.responseSchema ? { response_format: { type: "json_object" } } : {}),
    };
  }
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS), cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = typeof payload?.error?.message === "string" ? payload.error.message : `${candidate.provider} AI HTTP ${response.status}`;
    throw Object.assign(new Error(providerMessage), { providerStatus: response.status });
  }
  const text = parseText(payload);
  if (!text) throw new Error(`${candidate.provider} AI أعاد استجابة فارغة`);
  return text;
}

async function generateWithRotation(input: string, options: { keyId?: string; model?: string; systemInstruction?: string; temperature?: number; maxOutputTokens?: number; operation: string; responseSchema?: Record<string, unknown>; images?: Array<{ url: string; detail?: string }>; tools?: unknown[]; conversationMessages?: Array<{ role: string; content: string }> }) {
  const candidates = await getCandidates(options.keyId, options.model, options.operation);
  if (candidates.length === 0) throw new Error("لا يوجد مفتاح AI مفعّل. أضف مفتاحاً من لوحة الذكاء الاصطناعي أو عرّف مفتاحاً بيئياً.");
  let lastError = "فشل الاتصال بمزودي AI";
  for (const candidate of candidates) {
    if (!acquireKey(candidate)) continue;
    try {
      const text = await callProvider(candidate, input, options);
      const usage = estimateUsage(input.length, text.length, candidate.provider, candidate.model);
      await markSuccess(candidate);
      await recordUsage({ provider: candidate.provider, model: candidate.model, operation: options.operation, keyId: candidate.id, ok: true, inputChars: input.length, outputChars: text.length, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, estimatedCostUsd: usage.estimatedCostUsd });
      return { text, model: candidate.model, keyId: candidate.id, provider: candidate.provider, usage };
    } catch (error) {
      const status = typeof (error as { providerStatus?: unknown })?.providerStatus === "number" ? Number((error as { providerStatus: number }).providerStatus) : 0;
      const failure = status ? classifyProviderError(status, errorMessage(error)) : classifyThrownError(error);
      lastError = failure.message;
      await markFailure(candidate, failure);
      await recordUsage({ provider: candidate.provider, model: candidate.model, operation: options.operation, keyId: candidate.id, ok: false, inputChars: input.length, outputChars: 0, inputTokens: Math.ceil(input.length / 4), outputTokens: 0, estimatedCostUsd: 0, errorCode: failure.code });
      if (failure.nonRetryablePayloadError) throw new Error(failure.message);
    } finally {
      releaseKey(candidate);
    }
  }
  throw new Error(`تعذر تنفيذ طلب AI بعد تجربة المفاتيح المفعّلة: ${lastError}`);
}

export async function GET(req: NextRequest) {
  try {
    const resource = new URL(req.url).searchParams.get("resource") || "keys";
    if (resource === "keys") {
      const keys = await safeKeyRows();
      const envConfigured = (Object.keys(PROVIDER_CONFIG) as Provider[]).some((provider) => configFor(provider).envNames.some((name) => Boolean(process.env[name]?.trim())));
      return json({ ok: true, data: { keys, envConfigured, providers: Object.values(PROVIDER_CONFIG).map((config) => ({ id: config.id, defaultModel: config.defaultModel })) } });
    }
    if (resource === "usage") {
      const events = await db.aiUsageEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
      return json({ ok: true, data: events });
    }
    if (resource === "models") {
      const params = new URL(req.url).searchParams;
      const provider = validateProvider(params.get("provider") || DEFAULT_PROVIDER);
      const candidates = await getCandidates(params.get("keyId") || undefined, undefined);
      const candidate = candidates.find((item) => item.provider === provider);
      if (!candidate) return json({ ok: true, data: [] });
      const models = await discoverModels({ provider: candidate.provider, key: candidate.key, baseUrl: candidate.baseUrl || configFor(candidate.provider).baseUrl, modelsUrl: candidate.modelsUrl, apiKind: candidate.apiKind === "google" || candidate.apiKind === "provider" ? "provider" : "openai-compatible" });
      return json({ ok: true, data: models });
    }
    return json({ ok: false, error: "مورد غير معروف" }, 400);
  } catch (error) {
    return json({ ok: false, error: errorMessage(error) }, 400);
  }
}

export async function POST(req: NextRequest) {
  try {
    enforceRateLimit(req);
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "generate";
    const safetyInput = [body?.input, body?.context, body?.prompt, body?.sampleInput].find((value): value is string => typeof value === "string");
    if (safetyInput) {
      const safety = safetyCheckPrompt(safetyInput);
      if (!safety.safe) return json({ ok: false, error: safety.reason }, 400);
    }

    if (action === "keys.create") {
      const key = typeof body.key === "string" ? body.key.trim() : "";
      const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
      const provider = validateProvider(body.provider);
      const apiKind = body.apiKind === "provider" && provider === "google" ? "provider" : body.apiKind === "openai-compatible" ? "openai-compatible" : configFor(provider).kind;
      const baseUrl = optionalHttpUrl(body.baseUrl, "رابط API") || (provider === "custom" ? null : configFor(provider).baseUrl);
      const modelsUrl = optionalApiEndpoint(body.modelsUrl, "رابط الموديلات", baseUrl);
      const chatUrl = optionalApiEndpoint(body.chatUrl, "رابط المحادثة", baseUrl);
      if (provider === "custom" && !baseUrl) return json({ ok: false, error: "رابط API مطلوب للمزود المخصص" }, 400);
      if (key.length < 16 || key.length > 500) return json({ ok: false, error: "مفتاح AI غير صالح أو طوله غير مناسب" }, 400);
      if (!label) return json({ ok: false, error: "اسم المفتاح مطلوب" }, 400);
      const encryptedKey = await encryptAiKey(key);
      const row = await db.aiProviderKey.create({ data: { label, provider, apiKind, baseUrl, modelsUrl, chatUrl, encryptedKey, keyHint: maskAiKey(key), model: validateModel(body.model || defaultModel(provider), provider), specialty: typeof body.specialty === "string" ? body.specialty.slice(0, 40) : "general", scopesJson: typeof body.scopesJson === "string" ? body.scopesJson.slice(0, 2000) : "[\"generate\"]", capabilitiesJson: typeof body.capabilitiesJson === "string" ? body.capabilitiesJson.slice(0, 2000) : "[\"text\"]", priority: safeNumber(body.priority, 0, 0, 999), isActive: body.isActive !== false, status: "active", maxConcurrency: safeNumber(body.maxConcurrency, DEFAULT_MAX_CONCURRENCY, 1, 8), rpmLimit: body.rpmLimit == null ? null : safeNumber(body.rpmLimit, 60, 1, 100_000), dailyLimit: body.dailyLimit == null ? null : safeNumber(body.dailyLimit, 1000, 1, 10_000_000) } });
      return json({ ok: true, data: { id: row.id, label: row.label, provider: row.provider, apiKind: row.apiKind, baseUrl: row.baseUrl, modelsUrl: row.modelsUrl, keyHint: row.keyHint, model: row.model, isActive: row.isActive, priority: row.priority, status: row.status } }, 201);
    }

    if (action === "keys.update") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return json({ ok: false, error: "معرف المفتاح مطلوب" }, 400);
      const existing = await db.aiProviderKey.findUnique({ where: { id } });
      if (!existing) return json({ ok: false, error: "المفتاح غير موجود" }, 404);
      const provider = body.provider === undefined ? validateProvider(existing.provider) : validateProvider(body.provider);
      const apiKind = body.apiKind === "provider" || body.apiKind === "openai-compatible" ? body.apiKind : provider !== "google" ? configFor(provider).kind : (existing.apiKind || "provider");
      const baseUrl = body.baseUrl === undefined ? (existing.baseUrl || (provider === "custom" ? null : configFor(provider).baseUrl)) : optionalHttpUrl(body.baseUrl, "رابط API");
      const modelsUrl = body.modelsUrl === undefined ? existing.modelsUrl : optionalHttpUrl(body.modelsUrl, "رابط الموديلات");
      const chatUrl = body.chatUrl === undefined ? existing.chatUrl : optionalHttpUrl(body.chatUrl, "رابط المحادثة");
      if (provider === "custom" && !baseUrl) return json({ ok: false, error: "رابط API مطلوب للمزود المخصص" }, 400);
      const patch: Record<string, unknown> = { provider, apiKind, baseUrl, modelsUrl, chatUrl };
      if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim().slice(0, 80);
      if (typeof body.model === "string") patch.model = validateModel(body.model, provider);
      if (typeof body.specialty === "string") patch.specialty = body.specialty.slice(0, 40);
      if (typeof body.scopesJson === "string") patch.scopesJson = body.scopesJson.slice(0, 2000);
      if (typeof body.capabilitiesJson === "string") patch.capabilitiesJson = body.capabilitiesJson.slice(0, 2000);
      if (typeof body.priority === "number" && Number.isFinite(body.priority)) patch.priority = safeNumber(body.priority, existing.priority, 0, 999);
      if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
      if (body.maxConcurrency !== undefined) patch.maxConcurrency = safeNumber(body.maxConcurrency, DEFAULT_MAX_CONCURRENCY, 1, 8);
      if (body.rpmLimit !== undefined) patch.rpmLimit = body.rpmLimit == null ? null : safeNumber(body.rpmLimit, 60, 1, 100_000);
      if (body.dailyLimit !== undefined) patch.dailyLimit = body.dailyLimit == null ? null : safeNumber(body.dailyLimit, 1000, 1, 10_000_000);
      if (typeof body.key === "string" && body.key.trim()) {
        if (body.key.trim().length < 16 || body.key.trim().length > 500) return json({ ok: false, error: "مفتاح AI غير صالح" }, 400);
        patch.encryptedKey = await encryptAiKey(body.key.trim());
        patch.keyHint = maskAiKey(body.key.trim());
        patch.failureCount = 0;
        patch.consecutiveFailures = 0;
        patch.status = "active";
        patch.cooldownUntil = null;
        patch.lastError = null;
        patch.lastErrorCode = null;
      }
      const row = await db.aiProviderKey.update({ where: { id }, data: patch });
      return json({ ok: true, data: { id: row.id, label: row.label, provider: row.provider, apiKind: row.apiKind, specialty: row.specialty, scopesJson: row.scopesJson, capabilitiesJson: row.capabilitiesJson, keyHint: row.keyHint, model: row.model, isActive: row.isActive, priority: row.priority, status: row.status } });
    }

    if (action === "keys.reactivate") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return json({ ok: false, error: "معرف المفتاح مطلوب" }, 400);
      const row = await db.aiProviderKey.update({ where: { id }, data: { isActive: true, status: "active", cooldownUntil: null, consecutiveFailures: 0, lastError: null, lastErrorCode: null } });
      return json({ ok: true, data: { id: row.id, status: row.status, isActive: row.isActive } });
    }

    if (action === "keys.delete") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return json({ ok: false, error: "معرف المفتاح مطلوب" }, 400);
      await db.aiProviderKey.delete({ where: { id } });
      return json({ ok: true, data: { deleted: true } });
    }

    if (action === "keys.test") {
      const result = await generateWithRotation("أجب بكلمة واحدة فقط: جاهز", { keyId: typeof body.id === "string" ? body.id : undefined, model: body.model, operation: "key-test", maxOutputTokens: 32 });
      return json({ ok: true, data: { connected: true, provider: result.provider, model: result.model, keyId: result.keyId, preview: result.text.slice(0, 80) } });
    }

    if (action === "keys.modelsPreview") {
      const key = typeof body.key === "string" ? body.key.trim() : "";
      const provider = validateProvider(body.provider);
      const apiKind = body.apiKind === "provider" && provider === "google" ? "provider" : "openai-compatible";
      const baseUrl = optionalHttpUrl(body.baseUrl, "رابط API") || (provider === "custom" ? null : configFor(provider).baseUrl);
      const modelsUrl = optionalApiEndpoint(body.modelsUrl, "رابط الموديلات", baseUrl);
      const chatUrl = optionalApiEndpoint(body.chatUrl, "رابط المحادثة", baseUrl);
      if (key.length < 16 || key.length > 500) return json({ ok: false, error: "مفتاح AI غير صالح أو طوله غير مناسب" }, 400);
      if (!baseUrl) return json({ ok: false, error: "رابط API مطلوب" }, 400);
      const models = await discoverModels({ provider, key, baseUrl, modelsUrl, apiKind });
      return json({ ok: true, data: models });
    }

    if (action === "analyzeLesson" || action === "generateQuestions" || action === "whiteboardAssist") {
      const rawInput = typeof body.input === "string" ? body.input.trim() : typeof body.context === "string" ? body.context.trim() : "";
      if (!rawInput) return json({ ok: false, error: "سياق العملية مطلوب" }, 400);
      if (rawInput.length > MAX_INPUT_CHARS) return json({ ok: false, error: `سياق العملية طويل جداً (الحد ${MAX_INPUT_CHARS} حرف)` }, 400);
      const base = { type: "object", additionalProperties: false, properties: {}, required: [] } as Record<string, unknown>;
      let schema: Record<string, unknown> = base;
      let systemInstruction = "أنت مساعد رياضيات داخل بسلاسة. أخرج JSON فقط، ولا تخترع بيانات طلاب أو قرارات حصة. القرار النهائي للمدرس.";
      const operation = action;
      if (action === "analyzeLesson") {
        schema = { type: "object", additionalProperties: false, properties: { summary: { type: "string" }, objectives: { type: "array", items: { type: "string" } }, concepts: { type: "array", items: { type: "string" } }, risks: { type: "array", items: { type: "string" } }, activities: { type: "array", items: { type: "string" } }, suggestedQuestions: { type: "array", items: { type: "string" } } }, required: ["summary", "objectives", "concepts", "risks", "activities", "suggestedQuestions"] };
        systemInstruction += " حلل الدرس أو الخطوة في الرياضيات، وارجع ملخصاً وأهدافاً ومفاهيم ومخاطر وأنشطة وأسئلة مقترحة.";
      } else if (action === "generateQuestions") {
        const lessonId = typeof body.lessonId === "string" && body.lessonId.trim() ? body.lessonId.trim().slice(0, 300) : "ai-preview";
        const requestedCount = Number(body.count);
        const count = Number.isInteger(requestedCount) ? Math.max(1, Math.min(20, requestedCount)) : 5;
        schema = { type: "object", additionalProperties: false, properties: { questions: { type: "array", minItems: 1, maxItems: 20, items: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, correctAnswer: { type: "string" }, options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 }, rewardPoints: { type: "integer" }, difficulty: { type: "string", enum: ["easy", "medium", "hard"] }, tags: { type: "array", items: { type: "string" } }, explanation: { type: "string" } }, required: ["text", "correctAnswer", "options", "rewardPoints", "difficulty", "tags", "explanation"] } } }, required: ["questions"] };
        systemInstruction += ` أنشئ ${count} أسئلة رياضيات متعددة الخيارات من السياق فقط. اكتب correctAnswer داخل options، ولا تضف معلومات خارج السياق. lessonId المرجعي هو ${lessonId}.`;
      } else {
        schema = { type: "object", additionalProperties: false, properties: { kind: { type: "string", enum: ["text", "equation", "steps", "shape"] }, title: { type: "string" }, text: { type: "string" }, latex: { type: "string" }, steps: { type: "array", items: { type: "string" } }, warnings: { type: "array", items: { type: "string" } } }, required: ["kind", "title", "text", "latex", "steps", "warnings"] };
        systemInstruction += " ساعد المدرس في تحويل المسألة إلى عنصر سبورة قابل للمعاينة. لا تطبق شيئاً على السبورة؛ أرجع اقتراحاً فقط مع خطوات وتحذيرات.";
      }
      const result = await generateWithRotation(rawInput, { keyId: typeof body.keyId === "string" ? body.keyId : undefined, model: body.model, systemInstruction, temperature: body.temperature, maxOutputTokens: body.maxOutputTokens ?? 1800, operation, responseSchema: schema });
      const parsed = parseJsonText(result.text);
      if (action === "generateQuestions") {
        const rawQuestions = Array.isArray((parsed as any)?.questions) ? (parsed as any).questions : [];
        const lessonId = typeof body.lessonId === "string" && body.lessonId.trim() ? body.lessonId.trim().slice(0, 300) : "ai-preview";
        const accepted: Array<Record<string, unknown>> = [];
        const rejected: Array<{ errors: string[] }> = [];
        for (const rawQuestion of rawQuestions) {
          const checked = validateQuestionInput({ ...(rawQuestion || {}), lessonId, gameReady: true });
          if (checked.ok && checked.value) accepted.push({ ...checked.value, options: JSON.parse(checked.value.optionsJson), tags: JSON.parse(checked.value.tags), explanation: typeof rawQuestion?.explanation === "string" ? rawQuestion.explanation.slice(0, 1200) : "" });
          else rejected.push({ errors: checked.errors });
        }
        return json({ ok: true, data: { questions: accepted, rejected, provider: result.provider, model: result.model, keyId: result.keyId } });
      }
      return json({ ok: true, data: { result: parsed, provider: result.provider, model: result.model, keyId: result.keyId } });
    }

    if (action === "promptTest") {
      const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_SYSTEM_CHARS) : "";
      const sampleInput = typeof body.sampleInput === "string" ? body.sampleInput.trim() : "";
      if (!prompt || !sampleInput) return json({ ok: false, error: "القالب والمدخل التجريبي مطلوبان" }, 400);
      const result = await generateWithRotation(sampleInput, { keyId: typeof body.keyId === "string" ? body.keyId : undefined, model: body.model, systemInstruction: prompt, temperature: body.temperature, maxOutputTokens: body.maxOutputTokens ?? 1200, operation: "curriculum-factory-prompt-test" });
      return json({ ok: true, data: { text: result.text, provider: result.provider, model: result.model, keyId: result.keyId, usage: result.usage } });
    }

    if (action === "compare") {
      const input = typeof body.input === "string" ? body.input.trim() : "";
      const models = Array.isArray(body.models) ? body.models.filter((item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === "object")).slice(0, 4) : [];
      if (!input || !models.length) return json({ ok: false, error: "المدخل والموديلات مطلوبان للمقارنة" }, 400);
      const results = await Promise.all(models.map(async (item) => {
        const result = await generateWithRotation(input, { keyId: typeof item.keyId === "string" ? item.keyId : undefined, model: typeof item.model === "string" ? item.model : undefined, systemInstruction: typeof body.systemInstruction === "string" ? body.systemInstruction.slice(0, MAX_SYSTEM_CHARS) : undefined, temperature: body.temperature, maxOutputTokens: body.maxOutputTokens ?? 1200, operation: "curriculum-factory-model-compare" });
        return { text: result.text, provider: result.provider, model: result.model, keyId: result.keyId, usage: result.usage };
      }));
      return json({ ok: true, data: results });
    }

    if (action === "generate") {
      const input = typeof body.input === "string" ? body.input.trim() : "";
      if (!input) return json({ ok: false, error: "نص الطلب مطلوب" }, 400);
      if (input.length > MAX_INPUT_CHARS) return json({ ok: false, error: `نص الطلب طويل جداً (الحد ${MAX_INPUT_CHARS} حرف)` }, 400);
      const systemInstruction = typeof body.systemInstruction === "string" ? body.systemInstruction.trim().slice(0, MAX_SYSTEM_CHARS) : undefined;
      const operation = typeof body.operation === "string" ? body.operation.slice(0, 80) : "assistant";
      const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
      const conversationMessages = conversationId ? (await db.aiConversationMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" }, take: 80 })).map((message) => ({ role: message.role, content: message.content })) : [];
      if (conversationId) await db.aiConversationMessage.create({ data: { conversationId, role: "user", content: input } });
      const result = await generateWithRotation(input, { keyId: typeof body.keyId === "string" ? body.keyId : undefined, model: body.model, systemInstruction, temperature: body.temperature, maxOutputTokens: body.maxOutputTokens, operation, images: Array.isArray(body.images) ? body.images.slice(0, 4) : undefined, tools: Array.isArray(body.tools) ? body.tools.slice(0, 8) : undefined, conversationMessages: [...conversationMessages, { role: "user", content: input }] });
      if (conversationId) await db.aiConversationMessage.create({ data: { conversationId, role: "assistant", content: result.text, provider: result.provider, model: result.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens } });
      return json({ ok: true, data: { text: result.text, provider: result.provider, model: result.model, keyId: result.keyId, usage: result.usage } });
    }

    return json({ ok: false, error: "إجراء AI غير معروف" }, 400);
  } catch (error) {
    const message = errorMessage(error);
    const status = /تجاوز حد طلبات/.test(message) ? 429 : /غير صالح|مطلوب/.test(message) ? 400 : 500;
    return json({ ok: false, error: message }, status);
  }
}
