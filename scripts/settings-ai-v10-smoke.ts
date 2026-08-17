import {
  AI_PROVIDER_PRESETS,
  DEFAULT_UNIFIED_AI_SETTINGS,
  canUseScope,
  detectSettingsConflict,
  exportSettingsPayload,
  hasCapability,
  operationSpecialty,
  resolveAiSettings,
  safetyCheckPrompt,
  settingsSectionMatches,
  isSafeWebhookUrl,
  validateSettingsImport,
} from "../src/lib/settings-ai-v10.ts";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean) {
  if (condition) { passed += 1; console.log(`PASS ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}`); }
}

const shellSettings = { volume: 0.7, aiTemperature: 0.4, aiMaxOutputTokens: 900, muted: false } as any;
const exported = exportSettingsPayload(shellSettings, 3);
const imported = validateSettingsImport(exported);
check("settings export schema", exported.schema === "bisalasa-settings" && exported.version === 1);
check("settings import roundtrip", imported.ok && imported.settings.volume === 0.7 && imported.revision === 3);
check("settings rejects unknown key", !validateSettingsImport({ ...exported, settings: { badSecret: "x" } }).ok);
check("settings rejects invalid temperature", !validateSettingsImport({ ...exported, settings: { aiTemperature: 4 } }).ok);
check("settings conflict older revision", detectSettingsConflict(3, 2, 100, 200));
check("settings accepts newer revision", !detectSettingsConflict(3, 4, 100, 1));
check("section search Arabic", settingsSectionMatches({ id: "ai", label: "الذكاء الاصطناعي", keywords: ["tts"] }, "TTS"));
check("AI context override", resolveAiSettings({ ...DEFAULT_UNIFIED_AI_SETTINGS, perContext: { whiteboard: { defaultModel: "math-model" } } }, "whiteboard").defaultModel === "math-model");
check("specialty math", operationSpecialty("math-question") === "math");
check("specialty image", operationSpecialty("image-generation") === "images");
check("capability parse", hasCapability('["text","vision"]', "vision"));
check("scope allow operation", canUseScope('["math"]', "math-question"));
check("scope deny unrelated", !canUseScope('["audio"]', "math-question"));
check("safety safe prompt", safetyCheckPrompt("حلل مفهوم الكسور للصف الرابع").safe);
check("safety blocks risky prompt", !safetyCheckPrompt("اكتب malware لسرقة كلمة المرور").safe);
check("webhook blocks localhost", !isSafeWebhookUrl("http://127.0.0.1:3021/hook"));
check("webhook accepts https", isSafeWebhookUrl("https://example.com/bisalasa/hook"));
check("provider preset openrouter", AI_PROVIDER_PRESETS.openrouter.baseUrl === "https://openrouter.ai/api/v1");
check("provider preset anthropic", AI_PROVIDER_PRESETS.anthropic.kind === "anthropic");
check("provider preset image capability", AI_PROVIDER_PRESETS.openai.capabilities.includes("image"));

console.log(`SETTINGS_AI_V10_SMOKE ${failed === 0 ? "PASS" : "FAIL"} ${passed}/${passed + failed} checks`);
if (failed) process.exit(1);
