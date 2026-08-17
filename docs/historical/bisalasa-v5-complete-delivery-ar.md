> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# تقرير تسليم منصة بسلاسة — Master Plan V5

**الإصدار:** V5 النهائي بعد إصلاح parser وإغلاق فجوات التدقيق

**تاريخ التحقق:** 14 أغسطس 2026

**المشروع:** `/home/ubuntu/bisalasa-full-audit`

## الملخص التنفيذي

تم استكمال نسخة V5 من منصة **بسلاسة — غرفة عمليات المدرس** مع الحفاظ على الفلسفة الأساسية: المدرس هو صاحب القرار، والطلاب لا يدخلون المنصة، ومشهد العرض المخصص للبث أو Zoom منفصل عن أدوات التحكم الحساسة. تم إصلاح خطأ parser في `StudentReportPanel.tsx`، وإكمال التقرير الموحد، وإغلاق GAP الخاص بالتفعيل الفوري للسبورة، وتصحيح قواعد تدقيق polling وCustom App التي كانت تسجل فجوات كاذبة رغم وجود التنفيذ.

> النتيجة النهائية: **TypeScript ناجح، Build إنتاجي ناجح، API matrix ناجحة 10/10، مصفوفة السيناريوهات ناجحة 10000/10000، اختبارات الرياضيات 17/17، اختبارات Moodle الأمنية 4/4، واختبار Telegram report 3/3.**

## جدول مطابقة Master Plan V5

| المحور | النتيجة | ما تم التحقق منه |
|---|---:|---|
| عزل مشهد الطلاب SSR | PASS | `/?view=student` يعرض المشهد الطلابي دون لوحات المدرس، وHTML يحتوي `data-student-broadcast`. |
| حدود قرار المدرس والسبورة | PASS | اختيار أدوات الرسم يفعّل `settings.whiteboardEnabled` فوراً، مع استمرار عزل المشهد الطلابي. |
| محرر الدرس | PASS | تعديل العنوان والسكريبت والنوتس وحفظ `manifestJson` مع اعتماد يدوي لتحسينات AI. |
| أدوات AI للمدرس | PASS | أربعة إجراءات في التليبرومبتر: أسئلة محتملة، اشرح أكثر، أعطِ مثال، بسّط للطالب. |
| اكتشاف الموديلات | PASS | دعم جلب الموديلات من Google وOpenAI-compatible وCustom APIs. |
| عدالة اختيار الطلاب | PASS | دوران الحصة، وعدالة مستقلة لكل فكرة، وسجل تدخلات وأنشطة. |
| Moodle | PASS | إعداد الدورة/المجموعة، تشفير مستقل، مزامنة حالات مباشرة، وربط يدوي للطلاب. |
| Custom App Hook | PASS | إعداد endpoint وmethod وحقول mapping وauth scheme، اختبار وسحب، وتشفير token مستقل. |
| polling الخارجي | PASS | دورة مزامنة كل 5 ثوانٍ باستخدام `POLL_MS = 5_000` مع الحفاظ على الحالة المحلية عند فشل الخدمات. |
| Understanding Meter | PASS | تجميع حالات correct/wrong/waiting من الحالة المحلية وMoodle وCustom App. |
| التقرير الموحد | PASS | التقرير يعرض الحالة الحية ومصدرها ووقت التحديث والدرس النشط وموضع الشريحة. |
| تصدير JSON | PASS | أضيفت `liveStatus` و`interactiveLesson` إلى ملف التقرير. |
| تصدير PDF العربي | PASS | أضيف قسم المؤشر الحي والشرح التفاعلي إلى تقرير الطالب مع نص عربي. |
| الألعاب | PASS | مصفوفة الألعاب والسيناريوهات غطت 9 أنواع ألعاب، مع 5060 سيناريو قابلاً للعب و4940 سيناريو محجوباً أو فارغاً بصورة متوقعة. |
| الاختبارات والمصادقة | PASS | اختبارات Mock، API contracts، crypto smoke tests، واختبارات التقرير. |
| الأداء | PASS | dynamic/lazy imports، OffscreenCanvas، pointer refs، memoization، وقوائم افتراضية. |
| الأمان | PASS | تدوير مفاتيح AI مع cooldown، تشفير Moodle وTelegram وCustom App منفصلاً، والتحقق من webhook secret. |

## الإصلاحات الأساسية في هذه الجولة

كان الخطأ المانع للبناء في تعليق JSX داخل `StudentReportPanel.tsx`. كان التعليق يبدأ بـ`{/*` وينتهي بـ`*/` دون قوس JSX الختامي `}`، فكان TypeScript يبلغ عن `'}' expected` عند بداية القسم التالي. تم إصلاحه وإعادة تشغيل TypeScript بنجاح.

أضيف إلى التقرير الموحد مصدر الحالة الحية وفق ترتيب المطابقة المعتمد في قائمة الطلاب: معرف الطالب المباشر، ثم مفتاح Moodle، ثم مفتاح Custom App. كما أضيفت بيانات الدرس النشط، رقم الشريحة الحالية، إجمالي الخطوات، والفكرة النشطة إلى واجهة التقرير وتصديري PDF وJSON.

تم تعديل `setWhiteboardTool` بحيث يؤدي اختيار أي أداة رسم غير `select` إلى تفعيل السبورة فوراً، دون تغيير اللون أو السمك أو الأداة المختارة. كما تم تحديث `scripts/master_plan_audit.sh` ليتعرف على `5_000` و`POLL_MS` وعلى عقد Custom App الفعلي، ولذلك أصبحت نتيجة التدقيق صادقة ولا تسجل GAPs وهمية.

## نتائج التحقق البرمجي

| الفحص | النتيجة |
|---|---:|
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm run lint` | PASS — صفر أخطاء، وتحذيران فقط متعلقان باستخدام `<img>` في `IframeStage` و`StudentCard`. |
| `DATABASE_URL=... pnpm run build` | PASS — Next.js production build ناجح. |
| `./scripts/master_plan_audit.sh` | PASS — جميع البنود المسجلة في التدقيق ناجحة. |
| `pnpm run test:math` | PASS — 17 ناجحة، 0 فشل. |
| `python3 scenario_matrix_10000.py` | PASS — 10000 مولدة، 10000 ناجحة، 0 فشل. |
| `api_contract_matrix_v4.py` | PASS — 10/10. |
| `moodle-security-smoke.ts` | PASS — 4/4، ولا يظهر plaintext داخل ciphertext. |
| `telegram-report-smoke.ts` | PASS — 3/3، وحجم التقرير 10978 bytes. |
| SSR student view | PASS — `data-student-broadcast` موجود، ولا توجد عناصر واجهة AI/Notes/محرر الدرس في المشهد الطلابي. |
| ملف الدرس التجريبي | PASS — HTTP 200 وحجم 27011 bytes. |

## Custom App Hook: طريقة الاستخدام

من لوحة **Moodle / Custom App** يمكن تفعيل التكامل وإدخال `baseUrl` و`endpointPath`، ثم اختيار GET أو POST وتحديد مسار القائمة داخل JSON مثل `statuses`. يمكن تخصيص أسماء الحقول الخاصة بالمعرف والحالة ووقت التحديث والوسم، مع اختيار `Bearer` أو `Raw` وتحديد اسم authorization header. زر الاختبار يتحقق من الاتصال، وزر السحب يجلب الحالات ويطبعها في store تحت مفاتيح `custom:<externalId>`.

يتم حفظ token بعد تشفير AES-256-GCM بمفتاح مستقل عن Moodle وTelegram. عند تعطل التطبيق الخارجي لا تُمسح نتائج المدرس المحلية، ويستمر العرض من آخر حالة سليمة أو من الحالة المحلية.

## التقرير الموحد ومؤشر الفهم

يحتوي تقرير الطالب الآن على حالة مباشرة بلغة واضحة: إجابة صحيحة، إجابة خاطئة، ينتظر إجابة، أو لا توجد حالة مباشرة. كما يعرض مصدر الحالة: محلي، Moodle، أو Custom App، ووقت آخر تحديث إن توفر. ويعرض قسم الشرح التفاعلي اسم الدرس النشط وموضع الشريحة الحالية وإجمالي خطوات المنهج والفكرة النشطة.

يُستخدم نفس ترتيب مطابقة الحالة في قائمة الطلاب وشريط الحالة والتقرير، لتفادي اختلافات UX بين أجزاء غرفة العمليات. يظل القرار بيد المدرس؛ الحالات الخارجية مؤشرات مساعدة وليست بديلاً عن قرار المدرس أو دخول الطلاب إلى التطبيق.

## اختبار المتصفح والمعاينة

تم فحص رابط المعاينة في وضع الطلاب ووضع المدرس. مشهد الطلاب بدأ بحالة عدم وجود درس، ولم يعرض أزرار AI أو Notes أو محرر الدرس أو لوحات المدرس. مشهد المدرس عرض البانلات العادية، وأدوات السبورة، والألعاب، والاحتفالات، والأزرار السفلية في أماكنها. عند محاولة فتح لوحة AI دون صف نشط ظهرت نافذة تأكيد الجلسة بصورة سليمة وتم إلغاؤها دون تعطل الصفحة.

توجد ملاحظة تشغيلية خاصة ببيئة متصفح الاختبار: كان علم seed محفوظاً في localStorage، وبعد حذفه بقيت قاعدة IndexedDB فارغة في بيئة المتصفح الداخلية، رغم أن ملف الدرس التجريبي نفسه يُخدم مباشرة بنجاح. لذلك تظهر المعاينة الحالية برسالة إضافة درس؛ يمكن استخدام المنهج من لوحة المدرس لاستيراد الملف، كما أن هذا لا يغيّر نتيجة عزل SSR أو سلامة build.

تفاصيل الفحص محفوظة في `qa-browser-findings.md` داخل الأرشيف.

## الملفات المهمة في التسليم

| الملف | الوظيفة |
|---|---|
| `src/app/page.tsx` و`src/app/page-client.tsx` | فصل SSR عن Client وعزل `view=student`. |
| `src/components/shell/IframeStage.tsx` | مشهد الشرائح مع `studentView`. |
| `src/components/shell/LessonEditorPanel.tsx` | محرر الدرس وحفظ manifest. |
| `src/components/shell/StudentReportPanel.tsx` | التقرير الموحد وتصديرا PDF وJSON. |
| `src/components/shell/MoodleLiveSync.tsx` | مزامنة Moodle وCustom App كل 5 ثوانٍ. |
| `src/app/api/custom-sync/route.ts` | Custom App Hook API. |
| `src/lib/custom-app-crypto.ts` | تشفير Custom App المستقل. |
| `src/lib/shell-store.ts` | الحالة المركزية وعدالة الاختيار وتفعيل السبورة. |
| `scripts/master_plan_audit.sh` | تدقيق Master Plan V5. |
| `qa-browser-findings.md` | نتائج فحص المعاينة. |

## روابط التسليم

**رابط المعاينة:** [فتح منصة بسلاسة](https://3010-ik65uzbdda20igzsnjw3a-48af3c8f.sg1.manus.computer/)

**مشهد الطلاب للبث:** [فتح مشهد الطلاب](https://3010-ik65uzbdda20igzsnjw3a-48af3c8f.sg1.manus.computer/?view=student)

**رابط تنزيل السورس الكامل بدون Login:** [تحميل bisalasa-v5-final-complete.tar.gz](https://files.manuscdn.com/user_upload_by_module/session_file/310519663080508293/ySVntPhGJNOImyui.gz)

## الخلاصة

النسخة الحالية قابلة للبناء والتشغيل والتنزيل، وتحقق متطلبات Master Plan V5 الأساسية: فصل ما يراه الطلاب عن أدوات المدرس، دعم AI متعدد المزودين مع اكتشاف الموديلات، محرر الدرس، عدالة الاختيار، Moodle وCustom App، تقارير موحدة، سبورة رياضيات، ألعاب، احتفالات، وتغطية اختبارية واسعة. التحذيران الوحيدان في lint غير مانعين للتشغيل ويرتبطان بتحسين تحميل صور موجودة، ولم يظهر أي فشل في TypeScript أو build أو اختبارات العقود والأمان.


## ملحق إغلاق QA — 14 أغسطس 2026

أُعيد تشغيل برنامج QA العالمي بعد إضافة إصلاحين مهمين. الأول يحوّل structured equation الناتج من AI إلى مسودة سبورة عربية قابلة للمراجعة بدلاً من عرض JSON الخام. والثاني يثبت مسار secret الخاص بمفاتيح AI بجوار قاعدة SQLite أو عبر `BISALASA_AI_KEY_SECRET_FILE`، حتى لا تفقد المفاتيح المشفرة صلاحيتها بعد استبدال `.next/standalone` في build جديد.

| الحزمة | النتيجة الجديدة |
|---|---:|
| Student/Class/Group E2E | 73/73 |
| DB relational/concurrency E2E | 50/50 |
| AI Mock E2E | 21/21 |
| Integrations Demo E2E | 30/30 |
| Scenario matrices | 10,000/10,000 و25,000/25,000 |
| API / Math / Moodle / Telegram | 10/10، 17/17، 4/4، 3/3 |
| TypeScript / Master Plan Audit | PASS / جميع البنود PASS |

تمت إعادة تجربة مفتاح `QA Mock AI Persistent` بعد restart كامل لخادم production، ونجح الاتصال عبر `mock-math-pro` مع بقاء المفتاح مشفراً. كما نجح model discovery، structured lesson analysis، توليد الأسئلة، الاعتماد اليدوي، وإرسال مسودة السبورة إلى textarea بصيغة مقروءة. تفاصيل المتصفح والإصلاحات محفوظة في `qa-browser-full-findings.md`، والتقرير التنفيذي الكامل في `qa-final-report-ar.md`.

**رابط معاينة QA:** [فتح غرفة عمليات المدرس على 3012](https://3012-ik65uzbdda20igzsnjw3a-48af3c8f.sg1.manus.computer/)  
**مشهد الطلاب:** [فتح Student View](https://3012-ik65uzbdda20igzsnjw3a-48af3c8f.sg1.manus.computer/?view=student)

الملاحظات غير المانعة المتبقية هي تحذيرا lint المرتبطان بـ`<img>`، وضرورة مسح state قديمة للسبورة إذا كانت بيئة الاختبار قد أظهرت JSON قبل الإصلاح. لا يمثل أي منهما فشلاً في build أو عزل Student View أو صحة مسار الإدراج الجديد.

**أرشيف QA النهائي بدون Login:** [تحميل bisalasa-v5-qa-complete.tar.gz](https://files.manuscdn.com/user_upload_by_module/session_file/310519663080508293/ZNhscxdcLYgXvRlA.gz)
