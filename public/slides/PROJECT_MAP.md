# PROJECT_MAP.md — Bisalasa Technical Map

> **Purpose:** Reverse-engineered technical map for AI coding agents. Source code is the source of truth. Documentation is secondary. Every fact below is traceable to a file:line reference.
>
> **Project root:** `/home/z/my-project/app/bisalasa-full-audit`
> **Map generated:** 2026-08-16
> **Source files:** 181 `.ts/.tsx` files, ~46,576 lines
> **Schema models:** 73 Prisma models
> **API routes:** 23 route files

---

## 1. Project Identity

| Field | Value | Source |
|---|---|---|
| Name | بسلاسة (Bisalasa) | `src/app/layout.tsx:18` |
| package.json name | `nextjs_tailwind_shadcn_ts` | `package.json:2` |
| Version | 0.2.1 | `package.json:3` |
| Type | LAN-hosted single-teacher classroom operations shell | `BISALASA-COMPLETE-DOCUMENTATION-AR.md:11` |
| Core purpose | Teacher's local command center during class — slide display, whiteboard, students, games, rewards, reports. Moodle is pull-only. Students do NOT log in. | `BISALASA-COMPLETE-DOCUMENTATION-AR.md:11-13` |
| Users/Roles | Single teacher (operator). Students are data subjects, not authenticated users. Parents receive Telegram reports but don't use the UI. | `src/lib/auth.ts:14-16` |
| Key features | Slide iframe stage, smart whiteboard, 10 games, fair student picker, points/badges/gifts/titles, celebrations, AI assistant, Moodle integration, Telegram reports, curriculum factory | `src/components/shell/` + `src/lib/` |

---

## 2. Tech Stack

| Layer | Technology | Version | Source |
|---|---|---|---|
| Framework | Next.js (App Router) | ^16.1.1 | `package.json:86` |
| UI | React | ^19.0.0 | `package.json:93` |
| Language | TypeScript | ^5 (via `typescript@5.9.3`) | `package.json:120` |
| Styling | Tailwind CSS 4 + tailwindcss-animate | ^4 / ^1.0.7 | `package.json:118,119` |
| UI Primitives | shadcn/ui (Radix-based) | 36 components in `src/components/ui/` | `src/components/ui/` |
| State | Zustand (with persist middleware) | ^5.0.6 | `package.json:108` |
| Server State | @tanstack/react-query | ^5.82.0 | `package.json:66` — **UNKNOWN: actual usage extent not verified** |
| Database | SQLite | via Prisma | `prisma/schema.prisma:10-12` |
| ORM | Prisma | ^6.11.1 | `package.json:37,92` |
| Auth | Custom LAN token (httpOnly cookie) — NOT next-auth | — | `src/lib/auth.ts`, `src/middleware.ts` |
| Validation | Zod | ^4.0.2 | `package.json:107` — **UNKNOWN: actual usage extent not verified** |
| API strategy | Next.js Route Handlers (App Router) + single DB dispatcher `/api/db/[operation]` | — | `src/app/api/db/[operation]/route.ts` |
| Whiteboard | perfect-freehand + html2canvas | ^1.2.3 / ^1.4.1 | `package.json:91,82` |
| PDF | jspdf + pdf-lib + @pdf-lib/fontkit | ^4.2.1 / ^1.17.1 / ^1.1.1 | `package.json:84,90,36` |
| Arabic PDF | arabic-reshaper + bidi-js | ^1.1.0 / ^1.0.3 | `package.json:72,73` |
| Audio | howler | ^2.2.4 | `package.json:81` |
| Animations | framer-motion + canvas-confetti + @tsparticles | ^12.23.2 / ^1.9.4 / ^4.3.2 | `package.json:80,74,68,69` |
| AI SDK | z-ai-web-dev-sdk | ^0.0.18 | `package.json:106` |
| Markdown | react-markdown | ^10.1.0 | `package.json:97` |
| Build | Next.js webpack (standalone output) | — | `next.config.ts:4`, `package.json:7` |
| Testing | Custom smoke scripts (no Jest/Vitest) | 16 `test:*` scripts | `package.json:10-25` |
| Linting | ESLint + eslint-config-next | ^9 / ^16.3.0 | `package.json:115,116` |

---

## 3. Project Structure

```
bisalasa-full-audit/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (Cairo font, Toaster)
│   │   ├── page.tsx                  # Entry → renders page-client
│   │   ├── page-client.tsx           # Main teacher shell (client component)
│   │   ├── curriculum-factory/       # /curriculum-factory page (AI lesson builder)
│   │   │   ├── page.tsx
│   │   │   └── error.tsx
│   │   ├── grades/route.ts           # /grades — printable HTML report (GET only)
│   │   └── api/                      # 23 API route files (see §6)
│   │       ├── db/[operation]/route.ts   # CENTRAL DB dispatcher (~2200 lines)
│   │       ├── ai/                   # AI provider integration (6 routes)
│   │       ├── auth/whoami/route.ts  # Token issuance
│   │       ├── backup/route.ts       # JSON backup/restore
│   │       ├── telegram/route.ts     # Telegram bot integration
│   │       ├── moodle/               # Moodle integration (3 routes)
│   │       ├── webhooks/route.ts     # External webhook delivery
│   │       ├── live-sync/route.ts    # Custom App inbound events
│   │       ├── curriculum-factory/   # OCR + assets
│   │       ├── health/route.ts       # Health check (public)
│   │       ├── tts/route.ts          # Text-to-speech proxy
│   │       └── lessons/search/route.ts
│   ├── components/
│   │   ├── shell/                    # 40 teacher-shell components
│   │   │   ├── panels/               # 16 side-rail panels
│   │   │   ├── *Game.tsx             # 10 game components
│   │   │   ├── SmartWhiteboard.tsx   # ~2550 lines — canvas whiteboard
│   │   │   ├── FloatingSideRail.tsx  # Right-side tool rail + panel host
│   │   │   ├── BottomControlBar.tsx  # Bottom game/reward bar
│   │   │   ├── IframeStage.tsx       # Slide iframe host + postMessage
│   │   │   └── ...
│   │   └── ui/                       # 36 shadcn/ui primitives
│   ├── hooks/
│   │   ├── use-mobile.ts
│   │   └── use-toast.ts
│   ├── lib/                          # 44 library modules
│   │   ├── shell-store.ts            # Zustand store (~1840 lines) — main state
│   │   ├── db.ts                     # Prisma client + PRAGMA setup
│   │   ├── db-sync.ts                # Store↔DB sync layer
│   │   ├── local-db.ts               # Typed API client (POST /api/db/[op])
│   │   ├── auth.ts                   # LAN token authentication
│   │   ├── game-utils.ts             # Fair picker + award helpers
│   │   ├── slide-schema.ts           # SlideManifest + types + ShellSettings
│   │   ├── question-provider.ts      # Question extraction from manifest
│   │   ├── report-aggregator.ts      # Report builder (cached)
│   │   ├── *-crypto.ts               # 4 encryption modules (AI/Moodle/Telegram/CustomApp)
│   │   ├── whiteboard-v10.ts         # Whiteboard data types + SVG export
│   │   ├── celebrations.ts           # 36 default celebrations
│   │   ├── title-rules.ts            # Auto-title rules
│   │   ├── rewards-audio-v10.ts      # Badge levels + achievement metrics
│   │   ├── smart-context.ts          # AI lesson context sanitizer
│   │   ├── settings-ai-v10.ts        # AI key management + SSRF guard
│   │   ├── webhook-v10.ts            # Webhook signing + delivery
│   │   ├── moodle-v10.ts             # Moodle sync logic
│   │   ├── reports-telegram-v10.ts   # Telegram report builder + queue
│   │   ├── telegram-report-pdf.ts    # Arabic PDF generation
│   │   ├── pdf-export.ts             # Slide + whiteboard PDF export
│   │   ├── math-engine.ts            # Math expression evaluator
│   │   ├── tts-announcer.ts          # Text-to-speech announcer
│   │   ├── smart-audio.ts            # Howler audio manager
│   │   ├── game-activity-context.tsx # React context for game activity state
│   │   ├── useGameStudentPicker.ts   # Unified picker hook for games
│   │   ├── useFairStudentPicker.ts   # Fair picker hook
│   │   ├── seed-demo-lesson.ts       # First-run demo lesson seeding
│   │   └── ...
│   ├── types/
│   │   └── global.d.ts               # Window.__BISALASA_HYDRATED__ etc.
│   └── middleware.ts                 # Next.js edge middleware (auth check)
├── prisma/
│   ├── schema.prisma                 # 73 models, 1438 lines
│   └── data/custom.db                # SQLite file (gitignored)
├── public/
│   ├── slides/                       # 10 HTML lessons + 6 MD docs
│   ├── gifts/                        # Gift images (WebP)
│   ├── sounds/                       # Audio files
│   ├── fonts/Amiri-Regular.ttf       # Arabic font for PDF
│   ├── manifest.json                 # PWA manifest
│   └── sw.js                         # Service worker
├── scripts/                          # 73 smoke/E2E/audit scripts
├── tests/                            # 3 shell scripts (runtime checks)
├── data/custom.db                    # Runtime SQLite (gitignored)
├── next.config.ts
├── tsconfig.json                     # `@/*` → `./src/*`
├── tailwind.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── package.json
└── *.md                              # ~80 documentation files (root)
```

---

## 4. Architecture

### Layered Architecture (actual)

```
Browser (Teacher)
  │
  ├─ page-client.tsx (main shell, dynamic imports)
  │    ├─ IframeStage ← postMessage → slide HTML
  │    ├─ SmartWhiteboard (canvas overlay)
  │    ├─ FloatingSideRail → 16 panels (dynamic)
  │    ├─ BottomControlBar → 10 games + rewards
  │    ├─ ConfirmDialogHost (confirm/prompt system)
  │    ├─ CelebrationsOverlay
  │    └─ KeyboardShortcuts
  │
  ├─ Zustand Store (shell-store.ts)
  │    ├─ Persisted slice → localStorage (UI prefs only)
  │    └─ Non-persisted → students, sessions, fairness state
  │
  ├─ db-sync.ts (store → API bridge, fire-and-forget)
  │
  ├─ local-db.ts (typed fetch client → POST /api/db/[operation])
  │
  ↓
Next.js API Routes
  │
  ├─ middleware.ts (edge: token presence check → 401 if missing)
  │
  ├─ /api/db/[operation]/route.ts (CENTRAL dispatcher)
  │    ├─ await dbReady (PRAGMA setup)
  │    ├─ ALLOWED set check
  │    ├─ dispatch(op, args) → switch on 100+ operations
  │    └─ Prisma queries (transactions where needed)
  │
  ├─ /api/ai/* (AI provider proxy — 6 routes)
  ├─ /api/telegram (bot integration — 20 actions)
  ├─ /api/moodle/* (Moodle sync — 3 routes, 16 actions)
  ├─ /api/backup (JSON export/import)
  ├─ /api/auth/whoami (token issuance)
  ├─ /api/webhooks (outbound webhook delivery)
  └─ /api/live-sync (inbound Custom App events)
  │
  ↓
Prisma Client (db.ts)
  ├─ PRAGMA: foreign_keys=ON, busy_timeout=5000, journal_mode=WAL
  └─ SQLite (data/custom.db)
```

### Where things happen

| Concern | Location | Notes |
|---|---|---|
| UI rendering | `src/components/shell/*.tsx` | All client components (`"use client"`) |
| State | `src/lib/shell-store.ts` (Zustand) | Single store, ~1840 lines |
| Business rules | Split: `shell-store.ts` actions + `game-utils.ts` + API dispatcher | **Not centralized** — see §10 |
| Validation | `src/app/api/db/[operation]/route.ts` (server-side, per-op) + `question-contract.ts` | Client-side validation is minimal |
| DB access | Prisma via `src/lib/db.ts` | All queries go through `/api/db/[operation]` or dedicated routes |
| Auth | `src/middleware.ts` (edge) + `src/lib/auth.ts` (token gen/validation) | Token in `AppSettings.apiToken`, cookie `bisalasa-token` |
| Error handling | `PanelErrorBoundary` (per-panel) + `try/catch` in API routes + `sonner` toasts | No global error boundary |
| External calls | `/api/ai/*`, `/api/telegram`, `/api/moodle/*`, `/api/webhooks` | Server-side only |

---

## 5. Pages & Routes

| Route | File | Purpose | Key Components | Data Sources |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` → `page-client.tsx` | Main teacher shell | IframeStage, SmartWhiteboard, FloatingSideRail, BottomControlBar | Zustand store, `/api/db/*`, `/api/auth/whoami` |
| `/curriculum-factory` | `src/app/curriculum-factory/page.tsx` | AI-powered lesson builder | Custom page (no shell) | `/api/curriculum-factory/*`, `/api/ai/*`, `/api/db/*` |
| `/grades` | `src/app/grades/route.ts` | Printable HTML grades report (GET only) | Server-rendered HTML | `buildClassReport` from `report-aggregator.ts` |
| `/?view=student` | `page-client.tsx` (studentBroadcast prop) | Student projection view (no teacher tools) | IframeStage only | Slide iframe only |
| `/api/*` | 23 route files | See §6 | — | — |

**Navigation:** No router navigation except `/curriculum-factory` link in FloatingSideRail. All other UI is panel-based (FloatingSideRail toggles `activePanel` in store).

---

## 6. API Map

### 6.1 Central DB Dispatcher — `/api/db/[operation]/route.ts`

**Single endpoint** handling 100+ operations. POST body: `{ args: [...] }`.

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/db/{operation}` | cookie/token | Execute DB operation by name |
| GET | `/api/db/{operation}?_={ts}` | cookie/token | Read operations (e.g., `classes.list`) |

**Operations** (categorized, ~100 total):

| Namespace | Operations | Notes |
|---|---|---|
| `classes.*` | `list`, `create`, `update`, `delete` | |
| `students.*` | `list`, `listByClass`, `findByName`, `findByNameInClass`, `upsert`, `update`, `delete`, `awardPoints`, `awardCorrect`, `awardWrong`, `awardGoodTry`, `awardBadge`, `resetSession`, `setAbsent`, `setTitle`, `timeline` | `upsert`/`update` whitelist excludes `points`, `parentTelegramChatId`, `lastCalled` |
| `groups.*` | `list`, `save`, `delete`, `addPoints`, `autoSplit` | `autoSplit` uses `crypto.randomInt` + transaction |
| `lessons.*` | `list`, `upsert`, `delete` | |
| `questions.*` | `list`, `listByLesson`, `listByIdea`, `create`, `bulkCreate` | |
| `sessions.*` | `list`, `start`, `end`, `snapshotStudents`, `getStudentDelta` | |
| `gameResults.*` | `create`, `addParticipant`, `addQuestion`, `complete`, `listRecent` | |
| `attendance.*` | `list`, `save` | |
| `gifts.*` | `list`, `save`, `delete`, `awardToStudent`, `listByStudent` | |
| `prizes.*` | `list`, `save`, `delete` | |
| `sounds.*` | `list`, `save`, `delete` | |
| `celebrations.*` | `list`, `save`, `delete`, `seedDefaults` | |
| `celebrationEvents.*` | `listByStudent`, `listBySession`, `create` | |
| `studentNotes.*` | `create`, `listByStudent`, `listBySession`, `search`, `markShared` | |
| `studentActivities.*` | `create`, `listByStudent`, `listBySession`, `aggregateByType` | |
| `settings.*` | `get`, `set`, `profiles.list/save/delete` | `set` uses whitelist (45 keys) |
| `stats.summary` | — | Returns counts (students, lessons, sessions, gameResults) |
| `reports.*` | `student`, `class`, `attendance`, `games`, `compare`, `teacher`, `templates.*`, `schedules.*` | Aggregation endpoints |
| `ai.*` | `conversations.*`, `memory.*`, `prompts.*`, `embeddings.*`, `retry.*` | AI metadata storage |
| `telegramV10.*` | `preferences.*`, `queue.*`, `templates.*` | Telegram queue management |
| `moodleMappings.*` | `list` | Returns all Moodle mapping tables |
| `moodleResults.*` | `studentSummary` | |
| `webhooks.*` | `list`, `save`, `delete` | External webhook targets |
| `achievements.*` | `list`, `save`, `delete`, `unlock` | |
| `tournaments.*` | `list`, `save`, `delete` | |
| `backup.*` | `list`, `record` | |
| `customBadges.*` | `list`, `save`, `delete` | |
| `badgeProgress.*` | `upsert` | |
| `giftCombos.*` | `list`, `save`, `delete`, `award` | |
| `celebrationSequences.*` | `list`, `save`, `delete` | |
| `rewardEvents.*` | `listByStudent` | |
| `gameTemplates.*` | `list`, `save`, `delete` | |
| `curriculumFactoryDrafts.*` | `list`, `get`, `upsert`, `delete`, `versions`, `restoreVersion`, `bake` | |

### 6.2 Other API Routes

| Route | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/auth/whoami` | GET | none | Issue/generate API token as httpOnly cookie |
| `/api/health` | GET | none | Health check (`{ok, uptime, timestamp}`) |
| `/api/backup` | GET, POST, DELETE | cookie/token | JSON backup/restore (format=sql disabled) |
| `/api/ai` | GET, POST | cookie/token | 13 actions: `analyzeLesson`, `generate`, `generateQuestions`, `keys.*`, `promptTest`, `whiteboardAssist`, `compare` |
| `/api/ai/stream` | POST | cookie/token | SSE streaming AI responses |
| `/api/ai/image` | POST | cookie/token | Image generation |
| `/api/ai/media` | POST | cookie/token | Media generation |
| `/api/ai/stt` | POST | cookie/token | Speech-to-text |
| `/api/ai/compare` | POST | cookie/token | Model comparison |
| `/api/telegram` | GET, POST | cookie/token | 20 actions: `config.*`, `webhook.*`, `test`, `sendStudentReport`, `sendSessionReports`, `students.codes`, `queue.process`, etc. |
| `/api/telegram/retry` | POST | cookie/token | Retry failed Telegram messages |
| `/api/moodle` | GET, POST | cookie/token | 16 actions: `config.*`, `discover`, `syncStudents/Groups/Results`, `reconcile`, `liveStatus`, `webhook.*` |
| `/api/moodle/retry` | POST | cookie/token | Retry failed Moodle sync |
| `/api/moodle/webhook` | POST | HMAC signature | Inbound Moodle webhook |
| `/api/webhooks` | GET, POST | cookie/token | External webhook target CRUD + deliver |
| `/api/live-sync` | POST | shared secret | Inbound Custom App events |
| `/api/curriculum-factory/assets` | GET, POST | cookie/token | Asset upload/management |
| `/api/curriculum-factory/ocr` | POST | cookie/token | OCR image processing |
| `/api/tts` | POST | cookie/token | Text-to-speech proxy |
| `/api/lessons/search` | GET | cookie/token | Lesson search |

---

## 7. Database Map

**73 Prisma models** in `prisma/schema.prisma` (1438 lines). SQLite via Prisma.

### Core Domain Models

| Model | Purpose | Key Fields | Relations |
|---|---|---|---|
| `ClassRoom` | Class/section | `name`, `color`, `description` | `students[]`, `groups[]`, `sessions[]`, `attendance[]` |
| `Student` | Student record | `name`, `classId?`, `points`, `correctAnswers`, `wrongAnswers`, `attempts`, `title?`, `isAbsent`, `lastCalled?`, `studentCode?` (unique), `parentTelegramChatId?`, `moodleUserId?` | `class?`, `badges[]`, `gifts[]`, `rewardEvents[]`, `gameResults[]`, `activities[]`, `notes[]`, `celebrationEvents[]`, `teacherInteractions[]`, `sessionSnapshots[]`, `badgeProgress[]`, `achievements[]` |
| `StudentGroup` | Group within class | `classId`, `name`, `color`, `studentIds` (JSON string!), `groupPoints` | `class` |
| `Session` | Class session | `classId?`, `name`, `startedAt`, `endedAt?`, `statsJson` | `class?`, `gameResults[]`, `studentSnapshots[]`, `activities[]`, `studentNotes[]`, `celebrationEvents[]`, `teacherInteractions[]` |
| `ImportedLesson` | Lesson HTML + manifest | `lessonId`, `fileName`, `title`, `content` (HTML), `manifestJson` | `questions[]` |
| `LessonQuestion` | Question bank | `lessonId`, `text`, `correctAnswer`, `options?`, `ideaId?`, `stepNumber?`, `rewardPoints`, `tags` (JSON), `difficulty?` | `lesson` |

### Reward System Models

| Model | Purpose | Key Fields | Notes |
|---|---|---|---|
| `StudentBadge` | Badge award record | `studentId`, `type` (text: correct/good-try/fast/creative/helper/star/wrong) | No enum, free string |
| `StudentGift` | Gift award record | `studentId`, `giftId`, `giftName`, `giftImage` | |
| `StudentBadgeProgress` | Aggregated badge levels | `studentId`, `badgeId`, `level` (bronze/silver/gold), `count` | `@@unique([studentId, badgeId])` |
| `CustomBadge` | Teacher-defined badge template | `name`, `icon`, `condition`, `metric?`, `threshold?` | |
| `Achievement` | Auto-unlockable achievement | `metric`, `threshold`, `rewardPoints`, `badgeId?` | metric: correctStreak/gamesPlayed/weeklyPoints/helpers |
| `StudentAchievement` | Achievement unlock record | `studentId`, `achievementId`, `sessionId?` | `@@unique([studentId, achievementId])` |
| `GiftCombo` | Gift+celebration+badge combo | `giftId`, `celebrationId`, `badgeId?`, `points` | **No FK** to Gift/Celebration/Badge — weak references |
| `RewardEvent` | Idempotent reward log | `eventKey` (unique), `studentId`, `kind`, `points`, `giftId?`, `badgeId?`, `celebrationId?` | `eventKey` prevents duplicate awards |
| `Prize` | Lucky wheel prize | `name`, `type` (title/points/gift/nothing), `points`, `icon` | |
| `Gift` | Gift catalog | `name`, `category`, `image`, `description` | 32 defaults seeded |
| `Celebration` | Celebration catalog | `id` (deterministic for defaults), `label`, `icon`, `sound`, `renderMode` | 36 defaults |
| `CelebrationEvent` | Celebration fire record | `studentId?`, `sessionId?`, `celebrationId`, `celebrationLabel` | |
| `CelebrationSequence` | Multi-step celebration | `stepsJson`, `durationMs` | |

### Game Models

| Model | Purpose | Key Fields |
|---|---|---|
| `GameResult` | Game session record | `sessionId?`, `gameType`, `gameMode`, `startedAt`, `endedAt?`, `durationMs?`, `ideaId?`, `questionCount`, `configJson` |
| `GameResultParticipant` | Per-student game stats | `gameResultId`, `studentId`, `pointsEarned`, `correctCount`, `wrongCount`, `isWinner` |
| `GameResultQuestion` | Per-question answer record | `gameResultId`, `questionId?`, `studentId?`, `isCorrect?`, `pointsEarned` |

### Activity & Notes Models

| Model | Purpose | Key Fields |
|---|---|---|
| `StudentActivity` | Unified activity log | `studentId?`, `sessionId?`, `type`, `pointsDelta`, `description`, `metadataJson` |
| `StudentNote` | Teacher note on student | `studentId?`, `sessionId?`, `text`, `isShared` |
| `TeacherInteraction` | Teacher intervention record | `studentId?`, `sessionId?`, `curriculumKey`, `lessonKey`, `ideaKey?`, `type`, `stateBefore`, `stateAfter` |
| `AttendanceRecord` | Daily attendance | `classId`, `date`, `absentStudentIds` (JSON string!) |

### AI Models (9)

| Model | Purpose |
|---|---|
| `AiProviderKey` | Encrypted AI provider keys (Google/OpenAI/etc.) |
| `AiConversation` + `AiConversationMessage` | Chat history |
| `AiMemory` | Per-lesson/idea memory (keyed by `lessonId_ideaId_key`) |
| `AiRetryQueue` | Failed AI request retry queue |
| `AiReview` | AI review of homework |
| `AiUsageEvent` | AI usage telemetry (cost tracking) |
| `PromptLibrary` | Saved prompts |
| `LessonEmbedding` | Vector embeddings for RAG |

### Moodle Models (10)

`MoodleCourseMap`, `MoodleGroupMap`, `MoodleStudentMap`, `MoodleSectionMap`, `MoodleActivityMap`, `MoodleQuestionMap`, `MoodleHomeworkMap`, `MoodleSyncCursor`, `MoodleSyncEvent`, `MoodleSyncRetry`

Plus: `IdeaRun`, `IdeaQuestionAttempt`, `HomeworkSnapshot`, `HomeworkQuestionResult`, `HomeworkSubmission` for Moodle homework tracking.

### Telegram Models (3)

`TelegramParentPreference`, `TelegramMessageQueue`, `TelegramMessageTemplate`

### System Models

| Model | Purpose |
|---|---|
| `AppSettings` | Singleton (`id="singleton"`) — stores `settingsJson` including `apiToken` |
| `BackupHistory` | Backup audit log |
| `SettingsProfile` | Saved settings profiles per class |
| `ExternalWebhookTarget` | Outbound webhook config (encrypted secret) |
| `ReportTemplate` + `ReportSchedule` | Scheduled report templates |
| `LiveSyncClaim` | Idempotency for inbound live-sync events |

### Relationship Diagram (core)

```
ClassRoom ──< Student ──< StudentBadge
    │              ├──< StudentGift
    │              ├──< StudentActivity
    │              ├──< StudentNote
    │              ├──< CelebrationEvent
    │              ├──< TeacherInteraction
    │              ├──< SessionStudentSnapshot
    │              ├──< GameResultParticipant
    │              ├──< StudentBadgeProgress
    │              └──< StudentAchievement
    ├──< StudentGroup (studentIds as JSON string)
    ├──< Session ──< GameResult ──< GameResultParticipant
    │              ├──< StudentActivity
    │              ├──< StudentNote
    │              └──< CelebrationEvent
    └──< AttendanceRecord (absentStudentIds as JSON string)

ImportedLesson ──< LessonQuestion

AppSettings (singleton, stores apiToken + all settings)
```

**⚠️ Note:** `StudentGroup.studentIds` and `AttendanceRecord.absentStudentIds` are **JSON strings**, not junction tables. This means querying "which groups contain student X" requires scanning all groups and parsing JSON.

---

## 8. Authentication & Authorization

### Mechanism

| Aspect | Implementation | Source |
|---|---|---|
| Auth type | Shared secret token (LAN-only, single-teacher) | `src/lib/auth.ts:14-16` |
| Token storage | `AppSettings.apiToken` (in `settingsJson`), generated lazily | `src/lib/auth.ts:26-44` |
| Token generation | 64 hex chars (32 bytes) via `crypto.randomUUID` × 2 | `src/lib/auth.ts:47-63` |
| Token delivery | httpOnly cookie `bisalasa-token` via `/api/auth/whoami` | `src/app/api/auth/whoami/route.ts:25-31` |
| Token validation | `constantTimeEqual` comparison against `AppSettings.apiToken` | `src/lib/auth.ts:82-90` |
| Token sources accepted | 1. `X-Bisalasa-Token` header, 2. `bisalasa-token` cookie, 3. `?token=` query param | `src/lib/auth.ts:65-79` |
| Edge middleware | `src/middleware.ts` — checks token presence (not value, since edge can't query DB) | `src/middleware.ts:48-60` |
| Protected paths | `/api/db/`, `/api/backup`, `/api/ai/`, `/api/telegram`, `/api/moodle`, `/api/webhooks`, `/api/custom-sync`, `/api/live-sync`, `/api/curriculum-factory/` | `src/middleware.ts:22-32` |
| Public paths | `/api/health`, `/api/auth/whoami`, `/_next/`, `/gifts/`, `/sounds/`, `/slides/`, `/favicon.ico` | `src/middleware.ts:35-43` |

### Authentication vs Authorization

- **Authentication:** Token presence (edge middleware) + token validity (route handler via `isAuthorized`).
- **Authorization:** **None.** Any authenticated request can perform any operation including `students.delete`, `settings.set`, `backup.restore`. There is no role system.
- **No per-user accounts.** The teacher is the only user. Students are data subjects.

### Sensitive Notes

- `next-auth` is in dependencies but **NOT used** — `package.json:88`. The custom token system replaced it.
- Cookie is `SameSite=Strict`, `httpOnly=true`, `secure=false` (LAN HTTP).
- `/api/backup?format=sql` returns 403 (raw DB download disabled).

---

## 9. State Management

### Global State — Zustand Store (`src/lib/shell-store.ts`)

**Single store**, ~1840 lines. Created with `persist` middleware.

| State Slice | Persisted? | Source | Mutated by |
|---|---|---|---|
| `settings: ShellSettings` | ✅ localStorage | `DEFAULT_SETTINGS` → hydrate from DB | `updateSettings` |
| `students: Student[]` | ❌ (SQLite only) | `hydrateFromDb` → `setActiveClassId` reloads | `addStudent`, `removeStudent`, `awardPoints`, `awardCorrect`, etc. |
| `activeClassId` | ❌ | `hydrateFromDb` | `setActiveClassId` |
| `currentSessionId` | ✅ localStorage | `startNewSession` | `startNewSession`, `endCurrentSession` |
| `activeLessonId`, `currentStep`, `currentIdeaId` | ✅ localStorage | `setActiveLesson`, navigation | `nextStep`, `prevStep`, `goToIdea` |
| `manifest: SlideManifest` | ❌ (re-derived from iframe) | `setManifest` from IframeStage | IframeStage postMessage |
| `currentlyCalledStudent` | ❌ | `pickRandomStudent`, `awardCorrect` | various |
| `whiteboardTool`, `whiteboardColor`, `whiteboardThickness`, `whiteboardShape` | ✅ localStorage | UI controls | `setWhiteboardTool`, etc. |
| `gameParticipants`, `wheelResult`, `luckyWheelResult`, `diceResult`, `reactionBestMs` | `reactionBestMs` only | Games | Games |
| `sessionStats` | ❌ | Incremented during session | `incrementSessionStat` |
| `askedQuestionIds: Set<string>` | ❌ | `markQuestionAsked` | Games |
| Fairness state: `lessonAttemptsByStudent`, `lessonCorrectByStudent`, `lessonWrongByStudent`, `lastAskedAtByStudent`, `performanceByIdea`, `ideaSelectionHistory`, `fairnessLog` | ❌ | `recordFairPick` | Fair picker |
| `studentLiveStatuses` | ❌ | `awardCorrect/Wrong/GoodTry` | Award functions |
| `virtualCommentCalledIds`, `currentVirtualComment` | ❌ | `triggerVirtualComment` | Step navigation |
| `calledGroupIds` | ❌ | `pickFairGroups` | Group games |

### Persistence Strategy

- **localStorage** (`bisalasa-shell-store-v10` key): UI prefs, `currentSessionId`, `activeLessonId`, `currentStep`, `currentIdeaId`, `virtualCommentsEnabled`.
- **SQLite**: Students, lessons, sessions, activities, game results — all via `/api/db/*`.
- **On boot**: `hydrateFromDb` in `page-client.tsx` loads from SQLite, **replaces** store state (does not merge).

### Local State (component-level)

- `SmartWhiteboard`: `strokes[]`, `currentStroke`, `historyRef`, `replayState`, `editingText`, `cursorPos`, `laserPos` — all `useState`/`useRef`.
- Games: each game manages its own `phase`, `score`, `participants` via `useState`/`useRef`.

### Server State Caching

- `report-aggregator.ts`: in-memory cache with 750ms TTL for `buildStudentReport` and `buildClassReport`.
- **No cache invalidation on write** — reports may be stale for 750ms after a write.

---

## 10. Core Business Logic

### 10.1 Points Economy

| Action | Points | DB Fields Updated | Activity Logged | Source |
|---|---|---|---|---|
| `awardPoints(id, points)` | `+points` (validated -100..100) | `points` | `type:"points", pointsDelta:points` | `shell-store.ts:706-742` |
| `awardCorrect(id, points=3, ideaId?)` | `+points` (default 3) | `points`, `correctAnswers+1`, `attempts+1`, `lastCalled` | `type:"correct", pointsDelta:points` + badge "correct" | `shell-store.ts:743-790` |
| `awardWrong(id, ideaId?)` | 0 (no deduction) | `wrongAnswers+1`, `attempts+1`, `lastCalled` | `type:"wrong", pointsDelta:0` + badge "wrong" | `shell-store.ts:791-832` |
| `awardGoodTry(id)` | +1 | `points+1`, `attempts+1` | `type:"goodTry", pointsDelta:1` + badge "good-try" | `shell-store.ts:833-866` |
| `awardBadge(id, type)` | 0 | `badges` only | none | `shell-store.ts:867-895` |
| `awardGameBonus(id, points, desc)` | `+points` via `awardPoints` | via `awardPoints` | `type:"points", pointsDelta:0` (points already in awardPoints) | `game-utils.ts:108-120` |

**Flow:** Store action → optimistic state update → `dbSync.syncStudentAward*` (atomic `increment`) → API → Prisma.

### 10.2 Badge System

- **Types** (free string in DB): `correct`, `good-try`, `fast`, `creative`, `helper`, `star`, `wrong`.
- **Auto-awarded**: `correct` (in `awardCorrect`), `wrong` (in `awardWrong`), `good-try` (in `awardGoodTry`).
- **Manual**: any type via `awardBadge(id, type)`.
- **Progression**: `StudentBadgeProgress` tracks `level` (bronze→silver→gold) and `count` per `(studentId, badgeId)`.
- **Custom badges**: `CustomBadge` template with `condition="manual"` or metric-based.

### 10.3 Gift System

- **Catalog**: `Gift` model (32 defaults seeded on first `getAllGifts` call).
- **Awarding**: `gifts.awardToStudent` → creates `StudentGift` record.
- **Combos**: `GiftCombo` links gift + celebration + badge + points. Awarded via `giftCombos.award` which creates `RewardEvent` with idempotent `eventKey`.
- **⚠️ Weak references**: `GiftCombo` and `RewardEvent` store `giftId`/`celebrationId`/`badgeId` as plain strings — no FK constraints.

### 10.4 Title System

- **Auto-titles** (`src/lib/title-rules.ts:31-38`):

| ID | Name | Emoji | Priority | Condition |
|---|---|---|---|---|
| novice | مبتدئ | 🌱 | 0 | `points >= 0` (always) |
| rusher | سريع | ⚡ | 1 | `correct >= 20` |
| genius | عبقري | 🧠 | 2 | `correct >= 50` |
| champion | بطل | 🏆 | 3 | `points >= 100` |
| star | نجم الأسبوع | ⭐ | 4 | `points >= 200` |
| legend | أسطورة | 👑 | 5 | `points >= 500` |

- **`refreshTitle(studentId)`** (`shell-store.ts:948-981`): Computes auto-title, respects manual titles (only overrides if new is "عبقري" or "بطل" — higher priority). **⚠️ `AUTO_TITLES` list omits "سريع" and "أسطورة"** — students with those auto-titles are treated as having manual titles.
- **Called after**: `awardPoints`, `awardCorrect`, `awardWrong`. **Not called after** `awardGoodTry`, `awardBadge` — **UNKNOWN if intentional**.

### 10.5 Celebration System

- **36 default celebrations** in `src/lib/celebrations.ts:32-69`.
- **Trigger**: `triggerCelebration(type)` in store → `CelebrationsOverlay` renders confetti/particles.
- **Persistence**: `CelebrationEvent` record created (via `localDb.celebrationEvents.create`).
- **Smart celebration**: `computeSmartCelebration(players)` decides winner/tied/all-lost.

### 10.6 Fair Picker Algorithm

**`pickStudentFair(ctx)`** (`src/lib/game-utils.ts:202-253`):

1. Filter: `!isAbsent && !excluded`.
2. Rank by: `fairnessScore + strugglingBonus(100k) + ideaFreshnessBonus(1k) + sessionRotationBonus(20)`.
3. Modes:
   - `"off"`: all scores 0 (pure random).
   - `"soft"` (default): fair + warnings only.
   - `"strict"`: fair + reject/delay unfair repeats.
4. `recordFairPick`: updates `calledInSession`, `lastCalled`, fairness maps, `fairnessLog` (last 200), creates `StudentActivity` (`type:"fair-pick"`).
5. Dispatches `window.dispatchEvent("bisalasa:fair-pick")`.

**`pickStudentFairDeferred(ctx)`** (`game-utils.ts:267-327`): Returns `{student, commit}`. `commit()` must be called to record the pick. Used by wheels to avoid recording picks cancelled mid-animation.

### 10.7 Game Persistence Pattern

All curriculum games follow this pattern:

1. `ensureGameResult()` — lazy `localDb.gameResults.create(...)` → stores `gameResultIdRef`.
2. `recordAnswer(question, isCorrect)` — pushes to `recordedAnswersRef` (in-memory).
3. `persistCompletedGame()` — on game end:
   - Resolves `gameResultId`.
   - For each answer: `localDb.gameResults.addQuestion(...)`.
   - For each participant: `localDb.gameResults.addParticipant({..., isWinner})`.
   - `localDb.gameResults.complete({id, endedAt, durationMs})`.
4. Awards points via `awardCorrect`/`awardWrong` during gameplay.

---

## 11. Complete Feature Map

| Feature | UI Component | Store Action | API Operation | DB Model |
|---|---|---|---|---|
| Class management | `ClassesPanel` | `setActiveClassId` | `classes.*` | `ClassRoom` |
| Student CRUD | `StudentsPanel` | `addStudent`, `removeStudent`, `addStudentsBulk` | `students.upsert/delete` | `Student` |
| Student awards | `StudentCard`, `BottomControlBar` | `awardPoints/Correct/Wrong/GoodTry/Badge` | `students.award*` | `Student`, `StudentBadge`, `StudentActivity` |
| Attendance | `StudentsPanel` (scan mode) | `setStudentAbsent` | `students.setAbsent`, `attendance.save` | `AttendanceRecord` |
| Groups | `GroupsPanel` | — | `groups.*`, `groups.autoSplit` | `StudentGroup` |
| Lesson import | `CurriculumPanel` | `addLesson`, `setActiveLesson` | `lessons.upsert` | `ImportedLesson` |
| Slide display | `IframeStage` | `setManifest`, `nextStep`, `prevStep` | — | — |
| Whiteboard | `SmartWhiteboard` | `setWhiteboardTool`, `clearWhiteboard`, `undoWhiteboard` | — | localStorage only |
| Games (10) | `*Game.tsx` | `setActiveGame`, `pickRandomStudent` | `gameResults.*` | `GameResult`, `GameResultParticipant`, `GameResultQuestion` |
| Fair picker | `RandomStudentWheel`, `LuckyWheelGame` | `pickRandomStudent`, `pickStudentFair` | `studentActivities.create` | `StudentActivity` |
| Reports | `ReportsPanel`, `/grades` | — | `reports.*` | aggregated from multiple tables |
| AI assistant | `AiPanel` | — | `/api/ai` (13 actions) | `AiConversation`, `AiMemory`, `AiProviderKey` |
| Telegram | `SettingsPanel` (Telegram tab) | — | `/api/telegram` (20 actions) | `TelegramParentPreference`, `TelegramMessageQueue` |
| Moodle | `MoodlePanel` | — | `/api/moodle` (16 actions) | 10 Moodle models |
| Curriculum factory | `/curriculum-factory` | — | `/api/curriculum-factory/*`, `/api/ai` | `CurriculumFactoryDraft`, `CurriculumPromptTemplate` |
| Backup/restore | `SettingsPanel` | — | `/api/backup` (GET/POST/DELETE) | all tables |
| Webhooks | `SettingsPanel` | — | `/api/webhooks` | `ExternalWebhookTarget` |
| Celebrations | `CelebrationsOverlay`, `BottomControlBar` | `triggerCelebration` | `celebrationEvents.create` | `CelebrationEvent`, `Celebration` |
| Notes | `NotesPanel` | — | `studentNotes.*` | `StudentNote` |
| Settings | `SettingsPanel` | `updateSettings` | `settings.get/set` | `AppSettings`, `SettingsProfile` |

---

## 12. Critical User Flows

### Flow 1: Start Class Session

```
Teacher opens app → page-client.tsx mounts
  → hydrateFromDb() loads classes, lessons, settings, students
  → If currentSessionId in localStorage → prompt: "استكمال الجلسة؟"
Teacher clicks class card in ClassesPanel
  → handleActivate(cls) → setActiveClassId(cls.id)
    → StudentsPanel useEffect[activeClassId] reloads students from SQLite
Teacher clicks "ابدأ جلسة" → startNewSession()
  → dbSync.syncSessionStart(classId, name) → POST /api/db/sessions.start
  → Session record created, currentSessionId set
  → Snapshot students via sessions.snapshotStudents
```

### Flow 2: Award Points to Student

```
Teacher presses "صحيح" button (or shortcut V)
  → StudentCard calls awardCorrect(studentId, 3, currentIdeaId)
    → Optimistic update: students[].points += 3, correctAnswers += 1, badges.push({type:"correct"})
    → dbSync.syncStudentAwardCorrect(studentId, 3) → POST /api/db/students.awardCorrect
      → PRISMA: atomic increment points, correctAnswers, attempts
      → PRISMA: create StudentBadge {type:"correct"}
    → recordStudentActivity(studentId, {type:"correct", points:3, description})
      → dbSync → POST /api/db/studentActivities.create
    → refreshTitle(studentId) — may update title if threshold crossed
    → triggerClassroomHaptic("success"), announce("answer-correct")
    → UI updates (currentlyCalledStudent, studentLiveStatuses)
```

### Flow 3: Run QuickFire Game

```
Teacher opens QuickFire via BottomControlBar
  → closeBottomOverlays() confirms if game active
  → GameOverlay mounts QuickFireGame
  → useGameStudentPicker("quickfire") → picker
  → useGameQuestions("current-idea", limit) → questions from manifest/SQLite
Teacher clicks student → picker.pickRandom() → pickStudentFair({source:"quickfire"})
  → recordFairPick → StudentActivity created, calledInSession=true
Teacher reveals answer → recordAnswer(question, isCorrect)
  → recordedAnswersRef.push({questionId, isCorrect, pointsEarned})
  → if correct: awardCorrect(studentId, points) immediately
  → ensureGameResult() lazy creates GameResult
Game ends → persistCompletedGame()
  → For each answer: gameResults.addQuestion
  → For participant: gameResults.addParticipant({isWinner: true}) — single player
  → gameResults.complete({endedAt, durationMs})
```

### Flow 4: Export Grades PDF

```
Teacher opens /grades?classId=X
  → GET /api/grades → loadRows(classId, sessionId)
    → db.student.findMany({where: {classId}, include: {badges, gifts}})
    → db.studentActivity.findMany
    → buildClassReport({classId, sessionId}) — cached 750ms
    → Render HTML with Arabic RTL, Cairo font
Teacher clicks "اطبع / احفظ PDF" → window.print()
```

### Flow 5: Telegram Parent Report

```
Teacher clicks "أرسل تقرير الطالب" in ReportsPanel
  → POST /api/telegram {action:"sendStudentReport", studentId}
    → sendSummary(config, studentId)
      → buildStudentReport(studentId) → cached
      → generateTelegramStudentPdf (Arabic PDF via pdf-lib + arabic-reshaper)
      → telegramDocument(config, chatId, pdf, filename, caption)
        → POST https://api.telegram.org/bot{token}/sendDocument
        → Error scrubbing: token replaced with "***"
      → If fails → enqueueStudentReport → TelegramMessageQueue
```

---

## 13. Data Flow

### Slide Content Flow

```
Source: HTML file with <script id="slide-manifest"> + controller
  ↓ Teacher imports via CurriculumPanel
lessons.upsert → ImportedLesson (content HTML, manifestJson)
  ↓ setActiveLesson(id)
IframeStage loads HTML into sandboxed iframe
  ↓ iframe sends READY → Shell requests MANIFEST
iframe sends MANIFEST → setManifest in store
  ↓ If manifest has questions
setManifest → localDb.questions.listByLesson (async) → LessonQuestion[]
  ↓ stored in shell-store.lessonQuestions
Games use question-provider.getQuestions() to pull from lessonQuestions
```

### Report Data Flow

```
Sources (parallel queries in buildStudentReportUncached):
  - db.homeworkSnapshot.findMany (Moodle)
  - db.studentActivity.findMany (take: 5000)
  - db.celebrationEvent.findMany (take: 5000)
  - db.studentNote.findMany (take: 500)
  - db.ideaQuestionAttempt.findMany (take: 5000)
  - db.teacherInteraction.findMany (take: 500)
  - db.gameResult.findMany (take: 500, include participants + questions)
  ↓
Aggregated into StudentReportAggregate (report-contract.ts)
  ↓ Cached 750ms (report-aggregator.ts:29-39)
Returned to /grades or /api/db/reports.student
```

### Whiteboard Data Flow

```
Drawing: pointer events → flushPointerMove (rAF throttled)
  → drawCurrentStrokeIncremental (O(1) — draws last segment only)
  → On pointerup: commitHistory → redraw (full, O(n))
  → localStorage.setItem(slideStorageKey, JSON) — debounced
  ↓
Export: exportBoardPng()
  → html2canvas(iframe.contentDocument) → slideCanvas
  → composite canvas (slide + whiteboard overlay)
  → canvas.toDataURL("image/png") → download
```

---

## 14. Error Handling

| Layer | Mechanism | Location |
|---|---|---|
| Component errors | `PanelErrorBoundary` (class component, per-panel) | `src/components/shell/FloatingSideRail.tsx:64-95` |
| Page errors | `error.tsx` (curriculum-factory only) | `src/app/curriculum-factory/error.tsx` |
| API errors | `try/catch` → `NextResponse.json({ok:false, error}, {status})` | Each route handler |
| API input errors | `ApiInputError` class → 400 response | `src/app/api/db/[operation]/route.ts:14-17` |
| Prisma errors | `P2002` (unique constraint) → `ApiInputError`; others → 500 | `src/app/api/db/[operation]/route.ts:381-383` |
| Toast notifications | `sonner` (`toast.success/error/warning/info`) | Throughout components |
| Confirm dialogs | `requestConfirm`/`requestPrompt` in store → `ConfirmDialogHost` | `src/lib/shell-store.ts:1455-1480` |
| Loading states | Per-component `useState` (no global loading) | Various |
| Empty states | Per-component conditional rendering | Various |
| Fallback UI | `TeacherLoading = () => null` for dynamic imports | `src/app/page-client.tsx:14` |

**⚠️ Note:** No global React error boundary. If `page-client.tsx` throws, the entire app crashes with no recovery UI.

---

## 15. External Services

| Service | Integration Point | Purpose | Data In | Data Out | Failure Handling |
|---|---|---|---|---|---|
| AI Providers (Google/OpenAI) | `/api/ai/*` | Lesson analysis, question generation, chat | Lesson text, prompts | Generated text, questions | Retry queue (`AiRetryQueue`), key rotation |
| Telegram Bot API | `/api/telegram` | Parent reports, notifications | Chat ID, message | PDF, text | Message queue (`TelegramMessageQueue`), rate limiter |
| Moodle Web Services | `/api/moodle` | Course/student/homework sync | Token, course ID | Students, activities, grades | `MoodleSyncRetry`, delta sync cursor |
| External Webhooks | `/api/webhooks` | Outbound event delivery | Event payload | HTTP POST to teacher-configured URL | Retry with backoff (max 8 attempts) |
| Custom App (Live Sync) | `/api/live-sync` | Inbound events from external app | Event JSON + HMAC signature | — | `LiveSyncClaim` idempotency |
| z-ai-web-dev-sdk | `src/lib/*` (imported but usage UNKNOWN) | AI capabilities | — | — | UNKNOWN |

**Secrets handling:** All external service credentials (AI keys, Telegram token, Moodle token, webhook secrets) are AES-256-GCM encrypted at rest via dedicated crypto modules (`src/lib/*-crypto.ts`). Encryption key derived from env vars or `DATABASE_URL`.

---

## 16. Environment & Configuration

### Required Environment Variables

| Variable | Purpose | Default | Source |
|---|---|---|---|
| `DATABASE_URL` | SQLite path (`file:./data/custom.db`) | — | `prisma/schema.prisma:11` |
| `BISALASA_AI_KEY_SECRET` | AI key encryption secret | derived from `DATABASE_URL` if unset | `src/lib/ai-key-crypto.ts:28` |
| `BISALASA_AI_KEY_SECRET_FILE` | Path to secret file | — | `src/lib/ai-key-crypto.ts:8` |
| `BISALASA_MOODLE_KEY_SECRET` | Moodle token encryption | derived from `DATABASE_URL` | `src/lib/moodle-crypto.ts:10` |
| `BISALASA_TELEGRAM_KEY_SECRET` | Telegram token encryption | derived from `DATABASE_URL` | `src/lib/telegram-crypto.ts:10` |
| `BISALASA_DATA_DIR` | Data directory path | — | `src/lib/ai-key-crypto.ts:22` |
| `BISALASA_REST_API_KEY` | UNKNOWN — referenced but usage unclear | — | — |
| `LIVE_SYNC_SHARED_SECRET` | Custom App HMAC secret | — | `src/app/api/live-sync/route.ts` |
| `TELEGRAM_API_BASE_URL` | Telegram API base (for proxies) | `https://api.telegram.org` | `src/app/api/telegram/route.ts:23` |
| `NODE_ENV` | Environment | — | standard |
| `HTTPS` | Set to "1" to enable secure cookies in production | — | `src/app/api/auth/whoami/route.ts:29` |

### Configuration Files

| File | Purpose |
|---|---|
| `next.config.ts` | Standalone output, headers (CSP, X-Frame-Options), image optimization disabled, `allowedDevOrigins` |
| `tsconfig.json` | `@/*` path alias → `./src/*` |
| `tailwind.config.ts` | Tailwind config |
| `eslint.config.mjs` | ESLint config |
| `postcss.config.mjs` | PostCSS (Tailwind plugin) |
| `prisma/schema.prisma` | Database schema (73 models) |
| `Caddyfile` | Reverse proxy config (production) |

### Build Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev -p 3000` | Development server |
| `build` | `mkdir -p data && prisma db push && next build --webpack` | Production build |
| `start` | `cd .next/standalone && node server.js` | Production start |
| `db:push` | `prisma db push --accept-data-loss` | Schema sync (⚠️ destructive) |
| `db:generate` | `prisma generate` | Client generation |
| `test:*` | 16 smoke test scripts | Various feature tests |

---

## 17. Important Dependencies

| Dependency | Why It Exists | Where Used | Breakage Risk |
|---|---|---|---|
| `zustand` | Global state management | `shell-store.ts` | High — entire app depends on store shape |
| `@prisma/client` | DB access | All API routes | High — schema changes require `prisma generate` |
| `perfect-freehand` | Smooth pen drawing | `SmartWhiteboard.tsx` | Medium — affects whiteboard rendering only |
| `html2canvas` | Slide+whiteboard composite export | `SmartWhiteboard.tsx`, `pdf-export.ts` | Medium — affects PDF/image export |
| `jspdf` + `pdf-lib` | PDF generation | `pdf-export.ts`, `telegram-report-pdf.ts` | Medium — affects reports |
| `arabic-reshaper` + `bidi-js` | Arabic text in PDF | `telegram-report-pdf.ts` | High — Arabic PDFs break without it |
| `howler` | Audio playback | `smart-audio.ts` | Low — audio only |
| `canvas-confetti` + `@tsparticles` | Celebrations | `CelebrationsOverlay.tsx` | Low — visual only |
| `framer-motion` | Animations | Various components | Low — visual only |
| `react-markdown` | AI response rendering | `AiPanel.tsx` | Low — AI panel only |
| `z-ai-web-dev-sdk` | AI integration (UNKNOWN usage) | UNKNOWN | UNKNOWN |
| `@dnd-kit/*` | Drag-and-drop | `LessonEditorPanel`, whiteboard shapes | Medium — affects editors |
| `write-excel-file` | Excel export | `ReportsPanel` | Low — export only |
| `recharts` | Charts | `ReportPerformanceChart` | Low — reports only |

---

## 18. Security Map

| Area | Current State | Source |
|---|---|---|
| Authentication | ✅ Token-based (httpOnly cookie) | `src/lib/auth.ts`, `src/middleware.ts` |
| Authorization | ❌ None — any authenticated request does anything | No role system exists |
| Input validation | Partial — per-operation in dispatcher | `src/app/api/db/[operation]/route.ts` |
| SQL injection | ✅ Safe — Prisma parameterized queries | All DB access via Prisma |
| XSS | ✅ React escapes by default; `react-markdown` doesn't allow raw HTML | — |
| CSRF | Partial — `SameSite=Strict` cookie, but no CSRF token | `src/app/api/auth/whoami/route.ts:27` |
| SSRF | ✅ `isSafeWebhookUrl` blocks private IPs, metadata endpoints | `src/lib/settings-ai-v10.ts:155-180` |
| Secrets at rest | ✅ AES-256-GCM encryption (AI/Moodle/Telegram/webhook) | `src/lib/*-crypto.ts` |
| Secrets in transit | ✅ Telegram/Moodle tokens scrubbed from errors | `src/app/api/telegram/route.ts:25-31` |
| Sensitive data exposure | ⚠️ PII (parent phone, Telegram chatId) stored plaintext in DB | `prisma/schema.prisma:40-42` |
| Backup security | ✅ `format=sql` disabled; `restoreAll` validates structure | `src/app/api/backup/route.ts` |
| Settings injection | ✅ Whitelist (45 keys) rejects `apiToken`, `telegramToken` | `src/app/api/db/[operation]/route.ts:1711-1727` |
| Student code brute force | ⚠️ 16 hex chars but no rate limiting on `/link` command | `src/app/api/telegram/route.ts:27` |
| Queue claim races | ✅ Atomic `updateMany` with optimistic lock | `src/app/api/db/[operation]/route.ts` |
| Foreign key enforcement | ✅ `PRAGMA foreign_keys=ON` via `dbReady` | `src/lib/db.ts:25-33` |

---

## 19. Performance-Sensitive Areas

| Area | Concern | Location | Mitigation |
|---|---|---|---|
| Whiteboard redraw | O(n) per pointermove without incremental draw | `SmartWhiteboard.tsx` | ✅ Incremental draw added (O(1) per move) |
| `Math.min(...xs)` | Stack overflow on >65k points | `SmartWhiteboard.tsx` | ✅ Replaced with `strokeBBox` loop |
| Report aggregation | 7 parallel queries per student, take:5000 each | `report-aggregator.ts:121-127` | 750ms cache; **UNKNOWN if sufficient for large classes** |
| Students list | `include: { badges: true, gifts: true }` — N+1 risk | `students.listByClass` | No pagination |
| localStorage writes | JSON.stringify entire snapshot on every stroke | `SmartWhiteboard.tsx` | Debounced (UNKNOWN interval) |
| Zustand selectors | `useShellStore((s) => s.students)` re-renders all consumers | Throughout | **UNKNOWN if shallow equality used** |
| Dynamic imports | All shell components lazy-loaded | `page-client.tsx:15-27` | ✅ Reduces initial bundle |
| `BroadcastChannel` | Whiteboard sync across tabs | `SmartWhiteboard.tsx` | Snapshots capped at 2000 strokes |
| `lessonQuestions` extraction | Async on manifest set, fire-and-forget | `shell-store.ts:1262-1270` | No token guard (race risk) |

---

## 20. Responsive / UI Architecture

| Aspect | Implementation |
|---|---|
| Responsive strategy | Fixed layout: top bar (28px) + stage + bottom bar (48px) + right rail (52px). Not mobile-responsive. |
| Layout modes | `workspaceMode: "landscape"` (teleprompter right) vs `"portrait"` (teleprompter top) |
| Design system | shadcn/ui (Radix primitives) + Tailwind 4 |
| Reusable components | 36 UI primitives in `src/components/ui/` |
| Modal system | `ConfirmDialogHost` for confirm/prompt; `GameOverlay` for games; Radix Dialog for panels |
| Notifications | `sonner` toasts (global) |
| RTL | Arabic RTL throughout (`dir="rtl"` in layout) |
| Fonts | Amiri (Arabic) via `localFont`, Cairo for grades report |
| Themes | Dark theme only (`theme: "dark"`) |
| Important UI states | `currentlyCalledStudent`, `studentLiveStatuses`, `gameActivityActive`, `isPicking`, `celebrationType` |

---

## 21. Testing Map

| Type | Framework | Coverage | Location |
|---|---|---|---|
| Smoke tests | Custom Node scripts (`.cjs`/`.ts`) | Math, fairness, whiteboard, AI, Moodle, Telegram, reports | `scripts/*.cjs`, `scripts/*.ts` |
| E2E | Custom scripts with mock servers | Moodle mapping, live sync, homework | `scripts/*-e2e.cjs` |
| API contract | Custom matrix runner | API smoke tests | `scripts/api_smoke_matrix.sh` |
| Scenario matrix | Python script | 25,000 scenarios | `scripts/scenario_matrix_10000.py` |
| Unit tests | None | — | — |
| Component tests | None | — | — |
| Integration tests | Custom (db-relational-concurrency) | DB concurrency | `scripts/db-relational-concurrency-e2e.cjs` |
| Browser tests | Playwright (in QA, not in repo) | Manual via scripts | — |

**Test commands:** `pnpm test:math`, `test:fairness`, `test:whiteboard-games-v10`, `test:settings-ai-v10`, `test:reports-telegram-v10`, `test:curriculum-factory`, `test:moodle:*` (5 suites), `test:v10:complete`, `test:v10:seed`.

**⚠️ Gap:** No Jest/Vitest unit tests. No component testing. All tests are smoke/E2E style.

---

## 22. Known Risks / Suspicious Areas

| Risk | Evidence | Severity |
|---|---|---|
| `StudentGroup.studentIds` as JSON string | `prisma/schema.prisma:81` — can't query "groups containing student X" without full scan | Medium |
| `AttendanceRecord.absentStudentIds` as JSON string | `prisma/schema.prisma:283` — same issue | Medium |
| `GiftCombo`/`RewardEvent` have no FK to Gift/Celebration/Badge | `prisma/schema.prisma:191-204, 234-252` — weak referential integrity | Medium |
| `AUTO_TITLES` omits "سريع" and "أسطورة" | `shell-store.ts:960` — those auto-titles treated as manual | Low |
| `awardGoodTry`/`awardBadge` don't call `refreshTitle` | `shell-store.ts:833-895` — title may not update | Low |
| `setStudentTitle` doesn't log activity | `shell-store.ts:936-945` — no audit trail for manual title changes | Low |
| No report cache invalidation on write | `report-aggregator.ts:29-39` — 750ms stale window | Low |
| `next-auth` dependency unused | `package.json:88` — dead dependency | Low |
| `z-ai-web-dev-sdk` usage UNKNOWN | `package.json:106` — may be unused or used in unexplored files | UNKNOWN |
| `@tanstack/react-query` usage UNKNOWN | `package.json:66` — may be unused | UNKNOWN |
| `Zod` usage UNKNOWN | `package.json:107` — may be unused | UNKNOWN |
| No global error boundary | Only `PanelErrorBoundary` per panel — page-client crash = white screen | Medium |
| `hydrateFromDb` replaces state (no merge) | `db-sync.ts:113` — students added offline (pre-sync) are lost on reload | Medium |
| `prisma db push --accept-data-loss` in `db:push` script | `package.json:26` — destructive, no migrations folder | High |
| 80+ root `.md` files | Many historical/duplicate — documentation drift risk | Low |

---

## 23. File-to-Feature Matrix

| Feature | UI | Components | Hooks/Lib | API | DB Models |
|---|---|---|---|---|---|
| **Students** | `StudentsPanel` | `StudentCard`, `StudentShareCard` | `shell-store.ts`, `useGameStudentPicker` | `students.*` | `Student`, `StudentBadge`, `StudentActivity` |
| **Classes** | `ClassesPanel` | `ClassLeaderboardView` | `shell-store.ts` | `classes.*` | `ClassRoom` |
| **Groups** | `GroupsPanel` | — | `shell-store.ts` | `groups.*` | `StudentGroup` |
| **Lessons** | `CurriculumPanel` | `IframeStage`, `LessonEditorPanel` | `slide-schema.ts`, `question-provider.ts` | `lessons.*`, `questions.*` | `ImportedLesson`, `LessonQuestion` |
| **Whiteboard** | `SmartWhiteboard` | `WhiteboardContextMenu`, `MathToolsPanel` | `whiteboard-v10.ts` | — | localStorage |
| **Games** | `*Game.tsx` (10) | `GameOverlay`, `BottomControlBar` | `game-utils.ts`, `useGameStudentPicker` | `gameResults.*` | `GameResult`, `GameResultParticipant`, `GameResultQuestion` |
| **Rewards** | `StudentCard`, `BottomControlBar` | `AwardedGiftDisplay`, `GiftPersonalities` | `title-rules.ts`, `rewards-audio-v10.ts`, `celebrations.ts` | `students.award*`, `gifts.*`, `celebrationEvents.*` | `StudentBadge`, `StudentGift`, `RewardEvent`, `CelebrationEvent` |
| **Reports** | `ReportsPanel`, `/grades` | `ReportAnalyticsV10`, `ReportPerformanceChart` | `report-aggregator.ts`, `report-contract.ts` | `reports.*` | Aggregated |
| **AI** | `AiPanel` | `LessonIntelligence` | `smart-context.ts`, `settings-ai-v10.ts` | `/api/ai/*` | `AiProviderKey`, `AiConversation`, `AiMemory` |
| **Telegram** | `SettingsPanel` (Telegram) | `TelegramPanel` | `reports-telegram-v10.ts`, `telegram-report-pdf.ts` | `/api/telegram` | `TelegramParentPreference`, `TelegramMessageQueue` |
| **Moodle** | `MoodlePanel` | `MoodleLiveSync` | `moodle-v10.ts` | `/api/moodle/*` | 10 Moodle models |
| **Curriculum Factory** | `/curriculum-factory` | — | — | `/api/curriculum-factory/*` | `CurriculumFactoryDraft`, `CurriculumPromptTemplate` |
| **Auth** | (none — automatic) | — | `auth.ts`, `middleware.ts` | `/api/auth/whoami` | `AppSettings.apiToken` |
| **Backup** | `SettingsPanel` | — | — | `/api/backup` | All tables |

---

## 24. Critical Files (Modify with Caution)

| File | Why Critical | Dependents |
|---|---|---|
| `src/lib/shell-store.ts` | Central state — all components read/write here | All components, all games |
| `src/app/api/db/[operation]/route.ts` | Single dispatcher for 100+ operations | All DB operations via `local-db.ts` |
| `prisma/schema.prisma` | 73 models — any change requires `prisma generate` + `db push` | All API routes, all lib files using Prisma |
| `src/lib/local-db.ts` | Typed API client — all frontend DB access goes through here | All components, all hooks |
| `src/lib/db-sync.ts` | Store↔DB sync — race conditions here affect data integrity | `shell-store.ts`, `page-client.tsx` |
| `src/components/shell/SmartWhiteboard.tsx` | ~2550 lines, complex canvas logic | `page-client.tsx` |
| `src/lib/game-utils.ts` | Fair picker algorithm — affects all games | All `*Game.tsx`, `useGameStudentPicker` |
| `src/middleware.ts` | Auth gate — blocks all `/api/*` if misconfigured | All API routes |
| `src/lib/auth.ts` | Token generation/validation — breaks all API access if broken | `middleware.ts`, `/api/auth/whoami` |
| `src/app/page-client.tsx` | Main shell entry — dynamic imports, hydration | Root page |
| `src/lib/slide-schema.ts` | Type definitions for manifest, settings, students | All files importing types |
| `src/lib/report-aggregator.ts` | Report building — 7 parallel queries | `/grades`, `reports.*` API |

---

## 25. Dependency Graph

```mermaid
graph TD
    subgraph "Browser"
        PC[page-client.tsx]
        IFRAME[IframeStage]
        WB[SmartWhiteboard]
        RAIL[FloatingSideRail]
        BAR[BottomControlBar]
        GAMES[10 Game Components]
        PANELS[16 Panels]
    end

    subgraph "State"
        STORE[shell-store.ts<br/>Zustand]
        DBSYNC[db-sync.ts]
        LOCALDB[local-db.ts]
    end

    subgraph "API"
        MW[middleware.ts<br/>auth check]
        DBROUTE[/api/db/[operation]/route.ts]
        AIROUTE[/api/ai/*]
        TGROUTE[/api/telegram]
        MDROUTE[/api/moodle/*]
        AUTHROUTE[/api/auth/whoami]
        BACKUP[/api/backup]
    end

    subgraph "Database"
        PRISMA[db.ts<br/>Prisma + PRAGMA]
        SQLITE[(SQLite)]
    end

    PC --> STORE
    PC --> IFRAME
    PC --> WB
    PC --> RAIL
    PC --> BAR
    RAIL --> PANELS
    BAR --> GAMES

    STORE --> DBSYNC
    DBSYNC --> LOCALDB
    LOCALDB --> MW
    MW --> DBROUTE
    DBROUTE --> PRISMA
    PRISMA --> SQLITE

    PC --> AUTHROUTE
    AUTHROUTE --> PRISMA

    PANELS --> AIROUTE
    PANELS --> TGROUTE
    PANELS --> MDROUTE
    AIROUTE --> PRISMA
    TGROUTE --> PRISMA
    MDROUTE --> PRISMA

    GAMES --> STORE
    GAMES --> LOCALDB
```

---

## 26. Safe Modification Guide

### Where to modify business logic

| Logic Type | Location | Rule |
|---|---|---|
| Points/awards | `shell-store.ts` (store actions) + `game-utils.ts` (helpers) | Keep store and API in sync — store action calls `dbSync.sync*` |
| Fair picker | `src/lib/game-utils.ts` (`pickStudentFair`, `rankStudentsByFairness`) | Don't add side effects to ranking — keep it pure |
| Game rules | Each `*Game.tsx` component | Follow `ensureGameResult` → `recordAnswer` → `persistCompletedGame` pattern |
| Report aggregation | `src/lib/report-aggregator.ts` | Cache is 750ms — invalidate manually if needed |
| Auth | `src/lib/auth.ts` + `src/middleware.ts` | Edge middleware can't use Prisma — keep token check lightweight |
| Settings whitelist | `src/app/api/db/[operation]/route.ts` (`settings.set` case) | Add new settings keys to `ALLOWED_SETTINGS_KEYS` |

### Where NOT to put business logic

- ❌ UI components (keep them thin — call store actions)
- ❌ `local-db.ts` (it's a typed fetch client, no logic)
- ❌ `db-sync.ts` (it's a sync bridge, no business rules)
- ❌ Prisma schema (data shape only, no logic)

### How to add a new API operation

1. Add to `OpName` type in `src/app/api/db/[operation]/route.ts`
2. Add to `ALLOWED` set (same file)
3. Add `case "namespace.action":` in `dispatch()` function
4. Add typed method to `src/lib/local-db.ts`
5. Call from store action or component

### How to add a new feature

1. Create panel component in `src/components/shell/panels/`
2. Register in `FloatingSideRail.tsx` (`RAIL_GROUPS` + dynamic import + render conditional)
3. Add any needed store state/actions to `shell-store.ts`
4. Add API operations if needed (see above)
5. Add Prisma models if needed (run `prisma generate` + `prisma db push`)

### How to handle permissions

- **Current:** No permission system. All authenticated requests are equal.
- **To add:** Check `req.headers.get("x-bisalasa-token")` in route handler, validate via `isAuthorized(req)`, then check role (would need to add role field to settings).

---

## 27. Testing & Debugging Entry Points

| Problem Type | First Files to Inspect |
|---|---|
| **TypeScript error** | Check `tsconfig.json` paths → inspect the file in error → check imports resolve `@/*` |
| **Runtime error (UI)** | `src/components/shell/FloatingSideRail.tsx` (PanelErrorBoundary) → the panel component that threw → `shell-store.ts` (state shape) |
| **API error (400)** | `src/app/api/db/[operation]/route.ts` (find the `case`) → check `ApiInputError` throws → check input validation |
| **API error (401)** | `src/middleware.ts` (token presence) → `src/lib/auth.ts` (token validation) → `src/app/api/auth/whoami/route.ts` (cookie issuance) |
| **API error (500)** | `src/lib/db.ts` (PRAGMA, `dbReady`) → Prisma error code → `src/app/api/db/[operation]/route.ts` (try/catch) |
| **Database error** | `prisma/schema.prisma` (model definition) → `src/lib/db.ts` (connection) → check `PRAGMA foreign_keys` |
| **Student data issue** | `StudentsPanel.tsx` → `shell-store.ts` (`students` state, `setActiveClassId`) → `db-sync.ts` (`hydrateFromDb`) → `/api/db/students.listByClass` |
| **Points/badges issue** | `shell-store.ts` (`awardPoints/Correct/Wrong`) → `game-utils.ts` (`awardGameBonus`) → `/api/db/students.award*` → `Student` + `StudentBadge` + `StudentActivity` models |
| **Whiteboard issue** | `SmartWhiteboard.tsx` (canvas logic, `redraw`, `drawCurrentStrokeIncremental`) → `whiteboard-v10.ts` (data types) |
| **Game issue** | `*Game.tsx` (specific game) → `game-utils.ts` (fair picker) → `useGameStudentPicker.ts` (hook) → `/api/db/gameResults.*` |
| **Report issue** | `report-aggregator.ts` (queries, cache) → `report-contract.ts` (types) → `/grades/route.ts` (HTML rendering) |
| **Auth bug** | `src/middleware.ts` → `src/lib/auth.ts` → `src/app/api/auth/whoami/route.ts` → `AppSettings.apiToken` in DB |
| **Telegram issue** | `src/app/api/telegram/route.ts` → `src/lib/telegram-report-pdf.ts` → `src/lib/telegram-crypto.ts` → `TelegramMessageQueue` model |
| **Moodle issue** | `src/app/api/moodle/route.ts` → `src/lib/moodle-v10.ts` → `src/lib/moodle-crypto.ts` → Moodle* models |
| **AI issue** | `src/app/api/ai/route.ts` → `src/lib/settings-ai-v10.ts` → `src/lib/ai-key-crypto.ts` → `src/lib/smart-context.ts` |

---

## 28. Final AI Navigation Index

| Problem Type | First Files To Inspect |
|---|---|
| Authentication issue | `src/middleware.ts` → `src/lib/auth.ts` → `src/app/api/auth/whoami/route.ts` → `AppSettings` model |
| Student data issue | `src/components/shell/panels/StudentsPanel.tsx` → `src/lib/shell-store.ts` → `src/lib/db-sync.ts` → `src/app/api/db/[operation]/route.ts` (`students.*` cases) → `Student` model |
| Points/awards issue | `src/lib/shell-store.ts` (`awardPoints/Correct/Wrong`) → `src/lib/game-utils.ts` (`awardGameBonus`) → `students.award*` API → `Student` + `StudentBadge` + `StudentActivity` models |
| Game logic issue | `src/components/shell/*Game.tsx` → `src/lib/game-utils.ts` (`pickStudentFair`) → `src/lib/useGameStudentPicker.ts` → `gameResults.*` API → `GameResult` + `GameResultParticipant` models |
| Whiteboard issue | `src/components/shell/SmartWhiteboard.tsx` → `src/lib/whiteboard-v10.ts` |
| Report issue | `src/lib/report-aggregator.ts` → `src/lib/report-contract.ts` → `src/app/grades/route.ts` → `reports.*` API |
| Lesson/slide issue | `src/components/shell/IframeStage.tsx` → `src/lib/slide-schema.ts` → `src/lib/question-provider.ts` → `lessons.*` API → `ImportedLesson` + `LessonQuestion` models |
| AI issue | `src/components/shell/panels/AiPanel.tsx` → `src/app/api/ai/route.ts` → `src/lib/settings-ai-v10.ts` → `src/lib/ai-key-crypto.ts` → `AiProviderKey` model |
| Telegram issue | `src/components/shell/panels/TelegramPanel.tsx` → `src/app/api/telegram/route.ts` → `src/lib/reports-telegram-v10.ts` → `src/lib/telegram-report-pdf.ts` → `TelegramMessageQueue` model |
| Moodle issue | `src/components/shell/panels/MoodlePanel.tsx` → `src/app/api/moodle/route.ts` → `src/lib/moodle-v10.ts` → `src/lib/moodle-crypto.ts` → `MoodleCourseMap` model |
| Backup issue | `src/app/api/backup/route.ts` → all models (restore touches all tables) |
| Settings issue | `src/components/shell/panels/SettingsPanel.tsx` → `src/lib/shell-store.ts` (`updateSettings`) → `settings.set` API (whitelist) → `AppSettings` model |
| Database schema issue | `prisma/schema.prisma` → `src/lib/db.ts` (PRAGMA) → `src/app/api/db/[operation]/route.ts` |
| Performance issue | `src/components/shell/SmartWhiteboard.tsx` (redraw) → `src/lib/report-aggregator.ts` (queries) → `src/app/api/db/[operation]/route.ts` (N+1 queries) |
| Security issue | `src/middleware.ts` → `src/lib/auth.ts` → `src/app/api/db/[operation]/route.ts` (validation) → `src/lib/*-crypto.ts` (encryption) |

---

## Conflicts: Documentation vs Code

| Conflict | Documentation Says | Code Says | Truth |
|---|---|---|---|
| Auth | `BISALASA-COMPLETE-DOCUMENTATION-AR.md:149` says "before public deployment, add auth" | `src/middleware.ts` + `src/lib/auth.ts` implement LAN token auth | **Code is truth** — auth was added 2026-08-16 |
| `format=sql` | `FINAL-DELIVERY-MANIFEST-AR.md` implies backup works | `src/app/api/backup/route.ts:270` returns 403 | **Code is truth** — disabled for security |
| `students.upsert` fields | Older docs may imply all fields writable | `src/app/api/db/[operation]/route.ts:363` restricts to safe fields | **Code is truth** |
| `setActiveClassId` | Docs say it only sets id | `src/components/shell/panels/StudentsPanel.tsx:411` has useEffect that reloads students | **Code is truth** — reload via effect, not action |

---

*End of PROJECT_MAP.md. Every fact above is traceable to the cited file:line. When in doubt, read the source code.*
