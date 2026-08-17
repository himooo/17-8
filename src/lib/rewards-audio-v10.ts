/**
 * V10 reward, celebration, and audio contracts.
 * Pure helpers keep scoring decisions deterministic and easy to smoke-test.
 */

export type BadgeLevel = "bronze" | "silver" | "gold";
export type AchievementMetric = "correctStreak" | "gamesPlayed" | "weeklyPoints" | "helpers";

export interface BadgeDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  condition: "manual" | "auto";
  metric?: AchievementMetric;
  threshold?: number;
}

export interface StudentBadgeProgress {
  id: string;
  badgeId: string;
  level: BadgeLevel;
  count: number;
  awardedAt: string;
  updatedAt: string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  metric: AchievementMetric;
  threshold: number;
  rewardPoints: number;
  badgeId?: string;
}

export interface StudentAchievementState {
  studentId: string;
  achievementId: string;
  unlockedAt: string;
  rewardApplied: boolean;
}

export interface GiftCombo {
  id: string;
  name: string;
  giftId: string;
  celebrationId: string;
  badgeId?: string;
  points: number;
  enabled: boolean;
}

export interface ComboAwardPlan {
  comboId: string;
  studentId: string;
  eventKey: string;
  points: number;
  giftId: string;
  celebrationId: string;
  badgeId?: string;
}

export interface CelebrationSequenceStep {
  id: string;
  delayMs: number;
  type: "sound" | "banner" | "particles" | "tts" | "gift" | "badge";
  payload: Record<string, string | number | boolean>;
}

export interface CelebrationSequence {
  id: string;
  name: string;
  enabled: boolean;
  durationMs: number;
  steps: CelebrationSequenceStep[];
}

export type AudioChannel = "music" | "effects" | "tts" | "ambient";

export interface AudioChannelState {
  volume: number;
  muted: boolean;
}

export interface AudioMixerState {
  enabled: boolean;
  masterVolume: number;
  channels: Record<AudioChannel, AudioChannelState>;
  ambiance: "none" | "calm" | "focus" | "energetic" | "celebration";
  haptics: boolean;
}

const LEVELS: BadgeLevel[] = ["bronze", "silver", "gold"];

export function nextBadgeLevel(level: BadgeLevel): BadgeLevel {
  const index = LEVELS.indexOf(level);
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, index + 1))];
}

export function upsertBadgeProgress(existing: StudentBadgeProgress | null, input: { id: string; badgeId: string; nowIso: string }): StudentBadgeProgress {
  if (!existing) return { id: input.id, badgeId: input.badgeId, level: "bronze", count: 1, awardedAt: input.nowIso, updatedAt: input.nowIso };
  return { ...existing, count: existing.count + 1, level: nextBadgeLevel(existing.level), updatedAt: input.nowIso };
}

export function evaluateAchievement(definition: AchievementDefinition, metrics: Partial<Record<AchievementMetric, number>>): boolean {
  const value = Number(metrics[definition.metric] || 0);
  return Number.isFinite(value) && value >= Math.max(1, definition.threshold);
}

export function createComboAwardPlan(combo: GiftCombo, studentId: string, sessionId: string, now = Date.now()): ComboAwardPlan | null {
  if (!combo.enabled || !studentId || !sessionId) return null;
  return {
    comboId: combo.id,
    studentId,
    eventKey: `${sessionId}:${studentId}:${combo.id}:${now}`,
    points: Math.max(0, Math.round(combo.points)),
    giftId: combo.giftId,
    celebrationId: combo.celebrationId,
    badgeId: combo.badgeId,
  };
}

export interface CelebrationSequenceHandlers {
  sound?: (payload: CelebrationSequenceStep["payload"]) => void;
  banner?: (payload: CelebrationSequenceStep["payload"]) => void;
  particles?: (payload: CelebrationSequenceStep["payload"]) => void;
  tts?: (payload: CelebrationSequenceStep["payload"]) => void;
  gift?: (payload: CelebrationSequenceStep["payload"]) => void;
  badge?: (payload: CelebrationSequenceStep["payload"]) => void;
}

export function playCelebrationSequence(sequence: CelebrationSequence, handlers: CelebrationSequenceHandlers): () => void {
  if (!sequence.enabled) return () => undefined;
  const timers = orderCelebrationSteps(sequence).map((step) => window.setTimeout(() => {
    const handler = handlers[step.type];
    if (handler) handler(step.payload);
  }, Math.min(30_000, Math.max(0, step.delayMs))));
  return () => timers.forEach((timer) => window.clearTimeout(timer));
}

export function orderCelebrationSteps(sequence: CelebrationSequence): CelebrationSequenceStep[] {
  return [...sequence.steps]
    .filter((step) => Number.isFinite(step.delayMs) && step.delayMs >= 0)
    .sort((a, b) => a.delayMs - b.delayMs || a.id.localeCompare(b.id));
}

export function normalizeAudioMixer(input?: Partial<AudioMixerState>): AudioMixerState {
  const defaultChannel = (): AudioChannelState => ({ volume: 1, muted: false });
  const channels = (input?.channels || {}) as Partial<Record<AudioChannel, Partial<AudioChannelState>>>;
  const clamp = (value: unknown, fallback: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, Number(value))) : fallback;
  return {
    enabled: input?.enabled !== false,
    masterVolume: clamp(input?.masterVolume, 0.7),
    channels: {
      music: { ...defaultChannel(), ...(channels.music || {}), volume: clamp(channels.music?.volume, 1) },
      effects: { ...defaultChannel(), ...(channels.effects || {}), volume: clamp(channels.effects?.volume, 1) },
      tts: { ...defaultChannel(), ...(channels.tts || {}), volume: clamp(channels.tts?.volume, 1) },
      ambient: { ...defaultChannel(), ...(channels.ambient || {}), volume: clamp(channels.ambient?.volume, 1) },
    },
    ambiance: ["none", "calm", "focus", "energetic", "celebration"].includes(String(input?.ambiance)) ? input!.ambiance as AudioMixerState["ambiance"] : "none",
    haptics: input?.haptics === true,
  };
}

export function hapticPattern(pattern: "light" | "medium" | "heavy" | "success" | "error"): number | number[] {
  return { light: 10, medium: 30, heavy: 60, success: [10, 50, 10], error: [60, 30, 60] }[pattern];
}
