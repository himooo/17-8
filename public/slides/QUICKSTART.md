# بدء سريع — بسلاسة

**الإصدار المرجعي:** 16 أغسطس 2026 (جولة الإصلاحات الأمنية وقاعدة البيانات)

> بسلاسة غرفة عمليات محلية للمدرس. اعرض الشريحة عبر Zoom أو OBS، وأدر الطلاب والأسئلة والألعاب والسبورة والتقارير من بسلاسة. Moodle للسحب والتحليل فقط، والطالب لا يحتاج إلى الدخول إلى بسلاسة.

## 1. التشغيل

```bash
cd bisalasa-full-audit
pnpm install
pnpm exec prisma generate
DATABASE_URL='file:./data/custom.db' pnpm exec prisma db push
DATABASE_URL='file:./data/custom.db' pnpm run build
DATABASE_URL='file:./data/custom.db' pnpm run start
```

افتح `http://127.0.0.1:3000/`. يستخدم خادم QA الحالي `http://127.0.0.1:3032/`.

> **مصادقة الـAPI (جديد 16 أغسطس):** تحمي المنصة الآن كل مسارات `/api/*` برمز مشترك يُولَّد تلقائياً عند أول إقلاع ويُخزَّن في `AppSettings.apiToken`. المتصفح يستلمه كـ httpOnly cookie عبر `/api/auth/whoami`، فلا حاجة لإعداد يدوي. الأدوات الخارجية (curl، سكريبتات) تحتاج إرسال الرمز في header `X-Bisalasa-Token` أو query `?token=`.

## 2. جهز الفصل والطلاب

أنشئ فصلاً أو اختر فصلاً موجوداً. أضف الطلاب فردياً أو دفعة واحدة. يمكن إضافة طالب بلا فصل ونقله لاحقاً. علّم الغياب عند الحاجة؛ الطالب الغائب لا يظهر في عجلة الاختيار ولا الألعاب ولا autoSplit ولا مسارات المكافأة.

تستطيع إنشاء مجموعات، نقل الطلاب، حذف طالب، أو تقسيم الحاضرين تلقائياً. عند حذف طالب تنظف المنصة مراجع المجموعات والشارات والهدايا والأنشطة داخل transaction واحدة. تقسيم المجموعات التلقائي (`autoSplit`) يستخدم `crypto.randomInt` لتوزيع عادل غير متحيّز، ويُنفَّذ داخل `db.$transaction`.

## 3. استورد الدرس

اضغط أيقونة المنهج واستورد ملف HTML أو React static build بعد inline للـCSS والـJS. يجب أن يحتوي الملف على manifest:

```html
<script type="application/json" id="slide-manifest">
{"lessonId":"demo-01","title":"درس تجريبي","currentStep":1,"steps":[]}
</script>
```

يجب وجود controller يرسل `READY` و`MANIFEST` و`STEP_CHANGED`. راجع `VIBE_CODING_CONTRACT.md` عند حدوث مشكلة في التنقل أو ظهور script.

## 4. ابدأ الجلسة

من إعدادات الجلسة، ابدأ جلسة جديدة بعد اختيار الفصل. تحفظ المنصة snapshot لنقاط الطلاب وتربط الجلسة بالفصل. عند reload، راجع خيار استكمال الجلسة أو بدء جلسة جديدة. إنهاء الجلسة يحفظ الإحصاءات وسجل النشاط.

## 5. اشرح وتفاعل

استخدم `Space` أو السهم التالي للتنقل، وافتح التليبرومبتر لقراءة `script` وملاحظات المدرس. استخدم `R` لاختيار طالب حاضر، ثم قيّم الإجابة. يسجل النظام الصحيحة والخاطئة والمحاولات والنقاط وسجل النشاط وإحصاءات الجلسة.

| الاختصار | الوظيفة |
|---|---|
| `Space` أو `→` | التالي |
| `←` | السابق |
| `R` | اختيار طالب حاضر |
| `P` | قلم |
| `L` | ليزر |
| `W` | السبورة |
| `N` | النوتس |
| `G` | احتفال |
| `V` | نجاح |
| `B` | خطأ |
| `F` | ملء الشاشة |
| `Escape` | إغلاق overlay |

## 6. الألعاب والأسئلة

تشمل الألعاب Quick Fire وMath Challenge وQuestion Challenge وQuiz Show وMemory وMystery Box وHot Potato وDice Roll وReaction Time، إضافة إلى عجلة الطلاب وأدوات المجموعة.

في كل لعبة منهج، اختر عدد الأسئلة ومصدرها:

- الفكرة الحالية.
- فكرة محددة.
- كل الدرس.

لا تسحب المنصة سؤالاً من فكرة أخرى بصمت عند نفاد المصدر. الأسئلة تستخدم stable IDs و`askedQuestionIds` لمنع التكرار داخل الجلسة. تتوقف اللعبة أو تطلب قراراً واضحاً عند نفاد المصدر.

## 7. السبورة والاحتفالات

افتح السبورة فوق الشريحة واستخدم القلم والتظليل والممحاة والليزر والنص والأشكال والأسهم والعلامات والتراجع والإعادة والمسح. السبورة مناسبة للكسور والهندسة والشرح المباشر، وتستخدم RAF throttling ومزامنة revision.

يمكن إطلاق confetti أو particles أو كلاهما. إطلاق الاحتفال قرار بيد المدرس، وتدعم الإعدادات تقليل الحركة.

## 8. Moodle بإعداد مختصر

من MoodlePanel أدخل URL وtoken وCourse ID و`curriculumKey` ثم اضغط discovery. يوصى باستخدام الوسوم:

```text
bisalasa:idea:lesson03:idea01
bisalasa:idea:lesson03:idea02
bisalasa:homework:lesson03
```

تكتشف بسلاسة الأقسام والأنشطة والمجموعات والطلاب، وتستخدم الوسم ثم metadata الاسم ثم الترتيب. تعرض `confidence` و`needsReview`. بعد ذلك تعمل Delta Sync من غرفة المدرس، وتظهر النتائج في التقارير. الـwebhook اختياري ولا يغير Moodle.

## 9. AI بإعداد مختصر

AI اختياري ويمكن إيقافه. أضف مفاتيح provider من AiPanel مع label وpriority وmodel وحالة التفعيل. لا تظهر قيمة المفتاح الخام بعد الحفظ. استخدم AI لتحليل الدرس واقتراح الأسئلة وSmart Context، ثم راجع الناتج واعتمده بنفسك.

الاختبارات الحالية تستخدم mock provider. الاستدعاء الحقيقي لـGemini يحتاج مفتاح Google يضيفه مالك التطبيق ومراجعة سياسة الخصوصية والحصص.

## 10. التقارير وTelegram

افتح `/grades` لمراجعة نتائج الألعاب والأنشطة والجلسات وMoodle والواجبات. يظهر الطالب الذي حل أو لم يحل، ونسبة الإكمال والصحيح والخطأ. تظهر الأسئلة الموسومة حسب الفكرة، والأسئلة غير الموسومة في `lesson_unmapped`. يستبعد التقرير الطلاب الأيتام (بدون `classId`) لمنع ظهور طلاب وهميين.

يمكن إنشاء PDF عربي وإرساله عبر Telegram عند إعداد التكامل. راجع اتجاه النص والصفحات بعد التوليد. إذا فشل Telegram يبقى التقرير المحلي متاحاً.

## 11. فحوص الجودة

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint src scripts --max-warnings=999
./node_modules/.bin/next build --webpack
env BASE=http://127.0.0.1:3032 node scripts/performance-smoke.cjs
bash scripts/master_plan_audit.sh
```

أحدث النتائج في `PERFORMANCE-OPTIMIZATION-REPORT.md` و`MOODLE-REGRESSION-RESULTS.md`.

## 12. مشاكل شائعة

| المشكلة | الإجراء |
|---|---|
| الشريحة لا تظهر | تحقق من امتداد HTML وmanifest وcontroller وConsole |
| script لا يظهر | تحقق من JSON ووجود `script` في step |
| الأفكار لا تتنقل | طابق `data-idea` و`ideaId` ورسائل `postMessage` |
| الصوت لا يعمل | انقر داخل الصفحة، تحقق من الكتم وسياسة المتصفح |
| الأسئلة لا تظهر | تحقق من مصدر السؤال ووجود أسئلة في الفكرة/الدرس |
| Moodle لا يكتشف الأنشطة | تحقق من token وCourse ID وWeb Services ثم أعد discovery |
| بيانات بعد restore لا تظهر | أعد تحميل الصفحة وتحقق من `/api/db/classes.list` و`lessons.list` |
| التطبيق بطيء | تأكد من build production، وحجم الدرس، وعدد الطلاب، وعدم تشغيل polling خارج غرفة المدرس |
| 401 Unauthorized من API | تأكد من استدعاء `/api/auth/whoami` أولاً لضبط الـ cookie، أو أرسل `X-Bisalasa-Token` header |
| backup format=sql لا يعمل | معطّل للأمان. استخدم `format=json` (الافتراضي) |
| سبورة PNG فارغة | تأكد من تحميل درس أولاً؛ التصدير يدمج الشريحة + الكتابة |

## المراجع

- `USER_GUIDE.md`
- `BISALASA-COMPLETE-DOCUMENTATION-AR.md`
- `PERFORMANCE-OPTIMIZATION-REPORT.md`
- `MOODLE-INTEGRATION-REPORT.md`
- `VIBE_CODING_CONTRACT.md`
