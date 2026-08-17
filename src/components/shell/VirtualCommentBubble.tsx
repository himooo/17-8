"use client";

import { useEffect, useRef, useState } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useStageBounds } from "@/lib/stage-bounds";
import { Z_INDEX } from "@/lib/z-index";

/**
 * VirtualCommentBubble — بابل التعليق الافتراضي
 *
 * يظهر top-right داخل منطقة العرض (iframe bounds):
 * - Avatar emoji حسب gender
 * - اسم الطالب بلون مميز
 * - نص التعليق
 * - لون الخلفية حسب الـ tone
 * - صوت بلوووب عند الظهور
 * - hover يوقف الاختفاء + click يغلق فوراً
 */

// ألوان حسب الـ tone — محسّنة لرؤية واضحة
// bg: خلفية داكنة شبه شفافة (0.92 opacity) لضمان رؤية النص الأبيض
// textColor: أبيض دائماً
// borderColor: لون مميز قوي
// labelBg: خلفية الـ badge
const TONE_STYLES = {
  confident: { 
    bg: "rgba(6, 95, 70, 0.95)", 
    border: "#34d399", 
    label: "واثق 💪", 
    avatarBg: "#10b981",
    labelBg: "rgba(16, 185, 129, 0.3)",
    labelColor: "#a7f3d0"
  },
  confused:  { 
    bg: "rgba(120, 53, 15, 0.95)", 
    border: "#fbbf24", 
    label: "محتار 🤔", 
    avatarBg: "#f59e0b",
    labelBg: "rgba(245, 158, 11, 0.3)",
    labelColor: "#fde68a"
  },
  excited:   { 
    bg: "rgba(131, 24, 67, 0.95)", 
    border: "#f472b6", 
    label: "متحمس 🤩", 
    avatarBg: "#ec4899",
    labelBg: "rgba(236, 72, 153, 0.3)",
    labelColor: "#fbcfe8"
  },
  curious:   { 
    bg: "rgba(30, 58, 138, 0.95)", 
    border: "#60a5fa", 
    label: "فضولي 🧐", 
    avatarBg: "#3b82f6",
    labelBg: "rgba(59, 130, 246, 0.3)",
    labelColor: "#bfdbfe"
  },
  neutral:   { 
    bg: "rgba(31, 41, 55, 0.95)", 
    border: "#9ca3af", 
    label: "عادي 😊", 
    avatarBg: "#6b7280",
    labelBg: "rgba(107, 114, 128, 0.3)",
    labelColor: "#e5e7eb"
  },
} as const;

const GENDER_AVATAR = {
  female: "👧",
  male: "👦",
} as const;

export function VirtualCommentBubble() {
  const comment = useShellStore((s) => s.currentVirtualComment);
  const dismissVirtualComment = useShellStore((s) => s.dismissVirtualComment);
  const playSound = useShellStore((s) => s.playSound);
  const settings = useShellStore((s) => s.settings);
  const bounds = useStageBounds(!!comment);

  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommentIdRef = useRef<string | null>(null);

  const autoHideMs = settings.virtualCommentAutoHideMs ?? 12000;

  // تشغيل صوت + إعادة تعيين الـ timer مع كل تعليق جديد
  useEffect(() => {
    if (!comment) {
      // Defer to avoid setState-in-effect cascading render warning.
      queueMicrotask(() => setVisible(false));
      return;
    }
    if (comment.commentId === lastCommentIdRef.current) return;
    lastCommentIdRef.current = comment.commentId;
    // setVisible(true) here is OK because it's gated by the commentId check
    // (only fires once per unique comment), not on every effect run.
    setVisible(true);

    // صوت البلوووب 🫧
    playSound("celebrate-bubble" as never);

    // auto-hide timer
    const startTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!hovering) {
          setVisible(false);
          setTimeout(dismissVirtualComment, 300);
        }
      }, autoHideMs);
    };
    startTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [comment, autoHideMs, hovering, playSound, dismissVirtualComment]);

  // hover يوقف الاختفاء
  useEffect(() => {
    if (!comment) return;
    if (hovering) {
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      // restart — استخدم autoHideMs المُعدّل وليس قيمة ثابتة
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setTimeout(dismissVirtualComment, 300);
      }, autoHideMs);
    }
  }, [hovering, comment, dismissVirtualComment, autoHideMs]);

  if (!comment || !bounds) return null;

  const style = TONE_STYLES[comment.tone];
  const avatar = comment.student.gender ? GENDER_AVATAR[comment.student.gender] : "🧒";

  // الموضع: top-right داخل منطقة العرض (الكانفاس)
  // إصلاح: right في CSS تعني المسافة من الحافة اليمنى للـ viewport
  // لذلك لحساب الموضع الصحيح: window.innerWidth - bounds.right + 16
  // مثال: لو bounds.right = 800 و viewport width = 1200
  // right = 1200 - 800 + 16 = 416px → الفقاعة على يمين الكانفاس ✅
  // (القديم: right = 800 - 16 = 784 → يضعها على اليسار ❌)
  const rightOffset = typeof window !== "undefined" ? window.innerWidth - bounds.right + 16 : 16;
  const bubbleStyle: React.CSSProperties = {
    position: "fixed",
    top: `${bounds.top + 16}px`,
    right: `${rightOffset}px`,
    zIndex: Z_INDEX.VIRTUAL_COMMENT, // P1-2: was hardcoded 45 (collided with BOTTOM_BAR_DROPDOWN_BACKDROP)
    transform: visible ? "translateX(0)" : "translateX(120%)",
    opacity: visible ? 1 : 0,
    transition: "transform 250ms cubic-bezier(0.34, 1.4, 0.64, 1), opacity 200ms ease",
    maxWidth: "320px",
  };

  return (
    <div
      style={bubbleStyle}
      className="pointer-events-auto select-none"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => {
        setVisible(false);
        setTimeout(dismissVirtualComment, 200);
      }}
      title="اضغط للإغلاق"
      role="alert"
      aria-live="polite"
    >
      <div
        className="flex items-start gap-2.5 p-3 rounded-2xl shadow-2xl max-w-[320px] cursor-pointer"
        style={{
          backgroundColor: style.bg,
          border: `2px solid ${style.border}`,
          backdropFilter: "blur(8px)",
          boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px ${style.border}40`,
        }}
      >
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-2xl shrink-0 shadow-md"
          style={{ backgroundColor: style.avatarBg }}
        >
          {avatar}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="text-[13px] font-black text-white leading-tight"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}
            >
              {comment.student.name}
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ backgroundColor: style.labelBg, color: style.labelColor }}
            >
              {style.label}
            </span>
          </div>

          {/* Comment text */}
          <p className="text-[13px] text-white font-medium leading-snug" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
            {comment.text}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[8px] text-white/70">🏫 بسلاسة</span>
            <span className="text-[8px] text-white/60">اضغط للإغلاق ✕</span>
          </div>
        </div>
      </div>
    </div>
  );
}
