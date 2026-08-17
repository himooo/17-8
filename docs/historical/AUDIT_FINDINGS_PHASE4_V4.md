> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# نتائج المرحلة الرابعة — قاعدة البيانات وAPI ومصدر الأسئلة v4

## ما تم التحقق منه

مخطط Prisma يستخدم SQLite، والعلاقات الأساسية Classes → Students/Groups/Sessions، Lessons → LessonQuestions، Sessions → GameResults/Snapshots، وStudents → Badges/Gifts/Activities. عمليات العميل تمر عبر `local-db.ts` إلى allowlist في `/api/db/[operation]`، ولا يوجد dispatcher عام خارج العمليات المسموحة.

## نقاط سليمة

حذف الطالب ينظف `studentIds` داخل المجموعات في transaction. حذف الطالب يحذف الشارات والهدايا ونتائج الألعاب والـsnapshots عبر علاقات Cascade. إنهاء الجلسة يحفظ `statsJson`، ولا يمسح Zustand إلا بعد نجاح الكتابة. `groups.autoSplit` يستبعد الغائبين. `lessons.delete` يحذف الأسئلة التابعة عبر Cascade. `gameResults` يسمح بتسجيل المشاركين والأسئلة في جداول مستقلة.

## مشاكل منطقية أو مخاطر تحتاج إصلاحاً

### 1. إنشاء الأسئلة لا يتحقق من العقد

`questions.create` و`questions.bulkCreate` يرسلان البيانات إلى Prisma مباشرة، دون فحص أن السؤال يحتوي نصاً، وأن الخيارات مصفوفة، وأن `correctAnswer` موجود داخل الخيارات، وأن `gameReady` و`difficulty` و`tags` صحيحة. هذا يسمح لأسئلة AI أو الاستيراد اليدوي بإدخال pool غير قابل للعب.

### 2. تحديث الدرس قد يترك أسئلة قديمة

`lessons.upsert` يحدث `manifestJson` والمحتوى عند وجود lessonId، لكنه لا يعيد بناء LessonQuestion rows. إذا تغيرت الأسئلة أو ideas داخل HTML وأعيد استيراد الدرس، يمكن أن تبقى أسئلة قديمة في قاعدة البيانات. يجب اعتماد سياسة واضحة: إعادة مزامنة الأسئلة في transaction أو الاحتفاظ بإصدار مع externalRefId وإزالة القديم غير الموجود.

### 3. `groups.autoSplit` يحتاج حدوداً صريحة

لا توجد حماية ظاهرة ضد `numGroups <= 0` أو رقم ضخم جداً أو `NaN`. يجب تطبيع العدد إلى حد آمن، منع المجموعة الفارغة غير الضرورية عندما يكون عدد الطلاب أقل من عدد المجموعات، ومنع إنشاء مجموعات جديدة قبل حذف أو أرشفة مجموعات تقسيم سابقة إذا كان هذا هو سلوك الواجهة المقصود.

### 4. gameResults لا يتحقق من الهوية والعلاقة

`gameResults.addParticipant` و`gameResults.addQuestion` يطبقان allowlist فقط. لا يوجد تحقق أن الطالب يتبع صف الجلسة، أو أن السؤال يتبع الدرس، أو أن الطالب ليس غائباً، أو أن `gameResultId` موجود قبل الإنشاء. يلزم smoke matrix لهذه الحالات، ثم إضافة validation تدريجي لا يكسر السجلات القديمة.

### 5. الإحصاءات قد تكون عالمية أكثر من اللازم

`stats.summary(classId)` يفلتر عدد الطلاب والجلسات، لكنه يحسب `gameResults` دون فلتر classId. هذا يجعل تقرير صف معين يعرض عدد نتائج ألعاب من صفوف أخرى. يلزم إصلاح query أو توضيح أن المؤشر عالمي، والأصح ربط GameResult عبر Session ثم classId.

### 6. الاحتفالات لا تملك metadata العرض الجديدة

جدول `Celebration` لا يحتوي renderMode أو preset أو intensity أو soundEnabled أو duration أو target defaults. وجدول `CelebrationEvent` لا يحفظ mode/preset/reason/skillId. يجب إضافة حقول اختيارية عبر migration أو وضع JSON metadata مضبوط، مع الحفاظ على قراءة السجلات القديمة.

### 7. celebrationEvents لا يملك FK فعلياً

`studentId` و`sessionId` و`celebrationId` نصوص بلا relations في Prisma، وهذا يحمي من فشل الحذف لكنه يسمح بسجلات يتيمة. يجب إما إضافة علاقات اختيارية مناسبة أو إضافة cleanup/verification صريح، خصوصاً قبل تقارير PDF.

### 8. settings.get حساس لـJSON تالف

العملية تستخدم `JSON.parse(s.settingsJson)` مباشرة؛ ملف إعداد تالف يؤدي إلى خطأ API بدلاً من fallback آمن. يجب إضافة parse آمن وإرجاع `{}` أو backup آخر مع تسجيل التحذير.

### 9. backup.record يسجل metadata فقط

عملية backup الحالية لا تنشئ ملف backup؛ هي تسجل filename وfileSize وreason. يجب عدم تسميتها حفظاً فعلياً في التقرير، وإضافة تحقق أن الملف أنشئ فعلاً في مسار آمن إن كان المطلوب backup حقيقياً.

### 10. بعض العمليات تقبل قيماً غير مضبوطة

`awardPoints` و`groups.addPoints` وlimits في `gameResults.listRecent` وحقول الاحتفال والصوت والملاحظات تحتاج حدود طول ونطاق رقم وتطبيع null/undefined. هذا مهم خصوصاً عندما تأتي القيم من AI أو من JSON مستورد.

## قرار المرحلة

تثبت المرحلة أن طبقة SQLite جيدة كأساس محلي، لكنها تحتاج validation قبل قبول الأسئلة المولدة وتوسيع سجل الاحتفال والتقرير. الإصلاحات التالية ستبدأ بعقود مستقلة قابلة للاختبار: question validator، celebration metadata/defaults، stats class filter، safe settings parse، وDB smoke matrix. لن يتم حذف بيانات المستخدم أو إعادة بناء الأسئلة تلقائياً قبل وضع migration آمنة.
