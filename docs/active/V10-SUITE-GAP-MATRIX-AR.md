# مصفوفة تنفيذ خطة الاختبارات الشاملة V10

**المصدر:** `/home/ubuntu/upload/16-V10-COMPLETE-TEST-SUITE.md`  
**المشروع:** بسلاسة — `bisalasa-full-audit`  
**تاريخ التنفيذ النهائي:** 15 أغسطس 2026

## الحكم التنفيذي

تم تحويل البنود القابلة للتنفيذ من خطة V10 إلى runner موحد باسم `scripts/v10-complete-suite.cjs`، مع عزل كل suite في process وقاعدة SQLite منسوخة من seed ثابت. هذا العزل يمنع تلوث اختبارات AI وrate-limit بين العمليات، ويجعل نتيجة التشغيل قابلة للتكرار. التشغيل الرسمي عبر `npm run test:v10:complete` انتهى بنتيجة **34 suite، 34 PASS، 0 FAIL**.

## مصفوفة الإغلاق

| الفجوة أو البند | الحالة النهائية | التنفيذ أو الدليل |
|---|---|---|
| `/api/health` | مغلق | `src/app/api/health/route.ts`، فحص 200 و`ok=true` و`no-store` |
| أداة تشغيل موحدة | مغلق | `scripts/v10-complete-suite.cjs` و`npm run test:v10:complete` |
| عزل الاختبارات | مغلق | process مستقل وقاعدة `.suite-N` لكل suite، مع تنظيف بعد التشغيل |
| seed قابل لإعادة التشغيل | مغلق | `scripts/seed-test-data.cjs`: 3 فصول، 75 طالباً، 5 دروس، 50 سؤالاً، 9 جلسات |
| AI compare/image/stt القديمة | مغلق | aliases رفيعة إلى handlers الحالية، مع mock capability وsafety/limits |
| البحث المحلي للدروس | مغلق | `POST /api/lessons/search` بحد 50 نتيجة وtext search bounded |
| Telegram retry | مغلق | `/api/telegram/retry` يمرر إلى `queue.process` الحالي؛ لا منطق إرسال مكرر |
| CSRF/Origin | مغلق | dispatcher يرفض Origin الخارجي 403، ويقبل same-origin أو الطلب المحلي بلا Origin |
| sourceText وJSON limits | مغلق | `curriculumFactoryDrafts.upsert` يرفض تجاوز sourceText 120,000 وJSON 250,000/100,000 بدلاً من القص الصامت |
| sessions.end stale/idempotency | مغلق | `updateMany` ثم يعيد session row، أو `null` للجلسة القديمة؛ regression relational PASS |
| rate-limit state | مغلق اختبارياً | AI production limiter محفوظ؛ runner يعزل process/DB بدلاً من تعطيل limiter أو إخفاء 429 |
| صورة الهدايا والصوت | مغلق | boot: صفر صوت وصفر هدية؛ panel: 30 WebP وصفر صوت؛ static headers صحيحة |
| accessibility labels | مغلق في shell الأولي | 58/58 زر يحمل `aria-label` بعد enhancer الديناميكي |
| Playwright/Firefox/WebKit | مستبدل بقياس متاح وصادق | Chromium الداخلي وHTTP/browser smoke؛ لا ادعاء بتشغيل محركات غير متوفرة |
| 1000 webhook/sec وذاكرة ساعة | مستبدل بقياس آمن | 1000 طالب و100 نتيجة لعبة و100 health sample bounded؛ لا flooding خدمة خارجية |
| Cairo/Google Fonts | قرار offline مقصود | الخط المحلي offline هو Amiri؛ لم تتم إعادة remote font الذي يضر boot |

## ما تم تشغيله في runner

| المجموعة | التغطية |
|---|---|
| AI | mock provider، rotation/fallback، model discovery، limits، safety، compare/image/STT aliases، telemetry |
| Moodle | security، advanced، mapping، live delta، homework، concurrency، pull-only mocks |
| Reports/Telegram | reports unified/large class، templates، schedules، queue، PDF integration، webhook، custom mock |
| الطلاب والفصول والمجموعات | إنشاء/تعديل/حذف، طالب بلا فصل، snapshot، attendance، groups، atomic concurrent updates |
| الألعاب والسبورة والعدالة | contract، API، sync، fairness، game results، student selection، whiteboard actions |
| الأداء | shell/grades/API latency، cold start، static asset caching، 100 health samples، SQLite stress |
| المصفوفات | `scripts/master_plan_audit.sh` و`api_contract_matrix_v4.py` و`scripts/qa_scenario_matrix_extended.py` بنتيجة 25,000 سيناريو |

## بنود لم تُنفذ حرفياً ولماذا

الأمثلة النظرية الخاصة بتشغيل Firefox/WebKit، أو اختبار 1000 webhook في الثانية، أو إبقاء browser session ساعة، أو إرسال بيانات إلى خدمات حقيقية، لم تُنفذ بهذه الصورة لأنها غير متاحة أو غير آمنة في بيئة QA المحلية. استُبدلت بقياسات bounded قابلة لإعادة الإنتاج، مع mock محلي، ولم تُسجل هذه البدائل كاختبارات إنتاجية خارجية.

## إعادة التشغيل

بعد تجهيز قاعدة QA وmock integrations، يمكن تشغيل:

```bash
DATABASE_URL='file:/tmp/bisalasa-v10-suite.db' node scripts/seed-test-data.cjs
BASE=http://127.0.0.1:3040 \
TEST_BASE=http://127.0.0.1:3040 \
MOCK_MOODLE=http://127.0.0.1:3021/moodle \
TELEGRAM_API_BASE_URL=http://127.0.0.1:3021 \
DATABASE_URL='file:/tmp/bisalasa-v10-suite.db' \
SUITE_PORT_BASE=3200 \
npm run test:v10:complete
```

الـrunner يحتاج artifact production قائماً في `.next/standalone`، ويشغل process مستقلاً لكل suite ثم يحذف نسخة قاعدة الاختبار الخاصة به.
