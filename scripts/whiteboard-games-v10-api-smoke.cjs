const { authFetch } = require("./lib/api-client.cjs");
const BASE = process.env.BASE || "http://127.0.0.1:3032";
let checks = 0;
async function call(operation, args = []) {
  const response = await authFetch(`${BASE}/api/db/${operation}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ args }) });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}
function check(name, ok, detail) {
  checks += 1;
  if (!ok) throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
}
async function main() {
  const suffix = `v10-${Date.now()}`;
  const classId = `class-${suffix}`;
  const studentId = `student-${suffix}`;
  const badgeId = `badge-${suffix}`;
  const achievementId = `achievement-${suffix}`;
  const giftId = `gift-${suffix}`;
  const celebrationId = `celebration-${suffix}`;
  const comboId = `combo-${suffix}`;
  const templateId = `template-${suffix}`;
  const tournamentId = `tournament-${suffix}`;
  const cleanup = [];
  try {
    let result = await call("classes.create", [classId, "V10 QA Class", "temporary", "#0142A0"]);
    check("class fixture", result.response.ok && result.payload.ok === true);
    cleanup.push(["classes.delete", [classId]]);
    result = await call("students.upsert", [studentId, classId, { name: "طالب V10 QA", isAbsent: false }]);
    check("student fixture", result.response.ok && result.payload.data.id === studentId);
    result = await call("customBadges.save", [{ id: badgeId, name: "مبدع V10", icon: "creative", color: "#8b5cf6", condition: "manual", isActive: true }]);
    check("custom badge save", result.response.ok && result.payload.data.id === badgeId);
    result = await call("badgeProgress.upsert", [studentId, badgeId, "bronze", 1]);
    check("badge bronze", result.response.ok && result.payload.data.level === "bronze");
    result = await call("badgeProgress.upsert", [studentId, badgeId, "silver", 2]);
    check("badge silver", result.response.ok && result.payload.data.level === "silver" && result.payload.data.count === 2);
    result = await call("achievements.save", [{ id: achievementId, name: "سلسلة V10", description: "اختبار", metric: "correctStreak", threshold: 3, rewardPoints: 7, badgeId }]);
    check("achievement save", result.response.ok && result.payload.data.id === achievementId);
    result = await call("achievements.unlock", [studentId, achievementId, "session-v10"]);
    check("achievement unlock", result.response.ok && result.payload.data.unlocked === true);
    result = await call("achievements.unlock", [studentId, achievementId, "session-v10"]);
    check("achievement idempotency", result.response.ok && result.payload.data.unlocked === false);
    result = await call("gifts.save", [{ id: giftId, name: "هدية V10", category: "other", image: "", description: "temporary" }]);
    check("gift fixture", result.response.ok && result.payload.data.id === giftId);
    result = await call("celebrations.save", [{ id: celebrationId, label: "احتفال V10", icon: "star", color: "#fbbf24", color2: "#f59e0b", tagline: "QA", hype: "QA", sound: "celebrate-fanfare", renderMode: "both", isDefault: false, isCustom: true, sortOrder: 999 }]);
    check("celebration fixture", result.response.ok && result.payload.data.id === celebrationId);
    result = await call("giftCombos.save", [{ id: comboId, name: "حزمة V10", giftId, celebrationId, badgeId, points: 11, enabled: true }]);
    check("combo save", result.response.ok && result.payload.data.id === comboId);
    result = await call("giftCombos.award", [studentId, comboId, "session-v10", `event-${suffix}`]);
    check("combo award", result.response.ok && result.payload.data.awarded === true && result.payload.data.event.points === 11);
    result = await call("giftCombos.award", [studentId, comboId, "session-v10", `event-${suffix}`]);
    check("combo idempotency", result.response.ok && result.payload.data.idempotent === true && result.payload.data.awarded === false);
    result = await call("celebrationSequences.save", [{ id: `sequence-${suffix}`, name: "تسلسل V10", durationMs: 3000, steps: [{ id: "sound", delayMs: 0, type: "sound", payload: { sound: "celebrate-fanfare" } }] }]);
    check("sequence save", result.response.ok && result.payload.data.id === `sequence-${suffix}`);
    result = await call("audioProfiles.save", [{ id: `audio-${suffix}`, name: "Audio V10", masterVolume: 0.5, channels: { effects: { volume: 0.4, muted: false } }, ambiance: "focus", haptics: true }]);
    check("audio profile save", result.response.ok && result.payload.data.id === `audio-${suffix}`);
    result = await call("gameTemplates.save", [{ id: templateId, name: "لعبة V10", type: "quiz", config: { limit: 4, ideaBound: true } }]);
    check("game template save", result.response.ok && result.payload.data.id === templateId);
    result = await call("tournaments.save", [{ id: tournamentId, name: "بطولة V10", status: "draft", participants: [{ type: "student", id: studentId }], rounds: [] }]);
    check("tournament save", result.response.ok && result.payload.data.id === tournamentId);
    result = await call("rewardEvents.listByStudent", [studentId, 100]);
    check("reward event history", result.response.ok && Array.isArray(result.payload.data) && result.payload.data.length >= 2);
    console.log(`WHITEBOARD_GAMES_V10_API_SMOKE PASS ${checks} checks`);
  } finally {
    for (const [operation, args] of [["tournaments.delete", [tournamentId]], ["gameTemplates.delete", [templateId]], ["celebrationSequences.delete", [`sequence-${suffix}`]], ["giftCombos.delete", [comboId]], ["celebrations.delete", [celebrationId]], ["gifts.delete", [giftId]], ["achievements.delete", [achievementId]], ["customBadges.delete", [badgeId]], ...cleanup]) {
      await call(operation, args).catch(() => undefined);
    }
  }
}
main().catch((error) => { console.error(`WHITEBOARD_GAMES_V10_API_SMOKE FAIL: ${error.message}`); process.exit(1); });
