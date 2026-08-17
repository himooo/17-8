# مطابقة مراجعة Reports + Telegram + Components — V9 إلى V10

**التاريخ:** 15 أغسطس 2026  
**النطاق:** `15-REPORTS-TELEGRAM-COMPONENTS-V9-CRITICAL-REVIEW.md`  
**الحكم:** المراجعة دقيقة في غياب طبقة التقارير القابلة للتخصيص، المقارنة، التصدير الجدولي، التحليلات، Telegram templates/interactive callbacks/retry، لكنها تبالغ في بعض البنود لأن الكود الحالي يغطيها جزئياً أو بالكامل.

## ما هو مغلق أو موجود فعلاً

| المجال | الحكم بعد فحص الكود |
|---|---|
| `buildStudentReport` و`buildClassReport` | موجودان ويجمعان local/live/Moodle/homework/games/activities/fairness/celebrations/notes/quality |
| PDF العربي وتقرير الطالب الغني | موجودان مع `pdf-lib` وArabic shaping، وStudentReportPanel يعرض by-idea وJSON/PDF |
| stale/source quality | موجودان بحالات ok/missing/stale/not-linked ونافذة 36 ساعة |
| Moodle homework في التقارير | موجود، مستقل عن Moodle write-back، ويظهر grade/completion/by-idea |
| session/weekly/monthly/manual في إعدادات Telegram | session/manual يعملان؛ weekly/monthly محفوظان لكن scheduler الفعلي غير منفذ |
| token encryption/webhook/linking codes | موجود AES-GCM وHTTPS webhook وBS-year-code وربط parent بالطالب |
| StudentsPanel | CRUD، import، attendance، bulk add/move، search وfairness integrations موجودة |
| ClassesPanel | CRUD، roster، move، reset، attendance capture موجودة |
| GroupsPanel | CRUD، autoSplit، transfer، bulk points، ungrouped flow موجودة |
| TopStatusBar | quick live stats ومؤشر الفهم والجلسة موجودة؛ notifications/i18n غير موجودين |
| StudentDNA | محرك traits وتوصيات أساسية موجود؛ radar/history/compare غير موجودة |
| Teacher decision policy | التقارير وTelegram الحالية لا تمنح AI قراراً أو نقاطاً تلقائياً |

## الفجوات الحقيقية التي ستنفذ في V10

| الأولوية | الفجوة | قرار التنفيذ |
|---|---|---|
| حرجة | report templates | عقد versioned مع sections وvisibility وقوالب student/class/parent/teacher |
| حرجة | CSV/XLSX export | CSV آمن وXLSX بدون أسرار مع أعمدة ثابتة وfixture اختبار |
| حرجة | comparative/class analytics | عقود pure وAPI class comparison وإحصاءات المتوسط/الوسيط/التوزيع والاتجاه |
| حرجة | weekly/monthly/attendance/teacher/games reports | builders تعتمد على البيانات الحالية وperiod bounds UTC |
| حرجة | Analytics dashboard | واجهة مدرسية تعرض KPIs وby-idea وtrends وstruggling students بدون تحميل ثقيل |
| حرجة | Telegram scheduled delivery | schedule records وclaim/complete؛ لا يعتمد على `node-cron` داخل request server |
| حرجة | Telegram retry/rate limit | queue persisted، backoff، dedupe/idempotency، وrate limit لكل chat/operation |
| حرجة | Telegram inline keyboards/commands | callback verification، `/start /help /report /weekly /attendance /achievements`، وparent scope |
| متوسطة | parent preferences/templates/language | إعدادات parent scoped بالطالب، قوالب ar/en، sections allowlist |
| متوسطة | live events/reminders | opt-in event dispatcher وreminder queue، مع عدم الإرسال عند غياب consent/chat |
| متوسطة | Telegram photo/card | adapter `sendPhoto` اختياري، fallback إلى text/PDF عند فشل الصورة |
| متوسطة | Notes search/export/summary | بحث وتصدير محلي، وAI summary opt-in عبر route الموجود فقط |
| متوسطة | class/group analytics | pure aggregators وواجهات خفيفة، دون تحويل إدارة الصف إلى نظام منافسة إجبارية |
| متوسطة | Student timeline/profile metadata | tags/behavior notes/history في local settings/DB، مع تجنب medical data غير الضرورية |
| متقدمة | DNA radar/compare/history | visualization وcomparison deterministic؛ recommendations تبقى اقتراحاً |
| متقدمة | lesson search/tags/favorites/history | local indexed state مع sharing export، لا مشاركة خارجية افتراضية |
| متقدمة | toolbar favorites/layout | local teacher preferences فقط، مع الحفاظ على ظهور الأدوات العادية في أماكنها |
| اختيارية | multi-iframe/PiP/recording | feature-gated browser adapters، لا تدخل المسار الأساسي ولا تُحسب مغلقة بدون دعم المتصفح |

## قرارات فلسفة المنصة والأمان

يبقى Moodle pull-only. تقارير Telegram لا تعرض إلا الطالب المرتبط بذلك chat، ولا تعرض تقرير الصف الكامل لولي أمر مفرد. كل إعداد parent يحدد الأقسام واللغة والتكرار، ولا يُرسل حدث حي إلا عند opt-in. لا تُحفظ مفاتيح Telegram في templates أو export، ولا تُرسل tokens إلى المتصفح.

الجدولة المتكررة ستُصمم كـpersistent queue/claim surface قابلة للتشغيل من worker أو trigger خارجي، بدلاً من إنشاء `node-cron` داخل route أو تكرار جلسة كاملة كل ساعة. الاختبارات المحلية ستستعمل mock Telegram API وتتحقق من request shape وidempotency والـretry دون اتصال حقيقي.

## معيار الإغلاق

لا يُغلق أي بند بواجهة شكلية فقط. يجب أن يملك contract أو builder اختباراً إيجابياً وسلبياً، وتظهر نتيجته في API smoke أو contract smoke، وتظل البيانات المشتقة قابلة للمراجعة مع source quality وperiod. البنود الاختيارية ستظهر capability-gated ومعلنة الحدود بدلاً من ادعاء تفعيلها على كل متصفح أو مزود.
