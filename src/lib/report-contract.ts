export type ReportIdeaMetric = {
  ideaKey: string;
  total: number;
  answered: number;
  unanswered: number;
  correct: number;
  wrong: number;
  points: number;
  accuracyPct: number | null;
  completionPct: number;
};

export type ReportActivityMetric = {
  type: string;
  count: number;
  pointsDelta: number;
};

export type ReportRecentEvent = {
  source: "activity" | "celebration" | "note" | "game";
  type: string;
  label: string;
  points: number;
  createdAt: string;
  ideaKey?: string | null;
  shared?: boolean;
};

export type ReportHomeworkSnapshot = {
  id: string;
  homeworkMapId: string;
  status: string;
  totalQuestions: number;
  answeredQuestions: number;
  unansweredQuestions: number;
  correctQuestions: number;
  wrongQuestions: number;
  completionPct: number;
  successOnAnsweredPct: number | null;
  successOnTotalPct: number | null;
  moodleGrade: number | null;
  moodleMaxGrade: number | null;
  submittedAt: string | null;
  dueAt: string | null;
  sourceUpdatedAt: string | null;
  updatedAt: string;
};

export type ReportFairness = {
  picks: number;
  manualPicks: number;
  automaticPicks: number;
  byIdea: Array<{ ideaKey: string; picks: number; manualPicks: number; sources: Array<{ source: string; count: number }> }>;
};

export type ReportSourceQuality = {
  source: "local" | "moodle" | "live-app" | "games" | "teacher";
  status: "ok" | "missing" | "stale" | "not-linked";
  label: string;
  detail: string;
};

export type StudentReportAggregate = {
  generatedAt: string;
  scope: { sessionId: string | null; classId: string | null; moodleIndependentHomework: boolean };
  student: {
    id: string;
    name: string;
    classId: string | null;
    moodleUserId: number | null;
    moodleUsername: string | null;
    points: number;
    correctAnswers: number;
    wrongAnswers: number;
    attempts: number;
    accuracyPct: number;
    title: string | null;
    isAbsent: boolean;
  };
  session: { count: number; id: string | null; name: string | null; startedAt: string | null };
  local: { points: number; correct: number; wrong: number; attempts: number; accuracyPct: number };
  interactive: { total: number; answered: number; unanswered: number; correct: number; wrong: number; points: number; accuracyPct: number | null; byIdea: ReportIdeaMetric[]; teacherInteractions: number };
  homework: { latest: ReportHomeworkSnapshot | null; historyCount: number; byIdea: ReportIdeaMetric[] };
  games: { gameCount: number; points: number; correct: number; wrong: number; questions: number; byIdea: ReportIdeaMetric[] };
  activities: { total: number; points: number; byType: ReportActivityMetric[]; recent: ReportRecentEvent[] };
  fairness: ReportFairness;
  celebrations: { total: number; byType: Array<{ label: string; icon: string; count: number }> };
  notes: { total: number; shared: number; recent: Array<{ text: string; createdAt: string; isShared: boolean }> };
  quality: ReportSourceQuality[];
};

export type ClassReportRow = StudentReportAggregate & {
  rank: number;
};

export type ClassReportAggregate = {
  generatedAt: string;
  scope: { classId: string | null; sessionId: string | null; className: string };
  rows: ClassReportRow[];
  totals: {
    students: number;
    localPoints: number;
    localCorrect: number;
    localWrong: number;
    interactiveAnswered: number;
    interactiveCorrect: number;
    homeworkGradeCount: number;
    gamePoints: number;
  };
};
