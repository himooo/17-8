> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# تقرير QA العالمي النهائي — منصة بسلاسة

**المشروع:** بسلاسة — غرفة عمليات المدرس  
**تاريخ الإغلاق:** 14 أغسطس 2026  
**نطاق التحقق:** الكود، قاعدة البيانات، عقود API، المتصفح، AI، الألعاب، السبورة، التقارير، الاحتفالات، Moodle، Custom App، Telegram Demo، الأمن، وفشل الخدمات.

## 1. الحكم التنفيذي

تم تنفيذ جولة QA شاملة على المنصة وفق فلسفتها الأصلية: **المدرس هو صاحب القرار، والطلاب لا يسجلون الدخول إلى المنصة، ومشهد الطلاب مخصص للعرض عبر OBS أو Zoom، بينما تبقى أدوات الإدارة وAI والنوتس والتقارير داخل غرفة المدرس**. النتيجة النهائية للإصدار بعد الإصلاحات هي **PASS** على مستوى TypeScript وBuild وMaster Plan Audit، مع نجاح جميع الحزم الآلية المعاد تشغيلها وعدم وجود أخطاء lint مانعة.

أظهر الاختبار البصري أن `/?view=student` يعرض مشهد الشريحة/السبورة فقط ولا يكشف لوحات المدرس أو AI أو Notes أو محرر الدرس. كما نجحت مسارات إضافة وتعديل وحذف الطلاب والفصول، النقل والتكرار وorphan وautoSplit، الحضور، المكافآت، التقارير الفردية، الألعاب، السبورة، الاحتفالات، المتصدرين، التحدي الأسبوعي، كارت الطالب، وصفحة الدرجات.

## 2. مصفوفة النتائج الرقمية

| المجال | عدد السيناريوهات/الاختبارات | النتيجة |
|---|---:|---|
| إدارة الطلاب والفصول والمجموعات | 73 | 73 ناجح، 0 فشل |
| العلاقات والتزامن والحذف التاريخي | 50 | 50 ناجح، 0 فشل |
| AI عبر Mock API | 21 | 21 ناجح، 0 فشل |
| Moodle / Custom App / Telegram Demo | 30 | 30 ناجح، 0 فشل |
| مصفوفة السيناريوهات الموسعة | 25,000 | 25,000 ناجح، 0 فشل |
| مصفوفة السيناريوهات العامة | 10,000 | 10,000 ناجح، 0 فشل |
| API contract matrix | 10 | 10 ناجح |
| Math engine smoke | 17 | 17 ناجح |
| Moodle security smoke | 4 | 4 ناجح، ولا يظهر plaintext داخل ciphertext |
| Telegram report smoke | 3 | 3 ناجح، حجم التقرير 10,977 bytes |
| Master Plan V5 Audit | 8 محاور رئيسية | جميع البنود PASS |
| TypeScript | — | PASS، 0 أخطاء |
| Lint | — | PASS، 0 أخطاء و2 تحذير غير مانع |
| Production build | — | PASS عبر Webpack production build |

في المصفوفة العامة كان هناك **5,060 سيناريو قابلاً للعب** و**4,940 سيناريو محجوباً أو فارغاً بصورة متوقعة**؛ وفي المصفوفة الموسعة كانت النتيجة 25,000/25,000. الحجب المقصود يثبت أن الأسئلة غير القابلة للعب لا تدخل game pool، وهو سلوك أمان وصحة بيانات وليس فشلاً.

## 3. اختبارات المتصفح

| المسار | ما تم التحقق منه | الحكم |
|---|---|---|
| Student View SSR | عزل الشريحة/السبورة، غياب أدوات المدرس وAI وNotes | PASS |
| StudentsPanel | إضافة فردية، منع التكرار، bulk dedupe، الغياب، المكافآت، الملاحظة، التقرير الفردي | PASS |
| ClassesPanel | إنشاء، تعديل حقيقي عبر update، تنشيط، حذف، استيراد جماعي ومنع تكرار | PASS |
| Attendance | مسح اليوم، تبديل الغياب، حفظ السجل | PASS |
| GroupsPanel | autoSplit، استبعاد الغائب، عرض ungrouped الصحيح، وعدم عرض جميع الطلاب بعد التطبيع | PASS |
| Reports | خمسة مسارات PDF عربية وتنزيل فعلي، JSON للتقرير الفردي، liveStatus وinteractiveLesson | PASS |
| Games | سؤال المنهج، الرياضيات، الذاكرة، عجلة الحظ، الصندوق الغامض، النرد، رد الفعل، عجلة الطلاب | PASS |
| Whiteboard | Math Lab، الأدوات الرياضية، اختيار المثلث وتفعيل السبورة فورياً، AI draft bridge | PASS بعد الإصلاح |
| Celebrations | 36 افتراضياً، تشغيل confetti، إضافة احتفال عربي مخصص، عداد 37، render modes | PASS |
| Leaderboard | session/lifetime، podium، تحديث النقاط | PASS |
| Weekly challenge | أسبوع البداية، العتبة، top-3، عدم اختلاق فائز | PASS |
| Student Card | اختيار الطالب، session/lifetime/DNA، الشارات والهدايا والتقدم | PASS |
| Grades | `/grades`، صف نشط، classId/sessionId، الأعمدة العربية، الطباعة | PASS |
| Lesson Editor | تعديل title/script/notes، حفظ manifestJson، إعادة فتح بعد persist | PASS |
| AI Panel | tabs، toggles، model discovery، custom provider، rotation، structured output | PASS بعد الإصلاح |

## 4. العيوب التي اكتُشفت وأُصلحت

### 4.1 مسودة AI على السبورة كانت تعرض JSON خاماً

كشف الاختبار البصري أن `insertWhiteboardDraft` كان يستخدم `JSON.stringify` عندما تعيد العملية المنظمة نتيجة equation بلا `boardText`. لذلك كانت مفاتيح التنفيذ مثل `kind` و`latex` و`steps` تظهر على الشريحة. تم تعديل formatter في `AiPanel.tsx` ليحوّل النتيجة إلى نص قابل للمراجعة: عنوان، نص المسألة، صيغة LaTeX، وخطوات مرقمة، مع fallback عربي آمن لا يعرض البنية البرمجية.

بعد الإصلاح نجحت العملية عبر المتصفح: أعاد Mock النتيجة المنظمة، وأصبح textarea السبورة يحتوي نصاً منسقاً مثل «تبسيط كسر»، «تبسيط 2/4»، صيغة الكسر، و«الخطوات: 1. اقسم البسط والمقام على 2». يظل اعتماد المدرس مطلوباً قبل الالتزام النهائي، اتساقاً مع فلسفة المنصة.

### 4.2 فقدان مفاتيح AI المشفرة بعد إعادة تشغيل build

كشف اختبار restart أن fallback السابق كان يحفظ `.ai-key-secret` داخل `.next/standalone/data`، وهو مسار قابل للاستبدال أثناء build جديد. كانت النتيجة ظهور `تعذر فك تشفير المفتاح` وتحويل المفتاح إلى `needs-check` بعد restart. تم إصلاح `src/lib/ai-key-crypto.ts` ليستخدم مساراً ثابتاً بجوار ملف SQLite عند استخدام `DATABASE_URL=file:...`، أو المسار الصريح `BISALASA_AI_KEY_SECRET_FILE`، أو `BISALASA_DATA_DIR`.

بعد الإصلاح أُنشئ مفتاح QA Mock جديد تحت secret ثابت، ثم أُعيد تشغيل الخادم. نجح الاختبار من المتصفح بنتيجة `نجاح 1 · فشل 0` ورسالة `الاتصال ناجح عبر mock-math-pro`. كما نجحت model discovery والتحليلات المنظمة وتوليد الأسئلة بعد إعادة التشغيل.

### 4.3 إصلاحات الجولات السابقة التي أعيد التحقق منها

تمت إعادة التحقق من إصلاح parser في `StudentReportPanel.tsx`، التقرير الموحد وحقلي `liveStatus` و`interactiveLesson` في PDF/JSON، تفعيل السبورة الفوري، `saveClass` باستخدام update، محرر الفصل المملوء بالقيم الحالية، HTTP 400 لأخطاء الإدخال، تطبيع `studentIds` في autoSplit، nullable historical references، `detachStudentHistory`، و`isPlayableQuestion` لاستبعاد الأسئلة بلا options أو correctAnswer.

## 5. الأمن والتكاملات وفشل الخدمات

استخدم الاختبار Telegram Demo وMock Integrations فقط، دون إرسال رسائل حقيقية أو استخدام بيانات أولياء أمور حقيقية. اختبارات Telegram وMoodle أثبتت تشفير الأسرار وعدم ظهور plaintext، والتحقق من webhook secret، والاستجابة الآمنة لفشل المزود. اختبار AI استخدم مفتاحاً تجريبياً محلياً، وسجل مسار 401 بصورة آمنة مع تدوير إلى المفتاح التالي، دون عرض السر كاملاً.

جميع عمليات AI بقيت اختيارية، ولم تُرسل أسماء الطلاب أو سجلهم إلى Mock لأن خيار سياق الدرس لم يكن مطلوباً للاختبار. كما بقيت الموافقة اليدوية شرطاً قبل اعتماد أسئلة AI للألعاب، واعتمد المدرس الأسئلة كمصدر مستقل بدلاً من خلطها تلقائياً بالمنهج الأساسي.

## 6. ملاحظات UX والتشغيل

تظهر نافذة تأكيد استكمال الجلسة المحفوظة بعد reload. هذا سلوك مقصود لحماية جلسة المدرس، لكنه قد يحتاج لاحقاً إلى تحسين UX مثل عرض وقت الجلسة واسم الفصل وزري «استكمال» و«بدء جلسة جديدة» بوضوح أكبر.

أثناء الاختبار بقيت بعض آثار JSON الخام القديمة على canvas لأن state قديمة كانت قد التزمت قبل الإصلاح في localStorage. هذا ليس ناتجاً من مسار الإدراج الجديد؛ الإدراج الجديد يفتح نصاً منسقاً قابلاً للتعديل. قبل التسليم النظيف يجب استخدام reset للسبورة أو مسح state القديمة، أو إضافة migration اختيارية لمسح strokes القديمة التي تحمل بصمة JSON من اختبار سابق.

يظل في lint تحذيران غير مانعين في `IframeStage.tsx` و`StudentCard.tsx` بسبب استخدام `<img>` بدلاً من `next/image`. لا يؤثران على صحة الوظائف أو build، ويمكن تحسينهما في جولة أداء مستقلة.

## 7. فلسفة المنتج وحدود الرؤية

المنصة ليست LMS يتطلب دخول الطالب. المعلم يدير الحصة من غرفة العمليات، ويعرض المشهد عبر OBS أو Zoom. لذلك اعتُبر كشف لوحات AI أو Notes أو التقارير في Student View فشلاً أمنياً، بينما اعتُبر ظهور الشريحة والسبورة والاحتفال ومخرجات التفاعل التعليمية سلوكاً صحيحاً. جميع الإصلاحات حافظت على هذا الحد الفاصل.

## 8. أدلة إعادة التشغيل

| الدليل | المسار |
|---|---|
| نتائج المتصفح | `qa-browser-full-findings.md` |
| طلاب/فصول/مجموعات | `qa-student-class-group-e2e.json` |
| علاقات وتزامن | `qa-db-relational-concurrency.json` |
| AI Mock | `qa-ai-mock-e2e.json` |
| Integrations Demo | `qa-integrations-demo-e2e.json` |
| السيناريوهات الموسعة | `qa_extended_scenario_summary.json` |
| مصفوفة API | `scripts/api_contract_matrix_v4.py` |
| Smoke الأمن والرياضيات | `scripts/moodle-security-smoke.ts`, `scripts/telegram-report-smoke.ts`, `scripts/math-engine-smoke.ts` |

أوامر إعادة التشغيل الأساسية هي:

```bash
cd bisalasa-full-audit
pnpm exec tsc --noEmit
pnpm run lint
DATABASE_URL='file:$PWD/data/custom.db' pnpm exec next build --webpack
python3 scenario_matrix_10000.py
python3 scripts/qa_scenario_matrix_extended.py
node scripts/student-class-group-e2e.cjs
node scripts/db-relational-concurrency-e2e.cjs
node scripts/ai-mock-e2e.cjs
node scripts/integrations-demo-e2e.cjs
```

## 9. الخلاصة النهائية

الإصدار المختبر **قابل للتسليم** وفق نطاق QA المحدد. لا توجد أخطاء TypeScript أو Build أو API contract أو security smoke أو regression suite. العيبان الحقيقيان اللذان ظهرا في هذه الجولة، وهما عرض JSON الخام على السبورة وفقدان secret بعد restart، تم إصلاحهما وإعادة اختبارهـما بالمتصفح وبـproduction build. التحذيران المتبقيان في lint غير مانعين، وملاحظة state القديمة على canvas تخص بيانات اختبار محفوظة وليست خللاً في formatter الجديد.

**المؤلف:** Manus AI  
**المشروع:** بسالسة — غرفة عمليات المدرس
