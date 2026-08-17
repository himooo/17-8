# تقرير تطوير الربط بين بسلاسة وMoodle

**التاريخ:** 15 أغسطس 2026

## الملخص التنفيذي

تم تطوير تكامل Moodle من ربط يدوي يعتمد على Quiz ID إلى طبقة تكامل ذكية منخفضة الإعداد، مع الحفاظ الكامل على فلسفة بسلاسة: **المدرس هو صاحب القرار، بسلاسة تسحب وتحلل فقط، ولا تكتب أو تعدل المحتوى أو الدرجات داخل Moodle**.

أصبح الربط يدعم اكتشاف المقرر والأقسام والأنشطة والمجموعات والطلاب، ثم يطابق الأنشطة مع الدروس والأفكار تلقائياً باستخدام الوسوم أولاً، ثم metadata الاسم، ثم fallback حتمي يعتمد على ترتيب النشاط. كما أضيفت مزامنة تفاضلية تحفظ cursor وprocessed attempt keys، وتخفض طلبات إعادة المعالجة عند ثبات النتائج، مع adaptive backoff عند عدم وجود تغيير أو حدوث فشل خارجي.

أضيف أيضاً webhook اختياري آمن يستقبل أحداثاً من Moodle أو وسيط خارجي، ويتحقق من HMAC وtimestamp ويمنع إعادة تشغيل الحدث نفسه. لا يعتمد التشغيل الأساسي عليه؛ فالـpolling التكيفي يظل هو المسار الافتراضي الأسهل والأكثر توافقاً مع Moodle القياسي.

## ما تم تنفيذه

| المجال | التنفيذ | الأثر العملي |
|---|---|---|
| اكتشاف المقرر | جلب معلومات الموقع والمقررات والتحقق من token وcourse ID | إعداد أولي واضح مع رسائل فشل مفهومة |
| الأقسام | جلب `core_course_get_contents` وتحويل كل Section إلى وحدة داخل discovery | دعم الأبواب والوحدات داخل نفس المقرر |
| الأنشطة | توحيد quizzes وassignments في قائمة normalized activities | طبقة واحدة للربط والتقارير |
| الوسوم | تحليل وسوم `bisalasa:idea:<lesson>:<idea>` و`bisalasa:homework:<lesson>` | ربط تلقائي بلا إدخال Quiz ID لكل فكرة |
| fallback | استخدام metadata الاسم ثم ترتيب النشاط داخل القسم | استمرار العمل عند غياب الوسوم مع `confidence` و`needsReview` |
| المجموعات | اكتشاف groups وربط الطلاب بالمقرر والمجموعة | دعم أكثر من فصل يستخدم نفس محتوى السنة |
| النتائج | مزامنة attempts وquestion reviews وhomework snapshots | تقرير الطالب والفكرة والواجب في مصدر موحد |
| Delta Sync | cursor لكل course map، نافذة overlap، وprocessed keys | منع إعادة معالجة نفس attempt والاعتماد على التغييرات فقط |
| Polling | backoff تكيفي وvisibility-aware polling | تقليل الضغط عند ثبات النتائج أو إخفاء غرفة المدرس |
| Webhook | HMAC-SHA256، timestamp window، event hash، duplicate suppression | استقبال شبه فوري اختياري بدون فتح مسار كتابة إلى Moodle |
| الأمان | تشفير token الحالي، secret منفصل للwebhook، تدوير secret وعرضه مرة واحدة | فصل أسرار Moodle عن أسرار الخدمات الأخرى |
| الواجهة | عرض الأقسام، confidence، needsReview، آخر sync، delta requests، وحالة webhook | المدرس يرى ما تم اكتشافه وما يحتاج مراجعة قبل الاعتماد |

## عقد الاكتشاف التلقائي

تسلسل المطابقة في بسلاسة حتمي ويمكن تفسيره. يبدأ بالوسم الصريح، ثم يحاول قراءة metadata من اسم النشاط، ثم يستخدم ترتيب النشاط إذا لم يوجد تعريف صريح. كل نشاط يعاد مع `mappingMode` و`confidence` و`needsReview` و`fingerprint`، لذلك لا تصبح الأتمتة صندوقاً أسود أمام المدرس.

أمثلة الوسوم الموصى بها:

```text
bisalasa:idea:lesson03:idea01
bisalasa:idea:lesson03:idea02
bisalasa:homework:lesson03
```

الوسم لا يغير Moodle ولا يحتاج إلى إنشاء نشاط جديد. هو مجرد convention يقرأه connector. وإذا لم يمكن الوصول إلى الوسوم في نسخة Moodle أو الخدمة المخصصة، يعمل fallback بالترتيب مع إظهار `needsReview` عند انخفاض الثقة.

## دعم الأبواب والفصول والمحتوى المشترك

المقرر الواحد في Moodle يمكن أن يحتوي على Sections متعددة، وكل Section يظهر كوحدة مستقلة في نتيجة discovery. المجموعة `4A` و`4B` لا تحتاج إلى نسخ محتوى الدرس أو إنشاء mapping يدوي مستقل؛ الربط يعتمد على `moodleCourseId` والمجموعة والطالب، بينما يظل `curriculumKey` مشتركاً بين الفصول التي تستخدم نفس المنهج.

هذه البنية تفصل بين أربعة أشياء يجب ألا تختلط: **المقرر الخارجي، المجموعة داخل المقرر، المحتوى التعليمي المشترك، والطالب المرتبط بالمجموعة**. وبذلك يمكن للمدرس تحليل فصل واحد أو مقارنة مجموعات متعددة من دون تكرار تعريف الأفكار والأسئلة.

## Delta Sync بالتفصيل

كل course map له cursor مستقل في `MoodleSyncCursor`. عند أول مزامنة تُسحب النتائج اللازمة لبناء الحالة الأولية. بعد ذلك تستخدم بسلاسة آخر cursor مع نافذة overlap صغيرة للحماية من فرق التوقيت، وتستخدم processed keys لمنع إعادة إدخال نفس attempt أو submission عند تكرار الاستدعاء.

النتيجة العملية التي ظهرت في الاختبار:

```json
{
  "first": {
    "mode": "initial",
    "students": 2,
    "attempts": 4,
    "changed": 2,
    "skipped": 1,
    "requests": 5,
    "homeworkSnapshots": 2,
    "homeworkQuestions": 50
  },
  "second": {
    "mode": "delta",
    "students": 2,
    "attempts": 0,
    "changed": 0,
    "skipped": 4,
    "requests": 4,
    "homeworkSnapshots": 0,
    "homeworkQuestions": 0
  }
}
```

هذا لا يعني أن Moodle القياسي يوفر endpoint واحداً عاماً اسمه “give me all attempts after timestamp” لكل أنواع الأنشطة. لذلك صُممت المزامنة كـ**delta محلي idempotent**: بسلاسة تتذكر ما عالجته وتستخدم timestamps عندما تكون متاحة، وتمنع إعادة الكتابة المحلية حتى لو أعاد Moodle نفس السجلات في polling لاحق. هذه الطريقة أكثر توافقاً من الاعتماد على endpoint غير قياسي.

## Webhook الاختياري

الـwebhook لا يستبدل polling ولا يكتب إلى Moodle. عند تمكينه، يرسل Moodle plugin أو relay خارجي الحدث إلى:

```text
POST /api/moodle/webhook
```

التوقيع هو HMAC-SHA256 على النص التالي:

```text
<timestamp>.<raw-json-body>
```

ويرسل في:

```text
x-bisalasa-timestamp: <unix-seconds>
x-bisalasa-signature: sha256=<hex-digest>
```

يتم رفض timestamp القديم، والتوقيع غير الصحيح، والـpayload غير السليم. ويعاد الحدث المكرر كـduplicate بدون إعادة إدخال. secret لا يظهر في الإعدادات بعد حفظه؛ عملية التدوير تعرض secret الجديد مرة واحدة فقط ليضعه المسؤول في plugin أو relay.

Moodle Events API نفسها تصف الأحداث كقناة أحادية الاتجاه ولا تسمح للobserver بتعديل بيانات الحدث أو إيقاف توزيعه [1]. لذلك يحتاج الدفع الخارجي الفعلي إلى local plugin/relay يراقب الحدث ثم يرسل HTTP request إلى endpoint بسلاسة. أما من دون plugin، فيظل المسار الرسمي المتاح هو Web Services مع polling التكيفي [2].

## الأمان والخصوصية

لا يحصل الطالب على إعدادات Moodle أو token أو webhook secret. polling يعمل فقط في غرفة المدرس، ولا يحمل مكونات teacher-shell في وضع الطالب. كل payload قادم من Moodle يعامل كبيانات خارجية غير موثوقة؛ يتم تطبيع الحقول وتحديد الأنواع قبل حفظها. لا يوجد مسار outbound يغير سؤالاً أو درجة أو نشاطاً داخل Moodle.

ينبغي تشغيل endpoint عبر HTTPS في الإنتاج، وتقييد الـtoken في Moodle بأقل functions وصلاحيات لازمة، واستخدام secret مختلف لكل relay عند تعدد المصادر. يوصى أيضاً بتدوير token والwebhook secret عند تغيير مسؤول التكامل.

## الأداء المقاس

تم بناء النسخة باستخدام webpack بنجاح بعد إضافة routes والـschema والواجهة. بقيت مكاسب code splitting السابقة محفوظة: chunk صفحة الدخول انخفض من **464KB إلى 135KB** تقريباً، كما بقي وضع الطالب خفيفاً.

| Endpoint | p50 | p95 | الحد |
|---|---:|---:|---:|
| teacher shell | 11.72ms | 93.85ms | 1500ms |
| student shell | 6.58ms | 7.38ms | 1000ms |
| grades all | 40.93ms | 52.99ms | 1500ms |
| grades class | 36.10ms | 39.43ms | 1500ms |
| classes API | 3.35ms | 6.21ms | 500ms |
| report class API | 32.92ms | 34.34ms | 1000ms |

في polling المتكيف، يبدأ النظام بفاصل قصير عند وجود تغيير، ويرفع الفاصل تدريجياً عند الثبات حتى سقف مضبوط. كما يتوقف polling عندما تكون غرفة المدرس غير مرئية أو خارج الجلسة النشطة. هذا يمنع تحويل كل تبويب طالب إلى عميل polling مستقل.

## الاختبارات المنفذة

نجحت **22 suite** في regression النهائي، إضافة إلى master audit، وتشمل Lesson Editor، live sync والتزامن، السبورة، Smart Context، question contract، AI mock والlimits، custom integrations، Moodle mapping، homework، Moodle live sync، security، advanced discovery/webhook، التقارير، الطلاب والمجموعات، الخصوصية، API contract، database concurrency، Telegram PDF، وperformance smoke.

كما نجحت quality gates التالية:

- TypeScript: صفر أخطاء.
- ESLint: ناجح؛ التحذيران الموجودان legacy متعلقان بـ`<img>`.
- Production build: ناجح.
- Master plan audit: ناجح بالكامل.
- Moodle advanced smoke: **20 check** ناجحة، قسمان، 3 أنشطة، adaptive polling، HMAC، ومنع التكرار.
- Moodle mapping: **18 check** ناجحة.
- Moodle homework report: **16 check** ناجحة، 50 سؤالاً، completion 90%، success on answered 88.89%، success on total 80%.
- Moodle live sync: **12 check** ناجحة، والجولة الثانية أثبتت `changed=0` و`skipped=4`.

## إعداد Moodle الحقيقي

يحتاج المسؤول في Moodle إلى تفعيل Web Services وREST وإنشاء token محدود الصلاحيات. يجب إضافة functions اللازمة بحسب نوع الأنشطة المستخدم، ومنها وظائف الموقع والمقررات والمحتوى والمجموعات والطلاب، ثم وظائف quiz/assignment الخاصة بالمحاولات والمراجعة والsubmissions. Moodle يوفّر توثيق API الخاص بالموقع من **Site administration > Server > Web services > API documentation** [1].

بعد ذلك يضع المدرس في MoodlePanel عنوان Moodle وtoken وcourse ID مرة واحدة، ثم يضغط discovery. تظهر الأقسام والأنشطة والثقة والأنشطة التي تحتاج مراجعة. بعد حفظ الإعداد، لا يحتاج إلى إدخال Quiz ID لكل فكرة إذا استُخدمت الوسوم الموصى بها.

## المصادر الرسمية

[1]: https://moodledev.io/docs/5.0/apis/subsystems/external
[2]: https://docs.moodle.org/dev/Web_service_API_functions
[3]: https://docs.moodle.org/dev/Events_API

توضح وثائق Moodle الرسمية أن Web Service framework مصمم للاستخدام من الأنظمة الخارجية، وأن توثيق الدوال الفعلي يعتمد على ما هو متاح في نسخة Moodle والخدمة التي أنشأها المسؤول [1]. كما توضح قائمة الدوال الرسمية وجود وظائف محتوى المقرر، completion، groups، quizzes، assignments، وattempts بحسب الإصدار والخدمات المفعلة [2].

## ملاحظة فحص المتصفح

نجحت endpoints وDB وHTTP regression، لكن جلسة Browser Sandbox الحالية ظلت تعرض شاشة البداية ولم تشغّل client effects الخاصة بتحميل SQLite، رغم أن `/api/db/classes.list` و`/api/db/lessons.list` أعادا بيانات demo صحيحة. أضيف fallback timer لمعالجة race في Zustand persistence، وأعيد فحص المتصفح في جلسة جديدة، لكن يجب اعتبار هذه الجلسة الحالية قيداً بيئياً منفصلاً عن نجاح تكامل Moodle نفسه. لا يظهر أي فشل في server-rendered HTML أو routes الجديدة.

## توصية التشغيل

المسار الموصى به للإنتاج هو: **Web Services + discovery بالوسوم + adaptive delta polling**. يضاف webhook فقط عندما تكون الاستجابة شبه الفورية مطلوبة ويستطيع مسؤول Moodle تثبيت local plugin أو relay صغير. بهذه الطريقة تظل المنصة سهلة الإعداد، لا تعتمد على تعديل Moodle في الحالة العادية، ولا تضحي بأداء الطالب أو بفلسفة المدرس صاحب القرار.


## ترقية V10 — طبقة صحة التشغيل والمصالحة

أضيفت طبقة V10 فوق بنية Moodle السابقة دون تغيير فلسفة pull-only. تم التحقق أولاً من أن فهارس `MoodleStudentMap` في الشجرة الحالية صحيحة؛ ملاحظة الفهارس المكسورة الواردة في مراجعة V9 كانت قديمة ولا تنطبق على هذا المصدر. مرّ `prisma validate` و`prisma db push` بعد إضافة نموذج retry الجديد.

| الفجوة الحرجة | التنفيذ النهائي |
|---|---|
| Data Validation | `validateMoodleEvent` يتحقق من course map وMoodle user map وactivity/idea map وquestion map قبل اعتبار الحدث processed |
| أحداث غير قابلة للتحقق | تُحفظ كـ`pending-validation` مع `validationErrors` داخل metadata وتعود للمرسل برسالة 400 قابلة للتفسير، دون إسقاط الحدث |
| Retry Queue | `MoodleSyncRetry` مرتبط بـ`MoodleSyncEvent`، و`/api/moodle/retry` يعالج pending بملكية atomic، ثلاث محاولات، backoff 5/10/20 ثانية، ثم dead |
| Reconciliation | action `reconcile` يقارن الطلاب والمجموعات والأنشطة، يعطل خرائط الطلاب المفقودين دون حذفها، ويعرض الجدد واليتامى وdrift |
| Tag drift | مقارنة `sourceFingerprint` في `MoodleActivityMap` مع discovery الحالي، ورفع `needsReview` عند تغير الاسم أو الوسوم أو visibility |
| Standalone Mode | `useGameQuestions` يعتمد على manifest المحلي أو pool AI الذي اختاره المدرس؛ لا يحتاج Moodle لإظهار أسئلة المنهج، ولا يوجد fallback إلى demo questions خارج الدرس |
| Manual Mapping | MoodlePanel يعرض الطلاب غير المربوطين، ويسمح باختيار طالب محلي وربطه بـMoodle User ID وgroup وclass |
| Health Dashboard | بطاقات اتصال، آخر sync، الطلاب، الأنشطة، الأحداث، retry، drift، والتنبيهات مع تحديث كل 30 ثانية |
| Health Probe | action `probe` يفحص `core_webservice_get_site_info`، يحفظ latency ووقت الفحص وعدد الفحوص الفاشلة المتتالية، وتستدعيه لوحة المدرس كل 5 دقائق |
| Multi-course | `syncResults` يقبل `courseId` صريحاً، و`listCourseMaps` يعرض المقررات المفعلة، وزر «كل المقررات» يزامنها تسلسلياً مع cursor مستقل لكل course map |
| Group sync | action `syncGroups` خفيف يحدث group membership كل 5 دقائق من لوحة MoodlePanel، مع `lastGroupSyncAt` وgroup drift |

يحافظ reconciliation على البيانات المحلية لأغراض التدقيق. الطالب الذي يختفي من Moodle يُعطّل mapping الخاص به ويُسجل وقت الفقدان بدلاً من حذفه، والنشاط المحذوف أو المتغير يصبح `needsReview` بدلاً من حذف نتائجه السابقة. لذلك لا تتحول تغييرات Moodle إلى فقدان تاريخي صامت.

## Webhook بعد V10

يظل HMAC-SHA256 وtimestamp window وeventHash وduplicate suppression كما هي. بعد حفظ الحدث، يمرر إلى `processMoodleSyncEvent`. الحدث الصحيح يُوسم `processed`، والحدث غير القابل للتحقق يُوسم `pending-validation` مع قائمة أسباب، والفشل العابر يُنشئ صفاً في `MoodleSyncRetry`. لا يرسل أي مسار V10 كتابة إلى Moodle.

## الاختبارات النهائية لـV10

| الاختبار | النتيجة |
|---|---:|
| `scripts/moodle-advanced-integration-smoke.cjs` | PASS — 40 check |
| `scripts/moodle-mapping-e2e.cjs` | PASS — 18 check |
| `scripts/moodle-live-sync-e2e.cjs` | PASS — 12 check؛ الجولة الثانية `changed=0` و`skipped=6` في fixture الموسع |
| `scripts/moodle-homework-results-e2e.cjs` | PASS — 16 check |
| `scripts/moodle-security-smoke.ts` | PASS — 4 check؛ تشفير/فك تشفير/رفض tamper |
| Prisma validate + db push | PASS |
| TypeScript | PASS — صفر أخطاء |
| ESLint | PASS — تحذيرا `<img>` legacy فقط |
| Production build | PASS؛ routes الجديدة ظهرت في build ومنها `/api/moodle/retry` |

يشمل advanced smoke الآن اختبار probe وhealth وreconcile وsyncGroups وlistCourseMaps وsyncResults، وwebhook صحيحاً، وwebhook غير مربوط يعيد `pending-validation`، وretry ينتقل إلى `dead` بعد فشل validation، إضافة إلى duplicate suppression ورفض التوقيع غير الصحيح.

## التشغيل والاعتماديات

أضيفت أوامر رسمية إلى `package.json`: `test:moodle:security`، `test:moodle:advanced`، `test:moodle:mapping`، `test:moodle:live`، و`test:moodle:homework`. security smoke يعمل عبر Node type stripping المدمج حتى لا يعتمد على تشغيل CJS غير متوافق مع top-level await.

تظل health probe وgroup sync داخل دورة لوحة المدرس في التطبيق المحلي. في تشغيل دائم خارج المتصفح، يمكن استدعاء actions نفسها من heartbeat/cron على خادم التطبيق، مع تجنب إنشاء جلسة AI لكل polling؛ كل العمليات deterministic ولا تحتاج نموذجاً لغوياً.

## حدود معلنة

لا يمكن لـV10 معرفة أنشطة أو طلاباً جدد في Moodle أثناء انقطاع الاتصال؛ عند عودة الاتصال يعيد reconciliation اكتشاف الفروق. كما أن `totalMoodleStudents` و`totalMoodleActivities` في لوحة الصحة يعتمدان على آخر reconciliation محفوظ، وتبقى القيم صفرية أو محلية قبل أول discovery. هذا مقصود لمنع عرض أرقام مخمنة.
