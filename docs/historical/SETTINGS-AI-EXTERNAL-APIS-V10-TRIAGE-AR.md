# مطابقة مراجعة Settings + AI + External APIs — V9 إلى V10

**التاريخ:** 15 أغسطس 2026

**النطاق:** `13-SETTINGS-AI-EXTERNAL-APIS-V9-CRITICAL-REVIEW.md`

## الحكم الأولي

المراجعة صحيحة في فجوات تنظيم الإعدادات، profiles، conflict detection، retry queue، history/memory، prompt library، safety، وتكاملات outbound. لكنها أصبحت قديمة في بعض أجزاء AI: multi-provider، rotation حسب priority/cooldown/concurrency، AES-256-GCM، model discovery، usage logging، Smart Context، structured actions، comparison، usage estimation، وواجهة SSE موجودة بالفعل. مسار streaming الحالي ليس streaming upstream حقيقياً؛ إنه chunked playback للنص المكتمل، لذلك ستُوثق هذه النقطة كتحسين جودة لا كميزة مفقودة بالكامل.

## ما هو مغلق أو موجود بالفعل

| المجال | الحالة الحالية | الدليل |
|---|---|---|
| Google/Groq/OpenAI/Mistral/custom | موجود | `src/app/api/ai/route.ts` و`PROVIDER_CONFIG` |
| priority/cooldown/concurrency/RPM/daily limits | موجود | `getCandidates` و`markFailure` و`inFlightByKey` |
| تشفير المفاتيح | موجود | `src/lib/ai-key-crypto.ts` AES-256-GCM مع key hint |
| model discovery وpagination | موجود | `src/app/api/ai/model-discovery.ts` و`keys.modelsPreview` |
| usage وrotation | موجود | `AiUsageEvent` و`generateWithRotation` |
| Smart Context anonymized | موجود | `src/lib/smart-context.ts` |
| structured AI actions | موجود | `analyzeLesson` و`generateQuestions` و`whiteboardAssist` |
| prompt test وcomparison وusage estimate | موجود | `promptTest` و`compare` و`estimateUsage` في route/UI |
| SSE route | موجود وظيفياً | `/api/ai/stream`؛ يحتاج تحسين upstream لا إعادة بناء كاملة |
| Moodle/Custom App/Telegram/TTS | موجود | التقارير والـroutes الحالية واختبارات integration |

## الفجوات V10 الفعلية

| الأولوية | الفجوة | قرار التنفيذ |
|---|---|---|
| حرجة | Settings طويلة بلا تنظيم | Tabs/sections مع state داخلي يحافظ على layout المدرس |
| حرجة | لا يوجد بحث Settings | فهرس sections/keywords يعمل أثناء الكتابة ويظهر النتائج |
| حرجة | لا يوجد settings-only import/export | JSON versioned ومفلتر لا يشمل الطلاب أو الأسرار |
| حرجة | لا يوجد Settings Profiles | نموذج محلي مربوط اختيارياً بـclassId مع تطبيق atomic وrollback |
| حرجة | AI state غير موحد بين التابات | `aiSettings` موحد مع per-context overrides وBroadcastChannel/localStorage |
| حرجة | لا يوجد validation/conflict detection | schema validation وrevision/updatedAt وconflict response قبل الكتابة |
| متوسطة | conversation history | `AiConversation`/messages مع حدود الحجم وclear/export وprivacy opt-in |
| متوسطة | native streaming | الحفاظ على SSE الحالي وإضافة provider streaming adapter حيث يدعم، مع fallback chunked playback |
| متوسطة | cost accounting | حفظ input/output tokens والتكلفة حسب provider/model مع تقدير واضح عند غياب usage |
| متوسطة | specialty routing/scopes | specialty وcapabilities وallowedOperations لكل مفتاح، ثم general fallback |
| متوسطة | AI retry queue | queue persisted مع backoff وdead وmanual retry، دون worker دائم في البيئة المحلية |
| متوسطة | AI memory | key/value memory scoped lesson/idea مع TTL/consent وidempotent upsert |
| متوسطة | prompt library | CRUD مدرسية مع category/tags/variables ونسخ آمنة |
| متوسطة | safety filter | deterministic baseline + audit result، يمنع prompt عالي الخطورة قبل provider |
| متقدمة | semantic search | embeddings adapter اختياري وتخزين vectors محلي مع text fallback |
| متقدمة | image/vision/STT/tools | capability-gated adapters وmock routes؛ لا يظهر زر غير مدعوم |
| متقدمة | provider presets | OpenRouter/Anthropic/Together/Fireworks/DeepSeek/Cohere/Perplexity/Replicate/HuggingFace كقوالب config، مع adapters مستقلة لما ليس OpenAI-compatible |
| متقدمة | TTS providers | abstraction لـOpenAI/ElevenLabs/Google Cloud مع بقاء Google Translate/Web Speech fallback |
| متقدمة | outbound webhooks | targets مشفرة/موقعة HMAC، event allowlist، retry/dead-letter، SSRF validation |
| متقدمة | REST integration | API key scopes، HMAC، idempotency، rate limit، read-only default، audit log |

## قرارات الأمن والتربية

لا نضع مفاتيح أو نصوص أسرار في client state أو export الإعدادات. لا يتضمن settings export الطلاب أو الجلسات أو tokens. لا ينفذ AI أفعالاً حصة أو يمنح نقاطاً دون approval من المدرس؛ function calling يقتصر على أدوات آمنة مقترحة ويعيد confirmation قبل الأفعال المدمرة أو التي تغير الجلسة.

الـwebhook الصادر لا يقبل URL داخلياً أو localhost أو credentials داخل الرابط، ويستخدم allowlist للأحداث وتوقيع HMAC وتوقيتاً ومنع replay. REST API يبدأ read-only، ولكل مفتاح scopes محدودة، ويخضع للتسجيل والحدود.

الميزات التي تحتاج مزوداً خارجياً فعلياً ستختبر عبر mock provider في QA. لا يُدّعى نجاح مكالمة OpenAI أو Anthropic أو ElevenLabs حقيقية بلا مفتاح يقدمه المدرس وموافقة على إرسال البيانات.

## ترتيب التنفيذ والقبول

1. عقود schemas وsettings profiles وAI unified state وtests.
2. Settings tabs/search/import/export/validation/conflict/profile.
3. AI history/sync/cost/specialty/scopes/retry/memory/prompt/safety.
4. capability adapters وprovider presets وmock contracts.
5. outbound webhooks وREST read-only integration.
6. TypeScript/ESLint/build، unit/API/DB/browser/security/performance، ثم التوثيق والتغليف.

لا يُغلق أي بند بوجود UI فقط؛ يجب أن يمر باختبار إيجابي وسلبي، وأن يحافظ على عدم كشف الأسرار، وأن يعمل عند تعطل provider أو localStorage أو قاعدة البيانات.
