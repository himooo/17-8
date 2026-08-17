> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# مصفوفة الخصائص والمخاطر — تدقيق «بسلاسة» العميق

| المنطقة | نقطة الدخول | المتطلبات | المخاطر الحرجة | الاختبار الحاسم |
|---|---|---|---|---|
| الدرس والـ iframe | `IframeStage`, `slide-schema`, `public/slides/*` | Manifest، READY، STEP_CHANGED، RTL، خطوة حالية | خطوة/فكرة خاطئة، stale manifest، سؤال غير متزامن | تحميل كل أنماط manifest والتنقل forward/back/GOTO |
| مزود الأسئلة | `question-provider.ts` | أسئلة current/all/previous/manual من الدرس الحالي | fallback غير منهجي، تكرار، source ضائع، pool فارغ | trace لكل سؤال إلى lesson/idea/step و10k حالات pool |
| تحدي الأسئلة | `QuestionChallengeGame` | فردي/مبارزة/مجموعات، مناهج، timeout | تسجيل نقاط مزدوج، participants غير صالحة، لا سؤال | start/answer/skip/timeout/restart/close |
| مسابقة الأسئلة | `QuizShowGame` | 2–4 مشاركين، rounds، reveal، winner | انتقال round قبل حفظ النتيجة، winner stale | كل permutations للعدد والنتيجة والتعادل |
| Quick Fire | `QuickFireGame` | أسئلة، timer، streak، result | timeout race، question index، إعادة التشغيل | timer boundary 0/1/10، rapid click، restart |
| Math Challenge | `MathChallengeGame` | وضع curriculum أو مولد حسابي معلن | مخالفة فلسفة المنهج، parsing، timeout | curriculum mode trace، الإجابات الفارغة والخاطئة |
| Memory | `MemoryGame` | بطاقات، اختيار طالب، match/mismatch | timer cleanup، double flip، scoring | rapid flip، match، mismatch، close/reopen |
| Mystery Box | `MysteryBoxGame` | اختيار مشارك، صناديق، reward | reward عشوائي غير منضبط، timeout cleanup | كل صناديق الجوائز، cancel، restart |
| Hot Potato | `HotPotatoGame` | مشاركون، مؤقت، explode/stop | explosion race، الطالب الحالي، cleanup | start/pause/expire/stop/unmount |
| Dice Roll | `DiceRollGame` | طالب/مجموعة/قيمة نرد | غائب يدخل، random UI، حفظ نتيجة | no students/absent/multiple rolls |
| Reaction Time | `ReactionTimeGame` | طالب، round، timing | click before green، timing race | early/valid/late click، restart |
| عجلة الطالب | `RandomStudentWheel` | طلاب نشطون، عدالة، غياب | اختيار غائب، تكرار غير عادل، close | 1000 draws deterministic distribution |
| الحضور | `ClassesPanel`, `shell-store` | toggle غياب، persistence | state محلي فقط، اختيار غائب | toggle/reload/session/game |
| الجلسة | `shell-store`, `page.tsx` | start/end/resume/reload | إنهاء عند F5، snapshot ناقص | stop/start/read، confirm resume |
| التقييم | `BottomControlBar`, `game-utils` | correct/wrong/goodTry/reward | double points، wrong increments | repeated clicks and audit delta |
| الاحتفالات | `CelebrationsOverlay`, `CelebrationsPanel` | sound/effect/reduced-motion | double sound، stale banner | trigger/close/reduced-motion |
| السبورة | `SmartWhiteboard`, `WhiteboardContextMenu` | draw/erase/clear/background | coordinate loss، clear race، resize | pointer sequences/resize/clear |
| التليبرومبتر | `DraggableTeleprompter` | script/notes/resize/position | state reset، overflow | drag/resize/reload/portrait |
| اللوحات | `FloatingSideRail`, panels | open/close/empty/error | dead ends، stale data، Escape | every trigger and escape closure |
| الهدايا والجوائز | `data-store`, reward handlers | assign/display/persist | duplicate activity/points | award/reload/report |
| التقارير | `StudentReportPanel`, `/grades` | session/lifetime/current | wrong class/session, stale values | query permutations and print route |
| AI | `/api/ai`, `AiPanel` | optional, encrypted, rotation | key leak, unwanted context, rate limit | no key, CRUD, rotation, generate guard |
| accessibility | `globals.css`, all buttons | focus, keyboard, reduced motion | hidden focus, click-only controls | keyboard matrix + CSS preference |
| persistence | API/Prisma/SQLite | build/restart continuity | wrong DB path, orphan records | clean build → stop → start → read |

## أولويات الإصلاح

**P0:** مصدر الأسئلة، دورة الجولة، منع النقاط المزدوجة، timeout races، cleanup، ومسار الجلسة الحية.  
**P1:** إغلاق الألعاب واللوحات، الحضور والطلاب، التقارير، السبورة، وkeyboard/focus.  
**P2:** تحسينات تخصيص وإرشاد مدرس وإحصاءات ومساعدات لا تغير سلوك المنصة الأساسي.
