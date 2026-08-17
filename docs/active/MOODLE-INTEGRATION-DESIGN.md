# تصميم تكامل Moodle المتقدم في بسلاسة

**آخر تحديث:** 15 أغسطس 2026

> هذه الوثيقة هي العقد المعماري الحالي لتكامل Moodle. تقرير التشغيل والاختبارات في `MOODLE-INTEGRATION-REPORT.md` و`MOODLE-REGRESSION-RESULTS.md`.

## المبدأ الحاكم

Moodle يظل النظام الذي يشغّل النشاط والواجب، بينما بسلاسة تسحب وتطبع وتحلل النتائج فقط. لا ينشئ التكامل أو يعدّل درجات أو أنشطة في Moodle. المدرس هو صاحب القرار في بدء النشاط، إظهار المحتوى، اعتماد المطابقة، وتفسير النتائج.

## Zero-config discovery

يقبل التكامل وسوماً صريحة بالصيغة التالية:

- `bisalasa:lesson:<lessonKey>` لتحديد الدرس.
- `bisalasa:idea:<lessonKey>:<ideaKey>` لنشاط الفكرة.
- `bisalasa:homework:<lessonKey>` لواجب الدرس.
- `bisalasa:section:<sectionKey>` لتثبيت الوحدة/الباب.
- `bisalasa:order:<number>` لترتيب النشاط داخل الفكرة أو الدرس.

عند غياب الوسم الصريح، يستخدم التكامل اسم النشاط ووصفه وحقول metadata إن توفرت، ثم يطبق fallback حتمياً يعتمد على ترتيب النشاط داخل section. لا يتم إنشاء mapping صامت إذا كانت الثقة منخفضة؛ يعاد النشاط بحالة `needs_review` ويظهر للمدرس في لوحة المراجعة.

## Multi-section وmulti-class

كل Section من Moodle يحفظ كـread model محلي مرتبط بالمقرر، مع `sectionKey` و`sectionId` و`orderIndex` و`visible`. الفصل/المجموعة لا يكرر المحتوى؛ بل يرتبط بالمقرر المشترك، وتُحفظ نتائج الطلاب بمعرف الطالب الخارجي ومعرف المجموعة. بذلك يمكن لعدة فصول استخدام نفس curriculumKey دون نسخ الدروس أو الأسئلة.

## Delta Sync

لكل course map ولكل نطاق نتائج cursor مستقل. تبدأ أول مزامنة كاملة، ثم تستخدم آخر `sourceUpdatedAt` مع نافذة تداخل صغيرة لتفادي انحراف الساعة أو تأخر Moodle. النتائج المحلية idempotent عبر مفاتيح Moodle الخارجية، ويُحفظ cursor بعد نجاح الصفحة فقط. عند الفشل يبقى cursor السابق ويظهر status `stale` مع backoff تكيفي.

لا تعتمد النسخة الأساسية على endpoint غير قياسي باسم `modified_since`. تستخدم استدعاءات Moodle القياسية المتاحة، وتقلل الطلبات عبر cache للـdiscovery، batching، وعدم استدعاء liveStatus من عرض الطالب.

## Live status والأداء

عرض المدرس فقط هو الذي يقرأ live status. يبدأ polling بفاصل 5 ثوانٍ أثناء جلسة نشطة، ويرتفع تدريجياً عند عدم وجود تغييرات أو عند الفشل، ويعود سريعاً بعد أي تغيير. عند عدم تفعيل Moodle أو عدم وجود جلسة نشطة لا يتم استدعاء Moodle. يتم إرسال `since` وcursor داخلياً حيث يسمح العقد، مع fallback snapshot آمن.

## Webhook

لا يُفترض وجود webhook outbound عام في Moodle core. لذلك يوفر التكامل endpoint inbound اختياري في بسلاسة، محمياً بـHMAC أو secret token، مع timestamp tolerance وevent hash idempotency وbody size limit. يمكن تغذيته من Moodle local plugin أو من Custom App خارجي. إذا لم يتوفر plugin، يظل polling التكيفي هو المسار الافتراضي.

## الأمان والخصوصية

يُخزن token مشفراً AES-256-GCM ولا يعاد إلى العميل. لا يقبل endpoint بيانات طالب بلا توقيع صالح. لا تعرض صفحة الطالب بيانات مدرسية خاصة، ولا يكتب النظام إلى Moodle. يتم تنظيف URLs ومنع credentials داخل URL، وتقييد العمليات والحقول، وتسجيل آخر نجاح/فشل دون تسجيل الأسرار.

## عقود الاستجابة

يعيد discovery ملخصاً موحداً يشمل `sections`, `activities`, `groups`, `users`, `tagStats`, `mappingHints`, `failures`, و`sampledAt`. كل نشاط يتضمن `mappingMode` و`confidence` و`needsReview`. تعيد المزامنة `mode`, `cursor`, `changed`, `skipped`, `requests`, `failures`, و`nextPollMs` لتتمكن الواجهة من عرض الأداء والحالة للمدرس دون إغراقه بالتفاصيل.
