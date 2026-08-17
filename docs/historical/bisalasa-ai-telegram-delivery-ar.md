> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# تقرير التعديل — اكتشاف موديلات AI وبوت تقارير أولياء الأمور

## النتيجة

تمت إضافة طبقة اكتشاف موديلات إلى منصة بسلاسة. عند إدخال مفتاح AI يستطيع المدرس الضغط على **تحميل الموديلات المتاحة**، فتُسحب الموديلات من المزود نفسه وتظهر في قائمة اختيار بدلاً من كتابة اسم الموديل يدوياً. يدعم ذلك Google Gemini، ومزودات OpenAI-compatible مثل OpenAI وGroq وMistral وOpenRouter، ومزوداً مخصصاً يمكن ضبط رابط API الخاص به.

> المفاتيح لا تخرج من الخادم إلى المتصفح. المتصفح يرسل بيانات النموذج المطلوبة إلى المسار المحلي، والخادم وحده يتصل بمزود AI ويمرر المفتاح في ترويسات أو query parameters اللازمة.

## دعم المزودات

| النوع | إعدادات لازمة | طريقة اكتشاف الموديلات | طريقة الطلب |
|---|---|---|---|
| Google Gemini | المفتاح فقط | `GET /v1beta/models?key=...` مع pagination | Gemini `generateContent` |
| OpenAI | المفتاح | `GET /v1/models` مع Bearer | `/chat/completions` |
| Groq / Mistral | المفتاح | OpenAI-compatible `/models` | `/chat/completions` |
| Custom / OpenRouter | المفتاح وBase URL | Base URL + `/models` أو Models URL مخصص | Base URL + `/chat/completions` أو Chat URL مخصص |

القائمة الموحدة تطبع معرفات Google بعد إزالة البادئة `models/`، وتفهم صيغ `data[].id` و`models[].name` و`model` و`model_name`. يتم دعم pagination في Google حتى عشر صفحات وبحد أقصى 2000 موديل في الاستجابة.

### طريقة إضافة API مخصص

من لوحة **AI** اختر `Custom / OpenRouter / أي API`، ثم أدخل المفتاح وBase URL. اترك Models URL فارغاً إذا كان مزودك يستخدم `Base URL/models`. اترك Chat URL فارغاً إذا كان يستخدم `Base URL/chat/completions`. إذا كان المزود يستخدم مسارات مختلفة، أدخل الرابطين كاملين. اضغط **تحميل الموديلات المتاحة**، اختر الموديل، ثم **حفظ مشفر**.

المسار العام الحالي يفترض صيغة OpenAI-compatible للطلب. لذلك فإن عبارة «أي API» تعني أي API يوفّر هذه العقود أو يسمح بتحديد Models URL وChat URL مع جسم طلب متوافق. APIs التي تستخدم GraphQL أو جسم طلب خاصاً تماماً تحتاج Adapter جديداً في `src/app/api/ai/route.ts`، وقد أصبحت إضافة ذلك محصورة في طبقة المحول لا في بقية المنصة.

## نظام بوت Telegram

أضيفت لوحة **بوت تقارير أولياء الأمور** داخل SettingsPanel. تحفظ المنصة Bot Token وWebhook Secret بتشفير مستقل عن مفاتيح AI وMoodle. يمكن للمدرس حفظ الإعداد، اختبار البوت، تحديد نمط الإرسال، تسجيل Webhook HTTPS، ثم تحديث أكواد الطلاب.

لكل طالب كود من نمط `BS-2026-XXXXXXXX`. يعطي المدرس الكود لولي الأمر، فيرسل ولي الأمر `/start` ثم الكود إلى البوت. يتأكد Webhook من `X-Telegram-Bot-Api-Secret-Token` قبل معالجة الرسالة، ثم يحفظ Chat ID واسم المستخدم على الطالب. لا يتم الربط لمجرد فتح المنصة ولا يدخل ولي الأمر إلى غرفة العمليات.

عند الإرسال اليدوي أو الإرسال بعد الحصة، ينشئ الخادم PDF عربي من صفحة واحدة بخط Amiri، ويرسل الملف عبر `sendDocument` مع ملخص HTML. التقرير يتضمن الطالب والنقاط والإجابات الصحيحة والأخطاء والمحاولات والدقة والشارات وملاحظة أن قرار المدرس هو المرجع النهائي.

| الإرسال | الحالة |
|---|---|
| إرسال تقرير طالب يدوياً | منفذ من لوحة Telegram |
| إرسال كل التقارير المربوطة يدوياً | منفذ من لوحة Telegram |
| إرسال تلقائي بعد نجاح إنهاء الحصة | منفذ، fire-and-forget، ولا يعطل الجلسة المحلية |
| أسبوعي | الإعداد محفوظ كخيار ومكان التوسعة جاهز؛ يحتاج جدولة مستمرة خارج عملية المتصفح |
| شهري | الإعداد محفوظ كخيار ومكان التوسعة جاهز؛ يحتاج جدولة مستمرة خارج عملية المتصفح |

لا يُنصح بتشغيل جدولة أسبوعية أو شهرية من `setInterval` داخل المتصفح؛ عند تحويلها إلى تشغيل دائم ينبغي ربط endpoint `sendSessionReports` بجدولة مستمرة قابلة للإيقاف، مع إبقاء القرار والبيانات في SQLite.

## أماكن التفاصيل التي يمكن تغييرها لاحقاً

| المطلوب تغييره | مكانه |
|---|---|
| قالب رسالة ولي الأمر | دالة `sendSummary` في `src/app/api/telegram/route.ts` |
| محتوى PDF وخطوطه وتنسيقه | `src/lib/telegram-report-pdf.ts` و`public/fonts/Amiri-Regular.ttf` |
| حقول التقرير المستقبلية | type `TelegramReportInput` في `src/lib/telegram-report-pdf.ts` |
| شروط الإرسال بعد الحصة | `sendSessionReports` في `src/app/api/telegram/route.ts` وhook `endCurrentSession` في `src/lib/shell-store.ts` |
| نمط الجدولة | `TelegramSettings` و`TelegramPanel.tsx` |
| Adapter API جديد | `src/app/api/ai/model-discovery.ts` و`src/app/api/ai/route.ts` |
| أسماء المزودات الافتراضية | `PROVIDER_CONFIG` في `src/app/api/ai/route.ts` |
| سياسة اختيار الموديلات | `mapModel` في `src/app/api/ai/model-discovery.ts` |

## الأمان والتشغيل المحلي

يُخزّن Telegram في namespace مستقل داخل `AppSettings.settingsJson` وبمفتاح `.telegram-key-secret` مستقل. لا يظهر Token أو `tokenEncrypted` في GET أو واجهة المتصفح. عند غياب Telegram أو فشل الشبكة، تستمر الجلسة المحلية ولا تفشل عملية إنهاء الحصة. وبالمثل لا يدخل Telegram Token إلى `getCandidates()` الخاصة بالـAI.

إعداد Webhook يحتاج رابط HTTPS عام. Telegram يرسل تحديثات POST إلى الرابط ويقبل `secret_token` للتحقق من المصدر؛ كما أن webhook وgetUpdates طريقتان متبادلتان بحسب الوثائق الرسمية [1]. يدعم OpenAI endpoint `GET /models` مع Bearer ويعيد `data[].id` [2]، بينما Google يوفر `models.list` مع `nextPageToken` وحقول `supportedGenerationMethods` [3].

## نتائج الاختبار

| الاختبار | النتيجة |
|---|---:|
| TypeScript | ناجح، 0 أخطاء |
| ESLint | ناجح، 0 أخطاء، تحذيران سابقان فقط لاستخدام `<img>` |
| production build | ناجح، مع تحذير tracing سابق في مسار backup |
| محرك الرياضيات | 17/17 |
| API contract matrix | 10/10 |
| scenario matrix | 10000/10000 |
| Custom model preview mock | موديلان مكتشفان: `mock/alpha` و`mock/beta` |
| Custom key lifecycle | create ثم list models ثم delete، ناجح |
| Telegram safe config | Token غير ظاهر في GET، ثم reset ناجح |
| Telegram Arabic PDF | PDF صالح، صفحة واحدة، 10978 bytes، `pdfinfo` ناجح |
| HTTP production smoke | `/` و`/grades` و`/api/ai` و`/api/telegram` أعادت 200 |

## التشغيل والمعاينة

```bash
cd /home/ubuntu/bisalasa-full-audit
DATABASE_URL='file:/home/ubuntu/bisalasa-full-audit/data/custom.db' pnpm run build
PORT=3010 NODE_ENV=production DATABASE_URL='file:/home/ubuntu/bisalasa-full-audit/data/custom.db' pnpm start
```

رابط المعاينة المؤقت: [فتح منصة بسلاسة](https://3010-ik65uzbdda20igzsnjw3a-48af3c8f.sg1.manus.computer)

## المراجع

[1]: https://core.telegram.org/bots/api "Telegram Bot API — official documentation"

[2]: https://developers.openai.com/api/reference/resources/models/methods/list "OpenAI — List models"

[3]: https://ai.google.dev/api/models "Google Gemini API — Models"
