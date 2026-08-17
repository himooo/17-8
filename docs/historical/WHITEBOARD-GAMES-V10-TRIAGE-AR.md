# تدقيق فجوات السبورة والألعاب والاحتفالات والهدايا والشارات والأصوات — V9 إلى V10

**الحالة:** ناتج مطابقة مراجعة `14-WHITEBOARD-GAMES-CELEBRATIONS-GIFTS-BADGES-SOUNDS-V9-CRITICAL-REVIEW.md` مع المصدر الحالي في 15 أغسطس 2026.

## الحكم الأولي

المراجعة المرفوعة دقيقة في وصف الفجوات المتقدمة، لكنها تحتوي على ادعاءات أصبحت قديمة بعد أعمال V10 السابقة. لذلك لا يصح تنفيذها حرفياً بإضافة مكونات موازية قد تسبب ازدواجية أو تضاعف النقاط. التنفيذ الصحيح هو الحفاظ على الأساس الحالي ثم إضافة طبقات اختيارية محلية، مع بقاء المدرس صاحب القرار وعدم كشف لوحات المدرس أو أدوات AI في وضع الطالب.

## ما ثبت أنه منفذ بالفعل

| البند | الدليل الحالي |
|---|---|
| بوابة `pickStudentFair` | موجودة في `src/lib/game-utils.ts` مع فكرة ودرس وأداء وجلسة، وتسجيل `fair-pick` |
| ربط ألعاب اختيار الطلاب | الألعاب الحالية تستورد `useGameStudentPicker`، والـhook يستدعي `pickStudentFair` بدلاً من اختيار عشوائي مباشر للطالب |
| العجلات | `RandomStudentWheel` و`LuckyWheelGame` تستخدمان الـhook؛ عشوائية دوران الجائزة ليست اختيار الطالب |
| layers الأساسية | `SmartWhiteboard` يحوي `zIndex` وتحديداً متعددياً وأزرار أعلى/أسفل ومسحاً للمحدد |
| multi-slide persistence | توجد snapshots مرتبطة بمفتاح الشريحة في localStorage مع BroadcastChannel ومزامنة نافذة المدرس |
| shapes الأساسية | دائرة ومستطيل ومثلث وسهم موجودة في الرسم |
| pressure fallback | يتم حفظ `PointerEvent.pressure` واستخدام perfect-freehand مع simulatePressure عند غياب قلم حقيقي |
| Math tools integration | `MathToolsPanel` يرسل `bisalasa:insert-math`، والسبورة تستقبل النص وتضعه كعنصر قابل للتراجع، لكنه ليس renderer LaTeX مستقلاً |
| 36 احتفالاً وrender modes | catalog وCRUD و`confetti/particles/both` وreduced-motion منفذة |
| smart celebration والجوائز الأساسية | `computeSmartCelebration` وaward helpers وStudentActivity منفذة |
| custom gifts وcustom sounds | CRUD ورفع/تشغيل وربط صوت بالاحتفال منفذة |
| TTS الأساسي | TTS event announcer وWeb Speech/Google proxy وHowler lazy-load منفذة |

## الفجوات الحقيقية التي ستنفذ

| الأولوية | الفجوة | قرار V10 |
|---|---|---|
| حرجة | تصدير السبورة PNG/SVG | إضافة API تصدير من stroke model إلى PNG/SVG وتنزيل من UI |
| حرجة | replay للرسم | إضافة replay deterministic يحترم speed وcancel وreduced-motion |
| حرجة | equation كعنصر مستقل | إضافة عقد `equation` مع LaTeX خام ومخرج SVG آمن أو fallback نصي، مع undo/redo |
| حرجة | صفحات السبورة المستقلة | إضافة page manager فوق slide snapshots، مع حفظ الصفحة النشطة ونسخ احتياطي |
| حرجة | snap هندسي | إضافة تحليل خطوط للزوايا والتوازي والتعامد بشكل opt-in، دون تعديل الرسم الخام تلقائياً إلا بعد تأكيد |
| متوسطة | celebration sequences | catalog/CRUD وتشغيل قابل للإلغاء مع event log، دون setTimeout متسرب |
| متوسطة | gift combos | عقد combo ذري: gift + celebration + badge + points، مع منع التكرار وإعادة المحاولة الآمنة |
| متوسطة | badge levels وcustom badges | توسيع النوع backward-compatible وإضافة bronze/silver/gold وواجهة الإدارة |
| متوسطة | achievements | تعريفات إنجازات قابلة للتقييم من StudentActivity، ومنح idempotent |
| متوسطة | audio mixer وambiance وhaptics | إعدادات قنوات محلية مع master/effects/tts/ambient، تشغيل اختياري وإيقاف عند reduced-motion أو mute |
| متوسطة | difficulty scaling | اختيار صعوبة السؤال بناءً على أداء الفكرة، مع احترام سؤال الفكرة الحالي وعدم الخروج من المنهج |
| متوسطة | game analytics | تجميع نتائج الألعاب حسب النوع والفكرة والفصل والجلسة مع لوحة مدرسية |
| متقدمة | مشاركة/إعادة نتيجة اللعبة | export JSON/HTML وWeb Share fallback clipboard، بلا نشر خارجي تلقائي |
| متقدمة | spectator محلي | read-only snapshot محلي بمعرّف جلسة، دون صلاحية تفاعل أو كشف AI/notes |
| متقدمة | 3D/voice cloning/collaboration/OffscreenCanvas | بوابات feature flags وعقود آمنة؛ لا تُفعّل افتراضياً ولا تُثبت كميزة حقيقية بلا بيئة تشغيل/مزود مناسب |

## ادعاءات لا ينبغي تنفيذها كما وردت

لا يلزم استبدال كل `Math.random()`؛ عشوائية ترتيب الأسئلة والرسوم والجوائز ليست اختيار طالب. المطلوب هو منع العشوائية في هوية الطالب، وهذا محقق في الألعاب الحالية عبر `useGameStudentPicker`. بقيت دوال توافق خلفي (`useFairStudentPicker` و`data-store`) يجب منع استخدامها في مسار الألعاب النشط أو تحويلها إلى البوابة الموحدة.

لا تُضاف Three.js أو WebSocket كاعتمادات إلزامية لمجرد رفع الدرجة. المنصة محلية للمدرس، والسبورة الحالية تعمل عبر Canvas وBroadcastChannel بين نوافذ المدرس. لذلك تكون 3D والتعاون وvoice cloning اختيارات feature-gated مع fallback واضح، لا متطلبات تمنع التشغيل المحلي أو تزيد حجم التحميل الأساسي.

## ترتيب التنفيذ

1. تثبيت contracts والاختبارات للسبورة والجوائز والصوت قبل تغيير UI.
2. تنفيذ export/replay/equation/pages/snap كطبقات مستقلة وإضافتها إلى Context Menu.
3. تنفيذ sequences/combos/badges/achievements مع عمليات idempotent وتسجيل موحد في StudentActivity.
4. تنفيذ mixer/ambiance/haptic/adaptive difficulty/analytics/share.
5. إضافة spectator المحلي والعقود الاختيارية للتعاون وAI TTS و3D دون تحميلها في مسار الطالب.
6. تشغيل TypeScript وESLint وbuild وsmoke وDB/API/browser/performance، ثم اختبار regression للمسارات القديمة.

## قاعدة القبول

لا يعد أي بند منجزاً بمجرد وجود زر. يجب أن يمر عقده باختبار إيجابي وسلبي، وأن يحافظ على undo/redo أو idempotency أو privacy حسب طبيعة البند، وأن يعمل عندما تكون قاعدة البيانات أو الصوت أو BroadcastChannel غير متاحة. أي ميزة advanced لا يمكن تشغيلها محلياً بلا مزود خارجي توثق كـoptional adapter لا كتكامل حقيقي.
