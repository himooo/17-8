"use client";

import { useState, useEffect, useDeferredValue } from "react";
import Image from "next/image";
import { useShellStore } from "@/lib/shell-store";
import { Button } from "@/components/ui/button";
import { X, Trophy, Star, Award, Heart, Medal, Crown, Gift, Search, Check, Zap, Sparkles, Clock, Infinity as InfinityIcon, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { localDb } from "@/lib/local-db";
import { getStudentGifts } from "@/lib/data-store";
import { GameOverlay } from "./GameOverlay";
import { StudentDNACard } from "./StudentDNA";

/**
 * StudentCard v7.5 — ALL data from SQLite (single source).
 *
 * - Points/Correct/Wrong/Badges: read from Zustand store (which is hydrated
 *   from SQLite on boot and kept in sync by db-sync on every award).
 *   The store is the real-time cache of SQLite.
 *
 * - Gifts: read DIRECTLY from SQLite via getStudentGifts().
 *   This ensures gifts awarded from ANY source (BottomControlBar,
 *   StudentsPanel, games) appear immediately.
 *
 * - Session tab: gifts filtered by awardedAt >= session.startedAt
 * - Lifetime tab: ALL gifts from SQLite
 */
export function StudentCard({ onClose, studentId }: { onClose: () => void; studentId?: string }) {
  const [selectedStudent, setSelectedStudent] = useState<string | null>(studentId || null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filterType, setFilterType] = useState<"all" | "called" | "uncalled">("all");
  const [activeTab, setActiveTab] = useState<"session" | "lifetime" | "dna">("session");

  // ===== Data from store (real-time cache of SQLite) =====
  const storeStudents = useShellStore((s) => s.students);
  const playSound = useShellStore((s) => s.playSound);

  // ===== Gifts from SQLite (direct read) =====
  const [allGifts, setAllGifts] = useState<{ giftName: string; giftImage: string; awardedAt: string }[]>([]);
  const [sessionGifts, setSessionGifts] = useState<{ giftName: string; giftImage: string }[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);

  const currentStudent = storeStudents.find((s) => s.id === selectedStudent);

  // ===== Load gifts from SQLite whenever student or store changes =====
  // storeStudents is in the dependency array because when BottomControlBar
  // awards a gift, it updates the store → this effect re-runs → re-reads SQLite
  useEffect(() => {
    if (!selectedStudent) {
      // Defer the clear via a microtask so we don't call setState synchronously
      // in the effect body (which React 19's strict compiler flags as cascading).
      // The actual clear is no-op safe because the values are already empty
      // when selectedStudent is null on first mount.
      queueMicrotask(() => {
        setAllGifts([]);
        setSessionGifts([]);
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // 1. Get ALL gifts from SQLite
        const gifts = await getStudentGifts(selectedStudent);
        if (cancelled) return;
        const mapped = gifts.map((g) => ({
          giftName: g.giftName,
          giftImage: g.giftImage,
          awardedAt: g.awardedAt,
        }));
        setAllGifts(mapped);

        // 2. Get session start time
        const sessions = await localDb.sessions.list();
        const latestActive = sessions.find((s) => !s.endedAt) || sessions[0];
        if (latestActive) {
          setSessionStartTime(latestActive.startedAt);
          // Filter gifts awarded after session start
          setSessionGifts(mapped.filter((g) => g.awardedAt >= latestActive.startedAt));
        } else {
          setSessionStartTime(null);
          // No session = all gifts are "session" (fresh start)
          setSessionGifts(mapped);
        }
      } catch (err) {
        console.error("[StudentCard] failed to load gifts:", err);
        if (!cancelled) { setAllGifts([]); setSessionGifts([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedStudent, storeStudents]);

  // ===== Session delta from SQLite =====
  // C55 (P1 fix): session delta must reflect ONLY this session's gains.
  // Previously, when no snapshot existed (delta=null), the code fell back to
  // LIFETIME values (s.points, s.correctAnswers) — making the "session" tab
  // show identical numbers to "lifetime". Now: if no snapshot, show 0 (the
  // session started fresh or the snapshot wasn't taken). If snapshot exists,
  // compute delta = current - snapshotStart.
  const [sessionDelta, setSessionDelta] = useState<{ points: number; correct: number; wrong: number; attempts: number } | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState(false);

  useEffect(() => {
    if (!selectedStudent) {
      queueMicrotask(() => { setSessionDelta(null); setHasSnapshot(false); });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Use the CURRENT session from the store (not the latest from DB list,
        // which might be a different session if multiple tabs are open).
        const currentSessionId = useShellStore.getState().currentSessionId;
        let sessionId = currentSessionId;
        if (!sessionId) {
          // Fallback: find latest active session from DB
          const sessions = await localDb.sessions.list();
          const latestActive = sessions.find((s) => !s.endedAt) || sessions[0];
          sessionId = latestActive?.id;
        }
        if (!sessionId) {
          // No session at all → session stats = 0 (nothing happened yet)
          if (!cancelled) { setSessionDelta({ points: 0, correct: 0, wrong: 0, attempts: 0 }); setHasSnapshot(false); }
          return;
        }
        const delta = await localDb.sessions.getStudentDelta(sessionId, selectedStudent);
        if (!cancelled) {
          if (delta) {
            // Snapshot exists → real delta
            setSessionDelta(delta.delta);
            setHasSnapshot(true);
          } else {
            // No snapshot for this student in this session → session stats = 0
            // (the student hadn't been snapshotted when the session started,
            // or was added after session start). Show 0, NOT lifetime.
            setSessionDelta({ points: 0, correct: 0, wrong: 0, attempts: 0 });
            setHasSnapshot(false);
          }
        }
      } catch { if (!cancelled) { setSessionDelta({ points: 0, correct: 0, wrong: 0, attempts: 0 }); setHasSnapshot(false); } }
    })();
    return () => { cancelled = true; };
  }, [selectedStudent, storeStudents]);

  // ===== Celebration counts from DB =====
  const [celebrationCount, setCelebrationCount] = useState(0);
  const [sessionCelebrationCount, setSessionCelebrationCount] = useState(0);

  useEffect(() => {
    if (!selectedStudent) {
      queueMicrotask(() => {
        setCelebrationCount(0);
        setSessionCelebrationCount(0);
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // مدى الحياة
        const allEvents = await localDb.celebrationEvents.listByStudent(selectedStudent);
        if (!cancelled) setCelebrationCount(allEvents.length);
        // الجلسة الحالية
        const sessionId = useShellStore.getState().currentSessionId;
        if (sessionId) {
          const sessionEvents = await localDb.celebrationEvents.listByStudent(selectedStudent, sessionId);
          if (!cancelled) setSessionCelebrationCount(sessionEvents.length);
        } else {
          if (!cancelled) setSessionCelebrationCount(allEvents.length);
        }
      } catch (e) {
        console.warn("[StudentCard] celebration load error:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedStudent, storeStudents]);

  const BADGE_ICONS: Record<string, { icon: typeof Trophy; color: string; label: string }> = {
    correct: { icon: Check, color: "#10b981", label: "إجابة صحيحة" },
    wrong: { icon: X, color: "#ef4444", label: "إجابة خاطئة" },
    star: { icon: Star, color: "#FFD700", label: "نجمة" },
    fast: { icon: Zap, color: "#06b6d4", label: "سريع" },
    creative: { icon: Sparkles, color: "#a855f7", label: "مبدع" },
    helper: { icon: Heart, color: "#ec4899", label: "مساعد" },
    "good-try": { icon: Award, color: "#f59e0b", label: "محاولة جيدة" },
  };

  function accuracy(correct: number, attempts: number) {
    if (attempts === 0) return 0;
    return Math.round((correct / attempts) * 100);
  }

  // ===== Gifts to display based on active tab =====
  const giftsToShow = activeTab === "lifetime" ? allGifts : sessionGifts;

  // ===== Group gifts with count =====
  const groupedGifts = giftsToShow.reduce((acc, g) => {
    if (!acc[g.giftName]) acc[g.giftName] = { ...g, count: 0 };
    acc[g.giftName].count++;
    return acc;
  }, {} as Record<string, any>);

  return (
    <GameOverlay open onClose={onClose} title="🏆 كارت الطالب" accentColor="#FFD700" widthPercent={85} heightPercent={88}>
      <div className="p-4">
        <div className="flex justify-center mb-4">
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <circle cx="11.5" cy="11" r="2" fill="#DA151C" />
            <circle cx="20.5" cy="11" r="2" fill="#DA151C" />
            <path d="M7 16 Q16 25 25 16" stroke="#0142A0" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        {!selectedStudent ? (
          <div className="space-y-2">
            <div className="relative mb-2">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ابحث عن طالب..." className="bg-white/5 border-white/10 text-white text-xs h-8 pr-7" />
            </div>
            <div className="flex gap-1 mb-2">
              {[{ id: "all" as const, label: "الكل" }, { id: "called" as const, label: "تم سؤالهم" }, { id: "uncalled" as const, label: "لم يُسألوا" }].map((f) => (
                <button key={f.id} onClick={() => setFilterType(f.id)} className={cn("flex-1 h-6 rounded text-[10px] font-bold transition", filterType === f.id ? "bg-[#FFD700] text-black" : "bg-white/5 text-white/60")}>{f.label}</button>
              ))}
            </div>
            <div className="text-xs text-white/60 mb-2">اختر طالباً لعرض كارته</div>
            {storeStudents.length === 0 && <div className="text-center text-white/40 py-8">لا يوجد طلاب</div>}
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {storeStudents.filter((s) => {
                if (deferredSearchQuery && !s.name.includes(deferredSearchQuery)) return false;
                if (filterType === "called" && !s.calledInSession) return false;
                if (filterType === "uncalled" && s.calledInSession) return false;
                return true;
              }).map((s) => (
                <button key={s.id} onClick={() => { setSelectedStudent(s.id); playSound("click"); }} className="bg-white/5 hover:bg-white/10 rounded-lg p-3 text-center transition">
                  <div className="text-white font-bold text-sm">{s.name}</div>
                  <div className="text-xs text-[#FFD700]">{s.points} نقطة</div>
                  {s.calledInSession && <div className="text-[9px] text-[#10b981] mt-0.5">✓ تم سؤاله</div>}
                </button>
              ))}
            </div>
          </div>
        ) : currentStudent ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0142A0]/30 to-[#DA151C]/30 rounded-2xl p-4 text-center border-2 border-[#FFD700]/30">
              <div className="text-2xl font-bold text-white">{currentStudent.name}</div>

              {/* Tab switcher */}
              <div className="flex gap-1 mt-3 mb-2">
                <button onClick={() => setActiveTab("session")} className={cn("flex-1 h-8 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1", activeTab === "session" ? "bg-[#FFD700] text-black" : "bg-white/5 text-white/60")}>
                  <Clock className="w-3 h-3" /> الجلسة الحالية
                </button>
                <button onClick={() => setActiveTab("lifetime")} className={cn("flex-1 h-8 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1", activeTab === "lifetime" ? "bg-[#FFD700] text-black" : "bg-white/5 text-white/60")}>
                  <InfinityIcon className="w-3 h-3" /> مدى الحياة
                </button>
                <button onClick={() => setActiveTab("dna")} className={cn("flex-1 h-8 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1", activeTab === "dna" ? "bg-[#FFD700] text-black" : "bg-white/5 text-white/60")}>
                  <span className="text-xs">🧬</span> DNA
                </button>
              </div>

              {/* Stats */}
              {activeTab !== "dna" && (activeTab === "session" ? (
                <div>
                  <div className="flex justify-center gap-3 mt-2">
                    <div className="text-center"><div className="text-2xl font-bold text-[#FFD700]">+{sessionDelta?.points || 0}</div><div className="text-xs text-white/40">نقطة اليوم</div></div>
                    <div className="text-center"><div className="text-2xl font-bold text-[#10b981]">+{sessionDelta?.correct || 0}</div><div className="text-xs text-white/40">صحيح</div></div>
                    <div className="text-center"><div className="text-2xl font-bold text-[#ef4444]">+{sessionDelta?.wrong || 0}</div><div className="text-xs text-white/40">خطأ</div></div>
                  </div>
                  <div className="mt-2 inline-block bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    دقة اليوم: {accuracy(sessionDelta?.correct || 0, sessionDelta?.attempts || 0)}%
                  </div>
                </div>
              ) : (
                <div className="flex justify-center gap-4 mt-3">
                  <div className="text-center"><div className="text-2xl font-bold text-[#FFD700]">{currentStudent.points}</div><div className="text-xs text-white/40">نقطة</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-[#10b981]">{currentStudent.correctAnswers}</div><div className="text-xs text-white/40">صحيح</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-[#ef4444]">{currentStudent.wrongAnswers}</div><div className="text-xs text-white/40">خطأ</div></div>
                </div>
              ))}
            </div>

            {/* Student DNA */}
            {activeTab === "dna" && selectedStudent && (
              <StudentDNACard studentId={selectedStudent} />
            )}

            {/* ===== الإحصائيات المجمّعة — عرض مكثف وجميل ===== */}
            {activeTab !== "dna" && activeTab === "lifetime" && (
              <div className="grid grid-cols-3 gap-2">
                {/* عدد الشارات */}
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-700/10 rounded-xl p-3 text-center border border-purple-500/20">
                  <Medal className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                  <div className="text-xl font-black text-purple-300">{currentStudent.badges?.length || 0}</div>
                  <div className="text-[9px] text-white/50">شارة</div>
                </div>
                {/* عدد الهدايا */}
                <div className="bg-gradient-to-br from-pink-500/20 to-pink-700/10 rounded-xl p-3 text-center border border-pink-500/20">
                  <Gift className="w-5 h-5 mx-auto mb-1 text-pink-400" />
                  <div className="text-xl font-black text-pink-300">{allGifts.length}</div>
                  <div className="text-[9px] text-white/50">هدية</div>
                </div>
                {/* عدد الاحتفالات */}
                <div className="bg-gradient-to-br from-amber-500/20 to-amber-700/10 rounded-xl p-3 text-center border border-amber-500/20">
                  <PartyPopper className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                  <div className="text-xl font-black text-amber-300">
                    {celebrationCount}
                  </div>
                  <div className="text-[9px] text-white/50">احتفال</div>
                </div>
              </div>
            )}
            {/* نفس الإحصائيات للجلسة الحالية */}
            {activeTab !== "dna" && activeTab === "session" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-700/10 rounded-xl p-3 text-center border border-purple-500/20">
                  <Medal className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                  <div className="text-xl font-black text-purple-300">{(sessionDelta?.correct || 0) + (sessionDelta?.wrong || 0)}</div>
                  <div className="text-[9px] text-white/50">شارة</div>
                </div>
                <div className="bg-gradient-to-br from-pink-500/20 to-pink-700/10 rounded-xl p-3 text-center border border-pink-500/20">
                  <Gift className="w-5 h-5 mx-auto mb-1 text-pink-400" />
                  <div className="text-xl font-black text-pink-300">{sessionGifts.length}</div>
                  <div className="text-[9px] text-white/50">هدية</div>
                </div>
                <div className="bg-gradient-to-br from-amber-500/20 to-amber-700/10 rounded-xl p-3 text-center border border-amber-500/20">
                  <PartyPopper className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                  <div className="text-xl font-black text-amber-300">{sessionCelebrationCount}</div>
                  <div className="text-[9px] text-white/50">احتفال</div>
                </div>
              </div>
            )}

            {/* Badges */}
            {activeTab !== "dna" && (
            <div>
              <div className="text-xs text-white/60 mb-2 flex items-center gap-1">
                <Medal className="w-3 h-3" />
                {activeTab === "session" ? "شارات الجلسة" : "كل الشارات"}
                ({activeTab === "lifetime" ? (currentStudent.badges?.length || 0) : (sessionDelta?.correct || 0) + (sessionDelta?.wrong || 0)})
              </div>
              {activeTab === "lifetime" && (currentStudent.badges?.length || 0) > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {currentStudent.badges.map((badge: any, i: number) => {
                    const config = BADGE_ICONS[badge.type] || BADGE_ICONS.star;
                    const Icon = config.icon;
                    return (
                      <div key={i} className="flex flex-col items-center bg-white/5 rounded-lg p-2 w-16">
                        <Icon className="w-6 h-6" style={{ color: config.color }} />
                        <span className="text-[9px] text-white/60 mt-1 text-center">{badge.note || config.label}</span>
                      </div>
                    );
                  })}
                </div>
              ) : activeTab === "session" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
                    <Check className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-emerald-400">+{sessionDelta?.correct || 0}</div>
                    <div className="text-[9px] text-white/60">صحيحة اليوم</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
                    <X className="w-5 h-5 text-red-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-red-400">+{sessionDelta?.wrong || 0}</div>
                    <div className="text-[9px] text-white/60">خاطئة اليوم</div>
                  </div>
                </div>
              ) : <div className="text-xs text-white/40">لا توجد شارات بعد</div>}
            </div>
            )}

            {/* Gifts — from SQLite (both tabs) */}
            {activeTab !== "dna" && (
            <div>
              <div className="text-xs text-white/60 mb-2 flex items-center gap-1">
                <Gift className="w-3 h-3" />
                {activeTab === "session" ? "هدايا الجلسة" : "كل الهدايا"}
                ({giftsToShow.length})
              </div>
              {giftsToShow.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.values(groupedGifts).map((g: any, i) => (
                    <div key={i} className="flex flex-col items-center bg-white/5 rounded-lg p-2 w-16 relative">
                      <Image src={g.giftImage} alt={g.giftName} width={40} height={40} sizes="40px" className="w-10 h-10 object-cover rounded" unoptimized />
                      <span className="text-[9px] text-white/60 mt-1 text-center truncate w-full">{g.giftName}</span>
                      {g.count > 1 && <span className="absolute -top-1 -left-1 bg-pink-500 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{g.count}</span>}
                    </div>
                  ))}
                </div>
              ) : <div className="text-xs text-white/40">لا توجد هدايا</div>}
            </div>
            )}

            <Button onClick={() => { setSelectedStudent(null); setAllGifts([]); setSessionGifts([]); setSessionDelta(null); }} className="w-full bg-[#0142A0] hover:bg-[#0142A0]/80">رجوع للقائمة</Button>
          </div>
        ) : null}
      </div>
    </GameOverlay>
  );
}
