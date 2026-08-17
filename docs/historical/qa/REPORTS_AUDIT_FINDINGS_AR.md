> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# نتائج فحص التقارير — الجولة الجديدة

## baseline

TypeScript وESLint وTelegram PDF smoke نجحت على النسخة الحالية؛ ESLint لديه تحذيران قديمان فقط عن `<img>` في `IframeStage.tsx` و`StudentCard.tsx`.

## نقاط عدم الاتساق المكتشفة

1. `/grades` يجمع درجات الطالب الأساسية من Student، ونقاط بعض StudentActivity، لكنه لا يضم GameResultParticipant/GameResultQuestion كمسار مستقل؛ لذلك قد تختلف نتيجة لعبة محفوظة في GameResult عن نقاط المجاميع الظاهرة.
2. `/grades` يحسب `groupPoints` من StudentActivity بنوعي `game` و`points`، ولا يثبت علاقة كل نقطة بـstudent/session/idea في التقرير المعروض.
3. `StudentReportPanel` يعرض Moodle وLive App، لكنه يعتمد في «آخر الأنشطة» على badges فقط، ولا يعرض GameResult التفصيلي أو StudentActivity الكامل أو تفاعلات المعلم كخط زمني.
4. `StudentShareCard` يجمع StudentActivity والاحتفالات والملاحظات فقط، ولا يعرض Moodle أو Live App أو الألعاب، ولذلك ليس موحداً مع التقرير الفردي وTelegram.
5. `buildMoodlePayload` في Telegram يجمع الواجب وIdeaQuestionAttempt وتفاعلات المعلم، بينما `buildLiveAppPayload` يجمع أحداثاً ذات description يبدأ بـ`live-sync:`؛ GameResult والألعاب والاحتفالات والملاحظات لا تدخل تقرير ولي الأمر الحالي.
6. `moodleResults.classSummary` يرجع snapshots وbyStudent وbyIdea للواجب فقط؛ لا توجد aggregate موحدة للصف تجمع interactive/live/game/homework في عقد واحد.
7. دورة التقرير الحالية تعالج البيانات على أكثر من مسار مستقل، ولا تعرض دائماً مصدر الدرجة، زمن المزامنة، أو حالة stale/error بجوار الرقم.

## اتجاه الإصلاح

إنشاء read-model موحد للتقرير يضم: student identity، session، Moodle homework، interactive idea attempts، game results، StudentActivity، celebrations، teacher interactions، وquality flags. يجب أن يكون التقرير الفردي، تقرير الصف، StudentShareCard، وTelegram مبنيين على نفس العقد، مع عدم تغيير Moodle خارجياً.

## فحص المتصفح الأولي

تم فتح `http://127.0.0.1:3012/` وظهرت أزرار التقارير والدرجات وكارت الطالب. النقر الفهرسي على «التقارير» داخل Browser harness لم يغير الحالة، وهو نفس القيد الموثق سابقاً؛ لذلك سيتم فحص صفحة `/grades` مباشرة ومراقبة HTML/PDF وواجهات API، مع اعتبار تفاعل React الحقيقي يحتاج Browser automation خارج هذا harness.

## الفحص البصري النهائي — build 3018

صفحة `/grades` عادت بحالة 200 بعد seed التقرير الموحد. المعاينة أظهرت عنوان الصف والجلسة، إحصاءات منفصلة للنقاط المحلية والألعاب وسجل الأنشطة وصحيح التفاعل ودرجات Moodle، ثم جدولاً موحداً بأعمدة: نقاط الجلسة، التفاعل، Moodle، الألعاب، كسب الأنشطة، النقاط التراكمية، الشارات والهدايا. النص العربي مقروء والتخطيط منظم على عرض المكتب؛ الجدول كثيف بطبيعته ويستخدم overflow-x على الشاشات الأضيق.

## تدقيق اتجاه PDF العربي

المعاينة الأولى لـPDF الموسع بدت معكوسة عند قراءة طبقة OCR/النص المستخرج، لذلك أُنشئ مختبر مقارنة بخمس طرق. الفحص المرئي أثبت أن variant `ArabicReshaper + bidi-js getReorderedString` الحالي يعرض النص العربي متصلاً وبترتيب بصري صحيح، بينما raw يقطع الحروف وbidi-only يضعف التشكيل. تم الإبقاء على المسار الحالي، واعتبار مخرجات `pdftotext` ترتيباً منطقياً/بصرياً لا حكماً على العرض.

## Browser QA النهائي بعد آخر build

تم فتح `http://127.0.0.1:3018/grades?classId=report_class_mst5ch18` بعد build الأخير. العنوان يذكر الصف الصحيح، وعدد الطلاب أصبح 2 فقط، وظهرت الأعمدة الجديدة بقيم واقعية: Moodle `8/10 • 75%`، التفاعل `1/2 • 50%`، الألعاب `7 • 1`، وكسب الأنشطة `5`. المعاينة المرئية مستقرة والعربية مقروءة، ولا توجد بيانات من الصف الآخر في الفلتر.
