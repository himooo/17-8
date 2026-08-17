import type { ShellSettings } from "@/lib/slide-schema";

export type SettingsSectionId = "general" | "ai" | "integrations" | "advanced";

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  keywords: string[];
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "general", label: "عام", keywords: ["صوت", "تليبرومبتر", "سبورة", "عرض", "comments", "audio", "whiteboard"] },
  { id: "ai", label: "الذكاء الاصطناعي", keywords: ["ai", "ذكاء", "tts", "prompt", "model", "مفتاح", "نموذج", "محادثة"] },
  { id: "integrations", label: "التكاملات", keywords: ["moodle", "telegram", "custom app", "webhook", "rest", "مودل", "تليجرام"] },
  { id: "advanced", label: "متقدم", keywords: ["sqlite", "session", "backup", "restore", "shortcut", "migration", "نسخ", "جلسة"] },
];

export type AiContext = "aiPanel" | "teleprompter" | "curriculumFactory" | "whiteboard" | "reports";

export type UnifiedAiSettings = {
  enabled: boolean;
  defaultProvider: string;
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxOutputTokens: number;
  defaultKeyId?: string;
  perContext: Partial<Record<AiContext, Partial<Pick<UnifiedAiSettings, "defaultProvider" | "defaultModel" | "defaultTemperature" | "defaultMaxOutputTokens" | "defaultKeyId">>>>;
  revision: number;
};

export const DEFAULT_UNIFIED_AI_SETTINGS: UnifiedAiSettings = {
  enabled: true,
  defaultProvider: "google",
  defaultModel: "gemini-2.5-flash",
  defaultTemperature: 0.35,
  defaultMaxOutputTokens: 1200,
  perContext: {},
  revision: 1,
};

export function resolveAiSettings(settings: UnifiedAiSettings, context: AiContext) {
  return {
    ...settings,
    ...(settings.perContext[context] ?? {}),
  };
}

export function settingsSectionMatches(section: SettingsSection, query: string) {
  const normalized = query.trim().toLocaleLowerCase("ar");
  if (!normalized) return true;
  return [section.label, ...section.keywords].some((value) => value.toLocaleLowerCase("ar").includes(normalized));
}

const IMPORTABLE_SETTINGS = new Set<keyof ShellSettings>([
  "muted", "volume", "ttsEnabled", "ttsSpeakStudentName", "ttsSpeakPoints", "ttsSpeakCelebrations", "ttsSpeakGifts", "ttsRate",
  "teleprompterSize", "teleprompterFontSize", "whiteboardEnabled", "autoClearOnStepChange", "presentationMode", "fairnessMode",
  "virtualCommentsEnabled", "virtualCommentAutoHideMs", "aiEnabled", "aiModel", "aiTemperature", "aiMaxOutputTokens", "aiIncludeLessonContext",
  "audioMixerEnabled", "audioMasterVolume", "audioChannels", "ambianceType", "hapticsEnabled",
]);

export function exportSettingsPayload(settings: Partial<ShellSettings>, revision = 1) {
  const safe: Record<string, unknown> = {};
  for (const key of IMPORTABLE_SETTINGS) {
    if (settings[key] !== undefined) safe[key] = settings[key];
  }
  return { schema: "bisalasa-settings", version: 1, revision, exportedAt: new Date().toISOString(), settings: safe };
}

export function validateSettingsImport(payload: unknown): { ok: true; settings: Partial<ShellSettings>; revision: number } | { ok: false; errors: string[] } {
  if (!payload || typeof payload !== "object") return { ok: false, errors: ["ملف الإعدادات ليس JSON صالحاً"] };
  const record = payload as Record<string, unknown>;
  if (record.schema !== "bisalasa-settings" || record.version !== 1) return { ok: false, errors: ["إصدار ملف الإعدادات غير مدعوم"] };
  if (!record.settings || typeof record.settings !== "object" || Array.isArray(record.settings)) return { ok: false, errors: ["قسم settings مفقود أو غير صالح"] };
  const settings: Partial<ShellSettings> = {};
  const errors: string[] = [];
  for (const [key, value] of Object.entries(record.settings as Record<string, unknown>)) {
    if (!IMPORTABLE_SETTINGS.has(key as keyof ShellSettings)) { errors.push(`مفتاح غير مسموح: ${key}`); continue; }
    if (key === "volume" || key === "ttsRate" || key === "audioMasterVolume") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 2) errors.push(`قيمة رقمية غير صالحة: ${key}`);
      else (settings as Record<string, unknown>)[key] = value;
    } else if (key === "aiTemperature") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1.5) errors.push("aiTemperature خارج النطاق");
      else (settings as Record<string, unknown>)[key] = value;
    } else if (key === "aiMaxOutputTokens") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < 128 || value > 8192) errors.push("aiMaxOutputTokens خارج النطاق");
      else (settings as Record<string, unknown>)[key] = value;
    } else {
      (settings as Record<string, unknown>)[key] = value;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, settings, revision: typeof record.revision === "number" ? record.revision : 1 };
}

export function detectSettingsConflict(localRevision: number, incomingRevision: number, localUpdatedAt: number, incomingUpdatedAt: number) {
  return incomingRevision < localRevision || (incomingRevision === localRevision && incomingUpdatedAt < localUpdatedAt);
}

export function nextSettingsRevision(current: number) {
  return Math.max(1, Math.floor(current) + 1);
}

export const AI_PROVIDER_PRESETS = {
  google: { kind: "google", baseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.5-flash", capabilities: ["text", "vision", "tools", "streaming"] },
  openai: { kind: "openai-compatible", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", capabilities: ["text", "vision", "image", "stt", "tts", "embeddings", "tools", "streaming"] },
  openrouter: { kind: "openai-compatible", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini", capabilities: ["text", "vision", "tools", "streaming"] },
  anthropic: { kind: "anthropic", baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-sonnet-4-6", capabilities: ["text", "vision", "tools", "streaming"] },
  together: { kind: "openai-compatible", baseUrl: "https://api.together.xyz/v1", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", capabilities: ["text", "vision", "tools"] },
  fireworks: { kind: "openai-compatible", baseUrl: "https://api.fireworks.ai/inference/v1", defaultModel: "accounts/fireworks/models/llama-v3p1-70b-instruct", capabilities: ["text", "tools"] },
  deepseek: { kind: "openai-compatible", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat", capabilities: ["text", "tools"] },
  cohere: { kind: "cohere", baseUrl: "https://api.cohere.com/v2", defaultModel: "command-r-plus", capabilities: ["text", "tools"] },
  perplexity: { kind: "openai-compatible", baseUrl: "https://api.perplexity.ai", defaultModel: "sonar", capabilities: ["text", "search"] },
  replicate: { kind: "replicate", baseUrl: "https://api.replicate.com/v1", defaultModel: "", capabilities: ["image", "text"] },
  huggingface: { kind: "huggingface", baseUrl: "https://api-inference.huggingface.co", defaultModel: "", capabilities: ["text", "image"] },
} as const;

export type AiCapability = "text" | "vision" | "image" | "stt" | "tts" | "embeddings" | "tools" | "streaming" | "search";

export function hasCapability(capabilitiesJson: string | string[] | undefined, capability: AiCapability) {
  const values = Array.isArray(capabilitiesJson) ? capabilitiesJson : (() => { try { return JSON.parse(capabilitiesJson || "[]"); } catch { return []; } })();
  return values.includes(capability);
}

export function operationSpecialty(operation: string) {
  const normalized = operation.toLowerCase();
  if (normalized.includes("math") || normalized.includes("question") || normalized.includes("whiteboard")) return "math";
  if (normalized.includes("lesson") || normalized.includes("arabic") || normalized.includes("report")) return "arabic";
  if (normalized.includes("image") || normalized.includes("vision")) return "images";
  if (normalized.includes("audio") || normalized.includes("speech") || normalized.includes("tts") || normalized.includes("stt")) return "audio";
  return "general";
}

export function parseScopes(value: string | string[] | undefined) {
  const scopes = Array.isArray(value) ? value : (() => { try { return JSON.parse(value || "[\"generate\"]"); } catch { return ["generate"]; } })();
  return new Set(scopes.filter((item): item is string => typeof item === "string"));
}

export function canUseScope(scopesJson: string | string[] | undefined, operation: string) {
  const scopes = parseScopes(scopesJson);
  return scopes.has("*") || scopes.has("generate") || scopes.has(operation) || scopes.has(operationSpecialty(operation));
}

export function safetyCheckPrompt(input: string) {
  const normalized = input.toLocaleLowerCase("ar");
  const blocked = ["child sexual", "porn", "إباحية", "استغلال جنسي", "كراهية عرقية", "صنع سلاح", "malware", "سرقة كلمة المرور", "عنف", "عنيف", "قتل", "إيذاء"];
  const match = blocked.find((term) => normalized.includes(term.toLocaleLowerCase("ar")));
  return match ? { safe: false, reason: `محتوى غير لائق أو يحتاج مراجعة أمان: ${match}` } : { safe: true as const };
}

export type WebhookEvent = "lesson.started" | "lesson.completed" | "student.answered" | "student.struggling" | "session.ended";

export function isAllowedWebhookEvent(value: unknown): value is WebhookEvent {
  return ["lesson.started", "lesson.completed", "student.answered", "student.struggling", "session.ended"].includes(value as WebhookEvent);
}

export function isSafeWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host) || host.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}
