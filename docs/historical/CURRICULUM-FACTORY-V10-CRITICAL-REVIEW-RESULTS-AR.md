# تقرير إغلاق مراجعة Curriculum Factory — V10

## الملخص التنفيذي

تم تنفيذ مراجعة V9 الحرجة على مصدر المنصة الفعلي، ثم أغلقت الفجوات الحرجة والمتوسطة في إصدار V10 مع الحفاظ على فلسفة بسلاسة: **المدرس صاحب القرار، وAI يقترح ولا يعتمد، وMoodle pull-only، والأسئلة لا تدخل الألعاب قبل المراجعة وQuality Gate**.

نجح Production Build وTypeScript وESLint للملفات الجديدة. نجح smoke الرسمي للمصنع في **23/23** اختباراً، ونجحت اختبارات رفع الصور الإيجابية والسلبية، وعقود AI الجديدة في حالات الإدخال غير الصالح، كما أعيد تشغيل regression العام. اختبارات Moodle التي ظهرت أولاً كفشل بسبب استخدام BASE الافتراضي 3012 أعيد تشغيلها صراحة على خادم QA 3032 ونجحت: Mapping 18/18، Live Sync 12/12، Homework 16/16، Advanced 40/40، Security 4/4.

## مصفوفة إغلاق الفجوات

| الفجوة في مراجعة V9 | التنفيذ في V10 | التحقق |
|---|---|---|
| فقدان `solutionSteps` و`solutionScript` عند الخَبز | أضيفت الحقول إلى Prisma و`LessonQuestion`، ويمررها `curriculumFactoryDrafts.bake` إلى SQLite | smoke: الحلول محفوظة في DB |
| فقدان نوع السؤال والصور | أضيف `questionType` و`imageJson` مع إدراج الصور في Moodle XML | smoke: cloze/drag-drop والصورة محفوظة |
| غياب البحث والفلترة | بحث نصي وفلترة بالفكرة والنوع والصعوبة وQuality score | واجهة stage 3 وTypeScript/build |
| غياب Bulk Operations | تحديد جماعي، حذف، تغيير صعوبة، نقل فكرة، تحسين جماعي، بدائل جماعية | واجهة stage 3 + build |
| غياب إعادة الترتيب | HTML drag/drop مع تحديث `stepNumber` | واجهة stage 3 + build |
| غياب Tags autocomplete | `datalist` من الوسوم الحالية مع حقل قابل للتحرير | واجهة stage 3 |
| غياب معاينة السؤال | Modal يحاكي QuickFire وQuizShow | واجهة stage 3 |
| غياب diff للإصدارات | اختيار إصدارين وعرض manifest والأسئلة side-by-side | لوحة الإصدارات |
| غياب Question Templates | Prisma model، list/save/seed، مكتبة تطبيق القالب | smoke seed/list + الواجهة |
| غياب Lesson Templates | Prisma model، list/save، مكتبة تحميل القالب | TypeScript/build + الواجهة |
| غياب LaTeX validation | فحص صيغ display/inline والأقواس والأوامر غير المكتملة داخل Quality Gate | Quality Gate وXML validation |
| غياب Duplicate Detection | Jaccard similarity مع تنبيه التشابه ≥80% | واجهة stage 3 |
| غياب Idea Coverage Matrix | مصفوفة أنواع/صعوبة وتغطية لكل فكرة | واجهة stage 4 |
| غياب Difficulty Distribution | شريط بصري سهل/متوسط/صعب وتنبيه اختلال التوزيع | واجهة stage 4 |
| غياب Prompt Variables | استبدال `{subject}` و`{grade}` و`{academicYear}` و`{curriculumKey}` و`{lessonKey}` و`{title}` و`{questionsCount}` | الهيكلة والتوليد واختبار القالب |
| غياب Prompt Testing | action `promptTest` وزر اختبار دون تطبيق الناتج | AI contract smoke + الواجهة |
| غياب Few-shot Examples | `examplesJson` و`variablesJson` مع إدخال الأمثلة في prompt الفعلي | seed/list وحفظ القالب |
| غياب Token/Cost Estimation | تقدير input/output/total tokens وتكلفة تقريبية في AI response والواجهة | AI response contract |
| غياب Model Comparison | action `compare` حتى أربعة موديلات وواجهة مقارنة مستقلة | AI contract + الواجهة |
| غياب Streaming | `/api/ai/stream` بـSSE يعرض الناتج تدريجياً ولا يطبقه على المسودة | AI stream contract + build |
| غياب XML Validation | فحص رأس XML وجذر quiz والأسئلة وDOMParser عند توفره قبل التنزيل | زر XML في stage 5 |
| غياب رفع الصور | route آمن بحد 5MB وMIME allowlist واسم UUID وتخزين الملف خارج SQLite | upload success/rejection smoke |
| غياب Cloze/drag-drop | عقود UI وQuality Gate وMoodle XML (`cloze` و`ddwtos`) | smoke baked types + build |

## قرارات السلامة والفلسفة

لا تُرسل مفاتيح AI إلى المتصفح؛ تبقى الاختيارات والمفاتيح خلف بوابة الخادم وتدوير المفاتيح الحالي. ناتج AI يظل اقتراحاً، ولا يؤدي prompt test أو model comparison أو streaming إلى تعديل المسودة تلقائياً. الصور ترفع إلى مسار تخزين ملفات محلي آمن باسم عشوائي، ويحفظ السؤال الرابط والـalt فقط.

لا يكتب مصنع المناهج إلى Moodle. ملف Moodle XML تنزيل مستقل يقرر المدرس استيراده، بينما الخَبز المحلي يكتب إلى SQLite داخل معاملة واحدة مع استبدال أسئلة الدرس بصورة idempotent.

استُخدم fallback محلي للمسودات عبر `localStorage` عند عدم وجود مسودات من قاعدة البيانات، مع تأكيد صريح قبل الاستعادة. كما أضيف Error Boundary خاص بالمصنع حتى لا يؤدي فشل AI أو المعاينة إلى فقدان مساحة المدرس.

## الاختبارات النهائية

| الطبقة | النتيجة |
|---|---:|
| TypeScript | PASS |
| ESLint للملفات الجديدة | PASS |
| Next production build | PASS |
| Curriculum Factory smoke | PASS — 23/23 |
| Image upload success/rejection | PASS |
| AI promptTest/compare/stream invalid-contract | PASS |
| Fairness V10 | PASS — 11/11 |
| Reports unified وlarge-class | PASS |
| Lesson Editor وSmart Context وWhiteboard | PASS |
| Student privacy وlive sync وconcurrency | PASS |
| Moodle Mapping | PASS — 18/18 |
| Moodle Live Sync | PASS — 12/12 |
| Moodle Homework | PASS — 16/16 |
| Moodle Advanced V10 | PASS — 40/40 |
| Moodle Security | PASS — 4/4 |
| Telegram PDF | PASS — 10/10 |
| Master Audit | PASS بالكامل |
| Browser boot | HTTP 200، بلا runtime crash |

## حدود معلنة

فحص LaTeX الحالي deterministic وخفيف، وليس بديلاً عن محرك KaTeX كامل لكل أمر رياضي؛ لذلك يلتقط أكثر الأخطاء الشائعة قبل الخَبز ويترك العرض النهائي لـMoodle/renderer. كما أن تقدير التكلفة تقريبي مبني على character-to-token heuristic موحد، وليس فاتورة مزود حقيقية. رفع الصور يستخدم storage محلياً في هذا التطبيق المحلي، ويمكن تبديل adapter لاحقاً إلى S3/Manus Storage دون تغيير عقد السؤال.

## الملفات الرئيسية

- `src/app/curriculum-factory/page.tsx`
- `src/app/curriculum-factory/error.tsx`
- `src/app/api/curriculum-factory/assets/route.ts`
- `src/app/api/ai/route.ts`
- `src/app/api/ai/stream/route.ts`
- `src/lib/question-contract.ts`
- `src/lib/local-db.ts`
- `src/app/api/db/[operation]/route.ts`
- `prisma/schema.prisma`
- `scripts/curriculum-factory-smoke.cjs`
- `curriculum-factory-v10-browser-findings.md`
