> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# سجل فحص QA الشامل — الجولة الجديدة

## نطاق الجولة

هذه الجولة تتبع الملف المرفق `pasted_content_7.txt` وتغطي static analysis، build/runtime، الوظائف، API، قاعدة البيانات، UI/UX، RTL، الأمن، الأداء، التزامن، error handling، edge cases، regression، والاختبارات الآلية. لن يتم اعتبار أي ميزة ناجحة اعتماداً على فتح الصفحة فقط؛ كل نتيجة ستُربط باختبار أو دليل متصفح أو ستُسجل كقيد.

## خريطة التشغيل الحالية

| الطبقة | المسار/العقد |
|---|---|
| Frontend | Next.js App Router، `src/app/page-client.tsx`، Zustand، Tailwind، panels داخل `src/components/shell` |
| Backend | Next route handlers، وبالأخص `/api/db/[operation]` وroutes التكاملات |
| Database | Prisma 6 + SQLite، schema في `prisma/schema.prisma`، singleton في `src/lib/db.ts` |
| State hydration | SQLite مصدر الحقيقة، Zustand/localStorage cache، hydration في `page-client.tsx` |
| Student view | `?view=student` أو `studentBroadcast`، لا يفتح لوحة المدرس |
| Moodle | Pull-only routes ومزامنة نتائج ومappings |
| Live App | `/api/live-sync` + polling bridge |
| Telegram | route الإعداد/webhook/report/PDF، مع mock integrations للاختبار |
| AI | `/api/ai`، مفاتيح مدورة وموديلات providers، Copilot يحتاج موافقة المدرس |
| Build | `pnpm build` ينشئ standalone، و`pnpm exec next build --webpack` يستخدم في QA النظيف |
| Tests | لا يوجد `pnpm test` موحد؛ التغطية موزعة بين `scripts/*.cjs` و`*.ts` وsmokes وE2E |

## مخاطر الفحص ذات الأولوية

1. دورة session prompt وbeforeunload وreload لأن أي خطأ قد ينهي جلسة المدرس أو يفقد snapshot.
2. API dispatcher الكبير وغياب auth تقليدي لأن حماية العمليات يجب أن تكون متسقة مع فلسفة التطبيق المحلية.
3. مزامنة SQLite/Zustand وBroadcastChannel وLive App عند التكرار أو الأحداث القديمة.
4. تقارير Moodle والتفاعل والألعاب عند وجود بيانات ناقصة أو غير موسومة بفكرة.
5. الألعاب والسبورة واللوحات التي تعتمد على handlers، مع قيد Browser harness الداخلي الذي قد لا يطلق React events.
6. AI وTelegram وMoodle كتكاملات خارجية: timeouts، secrets، redaction، fallback، وعدم الكتابة إلى Moodle.
7. أداء `reports.class` وقوائم الطلاب والـpolling عند تكبير عدد الطلاب والتبويبات.

## قاعدة القرار

أي مشكلة تُكتشف ستسجل بدرجة P0–P3 مع السبب الجذري والأثر والإصلاح واختبار الإثبات. لن يتم تعطيل validation أو security لتمرير اختبار، ولن تُحذف اختبارات فاشلة دون تشخيص.

## Browser QA — وضعا المدرس والطالب

تم فتح `/` و`/?view=student` على build QA. وضع المدرس يعرض الشريط الجانبي وأزرار المنهج والتحليل ومحرر الدرس وAI والتقارير والطلاب والألعاب والسبورة وبدائل العرض، مع RTL واضح وحالة فارغة مفهومة عند عدم تحميل درس. وضع الطالب لم يعرض أي عنصر تفاعلي أو شريط مدرس؛ ظهر المشهد فقط مع رسالة حالة فارغة عند عدم وجود درس. لا توجد أدوات AI أو تقارير أو إعدادات ظاهرة في وضع الطالب.

## Browser QA — صفحة الدرجات بعد آخر build

تم فتح `/grades` بعد إصلاح validation. الصفحة أعادت HTTP 200 وعرضت تقرير كل الفصول بثلاثة طلاب، مع مؤشرات منفصلة للنقاط المحلية، الصحيح والخطأ، التفاعل، Moodle، الألعاب، وسجل الأنشطة. ظهرت بيانات Moodle `8/10 • 75%` و`1/2 • 50%`، والتفاعل `1/2 • 50%` و`1/1 • 100%`، مع RTL مقروء وبطاقات ملخص وجدول قابل للطباعة. لا يظهر stack trace أو حالة فارغة مضللة.

## DOM/accessibility smoke

في صفحة `/grades` على المتصفح: `dir=rtl` و`lang=ar`، لا يوجد overflow أفقي غير مقصود (`bodyScrollWidth == bodyClientWidth` و`overflowElements=0`)، والزر الظاهر يحمل نصاً/اسماً قابلاً للوصول. هذا smoke لا يغني عن Playwright/axe الكامل؛ بيئة harness الحالية لا توفر اختبار keyboard automation كاملاً.
