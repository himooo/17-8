#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
out="master-plan-audit.txt"
{
  echo "Bisalasa Master Plan V5 Audit"
  date -u
  echo
  check() { local label="$1"; local pattern="$2"; local scope="$3"; if grep -RIn --exclude-dir=node_modules --exclude-dir=.next -E "$pattern" $scope >/dev/null 2>&1; then printf 'PASS | %s\n' "$label"; else printf 'GAP  | %s\n' "$label"; fi; }
  echo "[1] Canvas and teacher decision boundary"
  check "whiteboard enabled sync" 'whiteboardEnabled.*true|setWhiteboardEnabled' 'src/lib/shell-store.ts src/components/shell/SmartWhiteboard.tsx'
  check "pointer events pen" 'pointerEvents.*auto|tool.*pen' 'src/components/shell/SmartWhiteboard.tsx'
  check "perfect freehand tuning" 'thinning.*0\.5|smoothing.*0\.65|streamline.*0\.75|simulatePressure.*false' 'src/components/shell/SmartWhiteboard.tsx'
  check "event timestamp" 'timeStamp' 'src/components/shell/SmartWhiteboard.tsx'
  check "student broadcast SSR" 'view.*student|data-student-broadcast|studentView' 'src/app/page.tsx src/app/page-client.tsx src/components/shell/IframeStage.tsx'
  echo
  echo "[2] Lesson editor and AI teacher tools"
  check "lesson editor panel" 'LessonEditorPanel' 'src/components/shell'
  check "manifestJson persistence" 'manifestJson.*JSON.stringify|lessons.upsert' 'src/components/shell/LessonEditorPanel.tsx src/lib/db-sync.ts'
  check "lesson context" 'lessonContext' 'src/components/shell/LessonEditorPanel.tsx src/app/api/db/[operation]/route.ts'
  check "four teleprompter AI actions" 'أسئلة محتملة|اشرح أكثر|أعطِ مثال|بسّط للطالب' 'src/components/shell/DraggableTeleprompter.tsx'
  check "manual approval generated questions" 'approveGeneratedQuestions|مراجعة' 'src/components/shell/panels/AiPanel.tsx'
  check "model discovery" 'model-discovery|listModels|previewModels' 'src/app/api/ai src/lib/local-db.ts src/components/shell/panels/AiPanel.tsx'
  check "smart context privacy sanitizer" 'buildSmartContext|sanitize|studentDataAllowed' 'src/lib/smart-context.ts src/components/shell/DraggableTeleprompter.tsx src/components/shell/panels/AiPanel.tsx'
  check "copilot teacher approval gate" 'review.*pending|approveAiDraft|requestConfirm|لا تُرسل' 'src/components/shell/DraggableTeleprompter.tsx src/components/shell/panels/AiPanel.tsx'
  echo
  echo "[3] Justice and unified progress"
  check "whole session rotation" 'pickStudentManual|lastCalled' 'src/lib/game-utils.ts src/lib/shell-store.ts'
  check "per idea justice" 'pickStudentByIdea|ideaSelectionCounts|selectionCounts' 'src/lib/game-utils.ts src/lib/shell-store.ts'
  check "intervention activity log" 'StudentActivity|studentActivities|fairness-resolved' 'src/lib/shell-store.ts src/app/api/db/[operation]/route.ts'
  check "app/moodle/game report fields" 'ideasCovered|studentReports|moodle|game' 'src/lib src/components/shell/panels/ReportsPanel.tsx prisma/schema.prisma'
  echo
  echo "[4] Moodle and Custom App sync"
  check "moodle course/group" 'moodleCourseId|groupId|courseId' 'src/app/api/moodle src/components/shell prisma/schema.prisma'
  check "five second polling" '5000|5_000|POLL_MS|setTimeout' 'src/components/shell/MoodleLiveSync.tsx'
  check "live status and understanding" 'StudentLiveStatus|understanding|heatmap|الفهم' 'src/lib/shell-store.ts src/components/shell src/app/api/moodle'
  check "custom app hook" 'customHook|customApp|endpointPath|customRequest|api/custom-sync' 'src/app/api src/components/shell prisma/schema.prisma'
  check "fallback on external failure" 'fallback|local|Moodle.*fail|catch' 'src/components/shell/MoodleLiveSync.tsx src/app/api/moodle/route.ts'
  check "live app inbound endpoint" 'live-sync|dedup|since' 'src/app/api/live-sync/route.ts scripts/live-sync-smoke.cjs'
  check "live app polling bridge" 'LiveSyncBridge|liveSyncEnabled|liveSyncPollMs' 'src/components/shell/LiveSyncBridge.tsx src/components/shell/panels/CustomAppPanel.tsx src/lib/slide-schema.ts'
  check "telegram live app report" 'buildLiveAppPayload|liveAppIncluded|Live App' 'src/app/api/telegram/route.ts src/lib/telegram-report-pdf.ts scripts/integrations-demo-e2e.cjs'
  check "unified report contract" 'StudentReportAggregate|ClassReportAggregate|ReportIdeaMetric' 'src/lib/report-contract.ts src/lib/report-aggregator.ts'
  check "unified report API" 'reports.student|reports.class|buildClassReport' 'src/app/api/db/[operation]/route.ts src/lib/local-db.ts src/lib/report-aggregator.ts'
  check "grades source columns" 'interactiveAnswered|homeworkGrade|gamePoints|نقاط الألعاب' 'src/app/grades/route.ts'
  check "share card unified sources" 'localDb.reports.student|Moodle|الألعاب' 'src/components/shell/StudentShareCard.tsx src/components/shell/StudentReportPanel.tsx'
  echo
  echo "[5] Self tests and mocks"
  check "mock API routes" '/api/mock|mock.*Moodle|mock.*App' 'src/app/api scripts'
  check "mock AI" 'mock.*AI|mock.*Gemini|mock.*OpenAI' 'src/app/api scripts'
  check "question provider tests" 'question-provider|question.*test' 'scripts tests src'
  check "game utils tests" 'game-utils|fairness' 'scripts tests src'
  check "crypto tests" 'moodle-crypto|telegram-crypto' 'scripts tests src'
  check "browser/E2E tests" 'playwright|puppeteer|browser|E2E|student.*view' 'scripts tests'
  check "whiteboard channel revision fallback" 'BroadcastChannel|revision|StorageEvent|echo' 'src/components/shell/SmartWhiteboard.tsx scripts/whiteboard-sync-smoke.cjs'
  check "arabic pdf bidi and full font" 'bidi-js|ArabicReshaper|subset.*false|Amiri' 'src/lib/telegram-report-pdf.ts scripts'
  check "expanded report pdf smoke" 'includesGamesSection|includesQualitySection|pages' 'scripts/telegram-report-smoke.ts'
  check "unified report smoke" 'reports-unified-smoke|reports.student|reports.class' 'scripts/reports-unified-smoke.cjs'
  check "large class report smoke" 'reports-large-class-smoke|students: 100|reportMs' 'scripts/reports-large-class-smoke.cjs'
  check "live sync concurrency smoke" 'live-sync-concurrency-smoke|withEventLock|LiveSyncClaim' 'scripts/live-sync-concurrency-smoke.cjs src/app/api/live-sync/route.ts prisma/schema.prisma'
  check "security headers" 'X-Content-Type-Options|Referrer-Policy|Permissions-Policy|X-Frame-Options' 'next.config.ts'
  echo
  echo "[6] Performance and data layer"
  check "dynamic game/panel imports" 'dynamic\(|lazy\(|import\(' 'src/components src/app'
  check "offscreen canvas" 'OffscreenCanvas' 'src'
  check "pointer move refs" 'useRef|pointermove' 'src/components/shell/SmartWhiteboard.tsx'
  check "database indexes" '@@index|@@unique' 'prisma/schema.prisma'
  check "student list memoization" 'useMemo|useCallback' 'src/components/shell/panels/StudentsPanel.tsx src/components/shell/StudentCard.tsx'
  check "virtualized large lists" 'react-window|virtual|overscan' 'src/components'
  echo
  echo "[7] APIs and security"
  check "provider rotation" 'getCandidates|acquireKey|releaseKey|cooldown' 'src/app/api/ai/route.ts'
  check "separate Moodle crypto" 'encryptMoodleToken|decryptMoodleToken' 'src/lib/moodle-crypto.ts src/app/api/moodle/route.ts'
  check "separate Telegram crypto" 'encryptTelegramToken|decryptTelegramToken' 'src/lib/telegram-crypto.ts src/app/api/telegram/route.ts'
  check "custom chat url" 'chatUrl|modelsUrl|baseUrl' 'src/app/api/ai prisma/schema.prisma'
  check "webhook secret validation" 'x-telegram-bot-api-secret-token|webhookSecret' 'src/app/api/telegram/route.ts'
  echo
  echo "[8] Files and scripts"
  printf 'LESSON_EDITOR=%s\n' "$(test -f src/components/shell/LessonEditorPanel.tsx && echo yes || echo no)"
  printf 'SSR_CLIENT_SPLIT=%s\n' "$(test -f src/app/page-client.tsx && echo yes || echo no)"
  printf 'MOCK_SCRIPTS=%s\n' "$(find scripts -maxdepth 1 -type f -iname '*mock*' | wc -l)"
  printf 'TEST_SCRIPTS=%s\n' "$(find scripts -maxdepth 1 -type f | wc -l)"
} > "$out"
cat "$out"
