# تنفيذ Settings + AI + External APIs V10

**المشروع:** بسلاسة — غرفة عمليات المدرس المحلية  
**المؤلف:** Manus AI  
**التاريخ:** 15 أغسطس 2026  
**النطاق:** إغلاق الفجوات العملية في `13-SETTINGS-AI-EXTERNAL-APIS-V9-CRITICAL-REVIEW.md` دون تغيير فلسفة المدرس صاحب القرار أو جعل Moodle قناة دفع للدرجات.

## 1. القرار المعماري

يعتمد الإصدار V10 على فصل واضح بين واجهة المدرس، وطبقة `local-db` typed facade، وdispatcher SQLite، وطبقة AI server-side. تبقى المفاتيح والأسرار خارج client state وخارج ملفات التصدير، بينما يمر كل طلب AI من خلال rotation حسب الأولوية وcooldown وlimits وconcurrency. لا ينفذ AI إجراءً صفياً أو يمنح نقاطاً تلقائياً؛ الناتج اقتراح قابل للمراجعة، ويظل القرار للمدرس.

> **قاعدة الخصوصية:** لا يُرسل سياق الطلاب أو الدرس إلى مزود خارجي إلا عند تفعيل المدرس للسياق وطلب العملية، ولا تعود قيمة المفتاح إلى المتصفح بعد الحفظ.

## 2. مصفوفة إغلاق الفجوات

| فجوة مراجعة V9 | تنفيذ V10 | الدليل والاختبار |
|---|---|---|
| Settings طويلة بلا تنظيم | تبويبات عام، AI، تكاملات، متقدم، مع بحث حي | `SettingsPanel.tsx`، browser findings، settings smoke |
| غياب بحث الإعدادات | فهرس sections/keywords عربي/إنجليزي مع تصفية أثناء الكتابة | `src/lib/settings-ai-v10.ts`، اختبار بحث TTS |
| غياب settings-only export/import | JSON versioned، whitelist للحقول، رفض المفاتيح المجهولة والحدود غير الصالحة | `exportSettingsPayload` و`validateSettingsImport`، 20/20 |
| غياب Settings Profiles | `SettingsProfile` مرتبط اختيارياً بـclassId، revision، تطبيق وحذف | dispatcher `settings.profiles.*`، API 16/16 |
| تعارضات الكتابة | مقارنة revision وإرجاع `{ conflict: true, current }` بدلاً من overwrite صامت | API smoke: conflict PASS |
| AI state غير موحد | `UnifiedAiSettings` وper-context resolution وعقد capabilities | `src/lib/settings-ai-v10.ts` وlocal-db facade |
| التاريخ الحواري | `AiConversation` و`AiConversationMessage`، حدود عدد/حجم، حفظ user/assistant في generate | API smoke: history persistence PASS |
| streaming غير موضح | الإبقاء على SSE الحالي مع adapters downstream؛ fallback chunked محفوظ في route الحالي | موثق كحد جودة لا كفجوة تشغيلية مغلقة بالكامل |
| cost accounting | input/output tokens، estimated cost حسب provider/model، وسجل `AiUsageEvent` | schema و`estimateUsage` وusage logging |
| specialty routing | specialty عام/رياضيات/عربي/علوم/صور/صوت مع أولوية للتخصص ثم general | `operationSpecialty` و`getCandidates` |
| scopes/capabilities | `scopesJson` و`capabilitiesJson` لكل مفتاح، ورفض المرشح غير المصرح بالعملية | contract smoke: scope allow/deny PASS |
| retry queue | `AiRetryQueue` مع pending/retrying/success/dead وbackoff، claim وcomplete وfail | API smoke: enqueue/claim/complete PASS |
| AI memory | key/value scoped lesson/idea مع TTL وcompound idempotent upsert | `AiMemory`، API smoke PASS |
| prompt library | CRUD لـ`PromptLibrary` مع category/tags/variables | dispatcher وAPI smoke PASS |
| prompt safety | فحص deterministic baseline قبل الاتصال بمزود AI، مع رد 400 واضح | contract وAPI safety gate PASS |
| semantic search | `LessonEmbedding` وتخزين vectors محلي، route embeddings مع mock وOpenAI-compatible | API smoke: mock embeddings PASS |
| image/vision | `/api/ai/media` capability-gated للصورة والرؤية، mock محلي ومدخلات OpenAI vision | API smoke: image/vision PASS |
| STT | multipart route للصوت مع mock وOpenAI-compatible transcription، حد 16MB | route `/api/ai/media` |
| tools/function calling | أدوات OpenAI-compatible تُرسل فقط عند طلب المدرس، ولا تُنفذ mutations تلقائياً | `tools` request field مع approval policy |
| provider presets | Google، OpenAI، OpenRouter، Anthropic، Together، Fireworks، DeepSeek، Cohere، Perplexity، Replicate، HuggingFace وcustom | `AI_PROVIDER_PRESETS` و`PROVIDER_CONFIG`، browser verification |
| Anthropic/Cohere shapes | Anthropic Messages headers/body مستقل، Cohere `/chat`، وعدم افتراض OpenAI shape | `callProvider` وTypeScript/build PASS |
| model discovery | القائمة الحالية تعمل مع provider/key، وواجهة AiPanel تعرض preset وFetch Models | AiPanel browser verification |
| TTS providers | POST server-side لـOpenAI، ElevenLabs، Google Cloud، مع GET Google Translate fallback | `src/app/api/tts/route.ts`، TTS path موثق |
| outbound webhooks | targets مشفرة، event allowlist، HMAC SHA-256، timestamp/event id، retries/backoff، SSRF rejection | `/api/webhooks`، pure contract وAPI target smoke |
| REST integration | read-only health endpoint عبر `BISALASA_REST_API_KEY`، لا يعمل عند غياب المفتاح | API smoke: denied without key |

## 3. الملفات والعقود الجديدة

| المسار | المسؤولية |
|---|---|
| `src/lib/settings-ai-v10.ts` | sections/search، import/export validation، profiles، provider presets، scopes، safety، webhook URL policy |
| `src/lib/webhook-v10.ts` | canonical body، HMAC، signature verification، event normalization، backoff |
| `src/app/api/ai/media/route.ts` | image، vision، embeddings، multipart STT، mock provider محلي |
| `src/app/api/webhooks/route.ts` | حفظ وحذف وتسليم targets وتوقيع/retry وREST read-only health |
| `src/app/api/tts/route.ts` | OpenAI/ElevenLabs/Google Cloud POST مع Google Translate GET fallback |
| `src/app/api/db/[operation]/route.ts` | CRUD profiles/history/memory/retry/prompts/embeddings/webhooks |
| `src/components/shell/panels/SettingsPanel.tsx` | tabs/search/settings-only import/export/profiles |
| `src/components/shell/panels/AiPanel.tsx` | provider presets، Fetch Models، specialty، priority، scopes، capabilities |
| `scripts/settings-ai-v10-smoke.ts` | 20 اختبار pure |
| `scripts/settings-ai-v10-api-smoke.cjs` | 16 اختبار API/DB/mock/security |
| `SETTINGS-AI-V10-FULL-REGRESSION.log` | سجل regression الكامل القابل للمراجعة |

## 4. قرارات الأمن والتربية

تُشفّر المفاتيح باستخدام مسار التشفير الحالي AES-256-GCM، ويُحفظ key hint فقط للعرض. لا يمر secret في `AiKeySummary` أو settings export أو webhook listing. يقبل webhook فقط `https` أو `http` العام بدون credentials أو hash أو localhost أو `.local`، ويُرسل signature مشتقاً من secret المخزن server-side.

الـAI لا يرى student data في Smart Context إلا عند opt-in، ولا يغير الدرس أو يمنح مكافأة أو ينهي جلسة بلا ضغط مدرس واضح. prompts ذات مؤشرات خطر واضحة تُرفض قبل provider. مزودات الصوت والصورة والـSTT خارجية اختيارية، ويُختبر المسار الآلي عبر mock حتى لا تُرسل بيانات المستخدم خارجياً بلا مفتاح وموافقة.

## 5. الحدود المتبقية المعلنة

المسار الأساسي المحلي مكتمل وقابل للاختبار دون مفاتيح خارجية. ما زال upstream streaming الحقيقي يعتمد على adapter provider؛ المسار الحالي يحافظ على SSE وfallback chunked playback ولا يدّعي وصول token لحظياً من كل مزود. Replicate وHuggingFace موجودان كpresets capability/config، لكن generate النصي العام لهما يحتاج adapter متخصصاً لنوع المهمة بدلاً من إرسال Chat Completions غير صحيح.

REST integration الحالي read-only افتراضياً ومربوط بمفتاح بيئي، ولا يفتح mutation خارجي أو endpoint عام عند غياب `BISALASA_REST_API_KEY`. التعاون متعدد الأجهزة وvoice cloning و3D ليست ضمن المسار المحلي الأساسي، ولذلك لا تُفعل تلقائياً ولا تُحسب كنجاح مزود خارجي حقيقي.

## 6. المراجع الخارجية

[1]: https://developers.openai.com/api/reference/overview/ — OpenAI API Reference.  
[2]: https://platform.claude.com/docs/en/api/messages — Anthropic Messages API.  
[3]: https://developers.openai.com/api/docs/guides/embeddings — OpenAI Embeddings Guide.  
[4]: https://developers.openai.com/api/docs/guides/images-vision — OpenAI Images and Vision Guide.  
[5]: https://elevenlabs.io/docs/api-reference/text-to-speech/convert — ElevenLabs Text to Speech API.
