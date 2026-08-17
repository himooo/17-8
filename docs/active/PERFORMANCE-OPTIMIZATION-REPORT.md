# تقرير تحسين الأداء والـRegression — بسلاسة

**تاريخ آخر قياس:** 15 أغسطس 2026

**المرجع العام:** `BISALASA-COMPLETE-DOCUMENTATION-AR.md`

## الحكم التنفيذي

اكتملت جولة تحسين الأداء دون تغيير فلسفة المنصة. يظل المدرس صاحب القرار، ويظل Moodle مصدراً للسحب والتحليل فقط، ولا تحمل صفحة الطالب لوحات المدرس الخاصة. نجحت TypeScript وESLint وproduction build وMaster Audit، كما نجح regression النهائي في 22 suite.

أهم مكسب هو خفض chunk صفحة الدخول من **464KB إلى 135KB** تقريباً، أي تحسن يقارب **70.9%**. هذا الرقم يخص bundle المقاس في بيئة QA، وليس ضماناً ثابتاً لكل جهاز أو شبكة.

## التحسينات المنفذة

| المجال | التغيير |
|---|---|
| الألعاب | تحويل 13 لعبة/مكوناً في `BottomControlBar.tsx` إلى `dynamic()` مع `ssr:false` وfallback خفيف |
| teacher-shell | تحويل 14 مكوناً في `page-client.tsx` إلى dynamic imports |
| وضع الطالب | عدم تحميل لوحات المدرس الثقيلة في `?view=student` |
| الصوت | تحميل Howler ديناميكياً عند أول تشغيل فقط |
| React | `useDeferredValue` للبحث و`content-visibility:auto` لصفوف الطلاب |
| الأسئلة | `WeakMap` caching لاستخراج أسئلة manifest مع إبقاء shuffle وasked IDs خارج cache |
| قاعدة البيانات | فهارس `Student(classId,name)` و`StudentActivity(studentId,sessionId,type)` |
| Next.js | `compress:true` و`poweredByHeader:false` مع headers الأمنية |
| Moodle | discovery وDelta Sync وadaptive polling لتقليل طلبات النتائج المتكررة |

## القياسات

تم تشغيل 10 عينات لكل endpoint على خادم production محلي في المنفذ 3032. الحدود التالية حدود smoke محافظة وليست benchmark عتادياً عالمياً.

| المسار | الحالة | p50 | p95 | المتوسط | الحد |
|---|---:|---:|---:|---:|---:|
| teacher-shell | 200 | 11.72ms | 93.85ms | 19.58ms | 1500ms |
| student-shell | 200 | 6.58ms | 7.38ms | 6.64ms | 1000ms |
| grades-all | 200 | 40.93ms | 52.99ms | 41.97ms | 1500ms |
| grades-class | 200 | 36.10ms | 39.43ms | 35.73ms | 1500ms |
| classes-api | 200 | 3.35ms | 6.21ms | 3.58ms | 500ms |
| report-class-api | 200 | 32.92ms | 34.34ms | 32.78ms | 1000ms |

**النتيجة:** 6/6 endpoints نجحت ولا توجد failures.

## Regression النهائي

| المجموعة | النتيجة |
|---|---:|
| Lesson Editor | PASS |
| Live Sync وconcurrency | PASS |
| Whiteboard sync | PASS |
| Smart Context وquestion contract | PASS |
| AI mock وlimits/rotation | PASS |
| Custom integrations | PASS |
| Moodle mapping | PASS — 18 checks |
| Moodle homework | PASS — 16 checks |
| Moodle live sync | PASS — 12 checks |
| Moodle security | PASS |
| Moodle advanced discovery/webhook | PASS — 20 checks |
| Unified وlarge-class reports | PASS |
| Students/classes/groups | PASS |
| Student privacy | PASS |
| API contract | PASS |
| DB relational concurrency | PASS |
| Telegram PDF | PASS |
| Performance smoke | PASS — 6/6 |
| Master audit | PASS بالكامل |

## إثبات Delta Sync

بعد reset cursor في بيئة الاختبار، التقطت الجولة الأولى النتائج، ثم تخطت الجولة الثانية السجلات غير المتغيرة:

```json
{
  "first": {
    "mode": "initial",
    "students": 2,
    "attempts": 4,
    "changed": 2,
    "skipped": 1,
    "requests": 5,
    "homeworkSnapshots": 2,
    "homeworkQuestions": 50
  },
  "second": {
    "mode": "delta",
    "students": 2,
    "attempts": 0,
    "changed": 0,
    "skipped": 4,
    "requests": 4,
    "homeworkSnapshots": 0,
    "homeworkQuestions": 0
  }
}
```

## فحص المتصفح

تم فتح `/` و`/?view=student` و`/grades` عبر المتصفح الداخلي. أظهر الخادم عنوان غرفة العمليات وشاشة فراغ مفهومة عند عدم وجود درس، ونجح مسار `/grades` عبر HTTP والـAPI في عرض التقرير. في آخر جلسة Browser Sandbox، بقيت الصفحة على fallback ولم تبدأ client effects الخاصة بتحميل SQLite رغم أن `/api/db/classes.list` و`/api/db/lessons.list` أعادا بيانات صحيحة؛ تم توثيق ذلك في `moodle-browser-findings-v2.md` باعتباره قيد جلسة متصفح منفصلاً، وليس فشل route أو بيانات.

## Quality gates

- TypeScript: PASS، صفر أخطاء.
- ESLint: PASS، صفر أخطاء مع تحذيرين legacy فقط في `IframeStage.tsx` و`StudentCard.tsx`.
- Production build: PASS باستخدام `next build --webpack`.
- Master audit: PASS.
- Archive: يستبعد `.env` و`node_modules` و`.next` وقواعد SQLite.

## إعادة التشغيل

```bash
cd bisalasa-full-audit
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint src scripts --max-warnings=999
./node_modules/.bin/next build --webpack

env BASE=http://127.0.0.1:3032 node scripts/performance-smoke.cjs
bash scripts/master_plan_audit.sh
```

## الحدود العملية

القياسات محلية، وSQLite موجه لمدرس واحد. OffscreenCanvas ليس شرطاً للسبورة الحالية؛ التطبيق يستخدم RAF throttling، ويمكن نقل state عالي التردد إلى refs لاحقاً إذا أثبت القياس فائدته. كما أن الأداء النهائي يعتمد على حجم manifest وعدد الطلاب والعتاد المحلي.


## قياس Curriculum Factory — 15 أغسطس 2026

تم قياس `/curriculum-factory` عشر مرات على خادم QA الإنتاجي بعد البناء الأخير. النتيجة: الحد الأدنى **2.87ms**، وp50 **3.23ms**، وp95 **4.47ms**، والمتوسط **3.43ms**. المسار مستقل ومخصص للمدرس، ولا يدخل عرض الطالب أو polling أو chunk العرض الأساسي. استدعاءات AI لا تعمل عند فتح الصفحة؛ لا تبدأ إلا بعد ضغط المدرس على عملية الهيكلة أو توليد الأسئلة.

كما نجح `scripts/curriculum-factory-smoke.cjs` في 10 checks، ونجح `tsc --noEmit` و`next build --webpack` وPerformance Smoke وMaster Audit بعد إضافة المصنع.


## تحديث V19 — تدقيق الأداء الكامل وإغلاق الاختناقات

**تاريخ القياس النهائي:** 15 أغسطس 2026. تم القياس على build production باستخدام `next build --webpack` وخادم standalone محلي على `127.0.0.1:3036`، مع 20 عينة لكل مسار وقاعدة SQLite منفصلة. هذه أرقام QA محلية وليست ضماناً لزمن شبكة أو جهاز بعينه.

### ما تم إصلاحه

| المجال | التنفيذ النهائي | الأثر المقصود |
|---|---|---|
| الصوت | Howler أصبح dynamic import، ولا تُنشأ Howl ولا تُحمّل أصوات عند boot؛ إعادة استخدام cache لكل source ومنع الطلبات المتزامنة المكررة | صفر طلبات صوت في boot النظيف، وتحميل الصوت عند أول تشغيل فقط |
| الهدايا | WebP للأصول المدمجة، `loading="lazy"` و`decoding="async"` في اللوحات، وتطبيع سجلات PNG القديمة إلى WebP وقت القراءة مع إبقاء `DEFAULT_GIFTS` متوافقاً مع العقود القديمة | تقليل نقل الصور، وعدم كسر قواعد SQLite القديمة أو اختبارات V13 |
| التقارير | TTL داخلي قصير 750ms لتجميع الطلبات المتكررة لتقرير الطالب/الفصل، بما في ذلك `reports.games` و`reports.teacher`، مع حذف cache عند الخطأ | منع إعادة تنفيذ عشرات الاستعلامات عند إعادة العرض أو الضغط المتتابع، مع بقاء التحديث شبه فوري للمدرس |
| قاعدة البيانات | فهارس مركبة لاستعلامات activities وcelebrations وnotes وteacher interactions وattempts وhomework results وgame results | تقليل full scans في أكثر مسارات التقرير استخداماً |
| الرسوميات | فصل `ReportPerformanceChart.tsx` عن `ReportAnalyticsV10.tsx` وتحميله ديناميكياً | لا يدخل recharts في مسار تقرير الصف النصي/الجداول أو shell؛ يُحمّل عند فتح الرسم فقط |
| الجلسات | جعل `sessions.end` idempotent باستخدام `updateMany` وتحديث عقد `local-db` إلى `{ count }` | منع خطأ P2025 عند بقاء sessionId قديم في متصفح أو تبويب بعد reset، مع الحفاظ على statsJson |
| Moodle | الإبقاء على adaptive polling وDelta Sync وvisibility pause؛ لم يُضف polling أسرع بلا حاجة | الحفاظ على pull-only وتقليل الحمل على Moodle أثناء غياب المدرس عن الصفحة |

### القياس قبل/بعد

| المسار | baseline السابق | V19 p50 | V19 p95 | V19 المتوسط | الحد | الحالة |
|---|---:|---:|---:|---:|---:|---|
| teacher-shell | 16.70ms | 11.88ms | 20.66ms | 24.47ms | 1500ms | PASS |
| student-shell | 11.39ms | 6.39ms | 9.80ms | 6.86ms | 1000ms | PASS |
| grades-all | 13.21ms | 4.89ms | 8.43ms | 9.28ms | 1500ms | PASS |
| grades-class | 10.82ms | 4.69ms | 6.56ms | 4.83ms | 1500ms | PASS |
| classes-api | 4.36ms | 3.50ms | 6.24ms | 4.97ms | 500ms | PASS |
| report-class-api | 5.90ms | 2.62ms | 4.99ms | 2.90ms | 1000ms | PASS |

تحسن p50 المحسوب من baseline إلى V19 يقارب **29% في teacher-shell**، و**44% في student-shell**، و**55% في grades-all**، و**57% في grades-class**، و**56% في report-class-api**. بعض المتوسطات تتأثر ببدء تشغيل SQLite ووقت أول request، لذلك تم اعتماد p50/p95 للحكم التشغيلي بدلاً من المتوسط وحده.

### الحزم والأصول

ظل chunk صفحة الدخول النهائي عند **130,946 bytes**، أي نحو 131KB، ولم يدخل إليه `recharts` أو Howler. يظل هذا متسقاً مع التخفيض التاريخي من 464KB إلى قرابة 135KB، ولا توجد عودة للحجم السابق. أصبح الرسم البياني في chunk منفصل، بينما بقي `xlsx` lazy داخل export handlers فقط. تم الاحتفاظ بـPNG كمرجع أصلي للاختبارات والتوافق، ويستخدم runtime أصول WebP المدمجة عند توفرها.

### إثبات قاعدة البيانات

نفذ `scripts/query-plan-check.py` على قاعدة V19. استخدمت استعلامات التقارير الفعلية الفهارس التالية: `student_activities_studentId_sessionId_createdAt_idx`، و`celebration_events_studentId_sessionId_firedAt_idx`، و`student_notes_studentId_sessionId_createdAt_idx`، و`teacher_interactions_studentId_sessionId_createdAt_idx`، و`game_results_sessionId_startedAt_idx`. استخدم استعلام المحاولات فهرس الطالب مع submittedAt، وهو اختيار منطقي من SQLite مع شرط `IN` على عدة ideaRunIds. لم يظهر full table scan في هذه المسارات.

### الاختبارات النهائية

| البوابة | النتيجة |
|---|---:|
| TypeScript | PASS — صفر أخطاء |
| Prisma validate | PASS |
| Production build V19 | PASS |
| ESLint | PASS — صفر أخطاء، تحذيران legacy فقط في `IframeStage.tsx` و`StudentCard.tsx` |
| Math | PASS — 20/20 |
| Fairness | PASS — 11/11 |
| Whiteboard/Games | PASS — 22/22 |
| Settings/AI pure | PASS — 20/20 |
| Reports/Telegram pure | PASS — 18/18 |
| Rewards/Assets V13 | PASS — 74/74 |
| Curriculum Factory | PASS — 23/23 |
| Settings/AI API | PASS — 16/16 |
| Reports/Telegram API | PASS — 23/23 باستخدام Telegram mock |
| Moodle Security | PASS — 4/4 |
| Moodle Advanced | PASS — 40/40 |
| Moodle Mapping | PASS — 18/18 |
| Moodle Live Delta Sync | PASS — 12/12 |
| Moodle Homework | PASS — 16/16 |
| Performance Smoke | PASS — 6/6 endpoints، 20 عينة لكل endpoint |

تم أيضاً جعل `scripts/moodle-advanced-integration-smoke.cjs` مستقلاً عن ترتيب الاختبارات بإنشاء طلاب QA محليين وربطهم صراحةً بـMoodleStudentMap؛ لم يتم تخفيف validation في التطبيق، وظل webhook يرفض الحدث غير المربوط بحالة `pending-validation`.

### تحقق المتصفح والحدود

أظهر قياس boot المتصفح الموثق في `docs/historical/PERFORMANCE-BROWSER-V14-BOOT-AR.md` **48 مورداً**، وصفر ملفات صوت وصفر صور هدايا عند boot النظيف. لاحقاً أصبحت جلسة Browser Sandbox غير متاحة بعد timeout أثناء محاولة إعادة فتح QA V17، لذلك لم أعدّ جلسة المتصفح الأخيرة نجاحاً جديداً؛ تم الاعتماد في الحكم النهائي على قياس boot المتصفح الموثق، وعلى curl/QA smoke/build وquery plan والاختبارات البرمجية. التطبيق لا يزال يحافظ على الخصوصية التشغيلية: لوحات AI والملاحظات والتقارير تبقى في مسار المدرس، ووضع الطالب لا يحملها، وMoodle لا يستقبل كتابات من المنصة.

### إعادة التشغيل

```bash
cd /home/ubuntu/bisalasa-final-recovered/bisalasa-full-audit
DATABASE_URL='file:/tmp/bisalasa-perf-v19.db' ./node_modules/.bin/prisma db push --accept-data-loss
npm run build
DATABASE_URL='file:/tmp/bisalasa-perf-v19.db' PORT=3036 NODE_ENV=production node .next/standalone/server.js
BASE=http://127.0.0.1:3036 SAMPLES=20 node scripts/performance-smoke.cjs
python3 scripts/query-plan-check.py /tmp/bisalasa-perf-v19.db
```

النسخة النهائية لا تضم `.env` أو `node_modules` أو `.next` أو قواعد SQLite الخاصة بالاختبار. 
