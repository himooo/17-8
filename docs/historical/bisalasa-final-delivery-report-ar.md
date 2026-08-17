> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# تقرير التسليم النهائي — منصة بسلاسة

## ملخص التنفيذ

تم استكمال طبقة تطوير جديدة لمنصة **بسلاسة — غرفة عمليات المدرس** مع الحفاظ على المبدأ الأساسي: المدرس هو صاحب القرار النهائي، ولا يوجد دخول للطلاب إلى المنصة. يعمل المسار المحلي من خلال Zustand وSQLite حتى عند تعطل AI أو Moodle، بينما تظل الخدمات الخارجية اختيارية وقابلة للإيقاف.

## ما تم تنفيذه

| المجال | التنفيذ | ملاحظات التشغيل |
|---|---|---|
| مفاتيح AI | Google وGroq وOpenAI وMistral مع أولوية وتدوير وcooldown وconcurrency وreactivate | مفاتيح AI لا تختلط مع Token Moodle |
| مساعد المدرس | أزرار التليبرومبتر: أسئلة محتملة، اشرح أكثر، أعطِ مثالاً، بسّط للطالب | النتيجة مراجعة يدوية ولا تُعرض تلقائياً |
| لوحة AI | اختيار المزود، أولوية المفتاح، الحالة، إعادة التفعيل، تحليل الدرس، توليد الأسئلة، مساعدة السبورة | كل الأزرار تتوقف عند تعطيل AI |
| Moodle | تخزين منفصل ومشفر للرابط والـToken وCourse ID، اختبار اتصال، سحب الطلاب، مراجعة وربط يدوي | لا يُعاد Token إلى العميل ولا يُمرر إلى مسار AI |
| حماية الإعدادات | `settings.set` أصبح يدمج الإعدادات بدلاً من استبدالها، فلا يفقد إعداد Moodle عند حفظ إعدادات الواجهة | أضيف `config.reset` لإزالة إعدادات Moodle بالكامل |
| الطلاب | حقول `moodleUserId` و`moodleUsername` و`moodleCourseId` في Prisma وAPI والعقود المحلية | الربط لا يتم تلقائياً؛ المدرس يختار المطابقة ويحفظها |
| المزامنة | polling قابل للإيقاف كل 5 ثوان فقط عند تفعيل Moodle ووجود Token وCourse ID | عند الفشل لا تتوقف غرفة العمليات ولا تُمسح الحالات المحلية |
| مؤشر الفهم | نتيجة المعلم المحلية تسجل صحيح/متعثر/محاولة، ومؤشر Moodle يوضح النشاط الأخير فقط | لا يتم الادعاء بأن `lastaccess` إجابة صحيحة |
| عدالة الاختيار | `pickStudentByIdea` يفضّل المتعثرين ثم الأقل اختياراً لكل فكرة، مع سجل لكل فكرة | الاختيار اليدوي للمدرس محفوظ ويحترم قراره |
| التنبيهات | تنبيه عند علاج الطلاب المتعثرين في الفكرة الحالية | لا يوجد إجراء تلقائي على العرض أو الطالب |
| التقارير | تقارير الشرائح، نسخة المدرس، الشريحة والسبورة، وملخص الصف والحصة PDF | مسار PDF السابق الذي يلتقط iframe الأصلي بقي فعالاً |
| الرياضيات والسبورة | إصلاحات السبورة وأدوات الرياضيات والـPDF والاحتفالات السابقة محفوظة | lint لا يحتوي أخطاء جديدة |

## الملفات الجوهرية المضافة أو المعدلة

- `src/app/api/moodle/route.ts`
- `src/lib/moodle-crypto.ts`
- `src/components/shell/panels/MoodlePanel.tsx`
- `src/components/shell/MoodleLiveSync.tsx`
- `src/components/shell/FloatingSideRail.tsx`
- `src/components/shell/panels/StudentsPanel.tsx`
- `src/lib/local-db.ts`
- `src/lib/slide-schema.ts`
- `src/lib/shell-store.ts`
- `src/lib/game-utils.ts`
- `src/app/page.tsx`
- `src/app/api/db/[operation]/route.ts`
- `prisma/schema.prisma`
- `scripts/moodle-security-smoke.ts`

## طريقة استخدام Moodle

من الشريط الجانبي افتح **Moodle**، أدخل رابط Moodle وCourse ID وWeb Service Token، ثم اختر **حفظ مشفر**. استخدم **اختبار الاتصال** للتأكد من الخدمة، ثم **سحب طلاب Moodle**. بعد السحب سيظهر لكل طالب Moodle اختيار الطالب المحلي المقابل؛ لا يتم حفظ أي ربط إلا بعد ضغط المدرس على **ربط**. يمكن تعطيل Moodle من المفتاح أو حذف الـToken، وعند فشل الاتصال يستمر التطبيق بالبيانات المحلية.

> ملاحظة مهمة: مؤشر Moodle الحالي يستخدم النشاط الأخير كإشارة اتصال/انتظار، وليس حكماً على صحة إجابة الطالب. صحة الإجابة التي يعتمد عليها التقرير تأتي من قرار المدرس المحلي.

## نتائج الاختبار

| الاختبار | النتيجة |
|---|---:|
| TypeScript `tsc --noEmit` | ناجح، 0 أخطاء |
| ESLint | ناجح، 0 أخطاء، تحذيران معروفان فقط بسبب `<img>` في `IframeStage.tsx` و`StudentCard.tsx` |
| production build | ناجح |
| اختبار محرك الرياضيات | 17/17 |
| مصفوفة عقود API | 10/10 |
| مصفوفة السيناريوهات | 10000/10000، بدون failures |
| تغطية الألعاب | Math Challenge وHot Potato وReaction وMemory وQuestion Challenge وQuick Fire وDice وMystery Box وQuiz Show |
| اختبار تشفير Moodle | 4/4، النص الصريح لا يظهر، والحمولة المعدلة تُرفض |
| اختبار HTTP production | `/` و`/grades` و`/api/moodle` و`/api/db/settings.get` أعادت 200 |

## ملاحظات الإنتاج

ظهر تحذير build واحد في `src/app/api/backup/route.ts` متعلق بتتبع الوصول الديناميكي للملف أثناء tracing، وهو تحذير تحسين packaging وليس فشل build. كما بقي تحذيرا Next.js المعتادان لاستخدام `<img>` في مكوّنين سابقين؛ لم يمنعا البناء أو الاختبارات.

تعذر فتح المتصفح الداخلي في آخر محاولة بسبب عدم توفر جلسة المتصفح (`Browser not available` بعد مهلة تحميل أولى)، لذلك تم تعويض اختبار العرض بــ HTTP smoke tests على نسخة production. لا ينبغي اعتبار ذلك بديلاً عن جولة بصرية يدوية عند توفر المتصفح.

## التشغيل المحلي

```bash
cd /home/ubuntu/bisalasa-full-audit
DATABASE_URL='file:/home/ubuntu/bisalasa-full-audit/data/custom.db' pnpm run build
PORT=3010 NODE_ENV=production DATABASE_URL='file:/home/ubuntu/bisalasa-full-audit/data/custom.db' pnpm start
```

تفتح النسخة محلياً على `http://127.0.0.1:3010` عند تشغيل الأمر السابق.
