import {
  addWhiteboardLayer,
  addWhiteboardPage,
  buildReplayFrames,
  createWhiteboardDocument,
  exportWhiteboardSvg,
  normalizeWhiteboardDocument,
  renderEquationText,
  setActiveWhiteboardPage,
  snapLineGeometry,
} from "../src/lib/whiteboard-v10.ts";
import { aggregateGameAnalytics, buildGameShareText, buildSpectatorSnapshot, chooseAdaptiveDifficulty, prioritizeQuestionsByDifficulty } from "../src/lib/game-v10.ts";
import {
  createComboAwardPlan,
  evaluateAchievement,
  hapticPattern,
  nextBadgeLevel,
  normalizeAudioMixer,
  orderCelebrationSteps,
  upsertBadgeProgress,
} from "../src/lib/rewards-audio-v10.ts";

let checks = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  checks += 1;
  if (!condition) {
    console.error(`FAIL ${name}`, detail ?? "");
    process.exitCode = 1;
  }
}

const base = createWhiteboardDocument("lesson-1:slide-2", 1000);
check("document version", base.version === 10);
check("initial page", base.pages.length === 1 && base.activePageId === base.pages[0].id);
const withLayer = addWhiteboardLayer(base, base.activePageId, "حل المسألة");
check("layer add", withLayer.pages[0].layers.length === 2);
const withPage = addWhiteboardPage(withLayer, "صفحة الحل", 1100);
check("page add and activate", withPage.pages.length === 2 && withPage.activePageId !== base.activePageId);
const backToFirst = setActiveWhiteboardPage(withPage, base.activePageId);
check("page switch", backToFirst.activePageId === base.activePageId);
const normalized = normalizeWhiteboardDocument({ ...backToFirst, pages: [{ ...backToFirst.pages[0], strokes: [{ id: "s1", kind: "path", points: [{ x: 0, y: 0 }, { x: 99, y: 2 }], color: "#f00", thickness: 3, layerId: "layer-main" }] }] }, "lesson-1:slide-2", 1200);
check("normalization", normalized.pages[0].strokes.length === 1 && normalized.version === 10);
const snapped = snapLineGeometry(normalized.pages[0].strokes[0], [], 6);
check("axis snap", snapped.metadata?.snapped === true);
const svg = exportWhiteboardSvg(normalized, 800, 500);
check("svg export", svg.startsWith("<svg") && svg.includes("polyline") && svg.includes("800"));
const equation = renderEquationText("$\\frac{x}{2} + \\sqrt{4} = 3$");
check("equation fallback", equation.includes("(x)/(2)") && equation.includes("√(4)"));
const replay = buildReplayFrames(normalized.pages[0].strokes, 2);
check("replay frames", replay.length === 2 && replay[1].elapsedMs > replay[0].elapsedMs);

check("badge level progression", nextBadgeLevel("bronze") === "silver" && nextBadgeLevel("gold") === "gold");
const badge = upsertBadgeProgress(null, { id: "p1", badgeId: "creative", nowIso: "2026-08-15T00:00:00.000Z" });
const upgraded = upsertBadgeProgress(badge, { id: "p1", badgeId: "creative", nowIso: "2026-08-15T00:01:00.000Z" });
check("badge progression state", badge.level === "bronze" && upgraded.level === "silver" && upgraded.count === 2);
check("achievement threshold", evaluateAchievement({ id: "a1", name: "streak", description: "", icon: "", metric: "correctStreak", threshold: 10, rewardPoints: 5 }, { correctStreak: 10 }));
const combo = createComboAwardPlan({ id: "champion", name: "Champion", giftId: "trophy", celebrationId: "champion", badgeId: "star", points: 50, enabled: true }, "student-1", "session-1", 123);
check("combo plan", combo?.giftId === "trophy" && combo?.points === 50 && combo?.badgeId === "star");
const ordered = orderCelebrationSteps({ id: "seq", name: "Champion", enabled: true, durationMs: 3000, steps: [{ id: "b", delayMs: 1000, type: "banner", payload: {} }, { id: "a", delayMs: 0, type: "sound", payload: {} }] });
check("sequence order", ordered[0].id === "a" && ordered[1].id === "b");
const mixer = normalizeAudioMixer({ masterVolume: 2, channels: { tts: { volume: 0.4, muted: true } }, ambiance: "focus", haptics: true });
check("mixer normalization", mixer.masterVolume === 1 && mixer.channels.tts.muted && mixer.ambiance === "focus" && mixer.haptics);
check("haptic patterns", Array.isArray(hapticPattern("success")) && hapticPattern("medium") === 30);
check("adaptive difficulty", chooseAdaptiveDifficulty({ attempts: 5, correct: 5 }) === "hard" && chooseAdaptiveDifficulty({ attempts: 5, correct: 1 }) === "easy");
const prioritized = prioritizeQuestionsByDifficulty([{ difficulty: "easy" as const, id: 1 }, { difficulty: "hard" as const, id: 2 }, { difficulty: "medium" as const, id: 3 }], "hard");
check("difficulty prioritization stays local", prioritized[0].id === 2 && prioritized.length === 3);
const analytics = aggregateGameAnalytics([{ gameType: "quickfire", ideaId: "idea-1", points: 10, participants: 2, durationMs: 1000, winnerId: "s1" }, { gameType: "quickfire", ideaId: "idea-1", points: 5, participants: 1, durationMs: 3000 }]);
check("game analytics", analytics.totalGames === 2 && analytics.totalPoints === 15 && analytics.byGame.quickfire.wins === 1 && analytics.byIdea["idea-1"].games === 2);
check("game share text", buildGameShareText({ gameType: "quickfire", winnerName: "أحمد", points: 10 }).includes("أحمد"));
const spectator = buildSpectatorSnapshot({ lessonId: "lesson-1", currentIdeaId: "idea-1", currentStep: 2, students: [{ id: "s1", name: "أحمد", points: 10, status: "correct" }] });
check("spectator read-only snapshot", spectator.version === 1 && spectator.students.length === 1 && !("canInteract" in spectator));

if (process.exitCode) process.exit(1);
console.log(`WHITEBOARD_GAMES_V10_SMOKE PASS ${checks} checks`);
