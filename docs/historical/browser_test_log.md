> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# سجل اختبار المتصفح — بسلاسة

## الحالة الأساسية

| المعرّف | السيناريو | النتيجة | الدليل |
|---|---|---|---|
| B-001 | فتح النسخة الإنتاجية على رابط الاختبار | ناجح | ظهرت صفحة «غرفة عمليات المدرس» كاملة دون شاشة خطأ أو فشل تحميل. |
| B-002 | تشغيل التطبيق بلا درس أو صف | ناجح | ظهرت حالة فارغة واضحة: «ابدأ بإضافة درس» و«لا يوجد صف نشط»، مع تعطيل بدء الجلسة ومعاينة الطالب. |
| B-003 | إغلاق نافذة تأكيد الجلسة/استعادة التفاعل | ناجح | أغلق مفتاح Escape نافذة التأكيد وعادت الواجهة إلى حالة تفاعلية. |

## ملاحظات أولية

الواجهة الإنتاجية تعمل من خلال خادم Node وقاعدة SQLite محلية. سيغطي الاختبار التالي إنشاء فصل، إضافة طلاب، تسجيل حضور، بدء جلسة، التقييم، الاستيراد، والتقارير، مع تسجيل كل نتيجة في هذا الملف.

| B-004 | فتح لوحة الفصول من الشريط الجانبي | ناجح | ظهرت قائمة فارغة سليمة وزر إنشاء فصل. |
| B-005 | فتح نموذج «صف جديد» | ناجح | ظهر نموذج الاسم والوصف واللون مع زري الحفظ والإلغاء. |

**الحالة الحالية:** نموذج إنشاء الفصل مفتوح؛ سيستخدم الفصل التجريبي لاختبار عزل البيانات والحضور والجلسات والتقارير.
| B-006 | إدخال اسم ووصف فصل تجريبي ثم حفظه | ناجح جزئياً | ظهر إشعار «تم حفظ الصف»، لكن القائمة بقيت تعرض «لا توجد فصول بعد» مباشرة بعد الحفظ؛ يلزم التحقق من إعادة الجلب أو التأخر البصري. |

**تنبيه اختبار:** الإشعار يؤكد نجاح مسار الحفظ، بينما لم تتحدث قائمة الفصول في اللقطة التالية. سيُفحص ذلك بإعادة فتح اللوحة وباستعلام API مباشر قبل اعتباره عيباً.
| B-007 | إعادة تشغيل حزمة standalone ثم قراءة API للفصول | ناجح | أعاد `classes.list` استجابة سليمة `{ ok: true, data: [] }` بعد إصلاح مسار SQLite. |
| B-008 | إعادة فتح الواجهة بعد إصلاح runtime | ناجح | التطبيق يقلع بقاعدة بيانات قابلة للقراءة؛ اختفى خطأ «Unable to open the database file». |
| B-009 | التفاعل بعد إعادة التحميل | ملاحظة | ظهر حوار تأكيد بدء جلسة بشكل غير مقصود أثناء إعادة فتح لوحة الفصول؛ سيغلق ويعاد اختبار المسار من عناصر الصفحة المحدثة لتفادي الاستدلال من فهارس قديمة. |
| B-010 | إغلاق حوار تأكيد عارض ثم فتح لوحة الفصول من الواجهة المستقرة | ناجح | ظهرت لوحة الفصول وحالة عدم وجود فصول دون أخطاء شبكة أو قاعدة بيانات. |
| B-011 | فتح نموذج فصل جديد وإدخال اسم ووصف عبر المتصفح بعد إصلاح runtime | ناجح | قبل النموذج البيانات العربية ويعرضها بصورة صحيحة في حقول الإدخال. |
| B-012 | حفظ الفصل ثم فحص API مباشرة | ناجح | أعادت الواجهة `classes.list` سجل الفصل بالاسم والوصف واللون، ما يؤكد نجاح الكتابة الفعلية. |
| B-013 | تحديث قائمة الفصول فور الحفظ | فشل واجهة | استمر النص «لا توجد فصول بعد» رغم نجاح الحفظ؛ أغلقت اللوحة لإعادة فتحها واختبار ما إذا كانت المشكلة في إعادة الجلب فقط. |
| B-014 | إعادة فتح لوحة الفصول بعد الحفظ | فشل | بقيت القائمة فارغة حتى بعد إعادة تركيب لوحة الفصول. |
| B-015 | طلب `classes.list` من Console داخل المتصفح | فشل مثبت | أعاد الطلب `{ ok: true, data: [] }` رغم أن نفس API عبر localhost يحتوي الفصل؛ يشير ذلك إلى تخزين مؤقت/توزيع طلبات GET غير صالح لمسار بيانات حي. |
| B-016 | إعادة تشغيل التطبيق بعد تعطيل cache ثم فتحه من الرابط الخارجي | ناجح | وُجدت استجابة API الحية في الاختبارات الشبكية؛ ستتحقق الواجهة من القائمة بعد إغلاق حوار الجلسة. |
| B-017 | إغلاق حوار الجلسة بـ Escape | ملاحظة | لم يغلق الحوار بالكامل رغم إخفاء نصه في الالتقاط؛ سيستخدم زر الإلغاء الصريح. |
| B-018 | محاولة إلغاء الحوار ثم إعادة التقاط DOM | ناجح مع ملاحظة | تغيّر DOM قبل النقر وأغلق الحوار فعلياً؛ لا توجد حالة معلقة الآن. |
| B-019 | فتح لوحة الفصول بعد `dynamic = force-dynamic` | فشل | بقيت فارغة في المتصفح الخارجي. |
| B-020 | طلب `classes.list` مع `cache: 'no-store'` من المتصفح | فشل موثق | أعاد استجابة قديمة مؤرخة 15:34:21 وبيانات فارغة؛ المشكلة تقع في التخزين المؤقت للوكيل الخارجي وتحتاج ترويسة `Cache-Control` صريحة في الاستجابة. |
| B-021 | اختبار API من المتصفح بعد ترويسات `no-store` | فشل في بيئة الاختبار | أعاد الرابط الخارجي نفس الاستجابة القديمة المؤرخة 15:34:21 حتى مع `Cache-Control: no-store`؛ سيُضاف query cache-buster إلى طلبات GET في العميل لضمان اختبار وسلوك صحيحين حتى عبر وكلاء قسرية التخزين. |
| B-022 | إعادة تحميل التطبيق بعد كاسر cache في العميل | ناجح | قلّعت الواجهة دون أخطاء بناء أو تشغيل؛ أُغلق تأكيد الجلسة بمفتاح Escape قبل اختبار لوحة الفصول. |
| B-023 | فتح لوحة الفصول بعد كاسر cache في العميل | ملاحظة | بقيت اللوحة فارغة في صفحة أصولها مخزنة مؤقتاً. |
| B-024 | استعلام API يدوي فريد من Console في نفس المتصفح | ناجح | أعاد الفصل الحقيقي بتاريخ 15:44:01؛ SQLite وAPI سليمان، والسبب المتبقي هو HTML/حزمة واجهة قديمة مخزنة في رابط الاختبار المؤقت. |
| B-025 | تحميل الصفحة بمعامل فريد لتجاوز cache للأصول | ناجح | بدأ التطبيق بالعنوان الفريد دون خطأ؛ أُغلق حوار الجلسة قبل استكمال اختبار الفصول. |
| B-026 | فتح لوحة الفصول بالأصول الحالية | فشل | بقيت القائمة فارغة رغم أن API الفريد يعيد الفصل. |
| B-027 | فحص Service Worker من Console | سبب محدد | يوجد `sw.js` نشط يغطي نطاق التطبيق بالكامل؛ يُحتمل أنه يعيد HTML/JS قديمة ويمنع ظهور إصلاحات العميل. |
| B-028 | إعادة تحميل الصفحة بعد نشر SW v2 | ناجح | العامل المسجل أصبح v2 (مع منع cache لـ `/api/*`). |
| B-029 | فحص API الفريد من المتصفح بعد SW v2 | ناجح | أعاد الفصل الحقيقي من قاعدة البيانات. |
| B-030 | محاولة فتح لوحة الفصول بعد SW v2 | ملاحظة | عناصر الفصول لم تظهر لأن نافذة تأكيد الجلسة حجبت DOM؛ يلزم إغلاق الحوار صراحةً قبل إعادة النقر. |
| B-031 | فتح لوحة الفصول بعد إغلاق الحوار مع SW v2 | ناجح | ظهر الفصل «الصف السادس - اختبار» والوصف «فصل قبول عبر المتصفح» في القائمة. |
| B-032 | تحقق عزل المشكلة وإعادة الاختبار بعد إصلاح SW | ناجح | انتقلت القائمة من «لا توجد فصول» إلى سجل الفصل الحقيقي؛ إصلاح الكاش أثبت فعاليته. |
| B-033 | اختيار بطاقة الفصل المحفوظ | ناجح | ظهرت بيانات الفصل وأزرار الحضور وتصفير النقاط وإضافة الطلاب. |
| B-034 | تفعيل الفصل | ناجح | تغيّر شريط الحالة إلى «الصف السادس - اختبار»، وظهر إشعار «الصف النشط». أصبح زر بدء الجلسة متاحاً. |
| B-035 | فتح نموذج إضافة الطلاب | ناجح | ظهر textarea لإدخال الأسماء مع أزرار الإضافة والإلغاء. |
| B-036 | إدخال ستة أسماء منها تكراران مطابقان | ناجح | قبل النموذج الأسماء العربية والأسطر المتكررة دون كسر الواجهة. |
| B-037 | إضافة قائمة الطلاب من الواجهة | ناجح جزئياً | ظهر إشعار «تم: 4 جديد · 2 مكرر تجاهل»، ما يؤكد منطق منع التكرار ونجاح مسار الإنشاء ظاهرياً. |
| B-038 | POST `students.listByClass` من Console بعد الإضافة | فشل/تناقض | أعاد `data: []` رغم إشعار النجاح؛ يلزم فحص API المحلي وقاعدة البيانات لمعرفة هل الكتابة ذهبت إلى قاعدة/عملية مختلفة أو أن القراءة تستخدم نسخة أخرى. |
| B-039 | إعادة تشغيل خادم نظيف ثم فتح التطبيق | ناجح | ظهرت «اختبار التشغيل» كفصل نشط وظهر مؤشر «الطلاب 1» في الواجهة. |
| B-040 | قراءة حالة الطالب بعد إعادة التحميل | ناجح | عادت بيانات الطالب من SQLite إلى شريط الحالة؛ عطل readonly/ازدواج الخادم كان سبب التناقض السابق. |
| B-041 | فتح لوحة الطلاب بعد إعادة تشغيل نظيف | ناجح | ظهر الطالب والعداد «الطلاب 1» وقائمة المتصدرين. |
| B-042 | تسجيل إجابة صحيحة (+3) | ناجح | تغيّرت النقاط إلى 3، الصح إلى 1، المحاولات إلى 1، والدقة 100%، وسُجل احتفال/نشاط. |
| B-043 | تقييم نجمة (+5) بعد إجابة صحيحة | ناجح | ارتفعت النقاط من 3 إلى 8 مع بقاء الصح 1 والدقة 100% وظهور احتفال مناسب. |
| B-044 | تسجيل الطالب غائباً | ناجح | ظهر وسم «غائب»، تغير الزر إلى «إلغاء الغياب»، وسُجل إشعار الغياب. |
| B-045 | محاولة بدء جلسة من لوحة الطلاب | ملاحظة | التفاعل الأول أغلق اللوحة ولم يظهر سجل API لأن زر DOM كان متغيراً. |
| B-046 | بدء جلسة من الزر الحالي بعنصر DOM حديث | ناجح | تغيّر الزر إلى «إنهاء الجلسة»، وظهر إشعار «بدأت جلسة جديدة — كل تفاعل الطلاب يُسجَّل الآن». |
| B-047 | محاولة إضافة ملاحظة أثناء جلسة بلا درس | حماية سليمة/ملاحظة UX | ظهر تنبيه «لا يوجد درس محمّل» ومنع فتح المسار؛ يبدو أن زر الملاحظة في هذا السياق مرتبط بفحص الدرس قبل إتمام الإجراء. |
| B-048 | إغلاق تنبيه عدم وجود درس | ناجح | عاد التطبيق إلى لوحة الطلاب دون كسر الجلسة أو البيانات. |
| B-049 | فتح تقرير الطالب | ناجح | ظهر تقرير بالنقاط 8، إجابة صحيحة 1، دقة 100%، جلستين، آخر نشاطين، والهدايا/الشارات. |
| B-050 | تصدير تقرير الطالب JSON | ناجح | ظهر إشعار «تم تصدير تقرير JSON بنجاح». |
| B-051 | إغلاق تقرير الطالب | ناجح | عاد إلى لوحة الطلاب مع بقاء الجلسة فعالة. |
| B-052 | محاولة فتح المنهج أثناء الجلسة | ملاحظة | لم تُفتح اللوحة بعنصر DOM السابق؛ يلزم تحديث اللقطة ثم النقر على العنصر الحالي بدلاً من الاعتماد على index متغير. |
| B-053 | فتح لوحة المنهج بعنصر DOM حديث | ناجح | ظهرت واجهة «استيراد شرائح (HTML/React)» وزر الاستيراد وقائمة الدروس الفارغة. |
| B-054 | تجهيز fixture للاستيراد | ناجح | وُجدت دروس HTML جاهزة، منها `public/slides/master-test-lesson.html` و`demo-lesson.html`. |
| B-055 | فحص عنصر رفع الملف | ملاحظة تقنية | وُجد `input[type=file]` بقبول HTML/JS/CSS لكنه مخفي، ولم يتمكن الرفع الآلي من تحديده؛ سأكشفه مؤقتاً داخل جلسة المتصفح فقط لإكمال اختبار الاستيراد. |
| B-056 | كشف عنصر رفع الملف للاختبار | ناجح | ظهر input الملف مؤقتاً في DOM دون تغيير كود التطبيق. |
| B-057 | رفع `master-test-lesson.html` | ناجح | ظهر اسم الملف المختار ثم اسم الدرس «المنهج التجريبي الشامل». |
| B-058 | تنفيذ الاستيراد | ناجح | أُضيف الدرس إلى القائمة دون خطأ. |
| B-059 | تحميل الدرس المستورد | ناجح | ظهر العرض البصري، عنوان الدرس، السكريبت العربي، وعداد 1/4 مع 5 أفكار و17 خطوة. |
| B-060 | ضغط عنصر غير صحيح أثناء اختبار التنقل | ملاحظة | الفهرس القديم كان زر أدوات الفصل، ولم يغيّر الشريحة. |
| B-061 | ضغط «الخطوة التالية» من DOM حديث | ناجح | انتقل العداد من 1/4 إلى 2/4، وتغير السكريبت إلى «المكونات» وتغيرت الشريحة بصرياً. |
| B-062 | الانتقال إلى الشريحة الثالثة | ناجح | ظهر سؤال «ما البسط في الكسر ثلاثة على ثمانية؟» مع اختيارات 3 و8 و11 و5. |
| B-063 | النقر الإحداثي على اختيار 3 | ملاحظة | لم يتغير العرض؛ عناصر الاختيار داخل iframe وليست أزراراً مكشوفة للمتصفح الخارجي. |
| B-064 | فحص iframe من Console | ناجح جزئياً | الإطار same-origin، لكنه لا يحتوي `button` أو `role=button`؛ يلزم فحص العناصر القابلة للنقر عامة أو اختبارها بإحداثيات دقيقة داخل الإطار. |
| B-065 | تحديد موضع iframe وعناصر الاختيار | ناجح | عُرفت مستطيلات الإجابات داخل iframe، والإطار same-origin. |
| B-066 | النقر الإحداثي المحسوب على الإجابة 3 | فشل وظيفي/ملاحظة | بقي السؤال كما هو؛ النقر الآلي الخارجي لا يفعّل مستمعات iframe في هذا الاختبار، بينما التنقل والتحميل يعملان. |
| B-067 | تفعيل الإجابة الصحيحة من داخل iframe برمجياً | ناجح | وُجد عنصر «3» وفُعّل، وظهرت class `feedback correct` ورسالة «✓ إجابة صحيحة! أحسنت». |
| B-068 | التحقق من حالة السؤال بعد الإجابة | ناجح | نص iframe احتوى السؤال والاختيارات ورسالة النجاح؛ منطق السؤال سليم، وملاحظة النقر السابق تخص قناة التحكم الخارجي فقط. |
| B-069 | الانتقال إلى الشريحة الرابعة | ناجح | ظهر سؤال «لو أكلنا 5 قطع من 8، ما الكسر؟» مع أربع اختيارات. |
| B-070 | تفعيل إجابة خاطئة `8/5` داخل iframe | ناجح | ظهر feedback «✗ إجابة خاطئة - الإجابة الصحيحة محددة بالأخضر»، مع بقاء feedback الصحيح السابق في DOM الخاص بالشرائح. |
| B-071 | فتح معاينة الطالب | ناجح | ظهرت شاشة «معاينة الطالب» مع عنوان الدرس والعداد 1/4 وخطوة 1 من 4 دون واجهة المعلم. |
| B-072 | الخروج من معاينة الطالب | ناجح | عاد وضع المدرس مع الدرس والسكريبت والجلسة دون فقد الحالة. |
| API-001 | مصفوفة القراءة الأولية | كشف عيوب | كشفت عمليات مفقودة: `students.list` ثم `questions.list`، ومسار وهمي `sessionResults.listRecent`. تم تنفيذ إصلاحات العقد/dispatcher وإزالة المسار الوهمي. |
| API-002 | مصفوفة CRUD والجلسات بعد الإصلاح | ناجح | نجحت قراءة/إنشاء/حذف الفصول والطلاب، الحضور، بدء الجلسة، snapshot، delta، إنهاء الجلسة مع statsJson، وإعادة القراءة والتنظيف. |
| API-003 | اختبارات TypeScript وBuild بعد الإصلاحات | ناجح | `tsc --noEmit` والبناء الإنتاجي مرّا بنجاح؛ بقي تحذير tracing في backup فقط. |
| API-004 | استمرارية SQLite عبر `pnpm build` ثم إيقاف/إعادة تشغيل `pnpm start` | ناجح | سجل `persist_pkg_*` بقي موجوداً بعد إعادة التشغيل؛ تم تحويل production إلى URI مطلق لقاعدة `data/custom.db` خارج standalone. |
| QA-001 | `pnpm exec tsc --noEmit` النهائي | ناجح | لا توجد أخطاء TypeScript بعد الإصلاحات. |
| QA-002 | `pnpm run build` النهائي | ناجح مع تحذير | البناء الإنتاجي يمر؛ التحذير الوحيد عن tracing ديناميكي في `api/backup/route.ts`. |
| QA-003 | `pnpm run lint` النهائي | يحتاج عمل لاحق | ما زالت أخطاء React Hook/نمط في الألعاب والسبورة و`ClassesPanel` و`use-mobile`؛ لا تمنع build لكنها دين تقني يجب إصلاحه قبل اعتماد بوابة CI صارمة. |
| B-073 | إعادة فتح المتصفح بعد تعذر الجلسة مؤقتاً | ناجح | عاد المتصفح للعمل بعد إعادة الملاحة؛ الخادم وAPI كانا سليمين، والعائق كان من جلسة المتصفح لا التطبيق. |
| B-074 | إقلاع النسخة الحالية بعد إصلاح استمرارية SQLite | ناجح | ظهر «Package Persistence» كفصل نشط، مع حوار جلسة البدء؛ يؤكد أن السجل بقي بعد restart. |
| B-075 | فتح لوحة المجموعات | ناجح | ظهرت الفئة الحالية وأزرار «تقسيم تلقائي» و«+ مجموعة». |
| B-076 | حالة المجموعات بلا طلاب | حماية سليمة | أوضح التطبيق «لا يوجد طلاب في هذا الصف» وطلب الإضافة أولاً بدلاً من تنفيذ تقسيم فارغ. |
| B-077 | فتح لوحة الجوائز | ملاحظة | انتقلت اللوحة دون خطأ، لكن عرض النص المستخرج لم يُظهر الكتالوج في هذه اللقطة. |
| B-078 | فتح مكتبة الهدايا | ناجح | ظهرت مكتبة 20 هدية، تصنيفاتها، صورها، البحث، وأزرار الحذف دون أخطاء. |
| B-079 | الضغط على الإعدادات | ملاحظة/فشل UI محتمل | لم تظهر لوحة الإعدادات في المحتوى بعد النقر. |
| B-080 | إعادة التقاط الصفحة بعد الإعدادات | ملاحظة | بقي الزر موجوداً دون محتوى إعدادات؛ يحتاج هذا المسار إلى فحص مكوّن `SettingsPanel` أو شرط فتحه في دورة إصلاح لاحقة. |
| B-081 | فحص DOM بعد النقر المرئي على الإعدادات | ملاحظة | لم تكن لوحة الجانب موجودة قبل التفعيل المباشر. |
| B-082 | تفعيل زر الإعدادات مباشرة من DOM | ناجح | `button[title="الإعدادات"] .click()` أنشأ side-panel؛ عدم الظهور السابق كان من فهرس النقر/تزامن snapshot وليس من SettingsPanel. |
| B-083 | فحص مفاتيح الإعدادات | ناجح | ظهرت مفاتيح الكتم والتعليقات والنطق والسبورة والمسح التلقائي مع حالاتها. |
| B-084 | تفعيل التعليقات الافتراضية | ناجح | تغيّرت الحالة من false إلى true، وأعاد `settings.get` الإعدادات المحفوظة دون خطأ. |
| B-085 | تصدير النسخة الاحتياطية JSON | ناجح | ظهر إشعار التنزيل وتسجيل ملف JSON بحجم 26.2KB في تاريخ النسخ. |
| B-086 | تصدير نسخة SQLite `.db` | ناجح | ظهر إشعار التنزيل وتسجيل ملف DB بحجم 336.0KB في تاريخ النسخ. لم أختبر «مسح الكل» لأنه إجراء هدّام على البيانات الحالية. |

### AI/UI Regression Batch — 2026-08-13
- B-085: Production build on http://127.0.0.1:3000 loaded successfully in internal browser; title and Shell visible; side rail exposed the new «مساعد AI» button, along with whiteboard, orientation, zoom, fullscreen, celebrations, games, leaderboard, student card, and grades controls. PASS.
- B-086: Automated click attempt on «مساعد AI» was intercepted by the existing «جلسة جديدة» confirmation dialog because the dialog remained open from persisted UI state. This is not an AI panel failure; next step is to dismiss/confirm the dialog and retry with a fresh DOM snapshot.

### AI/UI Regression Batch — continued
- B-087: After dismissing the persisted session confirmation, the internal browser opened «مساعد AI» successfully. The panel showed the optional toggle in the OFF state, context-sharing toggle, Arabic safety notice, prompt textarea, educational presets, Google key management, model/temperature/output controls, and no managed keys. PASS.
- B-088: Toggled the AI feature ON in the browser; prompt controls became enabled while the context toggle remained independently controllable. PASS.
- B-089: Submitted an Arabic prompt with no configured Google key; the panel displayed the safe actionable error «لا يوجد مفتاح Google AI مفعّل...» and remained responsive. PASS.
- B-090: Clicked «الطلاب» from the AI panel; the side rail remained visible but the students panel did not open in the automated click snapshot. Repeated browser view confirmed the panel was still closed. This reproduces the known fragile automated-index/side-rail interaction issue and requires direct DOM/coordinate verification before classifying as a product defect.
- B-091: Direct DOM click on the «الطلاب» button opened the students panel successfully; the panel displayed the empty state and add-student controls. The earlier automated-index failure was a test harness/snapshot issue, not a product navigation failure. PASS.
- B-092: DOM sweep opened the main side panels sequentially: curriculum, analysis, AI, assets, notes, students, classes, groups, prizes, gifts, quick gift, sounds, and settings. Each target was found and remained visible after opening; no unhandled exception surfaced. PASS.
- B-093: Settings panel opened after the sweep and displayed SQLite stats, JSON/DB backup, restore, session controls, teleprompter, audio, comments, TTS, whiteboard, keyboard shortcuts, and reset controls. PASS.
- B-094: Settings stats currently show 0 students, 1 lesson, 0 sessions, 0 games in the clean local database. This matches the post-cleanup database state; no new mismatch was introduced by AI work.
- B-095: Initial game-button sweep by visible text found none because the bottom game controls are icon-only buttons with title attributes. DOM inspection identified the real controls by title at indices 72–75: curriculum games, memory games, luck/reward games, and classroom tools. This is a test-selector issue, not a product defect.
- B-096: Using the actual title selectors, all four game controls responded without a JavaScript exception. With no active lesson, the app showed the intentional guard «لا يوجد درس محمّل — يجب تحميل درس من المنهج أولاً حتى تظهر الألعاب داخل منطقة العرض»، and left the shell recoverable. PASS.
- B-097: Closed the no-lesson guard and opened the curriculum panel through DOM. The existing lesson «المنهج التجريبي الشامل» was visible with import and delete controls. PASS.
- B-098: Loaded «المنهج التجريبي الشامل» from the curriculum; the stage showed title, 5 ideas, 17 steps, slide 1/4, and Arabic script. PASS.
- B-099: Opened the curriculum-games menu with the loaded lesson; it displayed «تحدي الأسئلة», «مسابقة الأسئلة», «أسئلة سريعة 10ث», and «تحدي الرياضيات» options. PASS.
- B-100: After reloading with the temporary class/student and active lesson, the memory-games control opened the «لعبة الذاكرة بصري / صوتي» overlay. A session-start confirmation appeared because the game path is session-aware; this is expected protection, not a crash.
- B-101: DOM cancellation removed the first confirmation action but a confirmation shell remained visible alongside the memory overlay; this needs a fresh visual/DOM snapshot to distinguish nested confirmation from stale text.
- B-102: Visual browser inspection showed the memory-game overlay with a clear close button and the «لعبة الذاكرة — بصري/صوتي» selection card; the earlier confirmation text was not visually present after cleanup. PASS.
- B-103: Entered the memory-game setup with the temporary student; the panel showed visual/audio modes, fair selection, student name, round counter, and start action. PASS.
- B-104: Started the memory round; the browser showed round 1, state «شاهد/كرر!», and the four colored pads with no runtime error. PASS.
- B-105: Clicking a memory pad advanced the game from round 1 to round 2 and returned to the watch/repeat state; no freeze or exception. PASS.
- B-106: Closing an active memory game correctly opened «تأكيد الخروج من اللعبة» explaining that progress would be lost; confirming exit returned to the lesson stage cleanly. PASS.
- B-107: Opened the luck/reward menu; it displayed «عجلة الحظ» and «الصندوق الغامض 6 صناديق مفاجآت». PASS.
- B-108: Opened «الصندوق الغامض» with the temporary student; the setup showed fair/random selection, the student name, and «ابدأ اللعب». PASS.
- B-109: Started the mystery-box round; the panel displayed the temporary player and six box choices. PASS.
- B-110: DOM inspection identified all six box buttons (🎁 📦 🎀 ✨ 💫 🎊) without ambiguity. PASS.
- B-111: Opened one mystery box; the browser showed a single reward «بطل! +3 نقطة مُضافة», confetti/medal celebration, remaining boxes, and «صندوق آخر». No duplicate reward or freeze observed. PASS.
- B-112: Closing the mystery-box game required the intentional exit confirmation; confirming returned to the lesson stage with no game overlay, while the independent medal celebration remained briefly as designed. PASS.
- B-113: Opened «أدوات الفصل»; the menu displayed dice, reaction-speed, active-break, and fair student-wheel tools. PASS.
- B-114: Opened the dice tool; setup showed fair student selection, the temporary student, 1–4 dice count options, and «ارمِ». PASS.
- B-115: Dice animation initially showed «جاري الرمي...» and then completed without hanging. PASS.
- B-116: Final dice state showed two dice faces, total 11, and the last-results history; the roll control remained available. PASS.
- B-117: Dice tool closed cleanly and returned to the lesson. PASS.
- B-118: The first reaction-tool selector was too specific; DOM inspection found the correct composite control «سرعة رد الفعل — استراحة نشطة». This is a selector issue, not a UI failure.
- B-119: Opened the reaction-time tool; setup showed fair student selection, temporary student, and the composite «اضغط للبدء — اختبر سرعة رد فعلك» control. PASS.
- B-120: The exact-text selector for «اضغط للبدء» did not match because the button includes a second line; DOM inspection identified the composite button. This is a selector issue, not a product failure.
- B-121: Started reaction-time measurement from the composite control; the tool transitioned to «استعد... انتظر اللون». PASS.
- B-122: The target state appeared as a large green «اضغط الآن! بسرعة!» card, ready for the measured click. PASS.
- B-123: Clicking the reaction target produced a numeric result of 28,301 ms, updated best-time and recent-attempt displays, and triggered the star celebration. PASS.
- B-124: Opened the smart-whiteboard toolbar over the loaded lesson; all major tools were visible: mouse, pen, pen+laser, highlighter, erasers, rainbow pen, laser, text, triangle/circle/square/arrow, marks, stamps, undo/redo, and clear-all. PASS.
- B-125: Canvas inspection found the whiteboard canvas positioned over the lesson but pointer-events disabled, indicating the app intentionally routes drawing through its interaction layer rather than raw canvas clicks. PASS/architecture note.
- B-126: Direct DOM activation of «قلم (P)» succeeded without exception; the toolbar remained responsive. PASS.
- B-127: Keyboard batch tested P/L/E/S/A/R/V/B/G/C/M/W/N, ArrowRight, ArrowLeft, Space, and restored W. The shell remained responsive; keyboard-driven state changes occurred without exception. PASS.
- B-128: Post-keyboard browser state showed slide 3/4 with the fraction question, audio toggle changed to «تشغيل الصوت», and the student-wheel overlay open with «ابدأ الدوران» and the four answer values visible. PASS.
- B-129: Started the student wheel from the R shortcut; the UI entered «جاري الدوران...» without freezing. PASS.
- B-130: After the animation, the wheel selected «طالب تدقيق مؤقت», displayed the available rewards, and exposed «أعد الدوران» plus cancel/celebration actions. PASS.
- B-131: Closed the wheel result and opened the celebration panel from the bottom rail; the panel displayed «الاحتفالات (36)», 36 defaults, custom-count summary, «احتفال جديد», and edit controls. PASS.
- B-132: Clicking the «كونفيتي» celebration card launched the celebration overlay and positive message «أداء مذهل!» without changing the panel data. PASS.
- B-133: The first edit-button selector by title did not match in the current DOM; customization controls are likely represented by unlabeled icon buttons/card actions and need a fresh attribute scan. Selector issue only so far.
- B-134: After launching «كونفيتي», the celebration editor closed and the independent student-wheel result overlay remained active; a fresh DOM scan therefore found no celebration edit buttons. This is expected overlay layering, not data loss. PASS/architecture note.
- B-135: Closed the wheel result and reopened the AI panel alone over slide 3. The panel showed independent AI/context switches, prompt/preset controls, the «مفتاح» action, model settings, and Google security notice. PASS.
- B-136: Opened the Google-key form; it provided label, password-type key field, visibility toggle, model field, encrypted-save, and cancel actions. PASS.
- B-137: Filled a non-real audit key and canceled; the key did not appear in the managed-key list and the AI panel returned to its normal state. PASS.
- B-138: The first immediate disabled-state read after clicking the participant was stale; after a 220 ms React render wait, «ابدأ التحدي» became enabled. This is an asynchronous test observation, not a product defect.
- B-139: Started the real curriculum question challenge; the game displayed the temporary participant, score 0, correct/wrong counters, lesson topic, question 1/2, and four answer options. PASS.
- B-140: Correct answer 5/8 awarded 4 points, incremented the correct counter to 1, launched the configured celebration, and advanced to question 2/2. PASS.
- B-141: The initial post-click DOM snapshot still showed question 1; after the game transition, fresh browser view showed question 2 with new options and stable counters. This was asynchronous rendering, not a logic defect.
- B-142: The second correct answer completed the challenge; fresh view showed «الفائز! طالب تدقيق مؤقت», 7 points, 2 correct, 0 wrong, «تحدي جديد», and a winner celebration. PASS.
- B-143: Closed the completed challenge and reopened the curriculum-game menu. PASS.
- B-144: Opened «مسابقة الأسئلة»; setup showed question-count controls, source controls, a 2-participant requirement, add/random participant actions, and the intentional exhausted-source warning. PASS.
- B-145: With two hydrated students, the multiplayer quiz start button became enabled and started the competition. PASS.
- B-146: The first quiz question rendered with both scoreboards and two answer options still visible after the first click/reveal; celebration «أحبك!» appeared, so the score transition needed a fresh post-animation check. PASS/transition note.
- B-147: After the reveal wait, the quiz exposed teacher-controlled winner buttons and «التالي بدون نقطة», preserving the app's teacher-in-the-loop philosophy. PASS.
- B-148: Awarded the first player «طالب تدقيق ثانٍ» +4; scoreboard updated to 4 vs 0 and the game advanced to question 2/2. PASS.
- B-149: The final reveal used a dynamic +3 reward button rather than +4; DOM inspection found the correct current label and avoided a false failure. PASS/selector note.
- B-150: Awarded the second round to «طالب تدقيق مؤقت»; the multiplayer quiz ended with winner display «طالب تدقيق ثانٍ فاز بـ 4 نقطة» and a new-match action. PASS.
- B-151: Started QuickFire with the temporary student; setup transitioned to a 10-second timer, question 1/2, score/streak counters, and four options. PASS.
- B-152: The quick round completed through timeout/incorrect attempts; result screen showed 0 points, 0 correct, 2 wrong, and «جولة جديدة» without a crash. PASS.
- B-153: Opened Math Challenge setup with student selector, easy/medium/hard modes, curriculum mode, 30/60/90/120-second durations, and start action. PASS.
- B-154: Started the easy 60-second round; displayed 13−6, numeric answer field, timer, and confirmation control. PASS.
- B-155: Submitted 7 for 13−6; score advanced to 10, streak to 1, and the next problem 7+14 appeared with timer continuing. PASS.
- B-156: Submitted an intentionally wrong answer (20 for 7+14); streak reset to 0 while points stayed at 10, and the game generated a new timed problem 19−10. PASS.
- B-157: Math Challenge timed out safely; result screen showed «انتهى الوقت!» and preserved 10 points with a «تحدي جديد» action. PASS.
- B-158: Opened Weekly Challenge; it displayed the 10-correct-answers goal for the week of 8 August, two ranked students (3/10 and 2/10), and correctly reported that nobody had passed. PASS.
- B-159: Opened Leaderboard; session-current and lifetime tabs were available, with two students ranked at 14 and 3 points. PASS.
- B-160: The «تصفير الكل» destructive action was visible and isolated; it was not activated during audit to avoid erasing the fixture before cleanup. PASS/safety note.
- B-161: Opened Student Card list; it showed filters «الكل/تم سؤالهم/لم يُسألوا» and both hydrated students with points and called status. PASS.
- B-162: Opened «طالب تدقيق ثانٍ» card; it displayed session/lifetime tabs, DNA, +14 points, today correct/wrong counts, 50% accuracy, badges, gifts, celebrations, and back action. PASS.
- B-163: Clicking the grades action produced the in-app confirmation «تم فتح صفحة الدرجات في تاب جديد — استخدم Ctrl+P للطباعة». PASS.
- B-164: Browser tab switching did not expose the new tab through the automation session, so visual verification of the separate tab remains a browser-session limitation, not an application error.
- B-165: Direct HTTP verification of /grades?audit=1 returned 200 with title «تقرير درجات — كل الفصول» and 11,467 bytes. Visual tab verification was unavailable after browser session timeout, but the route itself is healthy. PASS.
- AI-API-001: generate without a configured Google key returned a clear safe error and did not call an external provider.
- AI-API-002: keys.create returned only id/label/keyHint/model/isActive/priority; the raw key was never returned.
- AI-API-003: keys.update disabled the temporary key and changed priority; keys.delete removed it; keys list returned empty afterward.
- AI-API-004: raw temporary Google key was absent from SQLite and the recorded API output. PASS.
- B-166: Reopened production UI after the browser-session reset; the active-session confirmation appeared as designed. PASS.
- B-167: Portrait toggle opened a clear confirmation explaining script/menu relocation; after confirmation the control title changed to «التبديل للوضع العرضي», proving portrait mode activation. PASS.
- B-168: Zoom-in was triggered in the same flow without exception; visual class introspection was not available because the wrapper is rendered in a child boundary, but the control action completed. PASS/architecture note.
- B-169: Fullscreen button action completed without a runtime error; the browser-reported fullscreenElement remained false because automated browser fullscreen permission is blocked, so this is an environment limitation. PASS/limitation.
- B-170: The UI reflected the tested zoom state as 110% while the shell remained responsive. PASS.
