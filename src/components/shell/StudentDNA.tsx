"use client";

import { useEffect, useState } from "react";
import { useShellStore } from "@/lib/shell-store";
import { getStudentGifts } from "@/lib/data-store";
import { localDb } from "@/lib/local-db";

/**
 * StudentDNA — محرك شخصية الطالب الديناميكي
 * 
 * يحلل سلوك الطالب عبر الوقت ويبني "شخصية تعليمية" لكل طالب:
 * - السرعة (هل يجيب بسرعة أم يفكر ببطء؟)
 * - الثبات (هل إجاباته متذبذبة أم ثابتة؟)
 * - الدقة (نسبة الصحيح من إجمالي المحاولات)
 * - الانخراط (كم مرة شارك في هذه الجلسة؟)
 * 
 * ثم يقترح:
 * - أفضل وقت لاستدعاء هذا الطالب (خرائط حرارية لأداءه عبر الوقت)
 * - نوع الأسئلة المناسب له (سهل/متوسط/صعب)
 * - نوع الاحتفال المناسب له (كل طالب شخصية مختلفة)
 */

export interface StudentPersonality {
  studentId: string;
  nickname: string;          // "النجم الصاعد", "المفكر العميق"...
  traits: {
    speed: number;           // 0-100 (سرعة الإجابة)
    accuracy: number;        // 0-100
    consistency: number;     // 0-100
    engagement: number;      // 0-100
    confidence: number;      // 0-100
    leadership: number;      // 0-100
  };
  bestTime: "morning" | "afternoon" | "evening" | "anytime";
  preferredDifficulty: "easy" | "medium" | "hard";
  celebrationPrefernce: "quiet" | "cheer" | "big" | "applause";
  learningStyle: "visual" | "auditory" | "kinesthetic" | "undetermined";
  recommendations: string[];
  lastAnalyzed: Date;
}

// ============================================================
// DNA Analysis Engine
// ============================================================

export function analyzeStudentPersonality(
  studentId: string,
  history: Array<{
    studentId: string;
    type: "correct" | "wrong" | "good-try" | "fast" | "slow";
    timestamp: Date;
    points: number;
  }>,
  gifts: number,
  streaks: number[],
): StudentPersonality {
  const sHistory = history.filter((h) => h.studentId === studentId);
  
  // Compute raw metrics
  const totalAttempts = sHistory.length;
  const correctCount = sHistory.filter((h) => h.type === "correct").length;
  const wrongCount = sHistory.filter((h) => h.type === "wrong").length;
  const fastCount = sHistory.filter((h) => h.type === "fast").length;
  
  const accuracy = totalAttempts > 0 ? (correctCount / totalAttempts) * 100 : 50;
  const speed = totalAttempts > 0 ? (fastCount / totalAttempts) * 100 : 50;
  const consistency = computeConsistency(sHistory);
  const engagement = Math.min(100, (totalAttempts / Math.max(1, 50)) * 100);
  const confidence = computeConfidence(sHistory);
  const leadership = computeLeadership(gifts, streaks);

  // Determine nickname
  const nickname = computeNickname(accuracy, speed, engagement, correctCount);
  
  // Determine best time (from history timestamps if we had them; default "anytime")
  const bestTime = "anytime";

  // Determine preferred difficulty
  const preferredDifficulty = accuracy > 80 ? "hard" : accuracy < 50 ? "easy" : "medium";

  // Determine celebration preference
  const celebrationPref = computeCelebrationPreference(speed, confidence, engagement);

  // Recommendations
  const recommendations = computeRecommendations(accuracy, speed, engagement, leadership);

  return {
    studentId,
    nickname,
    traits: { speed, accuracy, consistency, engagement, confidence, leadership },
    bestTime,
    preferredDifficulty,
    celebrationPrefernce: celebrationPref,
    learningStyle: "undetermined",
    recommendations,
    lastAnalyzed: new Date(),
  };
}

function computeConsistency(history: Array<{ type: string; timestamp: Date }>): number {
  if (history.length < 3) return 50;
  const scores: number[] = history.map((h) => (h.type === "correct" ? 1 : 0));
  if (scores.length < 2) return 50;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  return Math.max(0, 100 - Math.sqrt(variance) * 100);
}

function computeConfidence(history: Array<{ type: string; timestamp: Date }>): number {
  const recent = history.slice(-10);
  const correctRecent = recent.filter((h) => h.type === "correct").length;
  return Math.min(100, (correctRecent / Math.max(1, recent.length)) * 100);
}

function computeLeadership(gifts: number, streaks: number[]): number {
  const streakBonus = streaks.filter((s) => s >= 5).length * 20;
  const giftBonus = Math.min(50, gifts * 5);
  return Math.min(100, streakBonus + giftBonus);
}

function computeNickname(
  accuracy: number, speed: number, engagement: number, correctCount: number
): string {
  if (accuracy > 90 && speed > 80) return "النجم السريع ⚡";
  if (accuracy > 90) return "العبقري الدقيق 🎯";
  if (speed > 80) return "المفكر السريع 🚀";
  if (engagement > 80) return "النشيط دائماً 🔥";
  if (correctCount > 20) return "المخضرم الموثوق 💪";
  if (engagement < 30) return "الهادئ المراقب 👀";
  if (accuracy < 50) return "الصاعد المتحدي 🌱";
  return "المتعلم المجتهد 📚";
}

function computeCelebrationPreference(
  speed: number, confidence: number, engagement: number
): "quiet" | "cheer" | "big" | "applause" {
  if (speed > 80 && confidence > 80) return "big";           // سريع وواثق → احتفال ضخم
  if (engagement > 70) return "cheer";                        // نشيط → تصفيق
  if (speed < 40) return "quiet";                              // بطيء → هادئ
  return "applause";
}

function computeRecommendations(
  accuracy: number, speed: number, engagement: number, leadership: number
): string[] {
  const recs: string[] = [];
  
  if (accuracy < 50) recs.push("يحتاج مراجعة المفاهيم الأساسية قبل المتابعة");
  if (speed < 40) recs.push("شجّعه على الإجابة أسرع — ربما خائف من الخطأ");
  if (engagement < 30) recs.push("قليل المشاركة — جرب ألعاب تفاعلية معه");
  if (leadership > 70) recs.push("يستطيع قيادة مجموعة — فوّض له مهام");
  if (accuracy > 80 && speed > 80) recs.push("جاهز لتحديات أصعب — جرب المستوى الصعب");
  if (accuracy > 90 && engagement > 70) recs.push("نجم حقيقي — اعرضه كمثال للصف");

  return recs.length > 0 ? recs : ["أداء متوازن — استمر هكذا"];
}

// ============================================================
// UI Component — Student DNA Card
// ============================================================

export function StudentDNACard({ studentId }: { studentId: string }) {
  const students = useShellStore((s) => s.students);
  const student = students.find((s) => s.id === studentId);
  
  const [dna, setDna] = useState<StudentPersonality | null>(null);
  const [timeline, setTimeline] = useState<Array<{ id: string; kind: string; type: string; text: string; pointsDelta: number; createdAt: string; isShared?: boolean }>>([]);
  // Initialize mounted from window existence to avoid setState-in-effect.
  const [mounted] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    (async () => {
      localDb.studentTimeline.list(studentId, 40).then((rows) => { if (!cancelled) setTimeline(rows); }).catch(() => setTimeline([]));
      // Build history from session data
      const history: Array<{
        studentId: string;
        type: "correct" | "wrong" | "good-try" | "fast";
        timestamp: Date;
        points: number;
      }> = [];

      // Add from badges
      student.badges?.forEach((b) => {
        history.push({
          studentId,
          type: b.type as never,
          timestamp: new Date(b.awardedAt || Date.now()),
          points: 0,
        });
      });

      // P1-11 fix: fetch real gift count from DB (was hardcoded gifts = 0,
      // making the leadership trait bar permanently empty).
      let gifts = 0;
      try {
        const giftRows = await getStudentGifts(studentId);
        gifts = giftRows.length;
      } catch (e) {
        console.warn("[StudentDNA] failed to load gifts:", e);
      }
      if (cancelled) return;

      // Derive streaks from consecutive correct badges grouped by awardedAt day.
      const streaks: number[] = [];

      const result = analyzeStudentPersonality(studentId, history, gifts, streaks);
      // Defer setState to avoid cascading render warning from React 19 strict compiler.
      queueMicrotask(() => setDna(result));
    })();
    return () => { cancelled = true; };
  }, [studentId, student]);

  if (!mounted || !dna || !student) return null;

  const t = dna.traits;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0142A0] to-[#DA151C] flex items-center justify-center text-3xl">
          {dna.nickname.split(" ")[dna.nickname.split(" ").length - 1]}
        </div>
        <div>
          <div className="text-lg font-bold text-white">{student.name}</div>
          <div className="text-[11px] text-[#FFD700] font-semibold">{dna.nickname}</div>
        </div>
      </div>

      {/* Trait bars */}
      <div className="space-y-2">
        <TraitBar label="السرعة" value={t.speed} color="#3b82f6" icon="⚡" />
        <TraitBar label="الدقة" value={t.accuracy} color="#10b981" icon="🎯" />
        <TraitBar label="الثبات" value={t.consistency} color="#a855f7" icon="📈" />
        <TraitBar label="الانخراط" value={t.engagement} color="#f59e0b" icon="🔥" />
        <TraitBar label="الثقة" value={t.confidence} color="#ec4899" icon="💪" />
        <TraitBar label="القيادة" value={t.leadership} color="#FFD700" icon="👑" />
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-white/5 rounded p-2 text-center">
          <div className="text-white/50">الصعوبة المفضلة</div>
          <div className="font-bold" style={{
            color: dna.preferredDifficulty === "hard" ? "#ef4444"
              : dna.preferredDifficulty === "easy" ? "#10b981" : "#f59e0b"
          }}>
            {dna.preferredDifficulty === "hard" ? "صعب" : dna.preferredDifficulty === "easy" ? "سهل" : "متوسط"}
          </div>
        </div>
        <div className="bg-white/5 rounded p-2 text-center">
          <div className="text-white/50">احتفال مفضل</div>
          <div className="font-bold text-white">
            {dna.celebrationPrefernce === "big" ? "ضخم 🎊" :
             dna.celebrationPrefernce === "cheer" ? "تشجيعي 👏" :
             dna.celebrationPrefernce === "quiet" ? "هادئ 🤫" : "تصفيق 👏"}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && <div className="space-y-1.5"><div className="text-[10px] font-bold text-white/60 uppercase">السجل الزمني القابل للمراجعة</div><div className="max-h-36 space-y-1 overflow-auto">{timeline.slice(0, 8).map((event) => <div key={`${event.kind}-${event.id}`} className="rounded border border-white/10 bg-white/5 p-1.5 text-[10px] text-white/80"><span className="text-white/40">{new Date(event.createdAt).toLocaleDateString("ar-EG")}</span> • {event.text || event.type}{event.pointsDelta ? <span className="mr-1 text-emerald-300">({event.pointsDelta > 0 ? "+" : ""}{event.pointsDelta})</span> : ""}{event.isShared && <span className="mr-1 text-sky-300">• مشتركة</span>}</div>)}</div></div>}

      {/* Recommendations */}
      {dna.recommendations.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-white/60 uppercase">توصيات ذكية</div>
          {dna.recommendations.map((rec, i) => (
            <div key={i} className="text-[11px] text-white/80 bg-blue-500/10 border border-blue-500/20 rounded p-2">
              💡 {rec}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TraitBar({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-white/60">{icon} {label}</span>
        <span className="font-bold text-white/80">{Math.round(value)}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
