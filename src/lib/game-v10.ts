export type AdaptiveDifficulty = "easy" | "medium" | "hard";

export interface PerformanceSample {
  attempts: number;
  correct: number;
  wrong?: number;
}

export interface GameResultSample {
  gameType: string;
  ideaId?: string | null;
  durationMs?: number | null;
  winnerId?: string | null;
  points?: number;
  correctAnswers?: number;
  participants?: number;
  completedAt?: string;
}

export interface GameAnalyticsSummary {
  totalGames: number;
  totalParticipants: number;
  totalPoints: number;
  averageDurationMs: number;
  byGame: Record<string, { games: number; points: number; averageDurationMs: number; wins: number }>;
  byIdea: Record<string, { games: number; points: number }>;
}

const DIFFICULTY_RANK: Record<AdaptiveDifficulty, number> = { easy: 0, medium: 1, hard: 2 };

export function chooseAdaptiveDifficulty(sample: PerformanceSample, current: AdaptiveDifficulty = "medium"): AdaptiveDifficulty {
  if (!sample.attempts || sample.attempts < 3) return current;
  const accuracy = sample.correct / Math.max(1, sample.attempts);
  if (accuracy >= 0.8) return "hard";
  if (accuracy <= 0.4) return "easy";
  return "medium";
}

export function prioritizeQuestionsByDifficulty<T extends { difficulty?: AdaptiveDifficulty }>(questions: T[], target: AdaptiveDifficulty): T[] {
  return [...questions].sort((a, b) => Math.abs(DIFFICULTY_RANK[a.difficulty || "medium"] - DIFFICULTY_RANK[target]) - Math.abs(DIFFICULTY_RANK[b.difficulty || "medium"] - DIFFICULTY_RANK[target]));
}

export function aggregateGameAnalytics(results: GameResultSample[]): GameAnalyticsSummary {
  const byGame: GameAnalyticsSummary["byGame"] = {};
  const byIdea: GameAnalyticsSummary["byIdea"] = {};
  let totalDuration = 0;
  let durationCount = 0;
  let totalParticipants = 0;
  let totalPoints = 0;
  for (const result of results) {
    const gameType = result.gameType || "unknown";
    const ideaId = result.ideaId || "lesson";
    const game = byGame[gameType] || { games: 0, points: 0, averageDurationMs: 0, wins: 0 };
    game.games += 1;
    game.points += Math.max(0, Number(result.points) || 0);
    game.wins += result.winnerId ? 1 : 0;
    if (Number.isFinite(result.durationMs)) {
      game.averageDurationMs += Number(result.durationMs);
      totalDuration += Number(result.durationMs);
      durationCount += 1;
    }
    byGame[gameType] = game;
    const idea = byIdea[ideaId] || { games: 0, points: 0 };
    idea.games += 1;
    idea.points += Math.max(0, Number(result.points) || 0);
    byIdea[ideaId] = idea;
    totalParticipants += Math.max(0, Number(result.participants) || 0);
    totalPoints += Math.max(0, Number(result.points) || 0);
  }
  for (const game of Object.values(byGame)) game.averageDurationMs = game.games > 0 ? Math.round(game.averageDurationMs / game.games) : 0;
  return { totalGames: results.length, totalParticipants, totalPoints, averageDurationMs: durationCount ? Math.round(totalDuration / durationCount) : 0, byGame, byIdea };
}

export function buildGameShareText(result: { gameType: string; winnerName?: string; points?: number; correctAnswers?: number; durationMs?: number }): string {
  const duration = Math.max(0, Math.round((result.durationMs || 0) / 1000));
  return `بسلاسة — نتيجة ${result.gameType}\nالفائز: ${result.winnerName || "الفصل"}\nالنقاط: ${result.points || 0}\nالإجابات الصحيحة: ${result.correctAnswers || 0}\nالمدة: ${duration} ثانية`;
}

export interface SpectatorSnapshot {
  version: 1;
  createdAt: string;
  lessonId?: string | null;
  currentIdeaId?: string | null;
  currentStep: number;
  students: Array<{ id: string; name: string; points: number; status?: string }>;
  game?: { type: string; questionIndex?: number; totalQuestions?: number };
}

export function buildSpectatorSnapshot(input: Omit<SpectatorSnapshot, "version" | "createdAt">): SpectatorSnapshot {
  return { version: 1, createdAt: new Date().toISOString(), ...input, students: input.students.map((student) => ({ id: student.id, name: student.name, points: student.points, status: student.status })) };
}
