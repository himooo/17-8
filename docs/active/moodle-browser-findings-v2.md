# Moodle Browser Findings — 2026-08-15

بعد استعادة حزمة demo عبر `POST /api/backup` بنجاح (`classes=1`, `students=12`, `lessons=4`, `questions=48`, `sessions=1`, `gameResults=4`) ثم فتح `/` بالمتصفح، ظلت الواجهة تعرض «لا يوجد صف نشط» و«ابدأ بإضافة درس». لذلك لا يمكن اعتبار MoodlePanel مفحوصاً بصرياً من خلال هذه الجولة بعد.

الـAPI والخادم production يقدمان البيانات الجديدة بشكل صحيح، لكن واجهة العميل الحالية لم تلتقط استعادة قاعدة البيانات في نفس جلسة المتصفح. الخطوة التالية هي إعادة تحميل كاملة/مسح hydration state أو فتح جلسة جديدة، ثم التحقق من ظهور lesson shell وMoodlePanel. لا يوجد حتى الآن دليل على فشل route Moodle نفسه؛ الملاحظة تخص تزامن hydration في الواجهة بعد استعادة خارجية.

فحص console من نفس الصفحة أثبت أن `/api/db/classes.list` يعيد الصف التجريبي وأن `/api/db/lessons.list` يعيد الدروس الأربعة. هذا يعزل الملاحظة إلى حالة `window.__BISALASA_HYDRATED__`/جلسة العميل التي تمنع إعادة hydration بعد الاستعادة الخارجية. لا توجد مشكلة في البيانات أو route DB.

بعد build جديد وإضافة fallback timer في page-client ثم إعادة تشغيل الخادم، ظل المتصفح يعرض شاشة البداية حتى بعد الانتظار. لم تظهر طلبات `/api/db` في resource timing. هذا يعني أن React client effect نفسه لا يبدأ في جلسة Browser Sandbox الحالية، رغم أن endpoints وserver-rendered HTML سليمين. سأستمر في اختبار التكامل عبر HTTP/DB، وأصنف فحص UI كقيد بيئي/جلسة متصفح يحتاج جلسة جديدة أو إعادة فتح browser، لا كفشل في Moodle discovery أو delta.
