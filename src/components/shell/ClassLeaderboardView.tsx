"use client";

import { useState, useEffect } from "react";
import { useShellStore } from "@/lib/shell-store";
import { localDb } from "@/lib/local-db";
import { type StudentPerClass } from "@/lib/data-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Trophy, Crown, Medal, Star, Edit, Save, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ClassLeaderboardView v6.3 - لوحة متصدرين الفصل داخل الكانفاس
 * - تقرأ طلاب الصف النشط مباشرة من الـ store (SQLite هو مصدر الحقيقة، ويُزامَن عبر db-sync)
 * - تعرضهم مرتبين بالنقاط (REAL points, not 0)
 * - أزرار +1/+3/+5 للطالب المختار
 * - تعديل الألقاب لكل طالب
 */
export function ClassLeaderboardView({ onClose }: { onClose: () => void }) {
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // ===== Session vs Lifetime tabs (MUST be declared before any early return — Rules of Hooks) =====
  const [activeTab, setActiveTab] = useState<"session" | "lifetime">("session");
  // C57 (P1 fix): fetch real session deltas from SQLite snapshots.
  // Previously the "session" tab just returned the same students unchanged —
  // showing lifetime points labeled as "today". Now we fetch deltas for all
  // students in the active class and map them.
  const [sessionDeltas, setSessionDeltas] = useState<Record<string, { points: number; correct: number; wrong: number; attempts: number }>>({});

  const activeClassId = useShellStore((s) => s.activeClassId);
  // ===== SINGLE SOURCE: read directly from store (no async, no copy) =====
  const storeStudents = useShellStore((s) => s.students);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const awardPoints = useShellStore((s) => s.awardPoints);
  const setStudentTitle = useShellStore((s) => s.setStudentTitle);
  const requestConfirm = useShellStore((s) => s.requestConfirm);
  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);

  // C57: fetch session deltas for all students when the session changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sessionId = useShellStore.getState().currentSessionId;
      if (!sessionId) {
        setSessionDeltas({});
        return;
      }
      try {
        const snapshots = await localDb.sessions.snapshotStudents(sessionId);
        if (cancelled) return;
        // Build a map of studentId → delta
        const deltas: Record<string, { points: number; correct: number; wrong: number; attempts: number }> = {};
        for (const snap of snapshots) {
          const student = storeStudents.find((s) => s.id === snap.studentId);
          if (student) {
            deltas[snap.studentId] = {
              points: student.points - snap.pointsStart,
              correct: student.correctAnswers - snap.correctStart,
              wrong: student.wrongAnswers - snap.wrongStart,
              attempts: student.attempts - snap.attemptsStart,
            };
          }
        }
        if (!cancelled) setSessionDeltas(deltas);
      } catch (e) {
        console.warn("[Leaderboard] session delta fetch failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [currentSessionId, storeStudents]);

  // Compute students list DIRECTLY from store (real-time, no async)
  const students: any[] = storeStudents.map((s) => ({
    studentId: s.id,
    name: s.name,
    points: s.points,
    correctAnswers: s.correctAnswers,
    wrongAnswers: s.wrongAnswers,
    attempts: s.attempts,
    badges: s.badges || [],
    title: s.title,
    isAbsent: s.isAbsent,
    calledInSession: s.calledInSession,
  })).sort((a, b) => b.points - a.points);

  const award = (student: any, points: number) => {
    // Update store (which syncs to SQLite via db-sync)
    awardPoints(student.studentId, points);
    setSelectedId(student.studentId);
    playSound(points > 0 ? "celebrate-coin-drop" : "celebrate-buzz");
    if (points >= 5) triggerConfetti();
  };

  const saveTitle = (student: StudentPerClass) => {
    // setStudentTitle updates the reactive store immediately and syncs
    // to the DB in the background — no manual refresh needed.
    setStudentTitle(student.studentId, titleDraft.trim() || null);
    setEditingTitleId(null);
    setTitleDraft("");
    playSound("celebrate-stamp");
  };

  const resetAll = async () => {
    if (!activeClassId) return;
    if (!(await requestConfirm("تصفير نقاط كل الطلاب؟", { danger: true }))) return;
    await import("@/lib/data-store").then((m) => m.resetClassPoints(activeClassId));
    // resetClassPoints only writes to SQLite — reflect the reset in the
    // reactive store immediately so the leaderboard doesn't show stale points.
    useShellStore.setState((s) => ({
      students: s.students.map((st) => ({
        ...st, points: 0, correctAnswers: 0, wrongAnswers: 0, attempts: 0, badges: [],
      })),
    }));
    playSound("click");
  };

  const width = 500;

  if (storeStudents.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900 p-6">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-white/30 mx-auto mb-2" />
          <p className="text-white/60 mb-4">لا يوجد طلاب — أضف طلاباً أو فعّل صفاً</p>
          <Button onClick={onClose} className="bg-[#0142A0] hover:bg-[#0142A0]/80">
            حسناً
          </Button>
        </div>
      </div>
    );
  }

  const top3 = students.slice(0, 3);
  const rest = students.slice(3);

  // C57: For session view, use REAL deltas from sessionDeltas map.
  // For lifetime view, use the original students array unchanged.
  const displayStudents = activeTab === "lifetime"
    ? students
    : students.map((s) => {
        const delta = sessionDeltas[s.studentId];
        if (delta) {
          return {
            ...s,
            points: delta.points,
            correctAnswers: delta.correct,
            wrongAnswers: delta.wrong,
            attempts: delta.attempts,
          };
        }
        // No snapshot for this student → session points = 0
        return { ...s, points: 0, correctAnswers: 0, wrongAnswers: 0, attempts: 0 };
      });

  const displayTop3 = displayStudents.slice(0, 3);
  const displayRest = displayStudents.slice(3);

  return (
    <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950 overflow-y-auto">
      <div className="flex flex-col h-full">
        {/* Tab switcher: Session vs Lifetime */}
        <div className="p-2 flex gap-1 shrink-0">
          <button
            onClick={() => setActiveTab("session")}
            className={cn(
              "flex-1 h-8 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1",
              activeTab === "session"
                ? "bg-[#FFD700] text-black"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
            ⏰ الجلسة الحالية
          </button>
          <button
            onClick={() => setActiveTab("lifetime")}
            className={cn(
              "flex-1 h-8 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1",
              activeTab === "lifetime"
                ? "bg-[#FFD700] text-black"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
            ∞ مدى الحياة
          </button>
        </div>

        {/* Top 3 podium */}
        {displayTop3.length > 0 && (
          <div className="p-3 bg-gradient-to-b from-[#FFD700]/10 to-transparent">
            <div className="flex items-end justify-center gap-2">
              {displayTop3[1] && <PodiumCard student={displayTop3[1]} rank={2} />}
              {displayTop3[0] && <PodiumCard student={displayTop3[0]} rank={1} />}
              {displayTop3[2] && <PodiumCard student={displayTop3[2]} rank={3} />}
            </div>
          </div>
        )}

        {/* Reset button */}
        <div className="px-3 pb-2 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={resetAll}
            className="text-white/60 hover:text-white h-7 text-[10px]"
            title="تصفير الكل"
          >
            <RotateCcw className="w-3 h-3 ml-1" /> تصفير
          </Button>
        </div>

        {/* Rest of students */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
          {displayRest.map((s, i) => (
            <div
              key={s.studentId}
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-lg transition cursor-pointer",
                selectedId === s.studentId ? "bg-[#0142A0]/40" : "bg-white/5 hover:bg-white/10"
              )}
              onClick={() => setSelectedId(s.studentId)}
            >
              <div className="w-6 text-center text-white/40 font-bold">{i + 4}</div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold truncate text-sm flex items-center gap-1">
                  {s.name}
                  {/* Show "تم استدعاؤه" if this student was called in the current session */}
                  {(s as any).calledInSession && (
                    <span className="bg-emerald-500/20 text-emerald-400 text-[8px] px-1.5 py-0.5 rounded-full font-bold" title="تم استدعاؤه في هذه الجلسة">
                      ✓ تم استدعاؤه
                    </span>
                  )}
                  {/* Activity count badge */}
                  {(() => {
                    const badgeCount = Array.isArray(s.badges) ? s.badges.length : 0;
                    return badgeCount > 0 ? (
                      <span className="bg-[#FFD700]/20 text-[#FFD700] text-[9px] px-1.5 py-0.5 rounded-full font-bold" title={`${badgeCount} نشاط`}>
                        {badgeCount} نشاط
                      </span>
                    ) : null;
                  })()}
                </div>
                {s.title && (
                  <div className="text-[10px] text-[#FFD700]">⭐ {s.title}</div>
                )}
              </div>
              <div className="text-[#FFD700] font-bold text-sm">{s.points}</div>
              {selectedId === s.studentId && (
                <div className="flex gap-1 ml-1">
                  <Button size="sm" onClick={() => award(s, 1)} className="h-6 px-2 bg-[#10b981]/30 text-green-300 text-xs">+1</Button>
                  <Button size="sm" onClick={() => award(s, 3)} className="h-6 px-2 bg-[#0142A0]/30 text-blue-300 text-xs">+3</Button>
                  <Button size="sm" onClick={() => award(s, 5)} className="h-6 px-2 bg-[#f59e0b]/30 text-amber-300 text-xs">+5</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTitleId(s.studentId);
                      setTitleDraft(s.title || "");
                    }}
                    className="h-6 w-6 p-0 text-white/60"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {students.length === 0 && (
            <div className="text-center text-white/40 py-8">
              <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>لا يوجد طلاب في هذا الصف</p>
            </div>
          )}
        </div>

        {/* Edit title modal */}
        {editingTitleId && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-10" onClick={() => { setEditingTitleId(null); setTitleDraft(""); }}>
            <div className="bg-zinc-900 rounded-xl border border-white/10 p-4 w-full max-w-xs space-y-3" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-white font-bold text-sm">تعديل اللقب</h3>
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder="مثال: عبقري الرياضيات"
                className="bg-white/5 border-white/10 text-white text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => saveTitle(students.find((s) => s.studentId === editingTitleId)!)}
                  className="flex-1 bg-[#10b981] hover:bg-[#10b981]/80 h-8 text-xs"
                >
                  <Save className="w-3 h-3 ml-1" /> حفظ
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingTitleId(null);
                    setTitleDraft("");
                  }}
                  className="text-white/60 h-8 text-xs"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PodiumCard({ student, rank }: { student: StudentPerClass; rank: number }) {
  const configs = {
    1: { height: "h-28", color: "from-[#FFD700] to-[#f59e0b]", icon: Crown, rank_label: "أول" },
    2: { height: "h-24", color: "from-[#9ca3af] to-[#6b7280]", icon: Medal, rank_label: "ثاني" },
    3: { height: "h-20", color: "from-[#cd7f32] to-[#92400e]", icon: Star, rank_label: "ثالث" },
  };
  const config = configs[rank as 1 | 2 | 3];

  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center" style={{ flex: 1 }}>
      <div className="text-center mb-1">
        <div className="text-white font-bold text-sm truncate max-w-[80px]">{student.name}</div>
        {student.title && (
          <div className="text-xs text-[#FFD700] truncate max-w-[80px]">⭐ {student.title}</div>
        )}
      </div>
      <div
        className={cn(
          "w-full rounded-t-xl bg-gradient-to-b flex flex-col items-center justify-start pt-2",
          config.color,
          config.height
        )}
      >
        <Icon className="w-6 h-6 text-white mb-1" />
        <div className="text-white font-bold text-2xl">{student.points}</div>
        <div className="text-white/70 text-xs">{config.rank_label}</div>
      </div>
    </div>
  );
}
