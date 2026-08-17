> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# QA Phase 2 — Moodle multi-class mapping

## Delivered

- Added Prisma read-model tables for shared curricula, lessons, ideas, Moodle courses/groups/students/activities/questions/homework, sync cursors, idea runs, attempts, homework snapshots, interventions, and AI reviews.
- Added safe API operations under `/api/db/moodleMappings.*` with input validation and upsert semantics.
- Added `curriculumKey` to encrypted Moodle configuration as the shared-content identity.
- Added Moodle `discover` action with best-effort reads for courses, groups, enrolled users, quizzes, and assignments.
- Added automatic tag parsing for `bisalasa:idea:<lesson>:<idea>` and `bisalasa:homework:<lesson>`.
- Added MoodlePanel controls for shared curriculum key, discovery, automatic student matching, group-to-class mapping, and mapping counts.
- Added local-db facade for typed mapping operations.
- Extended Mock Moodle responses with two groups, three students, interactive quiz, and lesson homework.

## Checks

| Check | Result |
|---|---|
| Prisma format/generate | PASS |
| Prisma QA `db push` | PASS |
| TypeScript after schema/API/UI changes | PASS |
| ESLint | PASS; two pre-existing `<img>` warnings remain |
| Production build | PASS |
| QA server health on 3012 | PASS / HTTP 200 |
| Moodle Mock discovery | PASS; course 77, two groups, three users, two quizzes, one assignment |
| Mapping E2E | PASS; 18 checks |
| Shared course isolation | PASS; two groups mapped independently |
| Student isolation | PASS; Moodle user 101 → class-4a, user 102 → class-4b |
| Untagged fallback | PASS by nullable `ideaKey` / lesson-level mapping |
| Browser UI attempt | Blocked in this iteration because the browser runtime reported unavailable; API and E2E coverage completed instead |

## Acceptance decision

Phase 2 mapping contract is accepted for progression: Moodle is still pull-only, the content key is shared across classes, and results retain group/student context. Detailed attempt and homework question synchronization continues in Phase 3.
