"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useGameStudentPicker } from "@/lib/useGameStudentPicker";
import { Button } from "@/components/ui/button";
import { RotateCcw, Users } from "lucide-react";
import { GameOverlay } from "./GameOverlay";
import { announce } from "@/lib/tts-announcer";

export function RandomStudentWheel({ onClose }: { onClose: () => void }) {
  const students = useShellStore((s) => s.students);
  const activeClassId = useShellStore((s) => s.activeClassId);
  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const wheelResult = useShellStore((s) => s.wheelResult);
  const setWheelResult = useShellStore((s) => s.setWheelResult);

  const picker = useGameStudentPicker("wheel");

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const wheelStudents = useMemo(() => {
    // ONLY use store students — NO demo fallback. Every present student is
    // shown (not just the first N) so the wheel and the fair picker always
    // operate on the exact same pool — otherwise a fairly-picked student
    // outside a capped list would silently fall back to an unfair pick.
    return students.filter((s) => !s.isAbsent).map((s) => ({ id: s.id, name: s.name, called: s.calledInSession }));
  }, [students]);

  // Build a fair-pick order using the deferred picker (commit only on animation end)
  const pickFairIdx = (): { idx: number; commit: () => void } | null => {
    const result = picker.pickRandomDeferred();
    if (!result) return null;
    const idx = wheelStudents.findIndex((s) => s.id === result.student.id);
    return idx >= 0 ? { idx, commit: result.commit } : null;
  };

  const segmentAngle = 360 / wheelStudents.length;

  const spin = () => {
    if (spinning || wheelStudents.length === 0) return;
    setSpinning(true);
    playSound("celebrate-spin");

    // C28 fix: use deferred pick — commit only when the spin completes.
    const picked = pickFairIdx();
    if (!picked) {
      setSpinning(false);
      return;
    }
    const targetIdx = picked.idx;
    const commitPick = picked.commit;
    const targetAngle = 360 * 6 + (360 - targetIdx * segmentAngle - segmentAngle / 2);
    const start = performance.now();
    const duration = 3500;
    const startRot = rotation;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const currentRot = startRot + (targetAngle - (startRot % 360)) * eased;
      setRotation(currentRot);
      const idxAtTop = Math.floor(((360 - (currentRot % 360)) % 360) / segmentAngle);
      setHighlightIdx(idxAtTop);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setSpinning(false);
        const winner = wheelStudents[targetIdx];
        setWheelResult({ studentId: winner.id, name: winner.name });
        const studentObj = useShellStore.getState().students.find((s) => s.id === winner.id);
        if (studentObj) {
          useShellStore.setState({ currentlyCalledStudent: studentObj });
          announce("student-picked", { studentName: winner.name });
        }
        // C28 fix: NOW commit the fair pick (records calledInSession + activity).
        // If the user closed the modal before this line, commitPick was never
        // called, so the student is NOT counted as called.
        commitPick();
        playSound("celebrate-tada");
        triggerConfetti();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Measure the space GameOverlay actually gives us (bounded to the
  // iframe-visible-area) instead of sizing off window.innerHeight, which
  // could overflow past what's visible to students during screen-share.
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(360);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize(Math.max(180, Math.min(rect.width, rect.height, 450)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <GameOverlay open onClose={onClose} title="عجلة الطلاب" accentColor="#DA151C">
      <div ref={containerRef} className="flex flex-col items-center justify-center p-4 min-h-[360px]">
        <div className="relative" style={{ width: size, height: size }}>
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-2 z-20" style={{ top: -10 }}>
            <div
              className="w-0 h-0"
              style={{
                borderLeft: "16px solid transparent",
                borderRight: "16px solid transparent",
                borderTop: "28px solid #DA151C",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
              }}
            />
          </div>

          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "none" : "transform 0.1s ease-out",
              filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.6))",
            }}
          >
            {wheelStudents.map((s, i) => {
              const startAngle = (i * segmentAngle - 90) * (Math.PI / 180);
              const endAngle = ((i + 1) * segmentAngle - 90) * (Math.PI / 180);
              const r = size / 2 - 4;
              const cx = size / 2;
              const cy = size / 2;
              const x1 = cx + r * Math.cos(startAngle);
              const y1 = cy + r * Math.sin(startAngle);
              const x2 = cx + r * Math.cos(endAngle);
              const y2 = cy + r * Math.sin(endAngle);
              const largeArc = segmentAngle > 180 ? 1 : 0;
              const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
              const colors = ["#0142A0", "#DA151C", "#10b981", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#92400e", "#0ea5e9", "#84cc16", "#f97316", "#6366f1"];
              const color = colors[i % colors.length];
              const midAngle = (startAngle + endAngle) / 2;
              const textR = r * 0.65;
              const tx = cx + textR * Math.cos(midAngle);
              const ty = cy + textR * Math.sin(midAngle);
              const textRotation = i * segmentAngle + segmentAngle / 2;
              return (
                <g key={s.id}>
                  <path d={path} fill={color} stroke="white" strokeWidth={2} opacity={highlightIdx === i && spinning ? 1 : 0.85} />
                  <text x={tx} y={ty} fill="white" fontSize={Math.max(12, size / 30)} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${textRotation} ${tx} ${ty})`} style={{ pointerEvents: "none" }}>
                    {s.name.length > 10 ? s.name.slice(0, 9) + "…" : s.name}
                  </text>
                </g>
              );
            })}
            <circle cx={size / 2} cy={size / 2} r={size / 10} fill="white" stroke="#0142A0" strokeWidth={3} />
            {/* اللوجو: ابتسامة + عيون (محدث) */}
            {/* العيون الحمراء (صغيرة نظيفة) */}
            <circle cx={size / 2 - size / 40} cy={size / 2 - size / 50} r={size / 65} fill="#DA151C" />
            <circle cx={size / 2 + size / 40} cy={size / 2 - size / 50} r={size / 65} fill="#DA151C" />
            {/* الابتسامة الزرقاء (خفيفة أنيقة) */}
            <path
              d={`M ${size / 2 - size / 28} ${size / 2 + size / 70} Q ${size / 2} ${size / 2 + size / 22} ${size / 2 + size / 28} ${size / 2 + size / 70}`}
              stroke="#0142A0"
              strokeWidth={size / 100}
              strokeLinecap="round"
              fill="none"
            />
            {/* كلمة بسلاسة مع م.آية صغيرة تحت اللوجو */}
            <text x={size / 2} y={size / 2 + size / 16} fill="#0142A0" fontSize={size / 60} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: "none" }}>
              بسلاسة
            </text>
            <text x={size / 2} y={size / 2 + size / 12} fill="#DA151C" fontSize={size / 70} textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: "none" }}>
              مع م.آية
            </text>
          </svg>
        </div>

        {wheelResult && !spinning && (
          <div className="mt-4 text-center">
            <div className="text-white/70 text-sm mb-1">الفائز</div>
            <div className="text-3xl font-bold text-[#FFD700] mb-3 drop-shadow-lg">{wheelResult.name}</div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {!spinning && (
            <Button onClick={spin} size="lg" className="bg-[#DA151C] hover:bg-[#DA151C]/80 text-white px-8">
              <RotateCcw className="w-5 h-5 ml-2" />
              {wheelResult ? "أعد الدوران" : "ابدأ الدوران"}
            </Button>
          )}
          {spinning && <div className="text-white text-lg animate-pulse">جاري الدوران...</div>}
        </div>

        {students.length === 0 && (
          <div className="mt-3 text-xs text-white/40 flex items-center gap-1">
            <Users className="w-3 h-3" />
            لا يوجد طلاب — أضف طلاباً من لوحة الطلاب
          </div>
        )}
      </div>
    </GameOverlay>
  );
}
