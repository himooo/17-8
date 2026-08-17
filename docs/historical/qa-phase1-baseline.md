> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# QA Phase 1 Baseline

## Environment

- Project: `/home/ubuntu/bisalasa-full-audit`
- Framework: Next.js / React / TypeScript / Prisma / SQLite
- Git metadata: unavailable in this source copy; baseline is tracked by filesystem and QA artifacts.
- Package scripts include production build, lint, math smoke, Prisma generation/push/migrate, and reset commands.

## Baseline checks

| Check | Result |
|---|---|
| TypeScript `pnpm exec tsc --noEmit` | PASS |
| ESLint `pnpm run lint` | PASS with 2 non-blocking warnings |
| Build before new execution | Existing project history reports PASS; a fresh build will be rerun after implementation |
| Existing QA regression artifacts | Present for students/classes/groups, relational concurrency, AI mock, integrations, scenarios, API/security/math |

## Existing lint warnings

- `src/components/shell/IframeStage.tsx:442` uses `<img>`.
- `src/components/shell/StudentCard.tsx:383` uses `<img>`.

These are performance-related warnings, not compilation failures. They are tracked for the performance phase.

## Execution note

The current source copy is not a Git checkout. Every implementation phase will therefore record modified files, tests, logs, and before/after results in QA artifacts rather than relying on Git diff output.
