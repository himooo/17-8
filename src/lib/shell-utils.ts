"use client";

// canvas-confetti v1.9.4 already exports shapeFromText/shapeFromPath
// allowing emoji shapes like "🎓" or "👑" as celebration particles.

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import type { SlideManifest, LessonQuestion } from "./slide-schema";

// ====================================================================
//  PDF export lives in pdf-export.ts.
//  The old text-only implementation was removed so no hidden caller can
//  accidentally produce a report that omits the original lesson slides.
// ====================================================================

// ====================================================================
//  Audio Engine - أصوات حقيقية من ملفات WAV محلية
//  كل صوت يُشغل بحد أقصى 3 ثوانٍ
//  استبدل الملفات في /public/sounds/ بأصواتك الحقيقية
// ====================================================================
import type { Howl as HowlType } from "howler";

type SoundType =
  | "success" | "error" | "celebrate" | "celebrate-students" | "celebrate-crowd"
  | "celebrate-fanfare" | "celebrate-applause" | "celebrate-fireworks" | "celebrate-medium"
  | "celebrate-horn" | "celebrate-airhorn"
  | "celebrate-drumroll" | "celebrate-tada" | "celebrate-magic" | "celebrate-whistle"
  | "celebrate-cash" | "celebrate-bell" | "celebrate-bubble" | "celebrate-fanfare-big"
  | "celebrate-cheer-soft" | "celebrate-cheer-loud" | "celebrate-clap" | "celebrate-stamp"
  | "celebrate-spin" | "celebrate-win" | "celebrate-lose" | "celebrate-level-up"
  | "celebrate-gift" | "celebrate-fanfare-short" | "celebrate-buzz" | "celebrate-chime"
  | "celebrate-whoosh" | "celebrate-pop" | "celebrate-ding-dong" | "celebrate-sparkle"
  | "celebrate-coin-drop" | "celebrate-sword" | "celebrate-magic-wand" | "celebrate-bird"
  | "celebrate-thunder" | "celebrate-referee" | "celebrate-buzzer" | "celebrate-fanfare-long"
  | "celebrate-alarm" | "celebrate-bubble-pop" | "celebrate-chime-bell" | "celebrate-drum-roll-long"
  | "celebrate-cuckoo" | "celebrate-applause-big" | "celebrate-rocket" | "celebrate-charge"
  // v11: 20 أصوات إضافية
  | "celebrate-drum-roll-longer" | "celebrate-applause-huge" | "celebrate-victory"
  | "celebrate-champion" | "celebrate-fanfare-victory" | "celebrate-laugh" | "celebrate-yay"
  | "celebrate-wow" | "celebrate-boo" | "celebrate-click-loud" | "celebrate-step-loud"
  | "celebrate-drum-hit" | "celebrate-cymbal" | "celebrate-triangle" | "celebrate-sweep-up"
  | "celebrate-sweep-down" | "celebrate-bubble-long" | "celebrate-robot" | "celebrate-magic-chime"
  | "celebrate-bell-church"
  | "bisalasa-success-bright" | "bisalasa-success-perfect" | "bisalasa-gift-reveal"
  | "bisalasa-badge-unlock" | "bisalasa-celebration-small" | "bisalasa-celebration-class"
  | "bisalasa-fireworks-impact" | "bisalasa-level-up" | "bisalasa-gentle-correction"
  | "bisalasa-countdown-tick" | "bisalasa-student-picker" | "bisalasa-session-finish"
  | "click" | "step";

const SOUND_FILES: Record<string, string> = {
  "success": "/sounds/bisalasa-success-bright.wav",
  "error": "/sounds/bisalasa-gentle-correction.wav",
  "celebrate-medium": "/sounds/bisalasa-success-perfect.wav",
  "celebrate": "/sounds/bisalasa-celebration-class.wav",
  "celebrate-fanfare": "/sounds/bisalasa-celebration-class.wav",
  "celebrate-students": "/sounds/bisalasa-celebration-class.wav",
  "celebrate-crowd": "/sounds/bisalasa-celebration-class.wav",
  "celebrate-applause": "/sounds/bisalasa-celebration-class.wav",
  "celebrate-fireworks": "/sounds/bisalasa-fireworks-impact.wav",
  "celebrate-horn": "/sounds/dragon-studio-air-horn-sound-effect-372453.wav",
  "celebrate-airhorn": "/sounds/dragon-studio-air-horn-sound-effect-372453.wav",
  "celebrate-drumroll": "/sounds/celebrate-drumroll.wav",
  "celebrate-tada": "/sounds/celebrate-tada.wav",
  "celebrate-magic": "/sounds/celebrate-magic.wav",
  "celebrate-whistle": "/sounds/celebrate-whistle.wav",
  "celebrate-cash": "/sounds/celebrate-cash.wav",
  "celebrate-bell": "/sounds/celebrate-bell.wav",
  "celebrate-bubble": "/sounds/celebrate-bubble.wav",
  "celebrate-fanfare-big": "/sounds/celebrate-fanfare-big.wav",
  "celebrate-cheer-soft": "/sounds/celebrate-cheer-soft.wav",
  "celebrate-cheer-loud": "/sounds/celebrate-cheer-loud.wav",
  "celebrate-clap": "/sounds/celebrate-clap.wav",
  "celebrate-stamp": "/sounds/celebrate-stamp.wav",
  "celebrate-spin": "/sounds/celebrate-spin.wav",
  "celebrate-win": "/sounds/bisalasa-success-perfect.wav",
  "celebrate-lose": "/sounds/bisalasa-gentle-correction.wav",
  "celebrate-level-up": "/sounds/bisalasa-level-up.wav",
  "celebrate-gift": "/sounds/bisalasa-gift-reveal.wav",
  "celebrate-fanfare-short": "/sounds/celebrate-fanfare-short.wav",
  "celebrate-buzz": "/sounds/celebrate-buzz.wav",
  "celebrate-chime": "/sounds/celebrate-chime.wav",
  "celebrate-whoosh": "/sounds/celebrate-whoosh.wav",
  "celebrate-pop": "/sounds/celebrate-pop.wav",
  "celebrate-ding-dong": "/sounds/celebrate-ding-dong.wav",
  "celebrate-sparkle": "/sounds/celebrate-sparkle.wav",
  "celebrate-coin-drop": "/sounds/celebrate-coin-drop.wav",
  "celebrate-sword": "/sounds/celebrate-sword.wav",
  "celebrate-magic-wand": "/sounds/celebrate-magic-wand.wav",
  "celebrate-bird": "/sounds/celebrate-bird.wav",
  "celebrate-thunder": "/sounds/celebrate-thunder.wav",
  "celebrate-referee": "/sounds/celebrate-referee.wav",
  "celebrate-buzzer": "/sounds/celebrate-buzzer.wav",
  "celebrate-fanfare-long": "/sounds/celebrate-fanfare-long.wav",
  "celebrate-alarm": "/sounds/celebrate-alarm.wav",
  "celebrate-bubble-pop": "/sounds/celebrate-bubble-pop.wav",
  "celebrate-chime-bell": "/sounds/celebrate-chime-bell.wav",
  "celebrate-drum-roll-long": "/sounds/celebrate-drum-roll-long.wav",
  "celebrate-cuckoo": "/sounds/celebrate-cuckoo.wav",
  "celebrate-applause-big": "/sounds/celebrate-applause-big.wav",
  "celebrate-rocket": "/sounds/celebrate-rocket.wav",
  "celebrate-charge": "/sounds/celebrate-charge.wav",
  // v11: 20 أصوات إضافية
  "celebrate-drum-roll-longer": "/sounds/celebrate-drum-roll-longer.wav",
  "celebrate-applause-huge": "/sounds/celebrate-applause-huge.wav",
  "celebrate-victory": "/sounds/celebrate-victory.wav",
  "celebrate-champion": "/sounds/celebrate-champion.wav",
  "celebrate-fanfare-victory": "/sounds/celebrate-fanfare-victory.wav",
  "celebrate-laugh": "/sounds/celebrate-laugh.wav",
  "celebrate-yay": "/sounds/celebrate-yay.wav",
  "celebrate-wow": "/sounds/celebrate-wow.wav",
  "celebrate-boo": "/sounds/celebrate-boo.wav",
  "celebrate-click-loud": "/sounds/celebrate-click-loud.wav",
  "celebrate-step-loud": "/sounds/celebrate-step-loud.wav",
  "celebrate-drum-hit": "/sounds/celebrate-drum-hit.wav",
  "celebrate-cymbal": "/sounds/celebrate-cymbal.wav",
  "celebrate-triangle": "/sounds/celebrate-triangle.wav",
  "celebrate-sweep-up": "/sounds/celebrate-sweep-up.wav",
  "celebrate-sweep-down": "/sounds/celebrate-sweep-down.wav",
  "celebrate-bubble-long": "/sounds/celebrate-bubble-long.wav",
  "celebrate-robot": "/sounds/celebrate-robot.wav",
  "celebrate-magic-chime": "/sounds/celebrate-magic-chime.wav",
  "celebrate-bell-church": "/sounds/celebrate-bell-church.wav",
  "bisalasa-success-bright": "/sounds/bisalasa-success-bright.wav",
  "bisalasa-success-perfect": "/sounds/bisalasa-success-perfect.wav",
  "bisalasa-gift-reveal": "/sounds/bisalasa-gift-reveal.wav",
  "bisalasa-badge-unlock": "/sounds/bisalasa-level-up.wav",
  "bisalasa-celebration-small": "/sounds/bisalasa-success-perfect.wav",
  "bisalasa-celebration-class": "/sounds/bisalasa-celebration-class.wav",
  "bisalasa-fireworks-impact": "/sounds/bisalasa-fireworks-impact.wav",
  "bisalasa-level-up": "/sounds/bisalasa-level-up.wav",
  "bisalasa-gentle-correction": "/sounds/bisalasa-gentle-correction.wav",
  "bisalasa-countdown-tick": "/sounds/celebrate-tick.wav",
  "bisalasa-student-picker": "/sounds/bisalasa-student-picker.wav",
  "bisalasa-session-finish": "/sounds/bisalasa-session-finish.wav",
  // v12: 15 أصوات إضافية
  "celebrate-correct-fast": "/sounds/bisalasa-success-bright.wav",
  "celebrate-wrong-buzz": "/sounds/bisalasa-gentle-correction.wav",
  "celebrate-drum-build": "/sounds/celebrate-drum-build.wav",
  "celebrate-magic-sparkle": "/sounds/celebrate-magic-sparkle.wav",
  "celebrate-success-bell": "/sounds/celebrate-success-bell.wav",
  "celebrate-fail-buzzer": "/sounds/celebrate-fail-buzzer.wav",
  "celebrate-tick": "/sounds/celebrate-tick.wav",
  "celebrate-countdown": "/sounds/celebrate-countdown.wav",
  "celebrate-magic-appear": "/sounds/celebrate-magic-appear.wav",
  "celebrate-magic-disappear": "/sounds/celebrate-magic-disappear.wav",
  "celebrate-correct-ding": "/sounds/celebrate-correct-ding.wav",
  "celebrate-wrong-bonk": "/sounds/celebrate-wrong-bonk.wav",
  "celebrate-applause-cheer": "/sounds/celebrate-applause-cheer.wav",
  "celebrate-fanfare-royal": "/sounds/celebrate-fanfare-royal.wav",
  "celebrate-mystery": "/sounds/celebrate-mystery.wav",
  "click": "/sounds/click.wav",
  "step": "/sounds/step.wav",
};

class AudioEngine {
  private muted = false;
  private volume = 0.7;
  private sounds: Record<string, HowlType> = {};
  private soundsBySource: Record<string, HowlType> = {};
  private howler: typeof import("howler") | null = null;
  private howlerLoading: Promise<typeof import("howler")> | null = null;
  private initialized = false;
  private unlocked = false;
  private customSoundsLoaded = false;
  private customSoundsLoading: Promise<void> | null = null;

  private forEachUniqueSound(callback: (howl: HowlType) => void) {
    new Set(Object.values(this.sounds)).forEach(callback);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m) this.forEachUniqueSound((howl) => { try { howl.stop(); } catch {} });
  }

  setVolume(v: number) {
    this.volume = v;
    this.forEachUniqueSound((howl) => { try { howl.volume(v); } catch {} });
  }

  private async loadHowler() {
    if (this.howler) return this.howler;
    if (!this.howlerLoading) {
      this.howlerLoading = import("howler").then((module) => {
        this.howler = module;
        return module;
      });
    }
    return this.howlerLoading;
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    void this.loadHowler().then(({ Howler }) => {
      this.init();
      // لا نسحب كل الأصوات المخصصة أو ملفات WAV عند أول نقرة.
      // Howler سيحمّل الصوت المطلوب فقط عند أول تشغيل فعلي.
      try {
        if (Howler.ctx?.state === "suspended") Howler.ctx.resume().catch(() => {});
        const click = this.sounds["click"];
        if (click) {
          click.volume(0);
          const id = click.play();
          setTimeout(() => { try { click.stop(id); } catch {}; click.volume(this.volume); }, 50);
        }
      } catch (e) { console.warn("Audio unlock failed:", e); }
    }).catch((e) => console.warn("Audio unlock failed:", e));
  }

  private getOrCreateSound(key: string, src: string) {
    const existing = this.sounds[key];
    if (existing) return existing;
    if (!this.howler) return null;
    const shared = this.soundsBySource[src] || new this.howler.Howl({
      src: [src],
      volume: this.volume,
      // Critical: do not fetch all 80+ WAV files during unlock/boot.
      preload: false,
      rate: 1.0,
      html5: false,
    });
    this.soundsBySource[src] = shared;
    this.sounds[key] = shared;
    return shared;
  }

  private init() {
    if (this.initialized || !this.howler) return;
    this.initialized = true;
    Object.entries(SOUND_FILES).forEach(([key, src]) => this.getOrCreateSound(key, src));
  }

  // تحميل بيانات الأصوات المخصصة من IndexedDB فقط؛ ملفاتها تُنشأ عند الطلب.
  private loadCustomSounds(): Promise<void> {
    if (this.customSoundsLoaded) return Promise.resolve();
    if (this.customSoundsLoading) return this.customSoundsLoading;
    this.customSoundsLoading = import("./data-store")
      .then(({ getAllCustomSounds }) => getAllCustomSounds())
      .then((customSounds) => {
        for (const cs of customSounds) {
          if (cs.filePath) this.getOrCreateSound(cs.id, cs.filePath);
        }
        this.customSoundsLoaded = true;
      })
      .catch((e) => console.warn("Failed to load custom sounds:", e))
      .finally(() => { this.customSoundsLoading = null; });
    return this.customSoundsLoading;
  }

  // إضافة صوت مخصص جديد دون تحميل ملفه حتى يطلبه المستخدم.
  addCustomSound(id: string, filePath: string) {
    void this.loadHowler().then(() => {
      const previous = this.sounds[id];
      if (previous) { try { previous.unload(); } catch {} }
      delete this.sounds[id];
      this.getOrCreateSound(id, filePath);
    });
  }

  // حذف صوت مخصص
  removeCustomSound(id: string) {
    const sound = this.sounds[id];
    if (sound) { try { sound.unload(); } catch {} }
    delete this.sounds[id];
  }

  play(type: SoundType | string) {
    if (this.muted) return;
    void this.playAsync(type);
  }

  private async playAsync(type: SoundType | string) {
    try {
      const { Howler } = await this.loadHowler();
      this.init();
      if (Howler.ctx?.state === "suspended") Howler.ctx.resume().catch(() => {});

      let sound = this.sounds[type];
      if (!sound) {
        // Custom sounds are looked up once, then played after metadata is ready.
        await this.loadCustomSounds();
        sound = this.sounds[type];
      }
      if (!sound) {
        console.warn(`Sound "${type}" not found`);
        return;
      }
      sound.volume(this.volume);
      const soundId = sound.play();
      setTimeout(() => {
        if (sound?.playing(soundId)) {
          try {
            sound.fade(this.volume, 0, 200, soundId);
            setTimeout(() => { try { sound?.stop(soundId); } catch {} }, 250);
          } catch {}
        }
      }, 2800);
    } catch (e) { console.warn(`Failed to play sound ${type}:`, e); }
  }
}

export const audioEngine = new AudioEngine();

/**
 * Keeps the (singleton) audioEngine's mute/volume in sync with settings.
 * Shared by IframeStage and KeyboardShortcuts so the sync logic exists
 * exactly once instead of being duplicated in both components.
 */
export function useAudioSettingsSync(muted: boolean, volume: number) {
  useEffect(() => {
    audioEngine.setMuted(muted);
    audioEngine.setVolume(volume);
  }, [muted, volume]);
}

if (typeof window !== "undefined") {
  window.addEventListener("play-sound", ((e: CustomEvent) => { audioEngine.play(e.detail.type as SoundType); }) as EventListener);
  const unlockEvents: (keyof WindowEventMap)[] = ["click", "touchstart", "touchend", "keydown", "pointerdown"];
  const unlockHandler = () => { audioEngine.unlock(); unlockEvents.forEach((evt) => { window.removeEventListener(evt, unlockHandler, true); }); };
  unlockEvents.forEach((evt) => { window.addEventListener(evt, unlockHandler, true); });
}

// ====================================================================
//  Confetti Engine - بألوان البراند + أشكال متنوعة + فوق كل الـ overlays
// ====================================================================
const BRAND_COLORS = ["#0142A0", "#DA151C", "#FFD700", "#FFFFFF", "#4A90E2", "#10b981", "#a855f7", "#ec4899"];

// Create a custom confetti instance with high z-index, sized/positioned to
// exactly match the iframe-visible-area (not the full viewport) — so
// particles are naturally clipped at the same boundary a teacher's
// screen-share/projector zoom actually shows students.
let highConfettiInstance: ReturnType<typeof confetti.create> | null = null;
let confettiCanvasEl: HTMLCanvasElement | null = null;
function syncConfettiCanvasToStage() {
  if (!confettiCanvasEl) return;
  const bounds = getStageBoundsRaw();
  if (!bounds || bounds.width < 10 || bounds.height < 10) return;
  const dpr = window.devicePixelRatio || 1;
  confettiCanvasEl.style.left = `${bounds.left}px`;
  confettiCanvasEl.style.top = `${bounds.top}px`;
  confettiCanvasEl.style.width = `${bounds.width}px`;
  confettiCanvasEl.style.height = `${bounds.height}px`;
  // resize:false means confetti.js won't do this itself — the actual pixel
  // buffer (not just CSS display size) must be set explicitly, or bursts
  // render into a stale/default-sized buffer stretched via CSS (blurry,
  // and confetti.js's own particle math would use the wrong coordinate space).
  const targetW = Math.round(bounds.width * dpr);
  const targetH = Math.round(bounds.height * dpr);
  if (confettiCanvasEl.width !== targetW || confettiCanvasEl.height !== targetH) {
    confettiCanvasEl.width = targetW;
    confettiCanvasEl.height = targetH;
  }
}
function getStageBoundsRaw() {
  if (typeof window === "undefined") return null;
  const stage = document.querySelector(".iframe-visible-area") as HTMLElement | null;
  if (!stage) return null;
  return stage.getBoundingClientRect();
}
function getHighConfetti() {
  if (highConfettiInstance) { syncConfettiCanvasToStage(); return highConfettiInstance; }
  if (typeof window === "undefined") return confetti as unknown as ReturnType<typeof confetti.create>;
  // Create custom canvas bounded to the visible stage area
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999"; // فوق كل الـ overlays
  document.body.appendChild(canvas);
  confettiCanvasEl = canvas;
  syncConfettiCanvasToStage();
  window.addEventListener("resize", syncConfettiCanvasToStage);
  const ro = new ResizeObserver(syncConfettiCanvasToStage);
  const stageEl = document.querySelector(".iframe-visible-area");
  if (stageEl) ro.observe(stageEl);
  setInterval(syncConfettiCanvasToStage, 300); // catches layout changes without a resize event
  highConfettiInstance = confetti.create(canvas, { resize: false, useWorker: false });
  return highConfettiInstance;
}

function getStageOrigin() {
  // Origin fractions are relative to the confetti canvas itself, which is
  // now sized to match the stage exactly — so the full 0..1 range IS the
  // visible stage, with a margin so bursts don't start flush against the edge.
  const margin = 0.15;
  return { xMin: margin, xMax: 1 - margin, yMin: margin, yMax: 1 - margin, cx: 0.5, cy: 0.5 };
}

// Helper: استخدم highConfetti بدلاً من confetti العادي
const c = () => getHighConfetti();

export function fireConfetti(opts?: { originY?: number; particleCount?: number; }) {
  const o = getStageOrigin(); const colors = BRAND_COLORS;
  c()({ particleCount: opts?.particleCount ?? 100, spread: 90, origin: { x: o.cx, y: opts?.originY ?? o.cy }, colors, scalar: 1, ticks: 150 });
  setTimeout(() => { c()({ particleCount: 40, angle: 60, spread: 60, origin: { x: o.xMin + 0.05, y: o.yMax - 0.1 }, colors }); c()({ particleCount: 40, angle: 120, spread: 60, origin: { x: o.xMax - 0.05, y: o.yMax - 0.1 }, colors }); }, 150);
}
export function fireBigCelebration() {
  const o = getStageOrigin(); const colors = BRAND_COLORS; const end = Date.now() + 1500;
  (function frame() { c()({ particleCount: 6, angle: 60, spread: 70, origin: { x: o.xMin + 0.02, y: o.cy }, colors }); c()({ particleCount: 6, angle: 120, spread: 70, origin: { x: o.xMax - 0.02, y: o.cy }, colors }); if (Date.now() < end) requestAnimationFrame(frame); })();
}
export function fireHeartConfetti() { const o = getStageOrigin(); c()({ particleCount: 80, spread: 100, origin: { x: o.cx, y: o.cy }, colors: ["#ec4899", "#f43f5e", "#DA151C", "#FFD700"], shapes: ["heart" as never], scalar: 1.5, ticks: 200 }); }
export function fireStarConfetti() { const o = getStageOrigin(); const colors = ["#FFD700", "#fbbf24", "#0142A0", "#FFFFFF"]; c()({ particleCount: 60, spread: 120, origin: { x: o.cx, y: o.cy }, colors, shapes: ["star" as never], scalar: 1.3, ticks: 180 }); setTimeout(() => { c()({ particleCount: 40, angle: 90, spread: 60, startVelocity: 45, origin: { x: o.cx, y: o.yMin + 0.02 }, colors, shapes: ["star" as never], scalar: 1.5 }); }, 200); }
export function fireMoneyConfetti() { const o = getStageOrigin(); c()({ particleCount: 100, spread: 80, origin: { x: o.cx, y: o.cy }, colors: ["#10b981", "#059669", "#FFD700", "#fbbf24"], shapes: ["circle" as never], scalar: 1.2, ticks: 200 }); }
export function fireMegaCelebration() { const o = getStageOrigin(); const colors = BRAND_COLORS; c()({ particleCount: 150, spread: 360, startVelocity: 40, origin: { x: o.cx, y: o.cy }, colors, shapes: ["star", "circle", "heart", "square"] as never[], scalar: 1.3, ticks: 250 }); setTimeout(() => fireStarConfetti(), 300); setTimeout(() => fireHeartConfetti(), 600); setTimeout(() => fireBigCelebration(), 900); }
export function fireGiftRain() { const o = getStageOrigin(); const colors = ["#ec4899", "#a855f7", "#FFD700", "#10b981", "#0142A0", "#DA151C"]; c()({ particleCount: 60, spread: 120, startVelocity: 25, origin: { x: o.cx, y: o.yMin + 0.02 }, colors, shapes: ["star" as never], scalar: 1.8, ticks: 300, gravity: 0.5, decay: 0.92 }); setTimeout(() => { c()({ particleCount: 50, spread: 120, startVelocity: 25, origin: { x: o.cx, y: o.yMin + 0.02 }, colors, shapes: ["circle" as never], scalar: 1.5, ticks: 300, gravity: 0.5 }); }, 300); setTimeout(() => { c()({ particleCount: 40, spread: 100, startVelocity: 25, origin: { x: o.cx, y: o.yMin + 0.02 }, colors, shapes: ["heart" as never], scalar: 1.6, ticks: 300, gravity: 0.5 }); }, 600); }
export function fireBalloons() { const o = getStageOrigin(); const colors = ["#ec4899", "#0142A0", "#10b981", "#FFD700", "#a855f7", "#DA151C"]; c()({ particleCount: 50, spread: 80, startVelocity: 15, origin: { x: o.cx, y: o.yMax - 0.02 }, colors, shapes: ["circle" as never], scalar: 2.2, ticks: 400, gravity: -0.5, decay: 0.98 }); setTimeout(() => { c()({ particleCount: 40, spread: 80, startVelocity: 15, origin: { x: o.xMin + 0.1, y: o.yMax - 0.02 }, colors, shapes: ["circle" as never], scalar: 2, ticks: 400, gravity: -0.5 }); c()({ particleCount: 40, spread: 80, startVelocity: 15, origin: { x: o.xMax - 0.1, y: o.yMax - 0.02 }, colors, shapes: ["circle" as never], scalar: 2, ticks: 400, gravity: -0.5 }); }, 200); }
export function fireFireworks() { const o = getStageOrigin(); const colors = BRAND_COLORS; const end = Date.now() + 2000; const points = [{ x: o.xMin + (o.xMax - o.xMin) * 0.3, y: o.yMin + (o.yMax - o.yMin) * 0.4 }, { x: o.xMin + (o.xMax - o.xMin) * 0.7, y: o.yMin + (o.yMax - o.yMin) * 0.4 }, { x: o.cx, y: o.yMin + (o.yMax - o.yMin) * 0.3 }]; let i = 0; (function frame() { const p = points[i % points.length]; c()({ particleCount: 50, spread: 360, startVelocity: 30, origin: { x: p.x, y: p.y }, colors, shapes: ["star", "circle"] as never[], scalar: 1.2, ticks: 200 }); i++; if (Date.now() < end) setTimeout(frame, 250); })(); }
export function fireStarRain() { const o = getStageOrigin(); const colors = ["#FFD700", "#fbbf24", "#FFFFFF", "#0142A0"]; const end = Date.now() + 1500; (function frame() { c()({ particleCount: 8, spread: 120, startVelocity: 20, origin: { x: o.cx + (Math.random() - 0.5) * (o.xMax - o.xMin), y: o.yMin + 0.02 }, colors, shapes: ["star" as never], scalar: 1.4, ticks: 250, gravity: 0.4 }); if (Date.now() < end) requestAnimationFrame(frame); })(); }
export function fireHeartExplosion() { const o = getStageOrigin(); const colors = ["#ec4899", "#f43f5e", "#DA151C", "#FFD700", "#a855f7"]; c()({ particleCount: 120, spread: 360, startVelocity: 35, origin: { x: o.cx, y: o.cy }, colors, shapes: ["heart" as never], scalar: 1.6, ticks: 250 }); setTimeout(() => { c()({ particleCount: 60, spread: 360, startVelocity: 25, origin: { x: o.cx, y: o.cy }, colors, shapes: ["heart" as never], scalar: 1.3, ticks: 200 }); }, 200); }
export function fireTitleParade() { const o = getStageOrigin(); const colors = ["#0142A0", "#DA151C", "#FFD700", "#FFFFFF", "#a855f7"]; const shapes = ["star", "circle", "heart", "square"]; for (let i = 0; i < 4; i++) { setTimeout(() => { c()({ particleCount: 40, spread: 90, startVelocity: 25, origin: { x: o.xMin + (o.xMax - o.xMin) * (0.2 + i * 0.2), y: o.yMin + 0.05 }, colors, shapes: [shapes[i % shapes.length] as never], scalar: 1.5, ticks: 350, gravity: 0.3 }); }, i * 250); } }
export function fireRainbowBurst() { const o = getStageOrigin(); c()({ particleCount: 200, spread: 360, startVelocity: 45, origin: { x: o.cx, y: o.cy }, colors: ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#4b0082", "#9400d3"], shapes: ["circle" as never], scalar: 1.2, ticks: 250 }); }

// v11: 10 احتفالات إضافية
export function fireSnowFall() { const o = getStageOrigin(); const colors = ["#FFFFFF", "#E0E7FF", "#BFDBFE"]; const end = Date.now() + 2500; (function frame() { c()({ particleCount: 5, spread: 100, startVelocity: 5, origin: { x: o.cx + (Math.random() - 0.5) * (o.xMax - o.xMin), y: o.yMin + 0.02 }, colors, shapes: ["circle" as never], scalar: 1.5, ticks: 400, gravity: 0.1, decay: 0.99 }); if (Date.now() < end) requestAnimationFrame(frame); })(); }
export function fireConfettiCannon() { const o = getStageOrigin(); const colors = BRAND_COLORS; c()({ particleCount: 80, spread: 70, startVelocity: 55, origin: { x: o.xMin + 0.05, y: o.yMax - 0.05 }, angle: 60, colors, scalar: 1.2, ticks: 200 }); setTimeout(() => c()({ particleCount: 80, spread: 70, startVelocity: 55, origin: { x: o.xMax - 0.05, y: o.yMax - 0.05 }, angle: 120, colors, scalar: 1.2, ticks: 200 }), 200); }
export function fireGoldenShower() { const o = getStageOrigin(); const colors = ["#FFD700", "#fbbf24", "#fde047"]; const end = Date.now() + 2000; (function frame() { c()({ particleCount: 8, spread: 180, startVelocity: 10, origin: { x: o.cx + (Math.random() - 0.5) * (o.xMax - o.xMin), y: o.yMin + 0.02 }, colors, shapes: ["star" as never, "circle" as never], scalar: 1.3, ticks: 300, gravity: 0.6 }); if (Date.now() < end) requestAnimationFrame(frame); })(); }
export function fireSchoolPride() { const o = getStageOrigin(); c()({ particleCount: 100, spread: 90, startVelocity: 40, origin: { x: o.cx, y: o.yMax - 0.05 }, angle: 90, colors: ["#0142A0", "#DA151C", "#FFD700", "#FFFFFF"], shapes: ["star", "circle", "square"] as never[], scalar: 1.3, ticks: 250, gravity: 0.8 }); }
export function fireDiscoLights() { const o = getStageOrigin(); const colors = ["#ff006e", "#fb5607", "#ffbe0b", "#8338ec", "#3a86ff"]; for (let i = 0; i < 8; i++) { setTimeout(() => { c()({ particleCount: 30, spread: 360, startVelocity: 25, origin: { x: o.xMin + (o.xMax - o.xMin) * (i / 8), y: o.cy }, colors: [colors[i % colors.length]], shapes: ["circle" as never], scalar: 1.5, ticks: 200 }); }, i * 100); } }
export function fireSpringBlossom() { const o = getStageOrigin(); const colors = ["#fbcfe8", "#f9a8d4", "#fce7f3", "#fda4af"]; const end = Date.now() + 2000; (function frame() { c()({ particleCount: 6, spread: 120, startVelocity: 15, origin: { x: o.cx + (Math.random() - 0.5) * (o.xMax - o.xMin), y: o.yMin + 0.02 }, colors, shapes: ["circle" as never], scalar: 1.8, ticks: 350, gravity: 0.3, decay: 0.98 }); if (Date.now() < end) requestAnimationFrame(frame); })(); }
export function fireTornadoSpin() { const o = getStageOrigin(); const colors = BRAND_COLORS; let angle = 0; const end = Date.now() + 1500; (function frame() { angle = (angle + 30) % 360; c()({ particleCount: 5, spread: 30, startVelocity: 30, angle, origin: { x: o.cx, y: o.cy }, colors, shapes: ["star", "circle"] as never[], scalar: 1.2, ticks: 200 }); if (Date.now() < end) requestAnimationFrame(frame); })(); }
export function fireDiamondBurst() { const o = getStageOrigin(); const colors = ["#FFFFFF", "#E0E7FF", "#C7D2FE", "#BFDBFE"]; c()({ particleCount: 120, spread: 360, startVelocity: 50, origin: { x: o.cx, y: o.cy }, colors, shapes: ["square" as never], scalar: 1.4, ticks: 300 }); }
export function fireEmojiRain() { const o = getStageOrigin(); const colors = ["#FFD700", "#FF6B6B", "#4ECDC4"]; const end = Date.now() + 2000; (function frame() { c()({ particleCount: 5, spread: 100, startVelocity: 10, origin: { x: o.cx + (Math.random() - 0.5) * (o.xMax - o.xMin), y: o.yMin + 0.02 }, colors, shapes: ["star" as never], scalar: 2, ticks: 400, gravity: 0.4 }); if (Date.now() < end) requestAnimationFrame(frame); })(); }
export function fireChampionBurst() { const o = getStageOrigin(); const colors = ["#FFD700", "#fbbf24", "#FFFFFF"]; c()({ particleCount: 150, spread: 100, startVelocity: 45, origin: { x: o.cx, y: o.cy }, colors, shapes: ["star", "circle"] as never[], scalar: 1.5, ticks: 300 }); setTimeout(() => fireStarConfetti(), 400); setTimeout(() => fireGoldenShower(), 800); }

// ===== v9: 14 احتفال إضافي جديد =====
export function fireRocketCelebration() { const o = getStageOrigin(); const colors = ["#FFD700", "#fbbf24", "#DA151C"]; c()({ particleCount: 40, spread: 30, startVelocity: 60, origin: { x: o.cx, y: o.yMax - 0.05 }, angle: 90, colors, shapes: ["circle" as never], scalar: 1.8, ticks: 200 }); setTimeout(() => { c()({ particleCount: 80, spread: 360, startVelocity: 35, origin: { x: o.cx, y: o.yMin + 0.15 }, colors, shapes: ["star" as never, "circle" as never], scalar: 1.5, ticks: 250 }); }, 500); }
export function fireSwordClash() { const o = getStageOrigin(); const colors = ["#C0C0C0", "#FFFFFF", "#FFD700"]; c()({ particleCount: 60, spread: 360, startVelocity: 50, origin: { x: o.cx, y: o.cy }, colors, shapes: ["square" as never], scalar: 1.3, ticks: 150 }); setTimeout(() => c()({ particleCount: 40, spread: 180, startVelocity: 30, origin: { x: o.cx, y: o.cy }, colors, shapes: ["star" as never], scalar: 1.5, ticks: 200 }), 150); }
export function fireCrownGlow() { const o = getStageOrigin(); const colors = ["#FFD700", "#fbbf24", "#fde047"]; c()({ particleCount: 80, spread: 60, startVelocity: 25, origin: { x: o.cx, y: o.cy }, colors, shapes: ["star" as never], scalar: 1.8, ticks: 300, gravity: 0.3 }); setTimeout(() => fireGoldenShower(), 400); }
export function fireMedalShine() { const o = getStageOrigin(); const colors = ["#FFD700", "#C0C0C0", "#CD7F32"]; for (let i = 0; i < 3; i++) { setTimeout(() => c()({ particleCount: 30, spread: 360, startVelocity: 20, origin: { x: o.cx + (i - 1) * 0.15, y: o.cy }, colors, shapes: ["circle" as never], scalar: 1.6, ticks: 250 }), i * 200); } }
export function fireShieldBurst() { const o = getStageOrigin(); const colors = ["#0142A0", "#3b82f6", "#60a5fa"]; c()({ particleCount: 70, spread: 360, startVelocity: 30, origin: { x: o.cx, y: o.cy }, colors, shapes: ["square" as never], scalar: 1.5, ticks: 300 }); }
export function fireTargetHit() { const o = getStageOrigin(); const colors = ["#DA151C", "#FFD700", "#FFFFFF"]; c()({ particleCount: 50, spread: 360, startVelocity: 45, origin: { x: o.cx, y: o.cy }, colors, shapes: ["circle" as never], scalar: 1.4, ticks: 200 }); setTimeout(() => c()({ particleCount: 30, spread: 30, startVelocity: 20, origin: { x: o.cx, y: o.cy }, colors, shapes: ["star" as never], scalar: 2, ticks: 300 }), 200); }
export function firePartyPopper() { const o = getStageOrigin(); const colors = BRAND_COLORS; c()({ particleCount: 100, spread: 90, startVelocity: 55, origin: { x: o.xMin + 0.05, y: o.yMin + 0.1 }, angle: 30, colors, shapes: ["star", "circle", "square"] as never[], scalar: 1.3, ticks: 250 }); setTimeout(() => c()({ particleCount: 100, spread: 90, startVelocity: 55, origin: { x: o.xMax - 0.05, y: o.yMin + 0.1 }, angle: 150, colors, shapes: ["star", "circle", "square"] as never[], scalar: 1.3, ticks: 250 }), 150); }
export function fireDragonFire() { const o = getStageOrigin(); const colors = ["#DA151C", "#f59e0b", "#fbbf24", "#FFFFFF"]; const end = Date.now() + 1500; (function frame() { c()({ particleCount: 8, spread: 40, startVelocity: 40, origin: { x: o.cx, y: o.yMax - 0.05 }, angle: 90, colors, shapes: ["circle" as never], scalar: 1.8, ticks: 200, gravity: 0.2 }); if (Date.now() < end) requestAnimationFrame(frame); })(); }
export function fireMagicWandSparkle() { const o = getStageOrigin(); const colors = ["#a855f7", "#c084fc", "#FFFFFF", "#FFD700"]; const end = Date.now() + 2000; (function frame() { c()({ particleCount: 3, spread: 360, startVelocity: 15, origin: { x: o.cx + (Math.random() - 0.5) * 0.3, y: o.cy + (Math.random() - 0.5) * 0.3 }, colors, shapes: ["star" as never], scalar: 1.2, ticks: 150 }); if (Date.now() < end) requestAnimationFrame(frame); })(); }
export function fireIceCrystal() { const o = getStageOrigin(); const colors = ["#bfdbfe", "#dbeafe", "#FFFFFF", "#93c5fd"]; c()({ particleCount: 80, spread: 360, startVelocity: 35, origin: { x: o.cx, y: o.cy }, colors, shapes: ["square" as never], scalar: 1.6, ticks: 350, gravity: 0.4 }); }
export function fireLightningStrike() { const o = getStageOrigin(); const colors = ["#FFD700", "#FFFFFF", "#fbbf24"]; c()({ particleCount: 50, spread: 10, startVelocity: 60, origin: { x: o.cx, y: o.yMin + 0.02 }, angle: 90, colors, shapes: ["square" as never], scalar: 1.5, ticks: 100 }); setTimeout(() => c()({ particleCount: 60, spread: 360, startVelocity: 40, origin: { x: o.cx, y: o.cy }, colors, shapes: ["star" as never], scalar: 1.3, ticks: 200 }), 100); }
export function fireTreasureChest() { const o = getStageOrigin(); const colors = ["#FFD700", "#fbbf24", "#a855f7", "#10b981"]; c()({ particleCount: 100, spread: 120, startVelocity: 45, origin: { x: o.cx, y: o.yMax - 0.05 }, angle: 90, colors, shapes: ["star", "circle", "square"] as never[], scalar: 1.5, ticks: 300, gravity: 0.5 }); setTimeout(() => fireGoldenShower(), 500); }
export function fireMedalStars() { const o = getStageOrigin(); const colors = ["#FFD700", "#C0C0C0", "#CD7F32"]; for (let i = 0; i < 5; i++) { setTimeout(() => c()({ particleCount: 20, spread: 360, startVelocity: 30, origin: { x: o.cx, y: o.cy }, colors, shapes: ["star" as never], scalar: 1.8, ticks: 250 }), i * 150); } }
export function fireDoubleRainbow() { const o = getStageOrigin(); const colors1 = ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#4b0082", "#9400d3"]; c()({ particleCount: 100, spread: 180, startVelocity: 30, origin: { x: o.cx, y: o.yMax - 0.05 }, angle: 90, colors: colors1, shapes: ["circle" as never], scalar: 1.2, ticks: 300, gravity: 0.3 }); setTimeout(() => c()({ particleCount: 80, spread: 180, startVelocity: 25, origin: { x: o.cx, y: o.yMax - 0.1 }, angle: 90, colors: colors1, shapes: ["circle" as never], scalar: 1, ticks: 350, gravity: 0.3 }), 300); }

export function fireCelebrationByType(type: string) {
  switch (type) {
    case "confetti": fireConfetti(); break;
    case "hearts": fireHeartConfetti(); break;
    case "stars": fireStarConfetti(); break;
    case "money": fireMoneyConfetti(); break;
    case "mega": fireMegaCelebration(); break;
    case "gift-rain": fireGiftRain(); break;
    case "balloons": fireBalloons(); break;
    case "fireworks": fireFireworks(); break;
    case "star-rain": fireStarRain(); break;
    case "heart-explosion": fireHeartExplosion(); break;
    case "title-parade": fireTitleParade(); break;
    case "rainbow": fireRainbowBurst(); break;
    // v11: 10 احتفالات إضافية
    case "snow": fireSnowFall(); break;
    case "cannon": fireConfettiCannon(); break;
    case "golden-shower": fireGoldenShower(); break;
    case "school-pride": fireSchoolPride(); break;
    case "disco": fireDiscoLights(); break;
    case "spring-blossom": fireSpringBlossom(); break;
    case "tornado": fireTornadoSpin(); break;
    case "diamond": fireDiamondBurst(); break;
    case "emoji-rain": fireEmojiRain(); break;
    case "champion": fireChampionBurst(); break;
    // ===== v9: 14 احتفال إضافي جديد =====
    case "rocket": fireRocketCelebration(); break;
    case "swords": fireSwordClash(); break;
    case "crown": fireCrownGlow(); break;
    case "medal": fireMedalShine(); break;
    case "shield": fireShieldBurst(); break;
    case "target": fireTargetHit(); break;
    case "party": firePartyPopper(); break;
    case "dragon": fireDragonFire(); break;
    case "magic-wand": fireMagicWandSparkle(); break;
    case "ice-crystal": fireIceCrystal(); break;
    case "lightning": fireLightningStrike(); break;
    case "treasure": fireTreasureChest(); break;
    case "medal-stars": fireMedalStars(); break;
    case "double-rainbow": fireDoubleRainbow(); break;
    default: fireConfetti();
  }
}

// ====================================================================
//  Script Splitter
// ====================================================================
export function splitScriptIntoSentences(
  script: string | string[] | undefined
): string[] {
  if (!script) return [];
  if (Array.isArray(script))
    return script.filter((s) => s.trim().length > 0);

  const sentences = script
    .split(/(?<=[\.\،\؛\!\؟\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences.length > 0 ? sentences : [script];
}

// ====================================================================
//  CSV Parser
// ====================================================================
export function parseStudentList(input: string): string[] {
  return input
    .split(/[\n,،;؛\t]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ====================================================================
//  File Reader
// ====================================================================
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ====================================================================
//  React App Import - يقرأ index.html من build ويعرضه
// ====================================================================
export async function importReactBuild(files: File[]): Promise<{
  html: string;
  manifest?: SlideManifest;
} | null> {
  // Find index.html
  const indexFile = files.find((f) => f.name === "index.html" || f.name.endsWith(".html"));
  if (!indexFile) return null;

  let html = await readFileAsText(indexFile);

  // Try to find and embed CSS/JS files
  const cssMatches = html.matchAll(/<link[^>]*href=["']\.?\/?([^"']+\.css)["'][^>]*>/g);
  const jsMatches = html.matchAll(/<script[^>]*src=["']\.?\/?([^"']+\.js)["'][^>]*><\/script>/g);

  const cssFiles: Record<string, string> = {};
  const jsFiles: Record<string, string> = {};

  for (const match of cssMatches) {
    const fileName = match[1].split("/").pop() || match[1];
    const file = files.find(
      (f) => f.name === fileName || f.name === match[1] || f.webkitRelativePath?.endsWith(match[1])
    );
    if (file) {
      cssFiles[match[1]] = await readFileAsText(file);
    }
  }

  for (const match of jsMatches) {
    const fileName = match[1].split("/").pop() || match[1];
    const file = files.find(
      (f) => f.name === fileName || f.name === match[1] || f.webkitRelativePath?.endsWith(match[1])
    );
    if (file) {
      jsFiles[match[1]] = await readFileAsText(file);
    }
  }

  // Replace CSS links with inline styles
  for (const [path, content] of Object.entries(cssFiles)) {
    const regex = new RegExp(
      `<link[^>]*href=["']\\.?\\/?${escapeRegExp(path)}["'][^>]*>`,
      "g"
    );
    html = html.replace(regex, `<style>\n${content}\n</style>`);
  }

  // Replace JS scripts with inline scripts
  for (const [path, content] of Object.entries(jsFiles)) {
    const regex = new RegExp(
      `<script[^>]*src=["']\\.?\\/?${escapeRegExp(path)}["'][^>]*><\\/script>`,
      "g"
    );
    html = html.replace(regex, `<script>\n${content}\n</script>`);
  }

  // Try to extract manifest
  const manifest = extractManifestFromHTML(html);
  return { html, manifest };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractManifestFromHTML(html: string): SlideManifest | undefined {
  const match = html.match(
    /<script[^>]*id=["']slide-manifest["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// ====================================================================
//  استخراج كل الأسئلة من الـ Manifest
//  (LessonQuestion النوع الموحّد مستورد من slide-schema.ts)
// ====================================================================
export function extractAllQuestions(manifest: SlideManifest | null): LessonQuestion[] {
  if (!manifest) return [];
  const questions: LessonQuestion[] = [];

  // من الأفكار (ideas)
  if (manifest.ideas) {
    for (const idea of manifest.ideas) {
      for (const step of idea.steps) {
        if (step.type === "question" && step.question?.text) {
          questions.push({
            text: step.question.text,
            correctAnswer: step.question.correctAnswer,
            options: step.question.options,
            rewardPoints: step.question.rewardPoints || 5,
            ideaTitle: idea.title,
            // v6.0: tag with ideaId + stepNumber for QuestionProvider filtering
            ideaId: idea.id,
            stepNumber: step.step,
            difficulty: "medium",
            tags: [],
            gameReady: true,
          });
        }
      }
    }
  }

  // من الخطوات المسطحة
  if (manifest.steps) {
    for (const step of manifest.steps) {
      if (step.type === "question" && step.question?.text) {
        questions.push({
          text: step.question.text,
          correctAnswer: step.question.correctAnswer,
          options: step.question.options,
          rewardPoints: step.question.rewardPoints || 5,
          step: step.step,
          // v6.0: tag for QuestionProvider
          ideaId: "flat",
          stepNumber: step.step,
          difficulty: "medium",
          tags: [],
          gameReady: true,
        });
      }
    }
  }

  return questions;
}

// ====================================================================
//  Step Effect Runner
//  لا يشغل confetti تلقائياً عند الانتقال - فقط صوت خطوة خفيف
//  الكونفيتي يُشغل فقط يدوياً (زر الاحتفال) أو عند إجابة صحيحة
// ====================================================================
export function runStepEffect(step: { effect?: string; sound?: { onEnter?: string }; type?: string } | null) {
  if (!step) return;
  // C50 (P1 fix): removed automatic "step" sound — it played on EVERY MANIFEST
  // receipt (which happens twice on load: initial + REQUEST_MANIFEST response),
  // causing a repeated/annoying sound. Also played on every step change via
  // the MANIFEST handler, which was not the intended behavior. If a step has
  // a configured sound.onEnter, play that instead; otherwise stay silent.
  if (step.sound?.onEnter) {
    try { audioEngine.play(step.sound.onEnter); } catch {}
  }
}

// ====================================================================
//  Format Helpers
// ====================================================================
export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ar-EG", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function getBadgeLabel(type: string): string {
  const labels: Record<string, string> = {
    correct: "إجابة صحيحة",
    "good-try": "محاولة جيدة",
    fast: "أسرع إجابة",
    creative: "تفكير إبداعي",
    helper: "مساعدة الزملاء",
    star: "نجمة",
    wrong: "إجابة خاطئة",
  };
  return labels[type] || type;
}

export function getBadgeIcon(type: string): string {
  const icons: Record<string, string> = {
    correct: "🏆",
    "good-try": "⭐",
    fast: "⚡",
    creative: "🎨",
    helper: "🤝",
    star: "✨",
    wrong: "❌",
  };
  return icons[type] || "⭐";
}

// ====================================================================
//  Whiteboard Helpers
// ====================================================================
export const WHITEBOARD_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  red: "#ef4444",
  green: "#10b981",
  black: "#1a1a1a",
  white: "#ffffff",
  yellow: "#fbbf24",
};

export function getToolCursor(tool: string): string {
  switch (tool) {
    case "pen":
      return "crosshair";
    case "laser":
      return "none";
    case "eraser":
      return "cell";
    case "text":
      return "text";
    case "shape":
    case "arrow":
    case "check":
    case "x":
    case "star":
    case "highlighter":
      return "crosshair";
    default:
      return "default";
  }
}
