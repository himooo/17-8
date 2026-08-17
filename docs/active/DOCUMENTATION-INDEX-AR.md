# فهرس توثيق منصة بسلاسة

**آخر تحديث:** 17 أغسطس 2026

## تنظيم مجلد docs (جديد 17 أغسطس 2026)

نُقلت الوثائق إلى بنية فاصلة تمنع خلط الحالي بالتاريخي:

| المكان | المحتوى |
|---|---|
| `docs/active/` | الوثائق الحالية المعتمدة فقط (هذا الفهرس وبقية الجدول أدناه) |
| `docs/historical/` | كل جولات التدقيق والسجلات والخطط القديمة ومخرجات QA (108 عنصراً) |
| `public/slides/*.md` | وثائق الشرائح والعقد ودليل المدرس — تبقى مكانها لأنها أصول runtime تُخدم للعميل |
| `backups/` | أرشيفات مصدر سابقة |

المرجع السريع للوكيل المستقبلي: اقرأ `docs/active/` لفهم الحالة الحالية، ولا تعتمد على شيء في `docs/historical/` إلا للتحقيق في سبب قرار قديم.

## كيف تُقرأ الوثائق

إذا أردت معرفة حالة المنصة الحالية، ابدأ بـ`BISALASA-COMPLETE-DOCUMENTATION-AR.md`. إذا أردت أرقام الأداء والـregression، استخدم `PERFORMANCE-OPTIMIZATION-REPORT.md`. إذا أردت إعداد Moodle، استخدم `MOODLE-INTEGRATION-REPORT.md` ثم `MOODLE-INTEGRATION-DESIGN.md`. إذا أردت تشغيل المدرس، استخدم `public/slides/USER_GUIDE.md` و`public/slides/QUICKSTART.md`. إذا أردت بناء درس أو شريحة جديدة، استخدم `public/slides/VIBE_CODING_CONTRACT.md`.

## الوثائق الحالية المعتمدة

| الوثيقة | الاستخدام |
|---|---|
| `BISALASA-COMPLETE-DOCUMENTATION-AR.md` | المرجع الكامل للفلسفة والبنية والخصائص والتحديثات والاختبارات والتشغيل |
| `DOCUMENTATION-INDEX-AR.md` | هذا الفهرس ومسار القراءة |
| `CHANGES.md` | سجل التغييرات الموحد حتى 15 أغسطس 2026 |
| `bisalasa_final_test_report_ar.md` | الحكم النهائي ونتائج التدقيق الحالية والحدود |
| `PERFORMANCE-OPTIMIZATION-REPORT.md` | code splitting وlazy loading وcaching والفهارس والأرقام الحالية |
| `MOODLE-INTEGRATION-REPORT.md` | إعداد Moodle وdiscovery وDelta Sync وwebhook والأمان |
| `MOODLE-INTEGRATION-DESIGN.md` | العقد المعماري لتكامل Moodle |
| `MOODLE-REGRESSION-RESULTS.md` | مصفوفة اختبارات Moodle الحديثة |
| `AI-REPORTS-DATA-GUIDE-AR.md` | AI، دورة بيانات الطالب، التقارير، PDF وTelegram |
| `moodle-browser-findings-v2.md` | قيد جلسة المتصفح وما ثبت عبر API فعلياً |
| `public/slides/USER_GUIDE.md` | دليل المدرس الشامل |
| `public/slides/QUICKSTART.md` | تشغيل سريع خلال دقائق |
| `public/slides/VIBE_CODING_CONTRACT.md` | العقد الإلزامي لبناء الشرائح والتواصل مع Shell |
| `public/slides/SLIDE_SCHEMA.md` | تعريفات manifest والأنواع |
| `public/slides/SLIDE_CONFIGURATION.md` | إعدادات الشرائح والقوالب |

## الوثائق التاريخية المساندة

انتقلت هذه المجموعة بالكامل إلى `docs/historical/`. الملفات التي تحمل `PHASE` أو `AUDIT_FINDINGS` أو `FINAL_` أو `FULL_` أو `REPORT_` أو تبدأ بـ`qa-` تمثل جولات تدقيق سابقة. أُضيفت إليها لافتة توضّح أنها تاريخية، ولذلك يمكن استخدامها لمعرفة سبب إصلاح معين، لكن لا تستخدم أرقامها القديمة بديلاً عن الوثائق الحالية.

تشمل هذه المجموعة سجلات المتصفح، تقارير PDF، تقارير الطلاب والمجموعات، خطط التدقيق، مصفوفات المخاطر، وملاحظات جولات AI وMath وTelegram. وجودها مقصود للحفاظ على traceability، وليس لأنها تمثل release منفصلاً يجب تشغيله اليوم.

## ترتيب القراءة حسب المهمة

| المهمة | ترتيب القراءة |
|---|---|
| فهم فلسفة المنصة | الوثيقة الكاملة ثم عقد الشرائح |
| استخدام المدرس | QUICKSTART ثم USER_GUIDE |
| إضافة درس | VIBE_CODING_CONTRACT ثم SLIDE_SCHEMA ثم SLIDE_CONFIGURATION |
| إعداد Moodle | MOODLE-INTEGRATION-REPORT ثم DESIGN ثم REGRESSION-RESULTS |
| فهم AI | الوثيقة الكاملة ثم `AI-REPORTS-DATA-GUIDE-AR.md` ثم CHANGES.md وملفات AI في المصدر |
| فحص الأداء | PERFORMANCE-OPTIMIZATION-REPORT ثم regression results |
| مراجعة التقارير وPDF | `AI-REPORTS-DATA-GUIDE-AR.md` ثم الوثيقة الكاملة ثم تقارير QA التاريخية ذات اللافتة |
| إعادة الاختبار | أوامر `PERFORMANCE-OPTIMIZATION-REPORT.md` ثم `scripts/master_plan_audit.sh` |

## قواعد الاتساق

يجب أن تحمل أي وثيقة جديدة تاريخاً واضحاً، وأن تذكر إن كانت مرجعاً حالياً أو سجلاً تاريخياً. يجب عدم إدخال أرقام p50/p95 أو منافذ أو عدد suites من جولة قديمة في وثيقة حالية. يجب عدم وصف webhook بأنه جزء لازم من Moodle القياسي، لأنه مسار اختياري يحتاج plugin أو relay. ويجب عدم وصف AI الحقيقي بأنه مختبر بمفتاح Google؛ الاختبار الحالي يستخدم mock provider ما لم يذكر سجل مستقل خلاف ذلك.

## التشغيل والاختبار

تحديث 17 أغسطس 2026: أصبحت أوامر التشغيل متوافقة مع Windows وLinux معاً (سكريبتات node بدل أوامر bash)، ومسار قاعدة البيانات موحّد في `.env` بقيمة `file:../data/custom.db` أي `<جذر المشروع>/data/custom.db` — مسار واحد للـCLI ووقت التشغيل والإنتاج، ولا حاجة لتصدير `DATABASE_URL` يدوياً في أي أمر.

```bash
pnpm install
node_modules/.bin/prisma generate      # أو: npm run db:generate
npm run build                          # prisma db push + next build --webpack + تجميع standalone
npm run start                          # يشغّل .next/standalone/server.js مع DATABASE_URL الصحيح

node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint src scripts --max-warnings=999
# على Windows استخدم node_modules\.bin\<الأداة>
env BASE=http://127.0.0.1:3032 node scripts/performance-smoke.cjs   # Windows: set BASE=... ثم node
bash scripts/master_plan_audit.sh      # يتطلب بيئة bash (Git Bash/WSL على Windows)
```

## مراجع Moodle الرسمية

[1]: https://moodledev.io/docs/5.0/apis/subsystems/external — Moodle External Services.
[2]: https://docs.moodle.org/dev/Web_service_API_functions — Moodle Web Service API functions.
[3]: https://docs.moodle.org/dev/Events_API — Moodle Events API.

تحدد هذه المراجع حدود Moodle الرسمية، بينما تحدد الوثائق المحلية الحالة الفعلية لتكامل بسلاسة.


## إضافة 15 أغسطس 2026 — Curriculum Factory

أضيفت وثيقة `CURRICULUM-FACTORY-IMPLEMENTATION-AR.md` كمرجع التنفيذ الحالي لمصنع المناهج. وهي توثق المراحل الخمس، Drafts، قوالب AI، Manifest، الأسئلة، الربط التلقائي، LaTeX، الخَبز الذري، Moodle XML، JSON Pack، النسخ الاحتياطي، الأداء والاختبارات. كما يوثق `docs/historical/curriculum-factory-browser-findings.md` نتيجة الفحص البصري المنفصلة، ويغطي `scripts/curriculum-factory-smoke.cjs` عقد الاختبار القابل لإعادة التشغيل.

مسار القراءة المقترح للميزة هو: `public/slides/QUICKSTART.md` ثم `CURRICULUM-FACTORY-IMPLEMENTATION-AR.md` ثم `public/slides/VIBE_CODING_CONTRACT.md` و`public/slides/SLIDE_SCHEMA.md`، وبعدها `PERFORMANCE-OPTIMIZATION-REPORT.md` ونتائج الاختبارات.


## تحديث 7-Star — 15 أغسطس 2026

أصبح `CURRICULUM-FACTORY-IMPLEMENTATION-AR.md` المرجع التفصيلي لإصدار 7-Star من المصنع. يجب أن يقرأ المراجع داخله الأقسام الخاصة بمحرك AI المخصص، التحكم الدقيق في الأسئلة، Quality Gate، Moodle XML V2، `CurriculumDraftVersion`، المعاينة الحية، Backup/Restore، والاختبارات.

| المكوّن | المرجع |
|---|---|
| إعداد AI لكل مرحلة وسحب الموديلات | `src/app/curriculum-factory/page.tsx` و`AI-REPORTS-DATA-GUIDE-AR.md` |
| Quality Gate وأنواع الأسئلة | `CURRICULUM-FACTORY-IMPLEMENTATION-AR.md` و`src/app/curriculum-factory/page.tsx` |
| versioning والاستعادة | `prisma/schema.prisma` و`src/app/api/db/[operation]/route.ts` |
| Backup/Restore للإصدارات | `src/app/api/backup/route.ts` |
| Moodle XML وLaTeX وfeedback | `CURRICULUM-FACTORY-IMPLEMENTATION-AR.md` |
| المعاينة الحية وقيد Browser Sandbox | `docs/historical/curriculum-factory-browser-findings.md` |
| اختبار المصنع | `scripts/curriculum-factory-smoke.cjs` — 15 check |
| أداء الإصدار | `PERFORMANCE-OPTIMIZATION-REPORT.md` و`CHANGES.md` |

آخر حالة اختبارية موحدة لهذه الإضافة: TypeScript PASS، ESLint للملفات المعدلة PASS، production build PASS، AI mock PASS بنتيجة 21/21، Curriculum Factory smoke PASS بنتيجة 15 check، Performance Smoke PASS بنتيجة 6/6، وMaster Audit PASS. هذه الأرقام تخص جولة 15 أغسطس 2026، ولا تستبدلها أرقام السجلات التاريخية.


## تحديث 15 أغسطس 2026 — نظام العدالة الكامل V10

المرجع الأساسي لنظام العدالة هو `FAIRNESS-V10-IMPLEMENTATION-AR.md`. يشرح هذا الملف البوابة الموحدة، طبقات عدالة الفكرة والدرس والأداء والجلسة، إعدادات متوقف/لطيف/صارم، تسجيل `fair-pick`، ربط الألعاب والعجلات والاختيار اليدوي والتليبرومبتر وHotPotato، لوحة المراقبة، التقارير، Telegram، وحدود historical V10.5 الاختيارية.

| المكوّن | المرجع |
|---|---|
| بوابة الاختيار والمعادلة | `src/lib/game-utils.ts` |
| عدادات الجلسة وأداء الفكرة | `src/lib/shell-store.ts` |
| Hook الألعاب | `src/lib/useGameStudentPicker.ts` |
| لوحة العدالة | `src/components/shell/LessonFairnessPanel.tsx` |
| إعدادات الوضع | `src/components/shell/panels/SettingsPanel.tsx` |
| الاختيار اليدوي | `src/components/shell/panels/StudentsPanel.tsx` |
| العجلات والألعاب | `src/components/shell/RandomStudentWheel.tsx` و`LuckyWheelGame.tsx` و`HotPotatoGame.tsx` |
| عقد التقارير | `src/lib/report-contract.ts` و`src/lib/report-aggregator.ts` |
| Telegram PDF | `src/lib/telegram-report-pdf.ts` و`src/app/api/telegram/route.ts` |
| الاختبار القابل لإعادة التشغيل | `scripts/fairness-v10-smoke.ts` عبر `npm run test:fairness` |
| نتائج المتصفح | `docs/historical/fairness-v10-browser-findings.md` |

مسار إعادة الاختبار الموصى به هو: `npm run test:fairness`، ثم `./node_modules/.bin/tsc --noEmit`، ثم `./node_modules/.bin/eslint src scripts --max-warnings=999`، ثم `./node_modules/.bin/next build --webpack`، وبعدها `scripts/curriculum-factory-smoke.cjs` و`scripts/performance-smoke.cjs` و`scripts/master_plan_audit.sh`.


## تحديث 15 أغسطس 2026 — Moodle Integration V10

أصبح `MOODLE-INTEGRATION-REPORT.md` المرجع النهائي لتكامل Moodle بعد إغلاق المراجعة الحرجة V9. يشرح التقرير Data Validation وpending-validation وMoodleSyncRetry وReconciliation وManual Mapping وStandalone Mode وHealth Dashboard وHealth Probe وTag Drift وMulti-course Sync وGroup Sync، مع حدود التشغيل وقرار pull-only.

| المهمة | المرجع |
|---|---|
| فهم الفجوات التي كانت موجودة | `docs/historical/MOODLE-V10-GAP-ANALYSIS-AR.md` |
| فهم التنفيذ النهائي | `MOODLE-INTEGRATION-REPORT.md` |
| فحص webhook والـvalidation | `src/app/api/moodle/webhook/route.ts` و`src/lib/moodle-v10.ts` |
| retry queue | `src/app/api/moodle/retry/route.ts` و`prisma/schema.prisma` |
| health وreconcile وgroup sync | `src/app/api/moodle/route.ts` |
| لوحة الصحة والربط اليدوي | `src/components/shell/panels/MoodlePanel.tsx` |
| Standalone question delivery | `src/lib/question-provider.ts` و`src/lib/useGameStudentPicker.ts` |
| اختبار V10 الموسع | `scripts/moodle-advanced-integration-smoke.cjs` — 40 check |
| اختبارات regression | `scripts/moodle-mapping-e2e.cjs` — 18، `scripts/moodle-live-sync-e2e.cjs` — 12، `scripts/moodle-homework-results-e2e.cjs` — 16، `scripts/moodle-security-smoke.ts` — 4 |

أوامر التشغيل الرسمية هي `npm run test:moodle:security` و`npm run test:moodle:advanced` و`npm run test:moodle:mapping` و`npm run test:moodle:live` و`npm run test:moodle:homework`. يجب تشغيلها مع خادم QA وmock Moodle عند اختبار endpoints، بينما security smoke يعمل محلياً عبر `node --experimental-strip-types`.


## تحديث 15 أغسطس 2026 — Curriculum Factory V10 Critical Review Closure

المرجع التنفيذي المحدث هو `CURRICULUM-FACTORY-IMPLEMENTATION-AR.md`، بينما يربط `docs/historical/CURRICULUM-FACTORY-V10-CRITICAL-REVIEW-RESULTS-AR.md` كل فجوة في مراجعة V9 بالإصلاح والاختبار المقابل. أضيفت أيضاً `docs/historical/curriculum-factory-v10-browser-findings.md` لنتيجة boot والواجهة.

| المكوّن | المرجع |
|---|---|
| حفظ الحلول والأنواع والصور عند الخَبز | `prisma/schema.prisma` و`src/app/api/db/[operation]/route.ts` |
| البحث والفلترة والbulk وإعادة الترتيب | `src/app/curriculum-factory/page.tsx` |
| Question/Lesson Templates | `src/app/api/db/[operation]/route.ts` و`src/lib/local-db.ts` |
| Quality Gate وLaTeX وduplicate وcoverage | `src/app/curriculum-factory/page.tsx` |
| رفع الصور الآمن | `src/app/api/curriculum-factory/assets/route.ts` |
| Prompt variables/examples/testing/usage/compare | `src/app/api/ai/route.ts` و`src/app/curriculum-factory/page.tsx` |
| SSE streaming | `src/app/api/ai/stream/route.ts` |
| Error Boundary وlocal recovery | `src/app/curriculum-factory/error.tsx` و`page.tsx` |
| الاختبار الرسمي | `npm run test:curriculum-factory` — PASS 23/23 |

هذه الجولة هي المرجع الحالي لإصدار V10، ولا ينبغي استخدام أرقام smoke القديمة 10 أو 15 بديلاً عن نتيجة 23/23.


## تحديث 15 أغسطس 2026 — Whiteboard/Games/Rewards V10

المرجع التنفيذي الجديد هو `WHITEBOARD-GAMES-V10-IMPLEMENTATION-AR.md`. يربط التقرير كل فجوة في مراجعة `14-WHITEBOARD-GAMES-CELEBRATIONS-GIFTS-BADGES-SOUNDS-V9-CRITICAL-REVIEW.md` بالإصلاح والدليل والاختبار، ويفصل الميزات الاختيارية التي تحتاج مزوداً أو بيئة تشغيل خارجية عن المسار المحلي المعتمد.

| المكوّن | المرجع |
|---|---|
| مطابقة مراجعة V9 وترتيب الفجوات | `docs/historical/WHITEBOARD-GAMES-V10-TRIAGE-AR.md` |
| التنفيذ النهائي ومصفوفة الإغلاق | `WHITEBOARD-GAMES-V10-IMPLEMENTATION-AR.md` |
| نتائج المتصفح والتنزيلات الفعلية | `docs/historical/WHITEBOARD-GAMES-V10-BROWSER-FINDINGS-AR.md` |
| عقود الصفحات والطبقات والمعادلات والـsnap/replay | `src/lib/whiteboard-v10.ts` |
| عقود الألعاب والتكيف والتحليلات والمشاركة | `src/lib/game-v10.ts` |
| عقود الجوائز والتسلسلات ومكسر الصوت | `src/lib/rewards-audio-v10.ts` |
| دمج السبورة الفعلي | `src/components/shell/SmartWhiteboard.tsx` و`MathToolsPanel.tsx` |
| لوحة المدرس للمكافآت | `src/components/shell/panels/RewardsV10Panel.tsx` |
| DB/dispatcher/facade | `prisma/schema.prisma` و`src/app/api/db/[operation]/route.ts` و`src/lib/local-db.ts` |
| اختبار العقود | `scripts/whiteboard-games-v10-smoke.ts` — **22/22** |
| اختبار API والذرية والتنظيف | `scripts/whiteboard-games-v10-api-smoke.cjs` — **18/18** |

مسار القراءة المقترح هو: `docs/historical/WHITEBOARD-GAMES-V10-TRIAGE-AR.md` ثم `WHITEBOARD-GAMES-V10-IMPLEMENTATION-AR.md` ثم `docs/historical/WHITEBOARD-GAMES-V10-BROWSER-FINDINGS-AR.md`، وبعدها `CHANGES.md` و`PERFORMANCE-OPTIMIZATION-REPORT.md`. لإعادة الاختبار تُشغّل أوامر `npm run test:whiteboard-games-v10` و`BASE=http://127.0.0.1:3032 node scripts/whiteboard-games-v10-api-smoke.cjs` مع بوابة TypeScript وESLint وproduction build وباقي regression.

تظل Three.js وWebSocket/WebRTC وvoice cloning وAI TTS المدفوع وOffscreenCanvas ميزات اختيارية موثقة، وليست متطلبات للمسار المحلي. لا ينبغي وصفها بأنها مفعلة افتراضياً أو تشغيلية بلا مزود أو قياس أو سياسة خصوصية مناسبة.


## تحديث 15 أغسطس 2026 — Settings + AI + External APIs V10

المرجع التنفيذي الحالي هو `SETTINGS-AI-V10-IMPLEMENTATION-AR.md`. يربط هذا التقرير فجوات مراجعة `13-SETTINGS-AI-EXTERNAL-APIS-V9-CRITICAL-REVIEW.md` بالإصلاحات الفعلية في Settings وAI وmedia وTTS وwebhooks وREST، ويفصل بوضوح ما يحتاج مزوداً خارجياً فعلياً.

| المكوّن | المرجع |
|---|---|
| مطابقة V9 وقرارات التنفيذ | `docs/historical/SETTINGS-AI-EXTERNAL-APIS-V10-TRIAGE-AR.md` |
| بحث Settings وtabs وprofiles وvalidation | `src/components/shell/panels/SettingsPanel.tsx` و`src/lib/settings-ai-v10.ts` |
| AI routing وrotation وusage وhistory | `src/app/api/ai/route.ts` و`src/lib/local-db.ts` |
| إدارة مزودي AI وFetch Models | `src/components/shell/panels/AiPanel.tsx` |
| image/vision/STT/embeddings | `src/app/api/ai/media/route.ts` |
| TTS adapters وfallback | `src/app/api/tts/route.ts` |
| webhook HMAC وSSRF وretry وREST read-only | `src/lib/webhook-v10.ts` و`src/app/api/webhooks/route.ts` |
| schema وCRUD والـqueues والـmemory | `prisma/schema.prisma` و`src/app/api/db/[operation]/route.ts` |
| اختبار العقود | `scripts/settings-ai-v10-smoke.ts` — **20/20** |
| اختبار API/DB/mock/security | `scripts/settings-ai-v10-api-smoke.cjs` — **16/16** |
| نتائج المتصفح | `docs/historical/SETTINGS-AI-V10-BROWSER-FINDINGS-AR.md` |
| سجل regression الكامل | `SETTINGS-AI-V10-FULL-REGRESSION.log` |
| ملخص الاختبارات | `docs/historical/SETTINGS-AI-V10-TEST-RESULTS-AR.md` |

مسار القراءة الموصى به هو: `docs/historical/SETTINGS-AI-EXTERNAL-APIS-V10-TRIAGE-AR.md` ثم `SETTINGS-AI-V10-IMPLEMENTATION-AR.md` ثم `docs/historical/SETTINGS-AI-V10-TEST-RESULTS-AR.md` ونتائج المتصفح، وبعدها `CHANGES.md`. إعادة الاختبار تستخدم `npm run test:settings-ai-v10` و`BASE=http://127.0.0.1:3032 npm run test:settings-ai-v10-api` بالإضافة إلى TypeScript وESLint وproduction build وباقي regression.

المراجع الخارجية المستخدمة في التصميم محفوظة في `AI-EXTERNAL-API-RESEARCH-AR.md`، ولا تعني أن اتصالاً حقيقياً بمزود مدفوع تم تشغيله في QA. الميزات التي تحتاج مفتاحاً أو endpoint أو بيئة متعددة الأجهزة تبقى capability-gated ولا تُفعل تلقائياً.


## تحديث 15 أغسطس 2026 — Reports + Telegram + Components V10

المرجع التنفيذي الحالي لمحور التقارير وTelegram والمكونات هو `REPORTS-TELEGRAM-COMPONENTS-V10-IMPLEMENTATION-AR.md`. يطابق التقرير مراجعة `15-REPORTS-TELEGRAM-COMPONENTS-V9-CRITICAL-REVIEW.md` مع التنفيذ الفعلي، ويفصل الفجوات المغلقة عن adapters الاختيارية التي تحتاج مزوداً أو بيئة خارجية.

| المكوّن | المرجع |
|---|---|
| مطابقة V9 ومصفوفة الإغلاق | `docs/historical/REPORTS-TELEGRAM-COMPONENTS-V10-TRIAGE-AR.md` و`REPORTS-TELEGRAM-COMPONENTS-V10-IMPLEMENTATION-AR.md` |
| عقود التقارير والقوالب والـretry والـrate limit | `src/lib/reports-telegram-v10.ts` |
| CSV/XLSX والتصدير الجدولي | `src/lib/report-export-v10.ts` |
| لوحة Analytics والمقارنة والحضور | `src/components/shell/ReportAnalyticsV10.tsx` و`src/components/shell/panels/ReportsPanel.tsx` |
| Telegram commands/keyboards/events/photos | `src/app/api/telegram/route.ts` و`src/lib/reports-telegram-v10.ts` |
| TelegramPanel والجدولة والqueue | `src/components/shell/panels/TelegramPanel.tsx` |
| القوالب وتفضيلات ولي الأمر والـqueue | `prisma/schema.prisma` و`src/app/api/db/[operation]/route.ts` و`src/lib/local-db.ts` |
| Notes search/export | `src/components/shell/panels/NotesPanel.tsx` و`studentNotes.search` |
| StudentDNA timeline | `src/components/shell/StudentDNA.tsx` و`students.timeline` |
| Curriculum search/favorites | `src/components/shell/panels/CurriculumPanel.tsx` |
| اختبار العقود | `scripts/reports-telegram-v10-smoke.ts` — **18/18** |
| اختبار API/SQLite/mock Telegram | `scripts/reports-telegram-v10-api-smoke.cjs` — **23/23** |
| نتائج الاختبارات المستقلة | `docs/historical/REPORTS-TELEGRAM-COMPONENTS-V10-TEST-RESULTS-AR.md` |
| نتائج المتصفح | `docs/historical/REPORTS-TELEGRAM-V10-BROWSER-FINDINGS-AR.md` |
| regression الكامل | `REPORTS-TELEGRAM-COMPONENTS-V10-FULL-REGRESSION.log` |
| آخر API gates | `REPORTS-TELEGRAM-COMPONENTS-V10-FINAL-API.log` |

مسار القراءة الموصى به هو: `docs/historical/REPORTS-TELEGRAM-COMPONENTS-V10-TRIAGE-AR.md` ثم `REPORTS-TELEGRAM-COMPONENTS-V10-IMPLEMENTATION-AR.md` ثم `docs/historical/REPORTS-TELEGRAM-COMPONENTS-V10-TEST-RESULTS-AR.md` ونتائج المتصفح، وبعدها `CHANGES.md` و`AI-REPORTS-DATA-GUIDE-AR.md`. لإعادة الاختبار شغّل `npm run test:reports-telegram-v10` و`BASE=http://127.0.0.1:3033 npm run test:reports-telegram-v10-api`، ثم TypeScript وESLint وproduction build وباقي regression.

تستخدم اختبارات Telegram وAI mocks محلية ولا تتطلب token حقيقياً. الجدولة recurring persistent queue وليست cron داخل request server، وTelegram live events وreminders لا تعمل إلا بعد opt-in وربط الطالب. الميزات المتقدمة مثل multi-iframe وPiP وrecording وradar البصري الكامل لـStudentDNA تبقى capability-gated ولا تُحسب مفعلة بلا adapter وقياس وبيئة مناسبة.


## تحديث 15 أغسطس 2026 — Rewards + Audio + Visual Assets V13

المرجع التنفيذي الجديد للأصوات والهدايا والصور هو `REWARDS-AUDIO-VISUAL-V13-IMPLEMENTATION-AR.md`. يشرح التقرير تدقيق الأصول، الصور الشفافة الجديدة، المؤثرات الصوتية القصيرة، ربط Sound Engine وSoundsPanel وGiftPanel، seed الثابت، dedupe، الأداء، وحدود الأصوات المخصصة.

| المكوّن | المرجع |
|---|---|
| تقرير التنفيذ ومصفوفة الإغلاق | `REWARDS-AUDIO-VISUAL-V13-IMPLEMENTATION-AR.md` |
| مواصفات الحزمة | `REWARDS-AUDIO-VISUAL-V13-BRIEF-AR.md` |
| فحص المتصفح | `docs/historical/REWARDS-AUDIO-VISUAL-V13-BROWSER-FINDINGS-AR.md` |
| صور الهدايا الجديدة | `public/gifts/rocket-star.png` و`rainbow-medal.png` و`magic-book.png` و`math-trophy.png` و`super-pencil.png` و`idea-lamp.png` و`comet-sticker.png` و`golden-crown.png` و`team-badge.png` و`confetti-box.png` و`planet-puzzle.png` و`heart-encouragement.png` |
| مؤثرات الصوت الجديدة | `public/sounds/bisalasa-*.wav` |
| ربط الهدايا والـseed والدedupe | `src/lib/data-store.ts` و`src/app/api/db/[operation]/route.ts` |
| aliases ومكتبة الأصوات | `src/lib/shell-utils.ts` و`src/components/shell/panels/SoundsPanel.tsx` |
| صوت منح الهدية | `src/lib/shell-store.ts` |
| فحص الأصول | `scripts/verify-rewards-assets-v13.py` و`scripts/rewards-assets-v13-smoke.cjs` |
| تحسين الصور | `scripts/clean-generated-gift-assets.py` و`scripts/optimize-gift-assets-v13.py` |
| بوابة الاختبار | `npm run test:rewards-assets-v13` — **74/74 PASS** |

مسار القراءة الموصى به هو: `REWARDS-AUDIO-VISUAL-V13-BRIEF-AR.md` ثم `REWARDS-AUDIO-VISUAL-V13-IMPLEMENTATION-AR.md` ثم سجل المتصفح، وبعدها `CHANGES.md`. لإعادة الاختبار شغّل بوابة الأصول، ثم TypeScript وESLint وproduction build، ثم افتح `SoundsPanel` و`GiftPanel` على QA. لا تحتاج الحزمة إلى مزود خارجي أو مفاتيح API، بينما يظل رفع صوت مخصص من المدرس اختيارياً.


## تحديث 15 أغسطس 2026 — V10 Complete Test Suite Closure

أصبح `V10-COMPLETE-TEST-SUITE-RESULT-AR.md` المرجع التنفيذي لنتيجة خطة `16-V10-COMPLETE-TEST-SUITE.md`. يشرح الإصلاحات الفعلية، حدود الاختبارات، القياسات، والفرق بين التكاملات المحلية بالمحاكاة والميزات التي تحتاج مزوداً خارجياً.

| المكوّن | المرجع |
|---|---|
| مصفوفة الفجوات والإغلاق | `V10-SUITE-GAP-MATRIX-AR.md` |
| نتيجة الاختبار النهائية | `V10-COMPLETE-TEST-SUITE-RESULT-AR.md` |
| نتيجة runner الخام | `docs/historical/v10-complete-suite-result.json` |
| browser/RTL/accessibility/assets | `docs/historical/V10-BROWSER-UX-FINDINGS-AR.md` |
| seed deterministic | `scripts/seed-test-data.cjs` |
| contract probes | `scripts/v10-contract-probes.cjs` |
| limits/stress/lifecycle | `scripts/v10-operational-suite.cjs` |
| runner الرسمي | `scripts/v10-complete-suite.cjs` و`npm run test:v10:complete` |

النتيجة الرسمية الحالية هي **34/34 PASS** بعد عزل كل suite في process وقاعدة SQLite مستقلة. المسار الموصى به لإعادة الاختبار هو: build ثم seed ثم تشغيل mock integrations ثم `npm run test:v10:complete` مع `BASE` و`MOCK_MOODLE` و`TELEGRAM_API_BASE_URL` كما هو موضح في تقرير النتيجة.
