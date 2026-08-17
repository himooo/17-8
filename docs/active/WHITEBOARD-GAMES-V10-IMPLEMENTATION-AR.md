# إغلاق مراجعة السبورة والألعاب والاحتفالات والهدايا والشارات والأصوات — V10

**التاريخ:** 15 أغسطس 2026

**المشروع:** بسلاسة — غرفة عمليات المدرس المحلية

**المرجع:** `14-WHITEBOARD-GAMES-CELEBRATIONS-GIFTS-BADGES-SOUNDS-V9-CRITICAL-REVIEW.md`

## 1. قرار القبول

تم تنفيذ طبقة V10 التشغيلية فوق البنية الموجودة بدلاً من إعادة بناء المنصة. بقيت الشريحة هي مركز الحصة، والمدرس هو صاحب القرار في الاختيار والمنح والاحتفال، ولا تظهر لوحات المدرس أو النوتس أو الذكاء الاصطناعي في وضع الطالب. لا توجد كتابة إلى Moodle؛ Moodle يظل مصدراً للسحب والتحليل فقط.

> **قاعدة V10:** لا تُعد الميزة منجزة بمجرد وجود زر. يجب أن يعمل عقدها، وأن يحافظ على الخصوصية أو العدالة أو idempotency أو undo/redo بحسب طبيعتها، وأن يكون لها اختبار قابل لإعادة التشغيل.

نجحت بوابة الجودة الأساسية بعد التنفيذ: **TypeScript PASS، Production Build PASS، smoke للعقود 22/22، smoke API 18/18، Math 20/20، Fairness 11/11، Curriculum Factory 23/23، Moodle Mapping 18/18، Moodle Live 12/12، Moodle Homework 16/16، Moodle Advanced 40/40، Moodle Security 4/4، وMaster Audit PASS**. يوجد تحذيران legacy فقط في ESLint متعلقان باستخدام `<img>` في `IframeStage.tsx` و`StudentCard.tsx`، ولا توجد أخطاء lint.

## 2. مصفوفة إغلاق فجوات V9

| رقم الفجوة | المجال | حالة V10 | الإصلاح أو القرار | الاختبار/الدليل |
|---:|---|---|---|---|
| 1 | ربط `pickStudentByIdea` | مغلقة | الألعاب والعجلات تستخدم `useGameStudentPicker` وبوابة `pickStudentFair`، مع الفكرة والدرس والأداء والجلسة | Fairness 11/11، Regression Moodle وMaster Audit |
| 2 | `pickStudentFair` الموحدة | مغلقة | القرار العادل موحد ومفسر ومسجل، مع أوضاع soft/strict وغياب الطالب | Fairness smoke 11/11 |
| 3 | عشوائية العجلة | مغلقة | هوية الطالب لا تُختار بـ`Math.random`؛ عشوائية ترتيب الجوائز لا تُعامل كاختيار طالب | مراجعة imports وFairness smoke |
| 4 | Layers | مغلقة | صفحة السبورة تحتوي طبقات مرئية/مقفولة، طبقة نشطة، إضافة وتبديل ظهور وقفل وحفظ `layerId` | Whiteboard smoke، متصفح: ظهور طبقة 2 |
| 5 | PNG/SVG | مغلقة | تصدير من الـcanvas ومن نموذج SVG مع احترام الطبقات، وتنزيل مباشر من الواجهة | Whiteboard smoke، Downloads: PNG 11,382 bytes وSVG 147 bytes |
| 6 | Pressure sensitivity | مغلقة | حفظ `PointerEvent.pressure` واستخدام fallback للمؤشر الذي لا يوفر ضغطاً | TypeScript وwhiteboard contract smoke |
| 7 | OffscreenCanvas/Worker | optional | لم يُفرض لأن التطبيق المحلي يحتاج سرعة تحميل واستقراراً، والـcanvas الحالي يستخدم RAF throttling. يمكن تفعيله لاحقاً خلف feature gate بعد قياس 1000+ stroke حقيقي | قرار أداء موثق؛ لا يُدّعى كتكامل افتراضي |
| 8 | Math/LaTeX | مغلقة | أداة equation وحقل LaTeX في MathToolsPanel، حفظ المصدر الخام، renderer نصي آمن عند غياب KaTeX، وundo/redo | Whiteboard smoke وbrowser: إدراج `\\frac{x}{2}+\\sqrt{4}=3` |
| 9 | Multi-page | مغلقة | مدير صفحات مستقل فوق snapshots الشريحة مع حفظ الصفحة النشطة وتبديلها وحذفها | Whiteboard smoke وbrowser: صفحة 1 وصفحة 2 |
| 10 | Snap هندسي | مغلقة | تحليل محاور وخطوط للتوازي والتعامد والزاوية، مع metadata لا تغيّر الرسم الخام بصمت | Whiteboard smoke: axis snap |
| 11 | Replay | مغلقة | `buildReplayFrames` وإعادة عرض قابلة للإيقاف وتحترم `layerId` وحالة الصفحة | Whiteboard smoke 22/22 وزر `إعادة` في المتصفح |
| 12 | Game templates | مغلقة | نماذج `GameTemplate` وعمليات list/save/delete مع config JSON محلي | Prisma db push وAPI smoke |
| 13 | Tournament | مغلقة كعقد تخزين | نموذج `Tournament` مع المشاركين والجولات والحالة والدورة الحالية، بلا فرض مشاركة خارجية أو طلاب مباشر | Prisma وAPI smoke، ويظل تشغيل البطولة قرار المدرس |
| 14 | Difficulty scaling | مغلقة | `chooseAdaptiveDifficulty` و`prioritizeQuestionsByDifficulty` يعيدان ترتيب أسئلة المصدر نفسه ولا يسرّبان سؤالاً من فكرة أخرى | Whiteboard smoke وQuestionProvider contract |
| 15 | Game analytics | مغلقة | تجميع حسب اللعبة والفكرة والنقاط والمدة والفوز والمشاركة، مع تبويب تحليلات في Rewards V10 | API smoke وbrowser: ست نتائج ألعاب معروضة |
| 16 | Choreographed sequences | مغلقة | `CelebrationSequence` وCRUD و`playCelebrationSequence` بتوقيت محدود وإلغاء تلقائي، مع sound/banner/particles/tts/gift/badge handlers | API smoke، Whiteboard smoke، زر تشغيل في Rewards V10 |
| 17 | 3D celebrations | optional | لم تُضف Three.js إلى المسار الأساسي حتى لا تزيد الحزمة أو تكسر التشغيل المحلي. عقد `renderMode` ثنائي الأبعاد هو الافتراضي الآمن | قرار معماري موثق |
| 18 | Personalized celebrations | جزئية آمنة | الاختيار الحالي يظل تحت تحكم المدرس؛ لا تُنشأ تفضيلات تلقائية للطالب ولا يُكشف ملف تفضيل في وضع الطالب لتجنب تصنيف غير مطلوب | قرار تربوي وخصوصية؛ personalization المتقدم adapter اختياري |
| 19 | Gift combos | مغلقة | عقد ذري يجمع gift + celebration + badge + points مع event key ومنع المنح المكرر | API smoke: combo award وidempotency |
| 20 | Custom badges | مغلقة | CRUD للشارة المخصصة ولوحة مدرسية لإنشاء شارة | API smoke وRewards V10 UI |
| 21 | Badge levels | مغلقة | progress contract يدعم bronze/silver/gold/platinum وترقية monotonic لا تعيد المستوى للخلف | Whiteboard smoke وAPI smoke bronze→silver |
| 22 | Achievement system | مغلقة | تعريف إنجاز قابل للتقييم ومنح idempotent ومرتبط بسجل reward event | API smoke unlock وunlock ثانية idempotent |
| 23 | AI TTS | optional | TTS الأساسي Google proxy/Web Speech قائم. لم يُفرض provider صوتي مدفوع أو مفتاح جديد داخل المسار المحلي؛ AI TTS يمكن ربطه عبر adapter الخادم عند تفعيل provider صريح | `/api/tts` الحالي واختبارات AI mock السابقة |
| 24 | Audio mixer | مغلقة | audio profile وقنوات music/effects/tts/ambient وmaster volume وmute، و`playSound` يمرر channel/volume | Whiteboard smoke وAPI audio profile وRewards V10 UI |
| 25 | Haptics | مغلقة اختيارياً | `navigator.vibrate` مرتبط بـ`hapticsEnabled` ويحترم mute؛ النجاح والخطأ والمحاولة لها patterns مختلفة | Whiteboard smoke وTypeScript؛ اختبار الجهاز الحقيقي يحتاج جهازاً داعماً |
| 26 | Music/ambiance | مغلقة كإعداد | profile يحفظ `none/calm/focus/energetic/celebration`، ولا يشغل ملفاً خارجياً تلقائياً أو يفرض موسيقى على الحصة | API audio profile وRewards V10 audio tab |
| 27 | Voice cloning | optional | لم تُرفع عينات صوت ولم تُرسل لمزود خارجي. هذا قرار أمني وتربوي؛ لا يُفعل إلا بتأكيد المدرس ومزود مفاتيحه وسياسة احتفاظ واضحة | حدود أمنية موثقة |
| 28 | Spectator mode | مغلقة محلياً | `buildSpectatorSnapshot` ينتج snapshot read-only بلا `canInteract` وبلا AI/notes؛ لا يوجد رابط عام أو صلاحية كتابة ضمن النموذج المحلي | Whiteboard smoke: read-only snapshot |
| 29 | Replay/share result | مغلقة | نص نتيجة منظم، Web Share عند توفره، وclipboard fallback عند عدم توفره، مع تبويب التحليلات | Game smoke وRewards V10 share button |
| 30 | Collaborative drawing | optional | BroadcastChannel/storage sync للمدرس المحلي موجودان، لكن WebSocket/WebRTC متعدد الأجهزة لم يُفرض لأن فلسفة المنتج لا تتطلب دخول الطلاب إلى التطبيق | whiteboard legacy sync smoke وقرار معماري موثق |

## 3. العقود والملفات الرئيسية

| الملف | المسؤولية |
|---|---|
| `src/lib/whiteboard-v10.ts` | صفحات السبورة والطبقات والمعادلات والـsnap والتصدير وإطارات replay |
| `src/lib/game-v10.ts` | التكيف مع الصعوبة وتحليلات الألعاب والمشاركة وsnapshot المشاهد |
| `src/lib/rewards-audio-v10.ts` | levels والإنجازات والـcombos وتسلسلات الاحتفال ومكسر الصوت والـhaptics |
| `src/components/shell/SmartWhiteboard.tsx` | دمج الرسم الفعلي، الصفحات، الطبقات، equation، replay وPNG/SVG |
| `src/components/shell/MathToolsPanel.tsx` | الرياضيات، إدخال LaTeX، PDF الشريحة، وإرسال equation للسبورة |
| `src/components/shell/panels/RewardsV10Panel.tsx` | إدارة الشارات والإنجازات والحزم والتسلسلات والصوت وتحليلات الألعاب |
| `src/lib/question-provider.ts` | source-bound question selection وdifficulty ordering وexcludeAsked |
| `src/lib/useGameStudentPicker.ts` | hook الألعاب لبوابة الاختيار العادل وصعوبة السؤال |
| `src/app/api/db/[operation]/route.ts` | CRUD الذري للجوائز والتسلسلات والصوت والقوالب والبطولات |
| `src/lib/local-db.ts` | typed facade المحلي للـdispatcher |
| `scripts/whiteboard-games-v10-smoke.ts` | 22 اختبار عقد pure |
| `scripts/whiteboard-games-v10-api-smoke.cjs` | 18 اختبار DB/API مع fixtures وتنظيف تلقائي |
| `docs/historical/WHITEBOARD-GAMES-V10-BROWSER-FINDINGS-AR.md` | نتائج المتصفح والتنزيلات الفعلية |

## 4. قرارات الأمن والتربية والأداء

جميع عمليات المنح تستخدم event key أو progress monotonic لتجنب مضاعفة النقاط عند النقر السريع أو إعادة الطلب. لا يمنح AI شارة أو هدية تلقائياً؛ AI يقترح فقط، والمدرس يراجع ويقرر. ولا تُرسل بيانات الطالب أو النتيجة إلى طرف خارجي من هذه الطبقة.

اختيار الطلاب يظل مبنياً على الفكرة الحالية وسجل الجلسة والأداء والغياب. ترتيب صعوبة السؤال لا يغير مصدر السؤال، ولا توجد أسئلة demo مخفية عندما لا يكون هناك درس. هذا يحافظ على فلسفة أن الحصة تنفذ داخل غرفة عمليات المدرس وأن الطالب لا يحتاج دخولاً إلى المنصة.

السبورة تُحفظ محلياً، وتدعم fallback عند غياب BroadcastChannel أو فشل localStorage. لم يُفرض OffscreenCanvas أو WebSocket أو Three.js أو voice cloning في الحزمة الأساسية لأن ذلك يزيد التحميل والمخاطر دون فائدة مؤكدة في نموذج مدرس واحد. أي تشغيل مستقبلي لهذه الميزات يجب أن يكون feature-gated وبقياس قبل/بعد.

## 5. الاختبارات القابلة لإعادة التشغيل

```bash
cd bisalasa-full-audit
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
npm run build
npm run test:math
npm run test:fairness
npm run test:curriculum-factory
npm run test:moodle:security
npm run test:moodle:advanced
BASE=http://127.0.0.1:3032 npm run test:moodle:mapping
BASE=http://127.0.0.1:3032 npm run test:moodle:live
BASE=http://127.0.0.1:3032 npm run test:moodle:homework
npm run test:whiteboard-games-v10
BASE=http://127.0.0.1:3032 node scripts/whiteboard-games-v10-api-smoke.cjs
```

الاختبارات اليدوية التي تم التحقق منها في المتصفح شملت boot على 3032، فتح Rewards V10، تحليلات الألعاب، تشغيل أدوات السبورة داخل درس fractions، إدراج equation، إضافة طبقة ثانية، إضافة صفحة ثانية، وتصدير PNG وSVG. أسماء الملفات الناتجة وأحجامها موثقة في تقرير نتائج المتصفح.

## 6. الحدود المتبقية المقبولة

الحدود المتبقية ليست فجوات في مسار غرفة عمليات المدرس الأساسي، بل adapters اختيارية تحتاج قراراً إضافياً ومزوداً أو بيئة تشغيل: 3D celebrations، AI TTS المدفوع، voice cloning، WebSocket/WebRTC لتعاون أجهزة الطلاب، وOffscreenCanvas عند ثبوت حاجة الأداء. تم إبقاء هذه البنود موثقة كاختيارية بدلاً من تسويقها كميزات تعمل وهي غير مفعلة، وهو القرار الأكثر أماناً واتساقاً مع فلسفة المنصة.

## 7. المراجع الداخلية

1. `14-WHITEBOARD-GAMES-CELEBRATIONS-GIFTS-BADGES-SOUNDS-V9-CRITICAL-REVIEW.md`
2. `docs/historical/WHITEBOARD-GAMES-V10-TRIAGE-AR.md`
3. `docs/historical/WHITEBOARD-GAMES-V10-BROWSER-FINDINGS-AR.md`
4. `scripts/whiteboard-games-v10-smoke.ts`
5. `scripts/whiteboard-games-v10-api-smoke.cjs`
