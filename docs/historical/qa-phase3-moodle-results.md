> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# QA Phase 3 — Moodle live results and homework aggregation

## Delivered

- Added `syncResults` to the Moodle pull-only route.
- Quiz attempts are normalized into `IdeaRun` and `IdeaQuestionAttempt` records with Moodle user, attempt, question, answer, correctness, points, and timestamps.
- Homework is normalized into one `HomeworkSnapshot` per Moodle homework/user pair, with total/answered/unanswered/correct/wrong counts, completion percentage, success on answered questions, success on total questions, Gradebook values, and submission status.
- Homework question results are stored individually; `bisalasa:idea:<lesson>:<idea>` tags route them to an idea, while questions without a tag route to the lesson-level bucket (`ideaKey = null`).
- Added student and class summary API operations.
- Added a MoodlePanel button for teacher-triggered result synchronization.
- Fixed summary lookup so Moodle User ID queries include live activity attempts, not only homework snapshots.

## Checks

| Check | Result |
|---|---|
| TypeScript | PASS |
| ESLint | PASS; two existing `<img>` warnings |
| Mock Quiz attempt pull | PASS; 4 question attempts |
| Mock homework pull | PASS; 50 question results |
| Submitted student | PASS; 45/50 answered, 40 correct |
| Not-submitted student | PASS; status `not_submitted` |
| Idea tag grouping | PASS; idea01 and idea02 buckets |
| Untagged question fallback | PASS; lesson-level bucket |
| Percentage calculation | PASS; 90% completion, 88.89% success among answered, 80% success on total |
| Idempotent sync | PASS; two consecutive syncs produced no duplicate attempts/snapshots |
| `moodle-homework-results-e2e.cjs` | PASS; 16 checks |
| `moodle-live-sync-e2e.cjs` | PASS; 12 checks |

## Acceptance decision

Phase 3 is accepted for progression. Moodle remains the source of student answers and grades, the shared curriculum key remains independent of class/group, and the application can distinguish not-opened/not-submitted from wrong answers. Reporting and parent delivery consume this normalized read model in the next phases.
