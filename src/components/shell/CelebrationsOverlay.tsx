"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { confetti as tsParticlesConfetti } from "@tsparticles/confetti";
import { useShellStore } from "@/lib/shell-store";
import { fireCelebrationByType } from "@/lib/shell-utils";
import { useStageBounds } from "@/lib/stage-bounds";
import { DEFAULT_CELEBRATIONS_MAP, type CelebrationConfig } from "@/lib/celebrations";

/**
 * CelebrationsOverlay v2 — نظام احتفالات مُذهل:
 *
 * كل احتفال يعرض:
 * 1. **Flash** ضوئي ملون ينطفئ في ~200ms
 * 2. **Banner ضخم** في المنتصف:
 *    - أيقونة عمهاقة (fill ~5rem) مع spring bounce
 *    - اسم الاحتفال بخط ضخم Cairo Black
 *    - Tagline حماسية
 *    - خلفية glowing ملونة (gradient + triple box-shadow)
 *    - Progress bar يشير للوقت المتبقي
 *    - Spring ingress: scale 0 → 1.12 → 1.0 over 500ms (cubic-bezier bounce)
 *    - Auto-dismiss بعد 2.5 ثانية
 * 3. **Particles** — يطلق fireCelebrationByType() من shell-utils (canvas-confetti)
 *
 * كل الألوان والحركات قابلة للتخصيص عبر CSS Variables (--cb-*).
 *
 * v10.4: META + SOUND_MAP المحلية تم حذفها — الـ overlay يقرأ من
 * useShellStore.celebrations (محملة من DB) مع fallback إلى
 * DEFAULT_CELEBRATIONS_MAP. هذا يضمن أن تعديلات المستخدم للاحتفالات
 * الافتراضية تنعكس فوراً على البانر.
 */

/* ===================== Types ===================== */

export interface CelebrationMeta {
  id: string;
  label: string;
  icon: string;
  color: string;
  /** Primary tagline (short & punchy) */
  tagline: string;
  /** Secondary enthusiasm line */
  hype: string;
  /** Extra gradient stop #2 */
  color2: string;
  renderMode: "confetti" | "particles" | "both";
}

/** Convert a CelebrationConfig (DB shape) → CelebrationMeta (render shape). */
function toMeta(c: CelebrationConfig): CelebrationMeta {
  return {
    id: c.id,
    label: c.label,
    icon: c.icon,
    color: c.color,
    color2: c.color2,
    tagline: c.tagline,
    hype: c.hype,
    renderMode: c.renderMode ?? "confetti",
  };
}

/**
 * New particle renderer. It is deliberately fire-and-forget: if a browser
 * blocks canvas creation or reduced-motion settings disable it, the legacy
 * renderer and the teacher-facing banner remain unaffected.
 */
function fireParticleCelebration(meta: CelebrationMeta): void {
  const options = {
    colors: [meta.color, meta.color2],
    count: 70,
    particleCount: 70,
    spread: 75,
    startVelocity: 32,
    gravity: 0.9,
    decay: 0.91,
    ticks: 180,
    scalar: 1,
    shapes: ["square", "circle", "star"],
    origin: { x: 0.5, y: 0.58 },
    position: { x: 50, y: 58 },
    zIndex: 9996,
    disableForReducedMotion: false,
  };
  void tsParticlesConfetti(options).catch((error) => {
    console.warn("[CelebrationsOverlay] particles renderer failed", error);
  });
}

/* ================================================================= */
/*  Main component                                                   */
/* ================================================================= */

const BANNER_DURATION_MS = 2500;
const FLASH_DURATION_MS = 200;

export function CelebrationsOverlay() {
  const celebrationType = useShellStore((s) => s.celebrationType);
  const celebrationCounter = useShellStore((s) => s.celebrationCounter);
  const celebrationsList = useShellStore((s) => s.celebrations);

  const [active, setActive] = useState<CelebrationMeta | null>(null);
  const lastCounterRef = useRef(celebrationCounter);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (celebrationCounter <= lastCounterRef.current) return;
    lastCounterRef.current = celebrationCounter;
    if (!celebrationType) return;

    // Look up celebration meta from the DB-loaded list first (respects user edits),
    // fall back to DEFAULT_CELEBRATIONS_MAP, then to the first default.
    const fromDb = celebrationsList.find((c) => c.id === celebrationType);
    const meta = fromDb
      ? toMeta(fromDb)
      : DEFAULT_CELEBRATIONS_MAP[celebrationType]
        ? toMeta(DEFAULT_CELEBRATIONS_MAP[celebrationType])
        : toMeta(DEFAULT_CELEBRATIONS_MAP["confetti"]);

    // The teacher-selected mode controls visuals only. Audio remains owned by
    // triggerCelebration in shell-store, so both renderers never double-play it.
    const renderMode = meta.renderMode;
    if (renderMode === "confetti" || renderMode === "both") {
      fireCelebrationByType(celebrationType);
    }
    if (renderMode === "particles" || renderMode === "both") {
      fireParticleCelebration(meta);
    }

    // NOTE: الصوت يُشغّل بواسطة triggerCelebration في shell-store.ts
    // (المالك الوحيد للصوت — يمنع double-sound)

    // Show banner on the next task to avoid cascading renders inside the
    // celebration synchronisation effect.
    timersRef.current.forEach((t) => clearTimeout(t));
    const showTimer = window.setTimeout(() => setActive(meta), 0);
    const dismissTimer = window.setTimeout(() => setActive(null), BANNER_DURATION_MS);
    timersRef.current = [showTimer, dismissTimer];

    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, [celebrationCounter, celebrationType, celebrationsList]);

  if (!active) return null;

  return (
    <>
      <ScreenFlash key={`flash-${celebrationCounter}`} color={active.color} color2={active.color2} />
      <CelebrationBanner key={`banner-${celebrationCounter}`} meta={active} />
    </>
  );
}

/* ================================================================= */
/*  Screen flash — brief radial light burst (dاخل حدود الـ stage)   */
/* ================================================================= */
function ScreenFlash({ color, color2 }: { color: string; color2: string }) {
  const bounds = useStageBounds(true);
  const style: React.CSSProperties = bounds
    ? {
        position: "fixed",
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }
    : { position: "fixed", inset: 0 };
  return (
    <div
      className="z-[9997] pointer-events-none cb-flash"
      style={
        {
          ...style,
          "--cb-flash-color": color,
          "--cb-flash-color-2": color2,
        } as React.CSSProperties
      }
    />
  );
}

/* ================================================================= */
/*  Banner — the big center badge (داخل حدود الـ stage فقط)         */
/* ================================================================= */
function CelebrationBanner({ meta }: { meta: CelebrationMeta }) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const bounds = useStageBounds(true);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 80);
    const t2 = setTimeout(() => setPhase("out"), BANNER_DURATION_MS - 380);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const scale = phase === "in" ? 0 : phase === "hold" ? 1 : 1.15;
  const opacity = phase === "in" ? 0 : phase === "out" ? 0 : 1;
  const y = phase === "out" ? -60 : 0;

  const cssVars = useMemo(
    () =>
      ({
        "--cb-meta-color": meta.color,
        "--cb-meta-color-2": meta.color2,
      }) as React.CSSProperties,
    [meta]
  );

  // ===== التموضع داخل الـ stage نفسه (اللي الطالب شايفه في الزوم) =====
  // لو bounds موجودة → center الـ stage. لو مش موجودة → center الصفحة.
  const centerX = bounds ? bounds.left + bounds.width / 2 : null;
  const centerY = bounds ? bounds.top + bounds.height / 2 : null;

  // إصلاح: نستخدم wrapper خارجي للتمركز + inner للـ scale
  // هذا يفصل التمركز عن التحجيم لتجنب تداخل scale مع translate(-50%)
  const wrapperStyle: React.CSSProperties = centerX !== null && centerY !== null
    ? {
        position: "fixed",
        left: `${centerX}px`,
        top: `${centerY}px`,
        zIndex: 9998,
        transform: "translate(-50%, -50%)",
      }
    : {
        position: "fixed",
        left: "50%",
        top: "50%",
        zIndex: 9998,
        transform: "translate(-50%, -50%)",
      };

  const innerStyle: React.CSSProperties = {
    transform: `translateY(${y}px) scale(${scale})`,
    transformOrigin: "center center",
    opacity,
    transition:
      phase === "in"
        ? "none"
        : phase === "hold"
          ? "transform 500ms cubic-bezier(0.34, 1.65, 0.55, 1), opacity 200ms ease-out"
          : "transform 380ms cubic-bezier(0.55, 0, 1, 0.45), opacity 320ms ease-in",
  };

  return (
    <div
      className="pointer-events-none select-none"
      style={{
        ...wrapperStyle,
        ...cssVars,
      }}
      role="status"
      aria-live="polite"
    >
      <div style={innerStyle}>
      {/* Outer glowing aura (blurred, big) */}
      <div
        className="absolute -z-10 rounded-[40px]"
        style={{
          inset: "-24%",
          background: `radial-gradient(closest-side, ${meta.color}80 0%, ${meta.color}33 45%, transparent 75%)`,
          filter: "blur(30px)",
        }}
      />

      {/* Concentric expanding ripple rings */}
      <div className="cb-ring" style={{ borderColor: meta.color }} />
      <div className="cb-ring cb-ring--delay" style={{ borderColor: meta.color2 }} />

      {/* Main badge */}
      <div
        className="cb-shell relative flex flex-col items-center gap-3 px-12 py-8 rounded-[32px] overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${meta.color}fa 0%, ${meta.color2}fa 100%)`,
          boxShadow: [
            `0 0 60px ${meta.color}cc`,
            `0 0 120px ${meta.color}55`,
            `0 24px 70px rgba(0,0,0,0.55)`,
            `inset 0 2px 0 rgba(255,255,255,0.45)`,
            `inset 0 -2px 8px rgba(0,0,0,0.25)`,
          ].join(", "),
          border: "2px solid rgba(255,255,255,0.35)",
          backdropFilter: "blur(6px)",
          minWidth: 320,
          maxWidth: "min(88vw, 540px)",
        }}
      >
        {/* Top shine sheen sweep */}
        <div className="cb-sheen" aria-hidden />

        {/* Giant icon with bounce + drop-shadow */}
        <div
          className="cb-icon leading-none"
          style={{
            fontSize: "clamp(3.5rem, 9vw, 5.5rem)",
            filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.5))",
            lineHeight: 1,
          }}
        >
          {meta.icon}
        </div>

        {/* Label */}
        <div
          className="text-white text-center font-black leading-tight"
          style={{
            fontSize: "clamp(1.9rem, 5vw, 3rem)",
            textShadow:
              "0 4px 14px rgba(0,0,0,0.55), 0 0 30px rgba(255,255,255,0.25)",
            fontFamily: "Cairo, 'Segoe UI', sans-serif",
            letterSpacing: 0,
          }}
        >
          {meta.label}
        </div>

        {/* Tagline + hype */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="text-white font-extrabold tracking-wide"
            style={{
              fontSize: "clamp(0.95rem, 2vw, 1.35rem)",
              textShadow: "0 2px 8px rgba(0,0,0,0.45)",
            }}
          >
            {meta.hype}
          </div>
          <div className="text-white/85 text-sm font-semibold tracking-wider">
            {meta.tagline}
          </div>
        </div>

        {/* Progress bar (duration indicator) */}
        <div
          className="cb-progress"
          style={{ animationDuration: `${BANNER_DURATION_MS - 380}ms` }}
          aria-hidden
        />
      </div>
      </div>
    </div>
  );
}
