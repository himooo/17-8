> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# نتائج المرحلة الثالثة — العقود والمخاطر والـinvariants v4

## نتيجة تدقيق Manifest

تم فحص 10 ملفات HTML في `public/slides` بمدقق ثابت يراجع وجود `slide-manifest`، JSON، الحقول الإلزامية، الخطوات والأفكار، التكرار، `script`، الأسئلة، الخيارات، `correctAnswer`، والتعليقات الافتراضية. النتيجة: **10 ملفات ناجحة، 0 فشل، 0 مشكلة**.

## العقود التي ثبتت سلامتها

عقد iframe يعتمد على `READY` ثم `MANIFEST` ثم `STEP_CHANGED`. بيانات الدرس تدعم flat steps وnested ideas. الأسئلة الموجودة في الـmanifest لا تحتوي في الجولة الحالية على `correctAnswer` خارج options أو نص سؤال فارغ. هذا لا يغني عن اختبار dynamic import وpostMessage في المتصفح، لكنه يثبت سلامة المصدر النصي.

## خريطة المخاطر التنفيذية

| الخطر | الاحتمال | الأثر | الإجراء |
|---|---:|---:|---|
| إطلاق Confetti وEffectsEngine معاً | متوسط | Banner/صوت/Particles مزدوج | توحيد dispatcher واختبار counter/signals |
| اختلاف PDF النصي عن PDF DOM | مرتفع | ملف عربي ناقص أو غير قابل للقراءة | اختبار كل exporter وrender وpdftotext |
| AI يعيد JSON غير صالح | متوسط | سؤال غير صالح داخل لعبة | schema + validator + preview فقط |
| اختصار يتنفذ داخل input | متوسط | تغيير أداة أو شريحة أثناء الكتابة | اختبار focus/textarea/panel/iframe |
| snapshot سبورة لا يطابق idea/step | متوسط | ظهور شرح في شريحة خاطئة | اختبار ذهاب/عودة/reload/lesson switch |
| ميتاداتا الاحتفال ناقصة | مؤكد | لا يوجد renderMode/preset/target/reason | توسيع النوع مع defaults وmigration |
| تكرار نقاط بعد retry | منخفض بعد الإصلاحات السابقة | فساد درجات | scenario matrix وDB verification |
| تعديلات AI/Particles لا تعطل التشغيل المحلي | متوسط | توقف الحصة | feature flags وfallback القديم |

## Invariants معتمدة للاختبار

تم اعتماد 20 invariant في `FULL_AUDIT_PLAN_V4.md`. أهمها: قرار المدرس لا يُستبدل بـAI، الطالب الغائب لا يدخل لعبة أو مكافأة، لا fallback صامت لمصدر أسئلة، لا تسجيل لطالب غير مختار، لا احتفال بصوت مزدوج، ولا فقد للسبورة أو الجلسة بعد reload أو فشل حفظ.

## قرار معماري

سيكون التوسع في AI والاحتفالات additive وغير هدمي. يبقى `triggerCelebration` نقطة دخول واحدة، وتضاف metadata اختيارية بدلاً من تغيير معنى السجلات القديمة. يبقى Confetti fallback إذا تعذر Particle renderer. وتبقى عمليات AI server-side مع JSON Schema، ولا تحفظ في المنهج أو pool اللعبة إلا بعد موافقة المدرس والتحقق البرمجي.

## المرحلة التالية

الانتقال إلى تدقيق Prisma وعمليات `/api/db/[operation]` وعمليات الأسئلة والجلسات والاحتفالات، مع فحص orphan rows وطلبات غير صالحة قبل لمس عقود AI أو Particles.
