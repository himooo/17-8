# خط أساس الأداء V13 — قبل الإصلاحات

## بيئة القياس

تم القياس على نسخة production مبنية عبر `next build --webpack`، وخادم QA محلي على `http://127.0.0.1:3036`، باستخدام `scripts/performance-smoke.cjs` مع 20 عينة لكل مسار.

## نتائج الاستجابة

| المسار | الحالة | p50 | p95 | المتوسط |
|---|---:|---:|---:|---:|
| teacher-shell `/` | 200 | 16.70ms | 27.60ms | 22.87ms |
| student-shell `/?view=student` | 200 | 11.39ms | 16.09ms | 11.60ms |
| grades-all `/grades` | 200 | 6.42ms | 10.37ms | 9.11ms |
| grades-class | 200 | 7.80ms | 8.59ms | 7.75ms |
| classes API | 200 | 4.83ms | 5.53ms | 4.89ms |
| report-class API | 200 | 5.90ms | 7.31ms | 6.09ms |

جميع المسارات اجتازت حدود performance smoke الحالية ولم تسجل failures.

## خط أساس build والأصول

| البند | القياس |
|---|---:|
| `.next` الكامل بعد build | 449MB تقريباً، ويشمل artifacts التشغيل والتتبع وليس payload المتصفح فقط |
| `public` | 8.5MB تقريباً |
| أكبر خط JavaScript | 411KB |
| ثاني أكبر خط JavaScript | 375KB |
| أكبر chunk ثالث | 330KB |
| أكبر خط CSS | 178KB |
| ملف خط الواجهة داخل build | 627KB تقريباً |
| أكبر صورة هدية جديدة | 438KB |
| أكبر WAV جديد | 220KB |

## ملاحظات التدقيق الأولي

المسارات الأساسية سريعة محلياً، لذلك لا توجد مشكلة latency ظاهرة في endpoints المقاسة. نقاط التحسين الأهم هي payload والتحميل الأولي: عدد كبير من مكتبة الصوت legacy، صور ومؤثرات متعددة داخل `public`، chunks كبيرة، ووجود `images.unoptimized=true` في `next.config.ts`. يجب تحسين هذه المسارات دون تحميل مكتبات الألعاب والتقارير وXLSX وHowler أثناء boot.

## القيود

هذه أرقام localhost ولا تمثل شبكة بطيئة أو جهازاً منخفض الإمكانات. لذلك ستُستكمل بقراءة ملفات build وقياس browser resource timing وCPU/long tasks، ثم تُقارن النتائج بعد الإصلاحات بنفس البيئة والعينات.
