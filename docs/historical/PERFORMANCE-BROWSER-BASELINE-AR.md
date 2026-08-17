# خط أساس المتصفح — تدقيق تحميل الموارد

تم القياس من داخل Chromium على خادم QA production محلي. حالة الصفحة كانت تتضمن لوحة الهدايا/الاحتفالات، لذلك الأرقام تمثل حالة feature-rich وليست boot نظيفاً فقط.

| المؤشر | القياس |
|---|---:|
| عدد الموارد | 189 |
| DOMContentLoaded | 88ms |
| load event | 1172ms |
| response time | 18ms |
| JavaScript heap used | 9.96MB |
| JavaScript heap total | 12.76MB |
| font decoded | 627KB |
| أكبر صورة هدية محملة | 438KB |
| صور هدايا كبيرة محملة | عدة ملفات بين 177KB و438KB |
| طلبات WAV المرصودة | طلبات مكررة لصوت الاحتفال نفسه، وبعضها بدون transferSize بسبب cache |

## الاستنتاجات العملية

الاستجابة الشبكية المحلية ليست الاختناق؛ الاختناق الحقيقي في حالة اللوحة المفتوحة هو **تحميل صور الهدايا كاملة الحجم** ووجود **إعادات طلب للصوت نفسه** من Audio Engine أو lifecycle للمكونات. يجب جعل الصوت singleton مع cache/promise deduplication، وعدم تحميل ملفات WAV إلا عند الاستخدام أو preload لصوت واحد فقط، واستخدام صور thumbnails محسنة أو `next/image` مع sizes مناسبة. كما يجب قياس boot نظيف بعد إغلاق اللوحة ومقارنته بحالة اللوحة المفتوحة.

القياس المتاح من `performance.getEntriesByType('resource')` كان مقتطعاً في الطرفية، لكن سجل المتصفح الكامل محفوظ في `/home/ubuntu/console_outputs/exec_result_2026-08-15_07-58-30_572.txt`.
