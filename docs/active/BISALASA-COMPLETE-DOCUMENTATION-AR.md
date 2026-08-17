# بسلاسة — التوثيق المرجعي الكامل للمنصة

**النسخة المرجعية:** 2026-08-16 — جولة الإصلاحات الأمنية وقاعدة البيانات

**المؤلف:** Manus AI

> هذه الوثيقة هي المرجع الحالي الموحّد لمنصة بسلاسة. إذا تعارضت معها وثيقة تاريخية أقدم، فهذه الوثيقة وملفات `CHANGES.md` و`PERFORMANCE-OPTIMIZATION-REPORT.md` و`MOODLE-INTEGRATION-REPORT.md` هي المرجع الأحدث.

## 1. تعريف المنصة وفلسفتها

بسلاسة ليست منصة دخول طلابية تقليدية، وليست بديلاً عن Zoom أو OBS أو Moodle. هي **غرفة عمليات محلية للمدرس** يستخدمها أثناء الحصة، بينما يظل العرض الأساسي في Zoom أو OBS، ويظل Moodle مصدراً خارجياً للسحب والتحليل. الطالب لا يحتاج إلى تسجيل دخول إلى بسلاسة في النموذج التشغيلي الأساسي.

المدرس هو صاحب القرار في بدء الجلسة، اختيار الدرس والفكرة، عرض السؤال، اختيار الطالب أو المجموعة، اعتماد الإجابة، منح النقاط، تشغيل اللعبة، إطلاق الاحتفال، فتح السبورة، وتسجيل التدخل التعليمي. لا تنفذ بسلاسة قراراً تربوياً حساساً نيابة عن المدرس بطريقة صامتة.

| المبدأ | التطبيق داخل المنصة |
|---|---|
| المدرس صاحب القرار | كل أدوات التقييم واللعب والمكافأة والتدخل تظهر في غرفة المدرس وتحت تحكمه |
| Moodle pull-only | بسلاسة تسحب المحتوى والطلاب والنتائج وتحللها، ولا تعدل نشاطاً أو درجة داخل Moodle |
| الطالب لا يدخل بسلاسة | وضع الطالب/المعاينة خفيف ولا يحمل لوحات المدرس أو AI أو الملاحظات الخاصة |
| العرض أولاً | الشريحة هي مركز الحصة، واللوحات العادية تظهر حولها دون إفساد مساحة العرض |
| الخصوصية | ملاحظات المدرس وAI والتقارير الخاصة لا تظهر في وضع الطالب |
| الأداء المحلي | التطبيق يعمل محلياً على SQLite، وتؤجل الأجزاء الثقيلة حتى الحاجة |
| قابلية التفسير | ربط Moodle وAI يعيدان حالة وثقة ومصدر القرار بدلاً من نتيجة غامضة |

## 2. المعمارية الحالية

التطبيق مبني على Next.js 16.3 وReact 19 وTypeScript 5 وPrisma 6 وSQLite ويعمل على Node.js 22. الواجهة الرئيسية في `src/app/page-client.tsx`، ويجري الاتصال بقاعدة البيانات من خلال `src/lib/local-db.ts` إلى dispatcher موحد في `/api/db/[operation]`.

```text
المدرس
  │
  ├─ غرفة العمليات: الشرائح، السبورة، الطلاب، الألعاب، الاحتفالات، التقارير، AI
  │
  ├─ SQLite محلي ← local-db ← /api/db/[operation] ← Prisma
  │
  ├─ Moodle Web Services ← /api/moodle ← discovery + delta sync + reports
  │
  ├─ AI Providers ← /api/ai ← مفاتيح مشفرة + أولوية + تدوير + limits
  │
  └─ Telegram / Custom App ← integrations ← PDF وتقارير وحالة حية
```

الشريحة التعليمية تعمل داخل iframe معزول. التواصل بين الشريحة وShell يتم عبر `window.postMessage` وفق manifest وcontroller موثقين في `public/slides/VIBE_CODING_CONTRACT.md`. لا ينبغي للشريحة الوصول إلى DOM الخاص بالـShell مباشرة.

## 3. دورة استخدام المدرس

يبدأ المدرس بإنشاء أو اختيار فصل، ثم يستورد درساً HTML أو manifest صالحاً. بعد ذلك يحدد الدرس النشط ويبدأ جلسة الحصة. تظهر الشريحة في الوسط، بينما تبقى أدوات التحكم الجانبية والسفلية متاحة. يستطيع المدرس الانتقال بين الخطوات والأفكار، فتح التليبرومبتر والملاحظات، اختيار طالب أو مجموعة، تشغيل لعبة، استخدام السبورة، ثم إنهاء الجلسة وحفظ نتائجها.

في الحصة المبنية على أفكار، ترتبط الأسئلة بالفكرة الحالية. يستطيع المدرس استخدام مصدر «الفكرة الحالية» أو «كل الدرس» أو فكرة محددة. لا يسمح مزود الأسئلة بالتسرب الصامت إلى فكرة أخرى عند نفاد المصدر؛ تظهر حالة نفاد واضحة ويقرر المدرس العودة إلى كل الدرس أو بدء جلسة أخرى.

## 4. الشرائح والـManifest

كل درس HTML يجب أن يحتوي على `slide-manifest` وcontroller. يدعم manifest خطوات مسطحة أو أفكاراً متداخلة، ويحتوي على العنوان والخطوات والسكريبت والملاحظات والأسئلة والأصول ونسبة العرض. يجب أن تكون الشرائح عربية الاتجاه عند إنتاج محتوى عربي، وأن ترسل `READY` ثم `MANIFEST` ثم `STEP_CHANGED` بعد كل انتقال.

| الرسالة | الاتجاه | الغرض |
|---|---|---|
| `READY` | الشريحة ← Shell | إعلان انتهاء التحميل |
| `MANIFEST` | الشريحة ← Shell | تعريف الدرس والخطوات والأفكار |
| `STEP_CHANGED` | الشريحة ← Shell | مزامنة الخطوة الحالية |
| `GOTO_STEP` | Shell ← الشريحة | الانتقال إلى خطوة |
| `GOTO_IDEA` | Shell ← الشريحة | الانتقال إلى فكرة |
| `NEXT` / `PREV` | Shell ← الشريحة | التنقل اليدوي |
| `REQUEST_SOUND` | الشريحة ← Shell | طلب صوت من محرك المنصة |

المرجع التفصيلي لبناء الشرائح هو `public/slides/VIBE_CODING_CONTRACT.md`. أما تشغيل المدرس والاستيراد فيلخصه `public/slides/QUICKSTART.md` بعد تحديثه في هذه الجولة.

## 5. الطلاب والفصول والمجموعات

تدعم المنصة إنشاء طالب داخل فصل، إنشاء طالب بلا فصل ثم نقله لاحقاً، إضافة فصل يحتوي طلاباً، تغيير الفصل، البحث، الغياب، المجموعات، التقسيم التلقائي، حذف الطالب، وحذف الفصل. تظل العلاقات المهمة داخل معاملات قاعدة البيانات، ويجري تنظيف مراجع الطالب من المجموعات عند الحذف.

تستبعد أدوات اختيار الطالب والألعاب والتقسيم التلقائي الطلاب الغائبين. لا يسمح منطق المكافآت بمنح نقاط أو هدايا لطالب غائب، وتوجد حواجز تمنع النقر المزدوج ومنح المكافأة مرتين.

## 6. الألعاب

تضم النسخة الحالية الألعاب والمكونات التفاعلية المحملة كسولاً من `BottomControlBar.tsx`. من الألعاب التي غُطيت في التدقيق: Quick Fire، Math Challenge، Question Challenge، Quiz Show، Memory، Mystery Box، Hot Potato، Dice Roll، وReaction Time، إضافة إلى مكونات مثل عجلة الطلاب وألعاب المجموعات.

الإصلاحات المشتركة تشمل قفل الإجابة، قفل الاختيار، منع الإنهاء المكرر، تنظيف timers وintervals عند الإغلاق، اشتراط طالب حاضر، منع تكرار السؤال، حفظ النتيجة مرة واحدة، والتأكد من أن مصدر السؤال هو المصدر الذي اختاره المدرس.

| الحالة الخطرة | الحماية الحالية |
|---|---|
| النقر مرتين على الإجابة | answer lock وrefs مخصصة |
| انتهاء المؤقت مع النقر في اللحظة نفسها | finished/closed refs وتسجيل واحد |
| إعادة فتح صندوق مكافأة | selection lock ومنع مضاعفة النقاط |
| إغلاق اللعبة أثناء الجولة | `requestExit` وتأكيد فقد التقدم |
| طالب غائب في عجلة أو لعبة | filtering قبل إنشاء قائمة اللعب |
| سؤال مكرر بين جولات | stable IDs و`askedQuestionIds` |

## 7. السبورة الرياضية

`SmartWhiteboard` طبقة فوق الشريحة وليست بديلاً عنها. تدعم الرسم الحر، القلم، الممحاة، الألوان، الأحجام، الأشكال الهندسية، الخطوط، الأسهم، النص، الأختام، التراجع، الإعادة، المسح، والليزر حسب الأدوات المتاحة في الواجهة. صُممت لتدريس الرياضيات، ولذلك يجب أن تكون الأشكال والأدوات قابلة للاستخدام مع الكسور والهندسة والشرح فوق الشريحة.

المسار الحالي يستخدم RAF throttling وحماية للمزامنة وقناة revision وstorage fallback وsnapshot محدود الحجم. لا تُحمّل السبورة في وضع الطالب. OffscreenCanvas موجود كـfeature gate اختياري، وليس شرطاً لتشغيل السبورة الحالية. يمكن تنفيذ نقل بعض قيم الرسم عالية التردد من state إلى refs لاحقاً إذا أثبت القياس فائدة ذلك.

## 8. الاحتفالات والتفاعل

تستطيع المنصة عرض الاحتفالات فوق منطقة العرض دون إخفاء الشريحة أو تعطيل غرفة العمليات. يدعم النظام القديم للكونفيتي ونمط particles/الألعاب النارية عندما يكون متاحاً، مع `renderMode` يسمح بالاختيار بين `confetti` و`particles` و`both`. يظل إطلاق الاحتفال قراراً يملكه المدرس، وتدعم الإعدادات التشغيل والإيقاف وتقليل الحركة عبر `prefers-reduced-motion`.

لا ينبغي أن يغطي الاحتفال أدوات المدرس الخاصة أو يجعل الطلاب يعتقدون أن نتيجة آلية نهائية؛ هو طبقة تحفيز بصرية بعد قرار المدرس أو حدث تعليمي معروف.

## 9. التقارير وحفظ النتائج

التقارير الموحدة تجمع مصادر النشاط والجلسات والألعاب وMoodle والواجبات والنتائج اليدوية. يظهر في تقرير الطالب ما إذا كان حل الواجب، وعدد الأسئلة، ونسبة الإكمال، والصحيح والخطأ، وما إذا كانت الأسئلة مرتبطة بفكرة أو مسجلة على الدرس كله. يظهر أيضاً سجل التدخل التعليمي عندما يتفاعل المدرس مع طالب أو فكرة.

تدعم صفحات التقارير عرض الصف أو الطالب، وتضم درجات الألعاب، سجل النشاط، نتائج Moodle، الدقة، ومصادر النتيجة. يدعم مسار Telegram إنشاء PDF عربي مع النصوص والمصادر الأساسية، ويجب مراجعة PDF بصرياً بعد التوليد لا الاكتفاء بوجود الملف.

## 10. Moodle

Moodle مصدر خارجي للسحب فقط. يدعم الربط عنوان Moodle وtoken وcourse ID و`curriculumKey`، ثم discovery تلقائي للأقسام والأنشطة والمجموعات والطلاب. المطابقة تستخدم الوسوم أولاً، ثم metadata الاسم، ثم fallback بالترتيب، مع `confidence` و`needsReview` وfingerprint.

الوسوم الموصى بها هي:

```text
bisalasa:idea:lesson03:idea01
bisalasa:idea:lesson03:idea02
bisalasa:homework:lesson03
```

تدعم المزامنة التفاضلية cursor لكل course map، ونافذة overlap، وprocessed keys لمنع إعادة معالجة نفس attempt أو submission. عند ثبات البيانات يزداد polling تدريجياً، وعند التغيير يعود إلى دورة أقصر. webhook اختياري ويستخدم HMAC وtimestamp ومنع duplicate، لكنه لا يلغي polling ولا يكتب إلى Moodle.

المرجع الكامل هو `MOODLE-INTEGRATION-REPORT.md`، والتصميم في `MOODLE-INTEGRATION-DESIGN.md`، ونتائج الاختبار في `MOODLE-REGRESSION-RESULTS.md`.

## 11. الذكاء الاصطناعي الاختياري

AI ميزة اختيارية يمكن تشغيلها أو إيقافها. توجد لوحة مدرسية لإدارة مفاتيح Google أو provider المتوافق، مع label وpriority وmodel وحالة التفعيل. تخزن المفاتيح مشفرة بـAES-256-GCM ولا تعاد القيمة الخام إلى المتصفح. عند وجود عدة مفاتيح، يختار النظام الأعلى أولوية المتاح ثم يدور عند limits أو الفشل بحسب العقد الحالي.

تغطي وظائف AI الحالية تحليل الدرس، استخراج السياق الذكي، توليد أسئلة، اقتراحات المدرس، وتكاملات model discovery عندما يوفر provider قائمة نماذج. لا يُفترض إرسال بيانات الطالب الخام إلى المزود دون سياسة واضحة؛ يجب استخدام sanitizer وتقليل البيانات إلى ما يلزم للمهمة. الاختبارات الحالية تستخدم mock provider، أما اختبار Gemini الحقيقي فيحتاج مفتاحاً يضيفه مالك التطبيق.

## 12. التقارير إلى Telegram والتكاملات

توجد طبقة تكامل منفصلة للتقارير وTelegram وCustom App. تستخدم Telegram في إرسال التقرير أو PDF عند إعداد credentials صحيحة. فشل الخدمة الخارجية لا يسقط التقرير المحلي؛ يسجل حالة الفشل ويعيد fallback واضحاً. Custom App يمكنه تزويد بسلاسة بحالة حية عبر endpoint inbound، مع ضرورة توقيع الطلبات وتطبيق idempotency في بيئة الإنتاج.

## 13. الأداء

جولة الأداء الأخيرة خفضت chunk صفحة الدخول من 464KB إلى 135KB تقريباً، أي تحسن يقارب 70.9%. تحقق ذلك عبر code splitting للألعاب، lazy loading لمكونات teacher-shell، lazy loading لـHowler، caching لاستخراج الأسئلة، `useDeferredValue` للبحث، `content-visibility:auto` للقوائم، وفهارس SQLite.

| المسار | p50 | p95 | الحد |
|---|---:|---:|---:|
| teacher-shell | 11.72ms | 93.85ms | 1500ms |
| student-shell | 6.58ms | 7.38ms | 1000ms |
| grades-all | 40.93ms | 52.99ms | 1500ms |
| grades-class | 36.10ms | 39.43ms | 1500ms |
| classes-api | 3.35ms | 6.21ms | 500ms |
| report-class-api | 32.92ms | 34.34ms | 1000ms |

هذه أرقام بيئة QA محلية وليست ضماناً لجهاز أو شبكة بعينها. لا يُحمل الطالب لوحات المدرس الثقيلة، ولا يعمل Moodle polling خارج غرفة المدرس النشطة.

## 14. الأمان والحدود

توجد headers أمنية، تشفير منفصل لـMoodle وAI وTelegram، وعدم عرض الأسرار الخام، وفصل وضع الطالب، والتحقق من payloads القادمة من التكاملات. ومع ذلك، فإن التشغيل المحلي الحالي ليس نظام multi-tenant عاماً. قبل النشر العام يجب إضافة مصادقة وتفويض لكل العمليات الهدامة، CSRF، حدود حجم backup، حماية أقوى للـwebhook، وتخزين أسرار إنتاجي مناسب.

SQLite مناسب لتشغيل مدرس محلي منفرد. عند الحاجة إلى عدة مدرسين أو كتابة متزامنة واسعة، يجب الانتقال إلى PostgreSQL أو TiDB بعد اختبار migrations وlocking.

### 14.1 إصلاحات الأمان (16 أغسطس 2026)

أُجريت جولة إصلاحات أمنية شاملة بعد المراجعة التحليلية. أبرز ما أُصلِح:

| المجال | الإصلاح |
|---|---|
| المصادقة | middleware جديد يحمي كل `/api/*` برمز مشترك (`AppSettings.apiToken`) يُولَّد تلقائياً ويُحفظ كـ httpOnly cookie. الأدوات الخارجية تستخدم `X-Bisalasa-Token` header |
| backup | `format=sql` معطّل (كان يُنزّل ملف DB بالأسرار). `restoreAll` الآن يتحقق من بنية الـJSON وقائمة بيضاء للجداول وحدود عدد الصفوف |
| settings | `settings.set` يستخدم قائمة بيضاء صارمة (45 مفتاح مسموح) — المفاتيح الحساسة (`apiToken`, `telegramToken`, `moodleToken`) تُرفض |
| students | أُزيلت `parentTelegramChatId` و`points` و`lastCalled` من `students.upsert`/`update` — يجب استخدام المسارات المخصصة (`awardPoints`, Telegram link flow) |
| Telegram | `scrubTelegramError` ينظف Bot Token من رسائل الأخطاء. `studentCode` أطول (16 hex بدل 8) |
| قاعدة البيانات | `PRAGMA foreign_keys=ON`, `busy_timeout=5000`, `journal_mode=WAL` مفعّلة عبر `dbReady`. أُضيفت `@relation` لـ StudentActivity/StudentNote/CelebrationEvent/TeacherInteraction |
| queue claims | جميع claims (`reports.schedules.claim`, `ai.retry.claim`, `telegram.queue.claim`) ذرّية الآن عبر `updateMany` optimistic lock |
| السبورة | `incremental draw` للقلم (O(1) بدل O(n)). `strokeBBox` بدل `Math.min(...xs)` لمنع crash. تصدير PNG يدمج الشريحة + الكتابة |
| الألعاب | `pickStudentFairDeferred` — العجلات لا تسجّل "تم الاستدعاء" إلا بعد اكتمال الدوران. QuizShow يحسب الفائز الفعلي. QuestionChallenge يحفظ مشاركي المجموعات |
| detachStudentHistory | يُعالج 12 جدول بدل 4 (studentBadge, studentGift, badgeProgress, achievements, snapshots, rewardEvents, etc.) |

## 15. الاختبارات الحالية

نجحت الجولة الأخيرة في 22 suite، إضافة إلى Master Audit، وتشمل Lesson Editor، live sync، concurrency، whiteboard، Smart Context، question contract، AI mock، AI limits، integrations، Moodle mapping، Moodle homework، Moodle live sync، Moodle security، advanced webhook/discovery، reports، students/classes/groups، privacy، API contract، DB concurrency، Telegram PDF، وperformance.

كما نجحت TypeScript بلا أخطاء، ESLint بلا أخطاء مع تحذيرين legacy، وproduction build باستخدام webpack. نتيجتا Moodle الأهم: mapping بـ18 check، وadvanced integration بـ20 check، وDelta Sync أثبت أن المزامنة الثانية غير المتغيرة تتجاوز السجلات بدلاً من إعادة معالجتها.

## 16. التشغيل المحلي

```bash
cd bisalasa-full-audit
pnpm install
pnpm exec prisma generate
DATABASE_URL='file:./data/custom.db' pnpm exec prisma db push
DATABASE_URL='file:./data/custom.db' pnpm run build
DATABASE_URL='file:./data/custom.db' pnpm run start
```

لإعادة تشغيل QA الحالي، استخدم المسار المباشر للأدوات عند وجود `node_modules` رمزي:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint src scripts --max-warnings=999
./node_modules/.bin/next build --webpack
PORT=3032 DATABASE_URL='file:/tmp/bisalasa-perf-final.db' NODE_ENV=production node .next/standalone/server.js
```

لا ينبغي وضع `.env` أو `node_modules` أو `.next` أو قواعد SQLite الخاصة بالاختبار داخل archive التسليم.

## 17. خريطة الوثائق

| الوثيقة | الحالة والغرض |
|---|---|
| `BISALASA-COMPLETE-DOCUMENTATION-AR.md` | المرجع الموحد الحالي |
| `CHANGES.md` | سجل التغييرات النهائي المحدث |
| `docs/historical/CHANGES_V3.md` | سجل مرحلة التدقيق الوظيفي السابقة مع تصحيح حالتها التاريخية |
| `PERFORMANCE-OPTIMIZATION-REPORT.md` | أرقام الأداء والregression الأخيرة |
| `MOODLE-INTEGRATION-REPORT.md` | تفاصيل Moodle الحالية |
| `MOODLE-REGRESSION-RESULTS.md` | نتائج اختبارات Moodle |
| `AI-REPORTS-DATA-GUIDE-AR.md` | AI، دورة البيانات، التقارير، PDF وTelegram |
| `MOODLE-INTEGRATION-DESIGN.md` | العقد المعماري والتشغيلي لـMoodle |
| `public/slides/USER_GUIDE.md` | دليل المدرس الحالي |
| `public/slides/QUICKSTART.md` | بدء التشغيل المختصر |
| `public/slides/VIBE_CODING_CONTRACT.md` | عقد بناء الشرائح |
| `moodle-browser-findings-v2.md` | قيد جلسة المتصفح وملاحظاته بصراحة |
| `CURRICULUM-FACTORY-IMPLEMENTATION-AR.md` | تنفيذ مصنع المناهج: المراحل، AI، الأسئلة، الخَبز، XML، الحزم والاختبارات |
| `docs/historical/curriculum-factory-browser-findings.md` | نتيجة فحص المتصفح لمصنع المناهج |
| `scripts/curriculum-factory-smoke.cjs` | اختبار مصنع المناهج القابل لإعادة التشغيل |

الملفات ذات الأسماء التي تحتوي على `PHASE` أو `AUDIT_FINDINGS` أو `qa/` تحفظ كسجلات تاريخية للأدلة. لا ينبغي قراءتها على أنها الحالة الحالية إذا خالفت هذه الوثيقة؛ يذكر كل سجل تاريخ ومجال الجولة التي ينتمي إليها.

## 18. مراجع خارجية

[1]: https://moodledev.io/docs/5.0/apis/subsystems/external — Moodle External Services documentation.
[2]: https://docs.moodle.org/dev/Web_service_API_functions — Moodle Web Service API functions.
[3]: https://docs.moodle.org/dev/Events_API — Moodle Events API.

تُستخدم هذه المراجع فقط لتحديد حدود Moodle الرسمية. أما حالة بسلاسة الفعلية فتُحدد بالكود والاختبارات والوثائق المحلية المذكورة في هذه الصفحة.
