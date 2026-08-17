> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# مصفوفة النواقص الفعلية — الجولة الجديدة

| البند | الحالة الحالية | الفجوة الفعلية | القرار |
|---|---|---|---|
| LessonEditorPanel | موجود كلوحة أولية | يحرر العنوان وخطوة واحدة وnotes، لكنه لا يملك تبويباً منظماً للأفكار، إدارة الخطوات، أسئلة الخطوة، أصول الدرس، undo/redo، أو إعادة تهيئة draft عند تغيير الدرس | إعادة بناء محرر فعلي قابل للتحرير مع حفظ ذري وتراجع وإعادة تحميل |
| تعديل الدرس | حفظ manifestJson موجود | التعديل ليس كاملاً ولا توجد حماية من تبديل الدرس أثناء draft أو validation قوي | ربط محرر الدرس بعقد manifest والتحقق قبل الحفظ |
| تزامن السبورة | حفظ per-slide في localStorage وevent لإدخال AI | لا يوجد BroadcastChannel/نسخة حالة مشتركة بين نوافذ المدرس أو OBS، ولا version/revision conflict handling | إضافة sync channel محلي آمن مع revision وdebounce وfallback |
| Smart Context | context محدود في AiPanel وstep-only في Teleprompter | لا يوجد aggregator موحد يجمع الدرس، الأهداف، الخطوات السابقة، الفكرة، stats مجهولة، Moodle/الواجب، والتدخلات مع حد حجم وprivacy | إنشاء buildSmartContext واستخدامه في كل عمليات AI |
| AI Copilot | أربعة أزرار موجودة في التليبرومبتر | البطاقات ليست مبنية على Smart Context الموحد ولا تعرض confidence/source أو سجل draft/approval منظم | توحيد Copilot الأربع مع context وreview state ورفض/اعتماد |
| Live App inbound | يوجد Custom App pull فقط | لا يوجد `/api/live-sync` يستقبل إجابة الطالب، deduplication، تحديث roster/activity والـheatmap | إضافة pull/push bridge محلي آمن، دون دخول الطالب إلى بسالسة |
| Heatmap/understanding | يوجد live status في store | لا يوجد مؤشر فهم واضح مع threshold وtoast قابل للإغلاق مبني على إجابات الفكرة الحالية | إضافة حساب heatmap ومؤشر TopStatusBar غير متطفل |
| ميزات مستقبلية عالية المخاطر | لا توجد SpeechRecognition/Mastery/Recovery/App-live questions | هذه ليست شرطاً للإصدار الأساسي، لكنها مذكورة في البرومبت كمسارات مستقبلية | توثيقها كـPhase لاحقة وعدم تفعيلها تلقائياً أثناء تنفيذ الإصدار الحالي |

## النتيجة

النواقص الأساسية القابلة للإغلاق الآن هي سبعة مسارات: محرر الدرس الكامل، تزامن السبورة، Smart Context، AI Copilot المنظم، Live App inbound، Heatmap alerts، وربطها بالتقارير والتدقيق. أما Silent Listener وPredictive Mastery وSmart Recovery وApp-live questions فهي توسعات منفصلة تحتاج عقود خصوصية وتجارب تشغيلية ولا ينبغي إدخالها تلقائياً في غرفة عمليات المدرس قبل اعتمادها.
