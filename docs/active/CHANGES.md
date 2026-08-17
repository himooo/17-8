# سجل التغييرات الموحد — بسلاسة

**آخر تحديث:** 17 أغسطس 2026 (جولة الاستقرار على Windows + حفظ نتائج الألعاب + تنظيف التوثيق والاعتماديات)

**مرجع الحالة الحالية:** `BISALASA-COMPLETE-DOCUMENTATION-AR.md`

## جولة 17 أغسطس 2026: استقرار + تغطية تقارير الألعاب + تنظيم

### إصلاحات منطقية (2)
- **T1 (عالي):** تجمّد ترقية الألقاب التلقائية — `refreshTitle` كان يقارن أسماء مجردة ("عبقري") بينما `computeTitle` يخزّن "🧠 عبقري" بإيموجي، فلم يكن أي لقب تلقائي يُطابق `AUTO_TITLES` بعد أول إسناد. أصبحت المقارنة تُبنى من `TITLE_RULES` نفسها (بالإيموجي) وتُحدَّد الترقية الكبرى بمعرّف القاعدة (`genius`/`champion`) — `src/lib/shell-store.ts`
- **T2:** `awardGoodTry` الآن يستدعي `refreshTitle` (منح النقطة قد يعبر عتبات بطل/نجم/أسطورة)

### تغطية التقارير (8 ملفات)
- **G1 (عالي):** 7 ألعاب لم تكن تكتب `GameResult` إطلاقاً فتغيب نتائجها عن التقارير: MathChallenge وMemory وMysteryBox وHotPotato وDiceRoll وReactionTime وLuckyWheel. أُضيف `src/lib/game-result-recorder.ts` (hook مشترك بنفس عقد QuickFire: ensure→answer→finish→complete) ودمج في الألعاب السبع. ألعاب الحظ تسجل المشاركين فقط دون صفوف أسئلة كي لا تلوث إحصاءات الدقة المعرفية.

### أمان (إصلاح انحدار من C15)
- **A1:** وسط المصادقة كان يحجب `/api/moodle/webhook` و`/api/live-sync` — وهما نقاطا تكامل machine-to-machine بمصادقة HMAC/سر مشترك داخل المسار نفسه. أُعفيا من فحص الرمز مع بقاء تحقق التوقيع كاملاً — `src/middleware.ts`
- **A2 (عالي):** بادئات الحماية كانت تنتهي بشرطة مائلة فلا تطابق المسار التام `/api/ai` — ومسار AI نفسه بلا أي فحص مصادقة داخلي، فكانت إدارة مفاتيح المزودين والتوليد متاحين بلا رمز على الشبكة المحلية. حُذفت الشرطات من كل البادئات — `src/middleware.ts`

### بنية تحتية للاختبارات (دين اختبارات أحدثته جولة 16 أغسطس)
- **W8 (عالي):** منظّف مشغّل v10 كان يحذف ملف القاعدة فقط دون ملفات `-wal`/`-shm` الجانبية — تعيد SQLite تشغيل WAL قديم فوق النسخة الجديدة فتُبعث صفوف من جولات/سويتات سابقة (تلوث عابر للجولات، هو سبب اختيار مفاتيح AI خاطئة في ai-limits). أصبح الحذف يشمل الشجرة كاملة قبل النسخ وبعده — `scripts/v10-complete-suite.cjs`
- **W9:** ستة اختبارات كانت تتحقق ضد العقد القديم ما قبل C18/C20 (بذر نقاط عبر upsert، مفتاح إعدادات مخصص، parentPhone عبر update) — حُدّثت للعقد الحالي (بذر عبر students.award*، مفتاح whitelisted، رفض parentPhone)
- **W10:** `ai-limits`/`operational`/`live-sync`/`reports-*`/`db-relational`/`student-class-group`/`integrations-demo` رُقعت بالمصادقة عبر `scripts/lib/api-client.cjs`
- **W11:** سكريبتات بـ `/tmp` الصريح تحولت إلى `os.tmpdir()` (Windows)
- **W12:** `moodle-live-sync-e2e` صار يبذر config وخرائط course 77 ذاتياً (قواعد السويتات المعزولة تبدأ فارغة)

### توافق Windows والبيئة (7)
- **W1:** توحيد مسار قاعدة البيانات في `file:../data/custom.db` (جذر المشروع `data/custom.db`) عبر `.env` — كان المسار النسبي القديم ينشئ قاعدة ثانية داخل `prisma/data` بينما سكريبتات الإنتاج تشير لجذر `data` (فقدان بيانات صامت محتمل)
- **W2:** `package.json`: سكريبتات dev/build/start/db كانت bash-only (tee/mkdir/export/cp) — أصبحت node متعددة المنصات (`scripts/build.cjs` + `scripts/start.cjs`)
- **W3:** `scripts/build.cjs` يتعامل مع انهيار خروج next المعروف على Windows (0xC0000409) بالتحقق من طزاجة المخرجات، وينسخ standalone عبر robocopy (fs.cpSync كان ينهار)
- **W4:** `@types/node` أُضيف كتبعية صريحة (كان الـbuild ينهار يحاول تثبيتها)
- **W5:** سكريبتات اختبار API لم تكن ترسل مصادقة بعد إضافة C15 (فشل 401 جماعي) — `scripts/lib/api-client.cjs` جديد (fetch موثق بكوكي whoami لكل origin) ودمج في 8 سكريبتات
- **W6:** `rewards-assets-v13-smoke` يعمل بدون python3/ffprobe (احتياط python + قراءة ترويسة WAV بـNode) — 74/74
- **W7:** مشغّل v10-complete يحل python3→python/py ويتخطى bash بصدق إن غاب

### تنظيف (3)
- **D1:** 25 مكوّن UI غير مستخدم + use-mobile حُذفت (تحقق صفر مراجع ثابتة وديناميكية)
- **D2:** 22 حزمة غير مستخدمة حُذفت من package.json (next-auth, z-ai-web-dev-sdk, react-query, react-table, zod, react-hook-form, dnd-kit×3, next-intl, next-themes, …) — -63 حزمة من node_modules
- **D3:** التوثيق نُظم: `docs/active/` (20) و`docs/historical/` (108) و`backups/`؛ أُصلحت 97 مرجعاً داخلية؛ README جذري جديد؛ حُذفت tsbuildinfo ومجلد db الفارغ

### التحقق
- **V10 Complete Suite: 32/32 ناجحة، 0 فشل** (و1 تخطٍّ صادق: master-plan-static-audit يتطلب bash/WSL غير المتوفر على جهاز Windows هذا) — النتيجة المؤرشفة في `docs/historical/v10-complete-suite-result-2026-08-17.json`
- TypeScript 0 أخطاء؛ ESLint 0 أخطاء وتحذيرات (src + scripts)
- Production build + standalone + start تعمل على Windows بمسار عربي؛ مسارات `/` و`/grades` و`/curriculum-factory` والشرائح والأصوات والهدايا كلها 200
- تحقق أمني: `/api/ai` و`/api/db/*` بلا رمز → 401 (الثغرة A2 مغلقة)، و`/api/moodle/webhook` يصل لمساره بمصادقة HMAC الخاصة به

---

## جولة 16 أغسطس 2026: الإصلاحات الأمنية وقاعدة البيانات

بعد مراجعة تحليلية شاملة (358 مشكلة مكتشفة، 41 حرجة)، أُجريت إصلاحات منهجية لجميع المشاكل الحرجة والمتقدمة. تم التحقق من جميع الإصلاحات بـ TypeScript (0 أخطاء) وفحص API (10/10 نجاح).

### الأمان (10 إصلاحات)
- **C15**: auth middleware جديد (`src/middleware.ts` + `src/lib/auth.ts` + `/api/auth/whoami`) يحمي كل `/api/*` برمز مشترك httpOnly cookie
- **C16**: `restoreAll` يتحقق من بنية الـJSON وقائمة بيضاء للجداول وحدود عدد الصفوف
- **C17**: `/api/backup?format=sql` معطّل (403) — كان يُنزّل ملف DB بالأسرار
- **C18**: `settings.set` قائمة بيضاء صارمة (45 مفتاح) — يرفض `apiToken`, `telegramToken`, `moodleToken`
- **C20**: أُزيلت `parentTelegramChatId`, `parentPhone`, `points`, `correctAnswers`, `lastCalled` من `students.upsert`/`update`
- **C21**: `scrubTelegramError` ينظف Bot Token من رسائل الأخطاء
- **C24**: `studentCode` أطول (16 hex chars بدل 8)
- **C25**: queue claims ذرّية (`updateMany` optimistic lock) لـ reports/ai/telegram
- **H3**: `awardPoints` يتحقق من integer بين -100 و100
- **H13**: `students.update` يسمح فقط بـ metadata آمنة

### قاعدة البيانات (8 إصلاحات)
- **C36**: `PRAGMA foreign_keys=ON`, `busy_timeout=5000`, `journal_mode=WAL` مفعّلة عبر `dbReady`
- **C37**: `@relation` مضافة لـ StudentActivity, StudentNote, CelebrationEvent, TeacherInteraction مع `onDelete: Cascade`
- **H1**: `detachStudentHistory` يُعالج 12 جدول بدل 4
- **C12**: `groups.autoSplit` في `db.$transaction` واحدة
- **H8**: `crypto.randomInt` بدل `Math.random` للتوزيع العادل

### الألعاب (5 إصلاحات)
- **C28**: `pickStudentFairDeferred` — العجلات لا تسجّل "تم الاستدعاء" إلا بعد اكتمال الدوران
- **C29**: QuizShowGame يحسب الفائز الفعلي (لا `isWinner: false` دائماً)
- **C30**: QuestionChallengeGame يحفظ مشاركي المجموعات (أزال `if (mode !== "group")`)
- **C33**: `closeBottomOverlays` يؤكد قبل إغلاق لعبة نشطة
- **C35**: LuckyWheelGame يستخدم deferred commit

### السبورة (3 إصلاحات)
- **P-WB-2**: `incremental draw` للقلم (O(1) بدل O(n) لكل pointermove)
- **H5**: `strokeBBox` بدل `Math.min(...xs)` لمنع crash للـstrokes الطويلة
- **P-WB-1**: `exportBoardPng` يدمج الشريحة + الكتابة عبر `html2canvas`

### State Management (3 إصلاحات)
- **C3**: `endCurrentSession` guard يتحقق `currentSessionId === id` بعد await
- **C6**: `recordStudentActivity` يستخدم `syncStudentAwardPoints` (atomic increment)
- **C7**: `pickRandomStudent` guard `if (isPicking) return`

### ملفات جديدة
- `src/lib/auth.ts` — API token authentication
- `src/middleware.ts` — Next.js edge middleware
- `src/app/api/auth/whoami/route.ts` — Token issuance endpoint

### التحقق
- TypeScript: 0 أخطاء
- ESLint: 0 أخطاء
- فحص API: 10/10 نجاح
- PRAGMA foreign_keys مفعّل ومُختبَر

---

## المرحلة الوظيفية الأولى: تثبيت المنصة

تم استكمال طبقة SQLite وPrisma وواجهات `/api/db/[operation]` وربطها بواجهة `local-db` typed. عولجت حالات الطلاب بلا فصل، النقل بين الفصول، المجموعات، الغياب، حذف الطالب وتنظيف المراجع، والجلسات والإحصاءات. أضيفت حماية للعمليات التي قد تتكرر بسبب النقر السريع أو إعادة المحاولة.

تم تثبيت contract الشريحة عبر manifest وcontroller و`postMessage`، وأصبح iframe معزولاً عن Shell. دعم الدرس الخطوات المسطحة والأفكار المتداخلة، مع script وnotes وquestions وassets.

## الألعاب والتفاعل

تمت مراجعة الألعاب الأساسية ومكونات اللعب، ومن بينها Quick Fire وMath Challenge وQuestion Challenge وQuiz Show وMemory وMystery Box وHot Potato وDice Roll وReaction Time، إضافة إلى عجلة الطلاب وأدوات المجموعات.

شملت الإصلاحات منع الإجابة المزدوجة، منع منح النقاط مرتين، تنظيف timers وintervals، منع اللعب لطالب غائب، منع التكرار الصامت للأسئلة، حماية الإغلاق أثناء الجولة، وتثبيت النتيجة مرة واحدة. أصبحت مصادر الأسئلة صريحة: الفكرة الحالية، كل الدرس، أو فكرة محددة؛ ولا يوجد fallback صامت إلى فكرة أخرى.

## السبورة والاحتفالات

تعمل `SmartWhiteboard` كطبقة فوق الشريحة وتضم أدوات الرسم الرياضي والأشكال والنص والتراجع والإعادة والمسح والليزر وفق الحالة الحالية للواجهة. تعتمد السبورة على RAF throttling ومزامنة revision وstorage fallback، ولا تُحمّل في وضع الطالب.

تم توحيد نظام الاحتفالات بحيث يمكن تشغيل نمط confetti أو particles أو كليهما عبر `renderMode` عند توفره، مع دعم تقليل الحركة. إطلاق الاحتفال يظل قراراً بيد المدرس ولا يوقف غرفة العمليات.

## الذكاء الاصطناعي الاختياري

أضيف `/api/ai` و`AiPanel.tsx` مع إدارة عدد غير محدود عملياً من مفاتيح providers، وlabel وpriority وmodel وحالة تفعيل، وتدوير عند limits أو فشل المفتاح. تخزن المفاتيح بـAES-256-GCM ولا تعاد القيمة الخام إلى العميل.

تدعم المنصة تحليل الدرس، Smart Context، توليد الأسئلة، أدوات المدرس، واكتشاف النماذج عندما يوفر provider endpoint لذلك. الاختبارات الحالية تستخدم mock provider؛ الاستدعاء الحقيقي لـGemini يحتاج مفتاح Google يضيفه مالك المنصة ويجب اختباره بسياسة خصوصية واضحة.

## التقارير وTelegram

أصبحت التقارير موحدة عبر نتائج الجلسة والألعاب وسجل النشاط وMoodle والواجبات. يظهر للمدرس حضور الطالب وإجاباته ونسبته ونتائج الأفكار وما تم التدخل فيه. يدعم Telegram إرسال التقرير وPDF العربي عند إعداد credentials صحيحة، مع fallback محلي عند فشل الخدمة الخارجية.

## Moodle

تم تطوير Moodle من mapping يدوي إلى discovery تلقائي للمقرر والأقسام والأنشطة والمجموعات والطلاب. يعتمد الربط على وسوم مثل `bisalasa:idea:lesson03:idea01` و`bisalasa:homework:lesson03`، ثم metadata الاسم، ثم fallback ترتيبي مع `confidence` و`needsReview`.

أضيف Delta Sync باستخدام cursor مستقل وprocessed keys وoverlap window وadaptive polling. أضيف webhook اختياري HMAC مع timestamp ومنع replay وduplicate، من دون كتابة إلى Moodle. التفاصيل في `MOODLE-INTEGRATION-REPORT.md`.

## جولة الأداء الأخيرة

تم تحويل 13 لعبة/مكوناً في `BottomControlBar.tsx` و14 مكوناً من teacher-shell إلى dynamic imports، وتأجيل Howler إلى أول صوت، وإضافة `WeakMap` caching لاستخراج الأسئلة، و`useDeferredValue` للبحث، و`content-visibility:auto` للصفوف، وفهارس `Student(classId,name)` و`StudentActivity(studentId,sessionId,type)`، وضبط `compress:true` و`poweredByHeader:false`. تم استبدال SheetJS غير الآمن بـ`write-excel-file/browser` lazy، مع إبقاء `sharp` dev-only لأدوات الصور.

انخفض chunk صفحة الدخول من 464KB إلى 135KB تقريباً، أي تحسن يقارب 70.9%. أحدث قياسات QA المحلية موثقة في `PERFORMANCE-OPTIMIZATION-REPORT.md`.

## بوابة الجودة الحالية

| الفحص | النتيجة الحالية |
|---|---|
| TypeScript | PASS — صفر أخطاء |
| ESLint | PASS — صفر أخطاء، تحذيران legacy فقط |
| Production build | PASS باستخدام webpack |
| Regression النهائي | PASS — 22 suite |
| Performance smoke | PASS — 6/6 endpoints |
| Master audit | PASS بالكامل |
| Moodle advanced smoke | PASS — 20 check |
| Moodle mapping | PASS — 18 check |
| Moodle homework | PASS — 16 check |
| Moodle live sync | PASS — 12 check |

## الحدود المعروفة

النسخة الحالية موجهة للتشغيل المحلي الفردي. SQLite مناسب لمدرس واحد، بينما يتطلب التشغيل متعدد المستخدمين اختبار PostgreSQL أو TiDB. قبل النشر العام يجب إضافة مصادقة وتفويض للعمليات الهدامة، CSRF، حدود حجم backup، وحماية إنتاجية للـwebhook.

تحذيرا ESLint الحاليان legacy متعلقان باستخدام `<img>` في مكونات قديمة. كما يبقى OffscreenCanvas feature gate اختيارياً، ولا يثبت أن نقله سيحسن الأداء قبل وجود قياس يبرر التغيير.

## الملفات المرجعية

| الملف | الوظيفة |
|---|---|
| `BISALASA-COMPLETE-DOCUMENTATION-AR.md` | التوثيق الكامل الحالي |
| `PERFORMANCE-OPTIMIZATION-REPORT.md` | الأداء والـregression |
| `MOODLE-INTEGRATION-REPORT.md` | Moodle والتشغيل والأمان |
| `MOODLE-REGRESSION-RESULTS.md` | نتائج اختبار Moodle |
| `public/slides/USER_GUIDE.md` | دليل المدرس |
| `public/slides/QUICKSTART.md` | البداية السريعة |
| `public/slides/VIBE_CODING_CONTRACT.md` | عقد الشرائح |

## تحديث 15 أغسطس 2026: Final 10/10 Closure

أُغلقت فجوة حقيقية ظهرت في browser QA: كان dispatcher يقارن `Origin` مع `new URL(req.url).origin`، ما يرفض الطلبات خلف reverse proxy أو localhost aliases برسالة «مصدر الطلب غير مسموح». أصبح التحقق يعتمد على `Host` و`X-Forwarded-Host/Proto` الموثوقين، مع بقاء cross-origin مرفوضاً بـ403. التحقق الفعلي: same-origin `reports.class` أعاد 200، و`https://evil.example` أعاد 403.

أزيلت ثغرات dependencies الإنتاجية: `npm audit --omit=dev` أعاد **0 vulnerabilities** بعد إزالة `xlsx` و`@mdxeditor/editor` و`react-syntax-highlighter` من الإنتاج واستبدال XLSX بـ`write-excel-file/browser`; بقي `sharp` في devDependencies فقط. أُعيد تشغيل TypeScript وESLint وproduction build بنجاح.

أُعيد تشغيل `npm run test:v10:complete` من baseline seeded مع Moodle mapping fixture مستقل، فكانت النتيجة **34/34 PASS، 0 FAIL**. في browser QA 3042 أصبح التقرير الموحد جاهزاً، ونجحت تنزيلات `bisalasa-class-report.xlsx` و`bisalasa-games.xlsx` وCSV، كما نجح PDF العربي بصرياً وظهر RTL بلا قص.

## التشغيل المختصر

```bash
cd bisalasa-full-audit
pnpm install
pnpm exec prisma generate
DATABASE_URL='file:./data/custom.db' pnpm exec prisma db push
DATABASE_URL='file:./data/custom.db' pnpm run build
DATABASE_URL='file:./data/custom.db' pnpm run start
```

لا يتضمن archive النهائي `.env` أو `node_modules` أو `.next` أو قواعد SQLite الخاصة بالاختبار.


## تحديث 15 أغسطس 2026: Curriculum Factory

أضيف مسار مستقل `/curriculum-factory` خاص بالمدرس، مع نقطة دخول من شريط المدرس دون تحميله في عرض الطالب. يعمل المصنع عبر خمس مراحل: الإدخال الخام، الهيكلة والسكريبت، بنك الأسئلة، التوزيع والربط، ثم الخَبز والتصدير.

أضيفت نماذج `CurriculumFactoryDraft` و`CurriculumPromptTemplate` إلى Prisma، مع عمليات DB typed للحفظ المرحلي، القراءة، الحذف، القوالب، والخبز الذري. الخَبز ينشئ أو يحدّث `ImportedLesson` ويستبدل `LessonQuestion` في معاملة واحدة، ثم يضع المسودة في حالة `baked`.

يدعم المصنع AI الاختياري عبر `aiClient` الحالي وتدوير المفاتيح الموجود، ويعرض كل ناتج AI كمقترح قابل للمراجعة. أضيفت قوالب قابلة للتعديل للهيكلة وتوليد الأسئلة والمراجعة التربوية. كما يدعم الهيكلة الأولية بدون AI من النص الخام حتى لا تتوقف وظيفة إعداد الدرس عند عدم وجود مفتاح.

أضيفت مطابقة تلقائية للأسئلة بالـ`ideaId` والوسوم مع حالة `needs-review` للعناصر غير المؤكدة، وفحص جودة يمنع الخَبز عند غياب Manifest صالح أو سؤال MCQ لا يحتوي إجابته الصحيحة داخل خياراته. يدعم التصدير Moodle XML مع `generalfeedback` وخطوات الحل والوسوم، وحزمة JSON قابلة للاستيراد كمسودة.

تم تحديث `/api/backup` ليشمل مسودات المصنع وقوالبه. أضيف `scripts/curriculum-factory-smoke.cjs` ونجح في 15 checks. كما نجح TypeScript وproduction build وPerformance Smoke وMaster Audit بعد التغيير.

## تحديث 7-Star: مصنع المناهج المتقدم

أضيفت إعدادات AI مستقلة للهيكلة والأسئلة والتحسين، مع provider وmodel وtemperature وmaxOutputTokens وkeyId، وسحب الموديلات من endpoint المزود من خلال الخادم. لا تُحفظ المفاتيح في المسودة، ويظل التدوير حسب الأولوية والفشل والحدود مسؤولية `/api/ai`.

أصبح توليد الأسئلة دقيقاً حسب الفكرة والنوع (MCQ أو صح/خطأ أو مقالي) والصعوبة والعدد، مع استخراج الأسئلة الموجودة في النص الخام، وتحسين سؤال منفرد، وتوليد بدائل خاطئة. أضيف Quality Gate بنتيجة لكل سؤال يفحص الخيارات والإجابة والتكرار والطول وخطوات الحل، ولا يسمح الخَبز بأخطاء الجودة.

أصبح Moodle XML يدعم أنواع الأسئلة الثلاثة، وتحويل LaTeX inline وdisplay، وshuffle ثابتاً، وfeedback وخطوات الحل وpenalty وtags. وأضيف نموذج `CurriculumDraftVersion` مع snapshots لكل حفظ، وقائمة نسخ واستعادة تنشئ نسخة جديدة بسبب الاسترجاع، كما أضيفت النسخ إلى Backup/Restore.

أضيفت معاينة حية محلية داخل iframe sandbox في مراحل البناء، دون إرسال محتوى الدرس إلى شبكة خارجية. آخر تحقق: TypeScript PASS، ESLint للملفات المعدلة PASS، production build PASS، AI mock PASS بنتيجة 21/21، Curriculum Factory smoke PASS بنتيجة 15 check، Performance Smoke PASS بنتيجة 6/6، وMaster Audit PASS بالكامل.


## تحديث 15 أغسطس 2026: نظام العدالة الكامل V10

تم تنفيذ بوابة `pickStudentFair` الموحدة لعدالة الفكرة والدرس والأداء والجلسة، مع عدادات `lessonAttemptsByStudent` و`lessonCorrectByStudent` و`lessonWrongByStudent` و`lastAskedAtByStudent` و`performanceByIdea` وسجل `fairnessLog`. أضيفت أوضاع متوقف/لطيف/صارم إلى الإعدادات، وأصبح القرار اليدوي محفوظاً بوصفه قراراً يدوياً قابلاً للتفسير.

رُبطت البوابة بكل مصادر الاختيار الفعلية: الألعاب، العجلات، التليبرومبتر، StudentsPanel، وHotPotato. أزيل double-pick من LuckyWheel، وأزيل fallback العشوائي من RandomStudentWheel، وأزيل تسجيل `star` الزائد بعد `fair-pick`. أضيف حدث `bisalasa:fair-pick` لتحديث اللوحات اللحظية، مع مزامنة StudentActivity وقبول `lastAbsentAt` في dispatcher وقاعدة SQLite.

أضيفت `LessonFairnessPanel.tsx` إلى شريط المدرس، وتعرض ترتيب العدالة، الأداء حسب الفكرة، التعثر، عدادات الدرس، وآخر مصادر الاختيار. أضيفت مؤشرات fairness إلى عقد التقارير وReportsPanel وTelegram PDF، مع إرسال ملخص المشاركة فقط إلى ولي الأمر دون تفاصيل scoring الداخلية.

أضيف `scripts/fairness-v10-smoke.ts` وأمر `npm run test:fairness`. النتيجة الفعلية: fairness smoke PASS بنتيجة 11/11، Curriculum Factory PASS بنتيجة 15/15، Performance Smoke PASS بنتيجة 6/6، Master Audit PASS، TypeScript PASS، production build PASS، وESLint PASS مع تحذيرين legacy فقط في IframeStage وStudentCard.

الوثيقة التفصيلية: `FAIRNESS-V10-IMPLEMENTATION-AR.md`.

## ملفات QA المضافة

| الملف | الوظيفة |
|---|---|
| `FAIRNESS-V10-IMPLEMENTATION-AR.md` | توثيق نظام العدالة V10 والحدود والاختبارات |
| `scripts/fairness-v10-smoke.ts` | سيناريوهات اختبار البوابة والعدادات |
| `docs/historical/fairness-v10-browser-findings.md` | نتائج boot path في المتصفح |


## تحديث 15 أغسطس 2026: Moodle Integration V10 — Critical Review Closure

تمت معالجة الفجوات الفعلية في مراجعة Moodle الحرجة. تم التحقق من أن فهارس `MoodleStudentMap` صحيحة في الشجرة الحالية، ثم أضيف `MoodleSyncRetry` المرتبط بـ`MoodleSyncEvent` مع backoff وحالة `dead`، وأضيفت مؤشرات `lastReconciledAt` و`lastGroupSyncAt` و`reconcileStatus` إلى `MoodleCourseMap`.

أضيفت طبقة `src/lib/moodle-v10.ts` للتحقق من course map وstudent map وactivity/idea map وquestion map. أحداث webhook غير القابلة للتحقق تُحفظ `pending-validation` مع الأسباب، والأخطاء العابرة تدخل queue. أضيفت routes `probe` و`health` و`reconcile` و`syncGroups` و`listCourseMaps` و`/api/moodle/retry`، مع استمرار HMAC وduplicate suppression وpull-only.

تم تطوير MoodlePanel بلوحة صحة محدثة كل 30 ثانية، وhealth probe كل 5 دقائق، ومصالحة يدوية، وgroup sync دوري، وقائمة الطلاب غير المربوطين مع manual mapping، وزر لمزامنة كل المقررات المرتبطة مع cursor مستقل لكل course map. كما أصبح question delivery معلناً كـstandalone محلي: ألعاب المنهج لا تتوقف عند تعطل Moodle ولا تستخدم أسئلة demo خارج الدرس.

تم تحديث `scripts/moodle-advanced-integration-smoke.cjs` ليغطي 40 check، وأضيفت أوامر Moodle الرسمية إلى `package.json`. النتيجة النهائية: Prisma PASS، TypeScript PASS، ESLint PASS مع تحذيرين legacy فقط، production build PASS، Moodle mapping 18/18، live sync 12/12، homework 16/16، security 4/4، advanced V10 40/40، fairness 11/11، Curriculum Factory 15/15، Performance 6/6، وMaster Audit PASS بالكامل.

المرجع التفصيلي: `MOODLE-INTEGRATION-REPORT.md` و`docs/historical/MOODLE-V10-GAP-ANALYSIS-AR.md`.


## تحديث 15 أغسطس 2026: Curriculum Factory V10 — إغلاق المراجعة الحرجة

تم إغلاق فجوات مراجعة Curriculum Factory V9 وإضافة طبقة V10 تشغيلية. شملت التغييرات حفظ `solutionSteps` و`solutionScript` و`questionType` و`imageJson` عند الخَبز، ودعم `cloze` و`drag-drop`، ورفع الصور الآمن بحد 5MB، والبحث والفلترة والتحديد الجماعي والحذف والتعديل ونقل الفكرة والتحسين والبدائل الجماعية، وإعادة ترتيب الأسئلة بالسحب، والوسوم المقترحة، ومعاينة QuickFire وQuizShow.

أضيفت Question Templates وLesson Templates مع seed/list/save، وQuality Gate لفحص LaTeX والصور والتكرار، Duplicate Detection، Idea Coverage Matrix، Difficulty Distribution، والتحقق من Moodle XML قبل التنزيل. كما أضيفت prompt variables وfew-shot examples وpromptTest وtoken/cost estimation وmodel comparison وSSE streaming، مع Error Boundary واستعادة محلية best-effort.

التحقق النهائي: TypeScript PASS، ESLint PASS للملفات الجديدة، Production Build PASS، Curriculum Factory smoke PASS **23/23**، image upload success/rejection PASS، AI contract smoke PASS، Moodle Mapping 18/18، Moodle Live 12/12، Moodle Homework 16/16، Moodle Advanced 40/40، Moodle Security 4/4، Fairness 11/11، Telegram PDF 10/10، وMaster Audit PASS بالكامل.


## تحديث 15 أغسطس 2026: Whiteboard + Games + Celebrations + Rewards V10

أُغلقت الفجوات التشغيلية في مراجعة `14-WHITEBOARD-GAMES-CELEBRATIONS-GIFTS-BADGES-SOUNDS-V9-CRITICAL-REVIEW.md` فوق البنية الحالية، مع الحفاظ على فلسفة غرفة عمليات المدرس. أضيفت صفحات وطبقات السبورة، equation/LaTeX قابل للمراجعة، snap هندسي، replay، وتصدير PNG/SVG. صار مختبر الرياضيات يرسل المعادلة إلى نفس محرر السبورة بدلاً من الرسم المباشر، وحافظت السبورة على localStorage/BroadcastChannel وundo/redo.

أضيفت عقود V10 مستقلة للتكيف مع صعوبة السؤال، تحليلات الألعاب، مشاركة النتيجة، read-only spectator snapshot، game templates، والبطولات المحلية. تظل الأسئلة داخل source والفكرة المختارين ولا يوجد fallback صامت خارج المنهج، وتستخدم الألعاب بوابة `pickStudentFair` الموحدة.

أضيفت نماذج وعمليات Prisma/dispatcher وtyped facade للشارات المخصصة، مستويات الشارات، الإنجازات، gift combos، celebration sequences، audio profiles، game templates، والبطولات. المنح ذري وidempotent عبر reward event key أو progress monotonic. أضيفت لوحة `RewardsV10Panel` للمدرس، وبها tabs للإدارة والتحليلات والتسلسلات والصوت والمشاركة. لا يمنح AI مكافآت تلقائياً.

أضيف Audio Mixer محلياً بقنوات `music/effects/tts/ambient` وmaster volume وambiance وhaptic opt-in. يمرر `playSound` القناة والحجم، وتحترم haptics إعداد المدرس وmute. لم تُفرض Three.js أو WebSocket/WebRTC أو voice cloning أو AI TTS مدفوع أو OffscreenCanvas كاعتماد أساسي؛ هذه adapters اختيارية تحتاج مزوداً أو قياساً أو بيئة تشغيل، وهو قرار أمني وأدائي متسق مع نموذج المدرس المحلي.

أضيفت اختبارات قابلة لإعادة التشغيل: `scripts/whiteboard-games-v10-smoke.ts` بنتيجة **22/22**، و`scripts/whiteboard-games-v10-api-smoke.cjs` بنتيجة **18/18** مع fixtures وتنظيف تلقائي. نجحت Math **20/20**، Fairness **11/11**، Curriculum Factory **23/23**، Moodle Mapping **18/18**، Moodle Live **12/12**، Moodle Homework **16/16**، Moodle Advanced **40/40**، Moodle Security **4/4**، وMaster Audit. نجح TypeScript وproduction build؛ بقي تحذيران legacy فقط في `IframeStage.tsx` و`StudentCard.tsx` بسبب `<img>`.

تم التحقق في المتصفح على QA `http://127.0.0.1:3032` من boot، فتح Rewards V10 وتحليلات الألعاب، رفع درس fractions، فتح SmartWhiteboard، إدراج LaTeX، إضافة طبقة وصفحة، وتصدير PNG وSVG. أسماء الملفات وأحجامها موثقة في `docs/historical/WHITEBOARD-GAMES-V10-BROWSER-FINDINGS-AR.md`، والتقرير الكامل في `WHITEBOARD-GAMES-V10-IMPLEMENTATION-AR.md`.


## تحديث 15 أغسطس 2026: Settings + AI + External APIs V10 — إغلاق مراجعة V9

تم تنظيم SettingsPanel إلى تبويبات عام وAI وتكاملات ومتقدم، مع بحث حي، واستيراد/تصدير JSON خاص بالإعدادات فقط، validation وrevision conflict، وSettings Profiles مرتبطة اختيارياً بالفصل. لا يشمل export الطلاب أو الجلسات أو الأسرار، ويعرض Advanced إدارة SQLite والنسخ الاحتياطية والاختصارات.

توسعت طبقة AI بعقود موحدة للتاريخ والمحادثات، memory scoped، retry queue مع claim/backoff، prompt library، embeddings محلية، safety gate، specialty routing، scopes وcapabilities، usage/cost logging، ومزودات قابلة للتدوير حسب priority/cooldown/concurrency. أضيفت presets وواجهة إدارة لـGoogle وOpenAI وOpenRouter وAnthropic وTogether وFireworks وDeepSeek وCohere وPerplexity وReplicate وHuggingFace وcustom، مع Fetch Models واختيار specialty والـscopes.

أضيفت `/api/ai/media` لمسارات الصورة والرؤية وSTT وembeddings مع mock provider محلي، ووسعت `/api/tts` إلى adapters server-side لـOpenAI وElevenLabs وGoogle Cloud مع fallback Google Translate/Web Speech. أضيفت `/api/webhooks` بتوقيع HMAC وallowlist وSSRF validation وretry، وREST read-only لا يعمل دون مفتاح بيئي، مع redaction للأسرار.

التحقق النهائي: Settings/AI pure **20/20**، Settings/AI API/DB/mock/security **16/16**، TypeScript PASS، production build PASS، ESLint PASS بصفر أخطاء وتحذيرين legacy فقط، Curriculum Factory **23/23**، Fairness **11/11**، Whiteboard/Games **22/22**، Moodle Security **4/4**، Advanced **40/40**، Mapping **18/18**، Live **12/12**، Homework **16/16**، وMaster Audit PASS. المتصفح تحقق من Settings tabs/search، إصلاح `NaN%` إلى fallback 70%، وواجهة presets وspecialty/scopes دون إرسال مفتاح حقيقي.

الميزات التي تتطلب مزوداً خارجياً فعلياً أو بيئة تشغيل خاصة، مثل upstream streaming لبعض المزودين وadapters المتخصصة لـReplicate/HuggingFace وREST mutation و3D والتعاون متعدد الأجهزة، بقيت gated وموثقة ولم تُدّعَ كنجاح خارجي حقيقي. التفاصيل في `SETTINGS-AI-V10-IMPLEMENTATION-AR.md` و`docs/historical/SETTINGS-AI-V10-TEST-RESULTS-AR.md`.


## تحديث 15 أغسطس 2026: Reports + Telegram + Components V10 — إغلاق مراجعة V9

أُغلقت الفجوات الحرجة في `15-REPORTS-TELEGRAM-COMPONENTS-V9-CRITICAL-REVIEW.md`. أضيفت عقود versioned لقوالب التقارير وأقسامها وظهورها، comparative/class analytics، builders للحضور والألعاب والتقارير الأسبوعية/الشهرية ومراجعة المعلم، وتصدير CSV آمن وXLSX عبر lazy import. أضيفت لوحة `ReportAnalyticsV10` داخل ReportsPanel مع KPIs والمقارنة والحضور والتقرير الانعكاسي والتصدير والقوالب، مع الحفاظ على تقارير PDF والدرجات السابقة.

توسعت Telegram إلى persistent schedules وclaim/complete وretry queue وbackoff وrate limiting وidempotency، وأضيفت القوالب العربية/الإنجليزية وتفضيلات ولي الأمر scoped بالطالب والأقسام والتكرار وlive events/reminders الاختيارية. أضيفت commands وinline keyboards مع callback scope، و`sendPhotoCard` مع HTTPS validation وfallback إلى التقرير النصي/PDF عند فشل الصورة. لا يرسل النظام live event أو reminder دون consent/chat وربط الطالب.

أضيفت `studentNotes.search` وتصدير ملاحظات CSV، و`students.timeline` الذي يجمع activities وnotes وbadges وgifts في سجل زمني قابل للمراجعة داخل StudentDNA. أضيف إلى CurriculumPanel بحث محلي ومفضلة للدرس محفوظة للمدرس فقط. تظل النقاط وقرارات التدخل والتوصيات تحت قرار المدرس ولا يستبدلها AI أو Telegram.

أضيفت ملفات `REPORTS-TELEGRAM-COMPONENTS-V10-IMPLEMENTATION-AR.md` و`docs/historical/REPORTS-TELEGRAM-COMPONENTS-V10-TEST-RESULTS-AR.md` و`docs/historical/REPORTS-TELEGRAM-V10-BROWSER-FINDINGS-AR.md`، واختبارات `scripts/reports-telegram-v10-smoke.ts` بنتيجة **18/18** و`scripts/reports-telegram-v10-api-smoke.cjs` بنتيجة **23/23**. regression النهائي نجح: Math **20/20**، Fairness **11**، Whiteboard/Games **22**، Settings/AI **20/20 و16/16**، Curriculum Factory **23**، Moodle Security **4/4**، Advanced **40**، Mapping **18**، Live **12**، Homework **16**. TypeScript وproduction build نجحا، وESLint بلا أخطاء مع تحذيرين legacy فقط في `IframeStage.tsx` و`StudentCard.tsx`.

تستخدم الاختبارات mock Telegram وmock Moodle محليين ولا ترسل بيانات خارجية. الجدولة recurrent persistent queue جاهزة لتشغيل worker أو scheduled trigger خارجي، ولم يُوضع cron داخل request server. الميزات التي تحتاج مزوداً خارجياً أو adapters متقدمة بقيت gated وموثقة ولم تُحسب نجاحاً خارجياً بلا مفاتيح حقيقية.


## تحديث 15 أغسطس 2026: Rewards + Audio + Visual Assets V13

تمت مراجعة مكتبة الأصوات والهدايا والاحتفالات وإضافة 12 صورة هدية شفافة موحدة الهوية: صاروخ النجمة، ميدالية قوس قزح، الكتاب السحري، كأس الرياضيات، القلم الخارق، مصباح الفكرة، ستيكر المذنب، التاج الذهبي، شارة الفريق، صندوق المفاجأة، لغز الكوكب، وقلب التشجيع. أضيفت الصور إلى `DEFAULT_GIFTS` وإلى seed الـdispatcher بمعرفات ثابتة من `g21` إلى `g32`، وتم تصغيرها إلى 512×512 لتحسين الأداء.

أضيفت تسعة مؤثرات WAV قصيرة بصيغة PCM لحالات النجاح والإتقان وظهور الهدية ونجاح الصف والتصحيح اللطيف وصعود المستوى والألعاب النارية ونهاية الحصة والاختيار العادل. تم ربط aliases القديمة بالأصوات الجديدة، وإظهارها في `SoundsPanel`، وتشغيل `bisalasa-gift-reveal.wav` عند منح الهدية مع احترام mute وvolume والـfallback.

أُصلحت مشكلة seed قديم كان يولد معرفات عشوائية ويؤدي إلى تكرار الهدايا عند مزامنة defaults. أصبح seed ثابتاً، وأصبح `getAllGifts` يطابق المعرف والصورة ويزيل التكرار المرئي لمسارات الهدايا المدمجة دون حذف الهدايا المخصصة أو السجلات التاريخية. فحص المتصفح على قاعدة نظيفة أظهر مكتبة هدايا بعدد **32** دون تكرار، ومكتبة أصوات بعدد **99** مع الأصول الجديدة ظاهرة.

تمت إضافة `scripts/rewards-assets-v13-smoke.cjs` وأمر `npm run test:rewards-assets-v13` بنتيجة **74/74 PASS**. نجح TypeScript وproduction build، ونجح ESLint دون أخطاء مع تحذيرين legacy فقط. regression المرتبط نجح: Math **20/20**، Fairness **11/11**، Whiteboard/Games **22/22**، Settings/AI **20/20**، Reports/Telegram **18/18**، Curriculum Factory **23/23**. كما تم تحويل layout إلى خط محلي `Amiri-Regular.ttf` لإغلاق اعتماد build على Google Fonts أثناء التشغيل offline.

التفاصيل في `REWARDS-AUDIO-VISUAL-V13-IMPLEMENTATION-AR.md` و`docs/historical/REWARDS-AUDIO-VISUAL-V13-BROWSER-FINDINGS-AR.md`.


## تحديث 15 أغسطس 2026: Performance Review V19 — الإغلاق الكامل

تم تنفيذ مراجعة أداء شاملة بعد V13. أُجّل Howler حتى أول تشغيل صوت، وأضيف cache آمن لكل مصدر، وأصبحت صور الهدايا المدمجة WebP وقت التشغيل مع lazy loading وdecoding غير متزامن، مع تطبيع PNG القديمة حتى لا تنكسر قواعد SQLite السابقة أو عقود `DEFAULT_GIFTS`. بقيت أصول PNG الأصلية للاختبارات والتوافق.

أضيف cache داخلي قصير 750ms لتقارير الطالب والفصل لتجميع الطلبات المتكررة من ReportsPanel و`reports.games` و`reports.teacher`. أضيفت فهارس مركبة لاستعلامات activities وcelebrations وnotes وteacher interactions وMoodle attempts وhomework results وgame results. تم فصل الرسم البياني الذي يستخدم `recharts` إلى `ReportPerformanceChart.tsx` dynamic chunk، بينما ظل `xlsx` lazy داخل export handlers.

تم جعل `sessions.end` idempotent عبر `updateMany` وتحديث typed facade إلى `{ count }` لمنع أخطاء الجلسات القديمة بعد reset أو تعدد التبويبات. لم يتغير سلوك المدرس أو حفظ `statsJson`. ظلت Moodle pull-only، مع Delta Sync وadaptive polling وpause عند إخفاء الصفحة.

القياس النهائي على 20 عينة لكل endpoint: teacher-shell p50 **11.88ms**، student-shell **6.39ms**، grades-all **4.89ms**، grades-class **4.69ms**، classes-api **3.50ms**، report-class-api **2.62ms**، وكلها PASS. ظل chunk الدخول **130,946 bytes** ولم يدخل إليه Howler أو recharts. query plan أكد استخدام الفهارس المركبة دون full table scan في استعلامات التقارير الأساسية.

أُصلح `scripts/moodle-advanced-integration-smoke.cjs` ليكون مستقلاً عن ترتيب الاختبارات بإنشاء طلاب QA وربطهم صراحةً بـMoodleStudentMap؛ لم تُضعف حماية production، وما زال الحدث غير المربوط يدخل `pending-validation`. النتيجة النهائية: TypeScript PASS، Prisma PASS، production build PASS، ESLint صفر أخطاء مع تحذيرين legacy فقط، Performance Smoke **6/6**، Settings/AI API **16/16**، Reports/Telegram API **23/23**، Moodle Advanced **40/40**، Mapping **18/18**، Live **12/12**، Homework **16/16**، Security **4/4**، Rewards/Assets **74/74**، Curriculum Factory **23/23**، وبقية الاختبارات المحلية PASS.

التفاصيل الرقمية الكاملة في `PERFORMANCE-OPTIMIZATION-REPORT.md`، وقياس boot المتصفح في `docs/historical/PERFORMANCE-BROWSER-V14-BOOT-AR.md`. تمت إضافة `scripts/query-plan-check.py` لفحص خطط SQLite، و`src/components/shell/ReportPerformanceChart.tsx` للرسم المؤجل.

## تحديث 15 أغسطس 2026: V10 Complete Test Suite — الإصلاح والإغلاق
تم تحويل خطة `16-V10-COMPLETE-TEST-SUITE.md` إلى runner رسمي `scripts/v10-complete-suite.cjs` وأمر `npm run test:v10:complete`. يعمل runner بعزل process وقاعدة SQLite منسوخة لكل suite، ولذلك لا تتلوث اختبارات AI بمفاتيح أو rate-limit من suite سابقة. أضيف `scripts/seed-test-data.cjs` ببيانات deterministic: 3 فصول، 75 طالباً، 5 دروس، 50 سؤالاً، و9 جلسات.
أضيفت health endpoint، aliases توافقية لـAI compare/image/STT وTelegram retry، بحث دروس محلي bounded، same-origin guard على mutations، وcontract probes للـhealth وCSRF وSQL-injection وAI safety والحدود. تم توسيع safety gate العربية للعنف الصريح، إصلاح حد sourceText وJSON في Curriculum Factory، وإصلاح `sessions.end` ليعيد session row مع idempotency للجلسات stale. تم توحيد mock Telegram ليقبل أي token اختباري ويعيد WebhookInfo كاملاً.
تمت إضافة operational suite لحدود payload وwarm p95 و1000 طالب و100 game result، واختبار المتصفح أثبت RTL وdark mode و58/58 aria-label، وboot بلا صوت أو صور هدايا، وتحميل 30 WebP عند فتح لوحة الهدايا. cold start المقاس 648ms، وperformance-smoke النهائي: teacher p50 16.08ms، student p50 8.56ms، grades-all p50 13.34ms، classes API p50 5.32ms، report-class p50 2.74ms.
النتيجة الرسمية النهائية: **34/34 PASS، 0 FAIL**، مع Prisma validation وTypeScript وESLint وproduction build PASS. التفاصيل في `V10-COMPLETE-TEST-SUITE-RESULT-AR.md` و`V10-SUITE-GAP-MATRIX-AR.md` و`docs/historical/V10-BROWSER-UX-FINDINGS-AR.md`، والنتيجة الخام في `docs/historical/v10-complete-suite-result.json`.


## تحديث 15 أغسطس 2026: Final QA Closure بعد آخر الإصلاحات

أعيد تشغيل `npm run test:v10:complete` بعد آخر build، فكانت النتيجة **34/34 PASS، 0 FAIL**. شملت الدورة suites الذكاء الاصطناعي الوهمية وحدودها، التكاملات، Moodle advanced/mapping/live/homework، fairness، whiteboard/games، reports/Telegram، performance، ومصفوفة السيناريوهات 25,000.

أُغلق تسريب رسائل مزودي AI في الواجهة نهائياً: `src/app/api/ai/route.ts` يستخدم رسائل عامة عبر `genericProviderError()` ولا يمرر نص provider الخام أو أجزاء API keys للمستخدم. في browser QA دون مفتاح صالح ظهرت رسالة عامة فقط، وبقيت اللوحة مستقرة.

أُصلح تبديل اللوحات المباشر برفع `FloatingSideRail` إلى `z-[220]` فوق backdrop، مع إغلاق `showCelebrationsOverlay` عند تبديل أي لوحة. أضيف زر Moodle المفقود فعلياً إلى مجموعة النظام في rail. اختُبرت هذه المسارات من المتصفح بعد build جديد بنجاح.

نجحت بوابات الإصدار: TypeScript بلا أخطاء، ESLint بلا أخطاء تشغيلية، production webpack/standalone build، و`npm audit --omit=dev` بنتيجة **0 vulnerabilities**. جرى تحديث `docs/historical/QA-V2-BROWSER-FINDINGS-AR.md` و`docs/historical/FULL-REVIEW-STATUS-AR.md` بهذه النتائج، وحُفظ artifact الرسمي في `qa-artifacts/v2-final-result.json`.

لا تتغير الحدود المقصودة: AI اختياري وتحت مراجعة المدرس، Moodle pull-only، الطالب خارج غرفة العمليات، وموفرو الإنتاج الحقيقيون يحتاجون credentials يملكها صاحب المنصة. الاختبارات المحلية تستخدم mocks ولا ترسل أسراراً إلى الخارج.


## تحديث 15 أغسطس 2026: Panel UX + Students PlugZap Crash Hardening

أزيل قيد الارتفاع الزائد من `.panel-scroll`، وأضيفت قواعد `min-height: 0` و`overscroll-behavior` و`scrollbar-gutter` حتى تستغل البانلز الجانبية كامل الارتفاع المتاح وتبقى قابلة للتمرير داخلياً. عُدّل `FloatingSideRail` ليمنح اللوحات الخاصة، ومنها Moodle، المساحة الكاملة بين الحواف بدلاً من ربطها بارتفاع teleprompter في الوضع الطولي، مع ضبط عرض آمن للشاشات الضيقة.

أضيف `PanelErrorBoundary` حول محتوى كل لوحة. إذا وقع خطأ runtime داخل لوحة واحدة، لا تتوقف غرفة العمليات؛ تظهر رسالة عامة آمنة مع زري إعادة المحاولة والإغلاق، بينما يسجل الخادم الخطأ للتشخيص دون عرض تفاصيل حساسة للمستخدم. كما طُبّع مسار Moodle discovery ضد غياب `users/groups/sections/activities/failures` في استجابة جزئية من provider أو mock، وهو مسار كان قد يحول بيانات ناقصة إلى crash عند الاستخدام اللاحق.

أعيد اختبار students → PlugZap → Moodle → AI من build جديد. فُتحت اللوحات، ظهر Custom App Hook، وكان scroll الداخلي فعّالاً بقياس `clientHeight=979` و`scrollHeight=1255` في MoodlePanel، ولم تظهر شاشة crash. نجحت TypeScript وESLint وproduction build، ثم V10 complete suite بنتيجة **34/34 PASS، 0 FAIL**. أضيفت النتيجة الخام الجديدة إلى `qa-artifacts/panel-fix-v10-result.json`.


## تحديث 15 أغسطس 2026: Curriculum Question Hydration + Honest Browser Regression

أُغلق فشل وظيفي حقيقي ظهر أثناء تدقيق متصفح مستقل: بعض دروس HTML كانت تظهر في لوحة المنهج، لكن ألعاب المنهج تعرض «حمّل درساً» و«لا توجد أسئلة». السبب أن بعض الشرائح لا ترسل `MANIFEST`، وأن درساً محفوظاً في SQLite لا يُفعّل manifest عند boot، وأن `useGameQuestions` لا يعيد الحساب عند وصول بنك الأسئلة asynchronously.

تم إصلاح المسار في `src/lib/shell-store.ts` و`src/app/page-client.tsx` و`src/lib/question-provider.ts` و`src/lib/useGameStudentPicker.ts`: استعادة `activeLesson` عبر `setActiveLesson` عند hydration، تحميل `lesson_questions` المحلي بعد manifest، تطبيع `optionsJson/tags` وحقول السؤال، وإعادة تشغيل provider عند تغير بنك الأسئلة. يظل المصدر محصوراً في أسئلة المنهج المختار ولا يوجد fallback demo أو خلط تلقائي مع AI.

التحقق الفعلي على build النهائي: ظهر `10 سؤال متاح من المنهج` في تحدي الأسئلة، أُضيف مشارك QA، بدأت الجولة عند `سؤال 1 من 10`، ظهرت أربعة خيارات، كشفت الإجابة الصحيحة وانتقل التطبيق إلى `سؤال 2 من 10` بلا crash.

أُعيدت regression browser على دفعات قصيرة مع مراقبة `window.error` و`unhandledrejection` وطلبات fetch الفاشلة. اختُبرت اللوحات الأساسية، الطلاب وPlugZap/Moodle، الفصول، المجموعات، الجوائز، الهدايا، هدية سريعة، الأصوات، الاحتفالات، مكافآت V10، أزرار العرض، أدوات السبورة الداخلية، وألعاب الذاكرة والحظ وأدوات الفصل. المسارات المختبرة سجلت `errors=0`, `unhandled=0`, `failedFetches=0`. route مصنع المناهج أعاد HTTP 200 بحجم 35,282 بايتاً، لكن تنقل أداة المتصفح إليه انتهى بمهلة؛ لذلك يسجل التقرير هذه الحالة كـbrowser navigation timeout غير محسوم، لا كـPASS متصفح كامل ولا كـcrash مثبت.

أُعيد تشغيل V10 complete suite على خادم 3045 المبني من الكود الحالي مع mocks: **34/34 PASS، 0 FAIL**. كما نجحت TypeScript وESLint وProduction Build. التفاصيل الحية محفوظة في `qa-artifacts/browser-coverage-live-log-2026-08-15.md`.


## تحديث 15 أغسطس 2026: Exploratory QA — إصلاح تداخل النوافذ السفلية

أظهرت جولة متصفح استكشافية أوسع من suite السابقة عطلين حقيقيين في سلوك النوافذ المنبثقة. كان كل زر من أزرار الاحتفالات والأسبوعي والمتصدرين والكارت وقوائم الألعاب يملك state مستقلاً، ما كان يسمح بتراكم overlays عند التبديل السريع. أضيف `closeBottomOverlays` في `BottomControlBar.tsx` ليجعل هذه النوافذ متبادلة الإغلاق، مع دعم Escape وحدث `close-all-overlays` وبقاء نافذة واحدة فقط.

كما أظهرت الجولة أن مختاري الهدية والجائزة للطالب المستدعى كانا مستقلين؛ فتح الجائزة بعد الهدية كان يظهر dialogين معاً. أصبحت أزرار فتح المختارين تستدعي نفس الحارس قبل الفتح. أعيد إثبات السلوك على طالب فعلي: الهدية وحدها، ثم الجائزة وحدها، ثم إغلاق كامل بلا dialog عالق.

نتائج إعادة التحقق: TypeScript PASS، ESLint PASS بلا تحذيرات جديدة، production build PASS، V10 complete **34/34 PASS**، AI API **16/16 PASS**، Moodle live **12/12**، homework **16/16**، mapping **18/18**، advanced **40/40**، security **4/4**، وTelegram API **23/23**. كما اختُبر طالب فعلي من الإضافة حتى التقييمات والـleaderboard والكارت والتقرير مع PDF/JSON.

فشل محاولتا Moodle live وTelegram API في التشغيل الأول كان بيئياً: الأولى استخدمت BASE الافتراضي 3012 غير المشغّل، والثانية لم تشغّل خادم 3045 على mock Telegram 3034. بعد ضبط البيئة الصحيحة نجحت الاختبارات، ولذلك لا تُسجلان كأعطال تطبيق.


## تحديث 15 أغسطس 2026: Exploratory Gap Audit — Games, Classroom, Reports

أُغلقت فجوة حفظ نتائج الألعاب المنهجية. أصبح `QuestionChallengeGame` و`QuickFireGame` و`QuizShowGame` ينشئون `GameResult` عند بدء الإجابة، ويسجلون اللاعب والسؤال وإجابته وصحتها والنقاط، ثم يثبتون `endedAt` و`durationMs` عند نهاية الجولة. تحفظ الألعاب `questionId` الحقيقي من `LessonQuestion` عند توفره، وتستخدم مطابقة آمنة بالنص والفكرة والخطوة كـfallback، ولا تضيف أسئلة خارج مصدر المنهج المحدد. يحافظ QuizShow على قرار المدرس في منح النقاط ولا يستبدله بتصحيح آلي.

تم اختبار جولة QuickFire من 4 أسئلة من الفكرة الحالية، وجولة QuizShow من 8 أسئلة من كل الدرس مع 4 مشاركين. فحص SQLite أثبت game results مكتملة، وquestion IDs حقيقية، وparticipant statistics صحيحة. كما أُعيد اختبار fixture الكامل واستعادة backup مرتين بعد إضافة wipe لـ`studentNote`، ونجح 21/21 في المرتين.

تم اختبار دورة الفصل في المتصفح: تفعيل فصل، بدء جلسة، تسجيل +3 و-1، مسح الحضور وتسجيل أحمد غائباً، ثم إنهاء الجلسة. التقرير الموحد حدّث نقاط الألعاب إلى 399، وأظهر الحضور 22 من 24 بنسبة 91.67%، بينما `/grades` عرض التقرير العربي RTL لـ12 طالباً مع 697 نقطة و399 نقطة ألعاب و90% دقة صف. أزرار حساب الحضور ومراجعة المعلم والمقارنة عملت بلا أخطاء JavaScript أو failed fetches.

أُعيد تشغيل بوابات الجودة بعد هذه التغييرات: `npm run test:v10:complete` بنتيجة **34/34 PASS**، AI mock **21/21 PASS**، integrations demo **32/32 PASS**، وvalidate-demo-backup **21/21 PASS** في مرتين متتاليتين. كما نجح TypeScript وESLint للملفات المعدلة وProduction Build.

## حدود الإثبات في هذه الجولة

زر الطباعة في `/grades` يطلق print preview الأصلي؛ في متصفح sandbox أدى ذلك إلى timeout بسبب حوار الطباعة، مع بقاء الصفحة سليمة. لا يُعد ذلك فشلاً في محتوى التقرير، لكن حفظ PDF من print preview يحتاج تأكيداً يدوياً في بيئة المستخدم. كما لم تُختبر credentials حقيقية لـGoogle أوMoodle أوTelegram؛ كل اختبارات التكامل الخارجية mock-only حفاظاً على البيانات وفلسفة Moodle pull-only.
