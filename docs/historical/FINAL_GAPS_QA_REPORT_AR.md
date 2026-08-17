> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# تقرير إغلاق النواقص وإعادة QA — بسالسة

## الملخص التنفيذي

تمت مراجعة المتطلبات السابقة مقابل الشيفرة الفعلية، ثم إغلاق **سبعة مسارات نقص أساسية**: محرر الدرس الكامل، تزامن السبورة، Smart Context، AI Copilot المنظم، Live App inbound، مؤشر فهم الفكرة، وربط النتائج بالتقارير وTelegram. كما كُشف وأُصلح عيب بصري حقيقي في PDF العربي بعد فحص الصفحة بصرياً؛ الإصلاح النهائي يستخدم ArabicReshaper وbidi-js وخط Amiri الكامل بدون subsetting.

> فلسفة المنصة محفوظة: Moodle مكان الحل والواجب، بسالسة تسحب وتحلل فقط؛ الطالب لا يحتاج إلى دخول غرفة عمليات بسالسة؛ AI يقترح ولا ينفذ تلقائياً؛ وتفعيل Live App inbound اختياري ومغلق افتراضياً.

## ما تم إغلاقه

| المسار | التنفيذ النهائي | دليل القبول |
|---|---|---|
| تعديل الدرس وLessonEditorPanel | محرر فعلي للعنوان والوصف والأفكار والخطوات والسكريبت والملاحظات وأسئلة الخطوة، مع إضافة/حذف/ترتيب وvalidation وundo/reset وحفظ ذري وإعادة تحميل | `lesson-editor-smoke.cjs`: ‏7/7 |
| تزامن السبورة | BroadcastChannel محلي، revision monotonic لكل شريحة، منع echo، debounce، snapshot bounded إلى 2000 stroke، وlocalStorage fallback | `whiteboard-sync-smoke.cjs`: ‏8/8 |
| Smart Context | aggregator موحد للـmanifest والهدف والخطوات السابقة والحالية والأسئلة وLessonContext والإحصاءات المجهولة، بحد حجم وsanitizer يمنع الاسم والمعرف والرموز | `smart-context-smoke.ts`: ‏6/6 |
| AI Lesson Copilot | أربع أدوات في التليبرومبتر، مصدر الموديل ووقت الاقتراح، حالات pending/approved/rejected، واعتماد صريح قبل إرسال النص إلى السبورة | `ai-mock-e2e.cjs`: ‏21/21، و`ai-limits-e2e.cjs`: ‏7/7 |
| Live App inbound | `POST /api/live-sync` مع eventId deduplication، والتحقق من الطالب، وتسجيل StudentActivity؛ `GET` بسياق `since` و`lessonId`؛ polling اختياري للمعلم | `live-sync-smoke.cjs`: ‏8/8 |
| Heatmap/الفهم | مؤشر فهم للفكرة الحالية في TopStatusBar وتنبيه عند أقل من 50%، مع عدم تنفيذ أي تدخل تلقائي | ظاهر في UI ومرت privacy smoke |
| الربط بالتقارير وTelegram | تقارير Telegram تجمع Moodle وLive App حسب الفكرة، وتعيد `moodleIncluded` و`liveAppIncluded`، وتضم القسمين في PDF | integration demo ‏32/32، PDF smoke ‏6/6 |

## إصلاح PDF العربي

أظهر الفحص البصري الأول أن الحروف العربية كانت مفككة. تم اختبار أكثر من مسار، ثم اعتماد المسار الذي أعاد نصاً عربياً متصلاً ومقروءاً بصرياً: تشكيل ArabicReshaper، إعادة ترتيب bidi-js، وخط Amiri-Regular كاملاً عبر `subset: false`. PDF النهائي صفحة A4 سليمة ويحتوي قسم واجب Moodle وقسم حل App التفاعلي وتحليل الفكرة. قد يعرض `pdftotext` النص المشكّل بترتيب بصري غير مألوف؛ الحكم المعتمد هو العرض المرئي داخل PDF، وقد تمت معاينته بعد الإصلاح.

## نتائج الاختبارات النهائية

| المجموعة | النتيجة |
|---|---:|
| Next production build مع Webpack | PASS |
| TypeScript `tsc --noEmit` | PASS |
| ESLint | PASS مع تحذيرين غير مانعين عن استخدام `<img>` في مكونين قديمين |
| Lesson Editor persistence | 7/7 |
| Live Sync وidempotency وfeed | 8/8 |
| Smart Context/privacy/size | 6/6 |
| Whiteboard sync static contract | 8/8 |
| AI mock workflow | 21/21 |
| AI limits/fallback rotation | 7/7 |
| Moodle mapping على قاعدة نظيفة | 18/18 |
| Moodle homework على قاعدة نظيفة | 16/16 |
| Moodle live sync/idempotency على قاعدة نظيفة | 12/12 |
| Telegram + Moodle + Live App integration | 32/32 |
| API contract matrix | 10/10 |
| Math engine | 20/20 |
| Student View privacy | 8/8 |
| مصفوفة السيناريو الموسعة السابقة | 10,000/10,000 و25,000/25,000 |

ظهرت في إحدى جولات Moodle نتيجة `5 مقابل 1` بسبب إعادة تشغيل الاختبار على قاعدة QA ملوثة بمحاولات سابقة؛ أعيدت الجولات الثلاث على `/tmp/bisalasa-qa-gaps-clean.db` جديدة، ونجحت كاملة. لذلك لا تُسجل النتيجة القديمة كفشل منتج.

## ما تبقى خارج الإغلاق الحالي

هناك مسارات مستقبلية ظهرت في البرومبت لكنها ليست جزءاً من النواقص السبعة القابلة للإغلاق الآمن داخل هذه الجولة: SpeechRecognition/Silent Listener، Predictive Mastery طويل المدى، Smart Recovery التنبؤي، وتوليد App-live questions بصورة مستقلة. لا يتم تشغيل أي منها تلقائياً؛ إدخالها يحتاج عقد خصوصية وموافقة مدرس وتصميم تجريبي منفصل، حتى لا يتحول AI إلى منفذ أو يرسل بيانات الطلاب بلا قرار.

أما Browser harness الداخلي، فقد أعاد الصفحة والـchunks بحالة 200 وأظهر جميع الأزرار، لكنه لم ينفذ React event handlers عند النقر الاصطناعي، وهي قيود سبق توثيقها. لذلك تم اعتماد API/smoke/build/privacy tests للوظيفة، مع توثيق هذه الملاحظة وعدم الادعاء بأن النقر المرئي نجح.

## الملفات الجديدة أو المعدلة الأهم

`src/components/shell/LessonEditorPanel.tsx`، `src/components/shell/SmartWhiteboard.tsx`، `src/components/shell/DraggableTeleprompter.tsx`، `src/components/shell/LiveSyncBridge.tsx`، `src/components/shell/TopStatusBar.tsx`، `src/components/shell/panels/CustomAppPanel.tsx`، `src/app/api/live-sync/route.ts`، `src/app/api/telegram/route.ts`، `src/lib/smart-context.ts`، `src/lib/telegram-report-pdf.ts`، `scripts/live-sync-smoke.cjs`، `scripts/smart-context-smoke.ts`، `scripts/whiteboard-sync-smoke.cjs`، و`qa-gaps-browser-findings.md`.

## المعاينة والحزمة

رابط المعاينة المحلي المعرّض سابقاً هو:

`https://3012-ik65uzbdda20igzsnjw3a-48af3c8f.sg1.manus.computer/`

ومشهد الطلاب المنفصل هو إضافة `?view=student`. سيتم إنشاء أرشيف مصدر محدث يستبعد `node_modules` و`.next` وقواعد SQLite والأسرار، ويضم هذا التقرير وملفات الاختبار والتوثيق.
