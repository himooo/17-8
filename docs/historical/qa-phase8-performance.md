> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# Phase 8 performance findings

The production webpack build passed after converting PDF export and FloatingSideRail panel imports to lazy loading. The main page chunk decreased from 696,098 bytes before panel splitting to 455,008 bytes after panel splitting, a reduction of 241,090 bytes (approximately 34.6%). The largest panel-related code now lands in separate dynamic chunks, so AI, reports, Moodle, and other administrative panels are not all parsed and loaded during the initial teaching view.

The remaining lint findings are two non-blocking Next.js warnings for legacy `<img>` usage in `IframeStage.tsx` and `StudentCard.tsx`. No TypeScript errors remain.

## Data and secret inventory

The inventory against `/tmp/bisalasa-qa-moodle-clean.db` found 2 classes and 2 students, with zero students missing a class, zero blank student names, zero orphaned session/game/activity events, and zero plaintext API-key indicators in settings. The database contained 25 AI usage events and no active provider keys after the test cleanup. An earlier inventory without `DATABASE_URL` targeted the default environment database and reported missing Moodle tables; that was an environment-selection issue and was corrected by rerunning against the QA database.
