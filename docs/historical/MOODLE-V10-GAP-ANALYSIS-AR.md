# تحليل فجوات Moodle V9 → V10

**التاريخ:** 15 أغسطس 2026

## ما ثبت أنه موجود بالفعل

الـschema الحالي يحتوي على فهارس صحيحة لـ`MoodleStudentMap`، كما يحتوي `MoodleActivityMap` على `needsReview` و`sourceFingerprint` و`mappingMode` و`confidence`. route `/api/moodle` يحتوي discovery بالوسوم والmetadata والترتيب، Delta Sync مع cursor وoverlap وattemptKeys، adaptive polling، مزامنة الواجبات، liveStatus، وpull-only. Webhook يحتوي HMAC-SHA256 وتحقق timestamp وduplicate suppression عبر eventHash.

## الفجوات الفعلية المطلوب تنفيذها

| الفجوة | الحالة قبل V10 |
|---|---|
| Data Validation للـwebhook | غير موجود؛ الحدث المقبول لا يتحقق من student/idea/question maps |
| pending-validation | غير موجود |
| retry queue | لا يوجد MoodleSyncRetry ولا route لمعالجة backoff |
| reconciliation | لا يوجد action يقارن Moodle الحالي بالخرائط المحلية |
| standalone fallback | غير موثق/غير موحد في question provider عند فشل Moodle |
| manual mapping UI | توجد مطابقة تلقائية وربط groups، لكن لا توجد قائمة صريحة للطلاب غير المربوطين وربطهم يدوياً |
| health dashboard | لا توجد action health ولا بطاقات صحة شاملة |
| health probe | لا توجد route دورية تحفظ نتيجة فحص الاتصال |
| tag drift | fingerprint محفوظ، لكن لا توجد مقارنة discovery مع الخرائط القديمة وتفعيل needsReview بسبب drift |
| multi-course sync | syncResults يعمل على courseMap نشط واحد |
| group drift | لا يوجد reconcile دوري يكتشف انتقال الطالب بين مجموعات Moodle |

## ملاحظة تصحيحية

المراجعة المرفقة تشير إلى فهارس Prisma مكسورة مثل `@@index(oodleUserId])`. هذا الادعاء غير منطبق على الشجرة الحالية؛ الفهارس في `prisma/schema.prisma` صحيحة بالفعل. سيتم تشغيل `prisma validate` كاختبار مستقل للتأكد، دون إدخال تعديل مصطنع في schema.

## نقاط التنفيذ

سيُضاف retry model مرتبط بـMoodleSyncEvent، وستحافظ validation على فلسفة pull-only: webhook يُقبل كإشارة واردة فقط ولا يكتب إلى Moodle. الأحداث غير القابلة للتحقق ستُحفظ بحالة `pending-validation` مع أسباب واضحة، بينما الفشل القابل لإعادة المحاولة سيذهب إلى queue محدودة بـ3 محاولات وexponential backoff.

سيُبنى health من cursors/events/maps، وسيكون probe اختيارياً ومحمياً من التشغيل المتزامن. وستُعرض reconciliation وmanual mapping وhealth في MoodlePanel مع empty/error/loading states، من دون إظهار بيانات المدرس الخاصة في واجهة الطالب.
