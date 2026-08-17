"use client";

/**
 * SmartAudioEngine — نظام صوتي ذكي خارج الصندوق
 * 
 * بدلاً من تشغيل أصوات عشوائية، هذا المحرك:
 * 1. يتذكر آخر N أصوات لتجنب التكرار
 * 2. يختار تنويعات ذكية حسب السياق (أول صح، ثالث صح متتالي، خطأ بعد فوز...)
 * 3. يستخدم TTS للإعلان الصوتي باسم الطالب
 * 4. يبني "جو صوتي" متماسك لكل جلسة
 */

import { speak, speakWithWebSpeech, stopSpeaking } from "./tts-service";

let howlerModulePromise: Promise<typeof import("howler")> | null = null;
function loadHowler() {
  return (howlerModulePromise ??= import("howler"));
}

// ============================================================
// Types
// ============================================================

export type AudioContext =
  | "first-correct"           // أول إجابة صحيحة في الجلسة
  | "streak-3"                // 3 صح على التوالي
  | "streak-5"                // 5 صح على التوالي
  | "streak-10"               // 10 صح على التوالي
  | "first-wrong"             // أول خطأ
  | "after-win-wrong"         // خطأ بعد فوز
  | "low-energy"              // طالب هادي يحتاج تشجيع
  | "high-energy"             // طالب نشيط
  | "random-selection"        // اختيار عشوائي
  | "welcome-back"            // رجوع بعد غياب
  | "class-famous"            // طالب مشهور
  | "newcomer"                // طالب جديد
  | "celebration"             // احتفال عام (مكافآت، نجوم)
  | "gift-given"              // منح هدية
  | "default";

export interface AudioEvent {
  context: AudioContext;
  studentName?: string;
  studentId?: string;
  intensity?: 1 | 2 | 3;      // 1=خفيف، 2=متوسط، 3=مكثف
  metadata?: Record<string, unknown>;
}

interface VoiceLine {
  ar: string;                 // عربي
  en?: string;                // إنجليزي (fallback)
  priority: number;           // أعلى = أهم
  cooldown: number;           // cooldown بالثواني لتجنب التكرار
}

interface AudioProfile {
  id: string;
  name: string;
  wavFile?: string;           // مسار WAV
  ttsLines: VoiceLine[];      // الجمل الصوتية المحتملة
  conflictsWith?: string[];   // ما لا يُسمع معه
  followsAfter?: string[];    // ما يُفضل أن يأتي بعده
}

// ============================================================
// Audio Profiles - كل صوت له شخصية
// ============================================================

const AUDIO_PROFILES: AudioProfile[] = [
  {
    id: "success",
    name: "نجاح",
    wavFile: "/sounds/celebrate-correct-ding.wav",
    ttsLines: [
      { ar: "برافو عليك!", priority: 5, cooldown: 5 },
      { ar: "إجابة صحيحة!", priority: 4, cooldown: 3 },
      { ar: "عظيم!", priority: 3, cooldown: 0 },
      { ar: "هذا هو!", priority: 3, cooldown: 10 },
      { ar: "أحسنت!", priority: 4, cooldown: 5 },
    ],
    followsAfter: ["celebrate-ding-dong", "celebrate-chime"],
  },
  {
    id: "streak-fire",
    name: "سلسلة ساخنة",
    wavFile: "/sounds/celebrate-fanfare-short.wav",
    ttsLines: [
      { ar: "🔥 سلسلة نجاحات!", priority: 10, cooldown: 30 },
      { ar: "أنت محترف حقيقي!", priority: 8, cooldown: 20 },
      { ar: "لا يمكن إيقافك!", priority: 8, cooldown: 25 },
    ],
    followsAfter: ["success", "success", "success"],
  },
  {
    id: "error",
    name: "خطأ",
    wavFile: "/sounds/celebrate-wrong-buzz.wav",
    ttsLines: [
      { ar: "محاولة جيدة — جرب مرة أخرى", priority: 4, cooldown: 10 },
      { ar: "اقتربت!", priority: 3, cooldown: 15 },
      { ar: "الفكرة صحيحة، التفاصيل محتاجة مراجعة", priority: 3, cooldown: 30 },
    ],
  },
  {
    id: "celebration",
    name: "احتفال",
    wavFile: "/sounds/celebrate-applause.wav",
    ttsLines: [
      { ar: "🎊 احتفال كبير!", priority: 6, cooldown: 5 },
      { ar: "هذا ما نحب أن نراه!", priority: 5, cooldown: 8 },
    ],
  },
  {
    id: "student-call",
    name: "نداء طالب",
    wavFile: "/sounds/celebrate-ding-dong.wav",
    ttsLines: [
      { ar: "دورك!", priority: 5, cooldown: 0 },
      { ar: "أريد أن أسمع منك", priority: 4, cooldown: 5 },
      { ar: "هيا بنا!", priority: 3, cooldown: 10 },
    ],
  },
  {
    id: "gift-given",
    name: "هدية",
    wavFile: "/sounds/celebrate-gift.wav",
    ttsLines: [
      { ar: "لقد ربحت هدية!", priority: 5, cooldown: 3 },
      { ar: "مفاجأة رائعة!", priority: 4, cooldown: 5 },
    ],
  },
  {
    id: "game-start",
    name: "بداية لعبة",
    wavFile: "/sounds/celebrate-charge.wav",
    ttsLines: [
      { ar: "فلنبدأ!", priority: 5, cooldown: 0 },
      { ar: "استعدوا!", priority: 5, cooldown: 0 },
      { ar: "3... 2... 1... انطلق!", priority: 7, cooldown: 15 },
    ],
  },
  {
    id: "victory",
    name: "انتصار",
    wavFile: "/sounds/celebrate-victory.wav",
    ttsLines: [
      { ar: "🏆 بطل الفصل!", priority: 10, cooldown: 60 },
      { ar: "الفوز لك!", priority: 8, cooldown: 20 },
      { ar: "أنت نجم اليوم!", priority: 8, cooldown: 30 },
    ],
  },
  {
    id: "encouragement",
    name: "تشجيع",
    wavFile: "/sounds/celebrate-cheer-soft.wav",
    ttsLines: [
      { ar: "يمكنك فعلها!", priority: 4, cooldown: 10 },
      { ar: "لا تستسلم!", priority: 4, cooldown: 8 },
      { ar: "أنا أثق بك!", priority: 5, cooldown: 15 },
    ],
  },
  {
    id: "transition",
    name: "انتقال",
    wavFile: "/sounds/celebrate-whoosh.wav",
    ttsLines: [
      { ar: "الآن... العنصر التالي", priority: 3, cooldown: 5 },
      { ar: "انتبهوا هنا", priority: 4, cooldown: 8 },
    ],
  },
];

// ============================================================
// Smart Audio Engine
// ============================================================

class SmartAudioEngine {
  private history: Array<{ profileId: string; timestamp: number }> = [];
  private ttsHistory: Array<{ text: string; timestamp: number }> = [];
  private contextCounters: Map<AudioContext, number> = new Map();
  private currentStreak = 0;
  private lastContext: AudioContext = "default";
  private voicePreference: "ar" | "en" | "both" = "ar";
  private speechRate = 1.0;
  private speechPitch = 1.0;
  private speechVolume = 1.0;

  constructor() {
    if (typeof window !== "undefined") {
      this.loadVoices();
    }
  }

  private loadVoices() {
    if (!("speechSynthesis" in window)) return;
    // Warm up voices
    speechSynthesis.getVoices();
  }

  private getVoice(lang: "ar" | "en"): SpeechSynthesisVoice | null {
    if (!("speechSynthesis" in window)) return null;
    const voices = speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang.startsWith(lang === "ar" ? "ar" : "en")) || null
    );
  }

  /** اختيار تنويعة ذكية من الجمل المتاحة */
  private selectTTSText(profileId: string, context: AudioContext): string | null {
    const profile = AUDIO_PROFILES.find((p) => p.id === profileId);
    if (!profile) return null;

    const now = Date.now();
    const validLines = profile.ttsLines.filter((line) => {
      const lastUsed = this.ttsHistory.find((h) => h.text === line.ar);
      if (!lastUsed) return true;
      return now - lastUsed.timestamp > line.cooldown * 1000;
    });

    if (validLines.length === 0) {
      // Reset if all on cooldown
      this.ttsHistory = this.ttsHistory.filter(
        (h) => now - h.timestamp < 5000
      );
      return profile.ttsLines[0]?.ar || null;
    }

    // Weight by priority
    const totalWeight = validLines.reduce((sum, l) => sum + l.priority, 0);
    let rand = Math.random() * totalWeight;
    for (const line of validLines) {
      rand -= line.priority;
      if (rand <= 0) return line.ar;
    }
    return validLines[0].ar;
  }

  /** تشغيل TTS — يستخدم Google Translate TTS (أجود) مع fallback لـ Web Speech */
  private async speak(text: string, opts?: { rate?: number; pitch?: number; onEnd?: () => void }) {
    // أوقف أي نطق جاري
    stopSpeaking();

    const rate = opts?.rate ?? this.speechRate;

    // جرّب Google Translate TTS أولاً (أجود في العربي)
    const success = await speak(text, "ar", rate);

    // لو Google TTS فشل، استخدم Web Speech API (مع pitch)
    if (!success) {
      speakWithWebSpeech(text, "ar", rate, opts?.pitch ?? this.speechPitch, this.speechVolume);
    }

    // سجل في التاريخ
    this.ttsHistory.push({ text, timestamp: Date.now() });

    // استدعِ onEnd بعد تقدير المدة
    const estimatedDuration = Math.max(1000, text.length * 80);
    setTimeout(() => opts?.onEnd?.(), estimatedDuration);
  }

  /** تشغيل WAV */
  private async playWav(profile: AudioProfile, volume = 1.0): Promise<void> {
    if (!profile.wavFile) return;
    try {
      const { Howl } = await loadHowler();
      await new Promise<void>((resolve) => {
        const howl = new Howl({
          src: [profile.wavFile!],
          volume,
          onend: () => resolve(),
          onloaderror: () => resolve(),
        });
        howl.play();
      });
    } catch {
      // Audio is enhancement only; never block classroom interaction if the
      // browser cannot load the optional audio module or file.
    }
  }

  /**
   * المدخل الرئيسي: إطلاق حدث صوتي ذكي
   * يقرر: هل نُشغّل WAV؟ TTS؟ الاثنين معاً؟
   */
  async fire(event: AudioEvent): Promise<void> {
    const profile = this.selectProfile(event);
    if (!profile) return;

    // Check conflicts
    const recentIds = this.history
      .filter((h) => Date.now() - h.timestamp < 1000)
      .map((h) => h.profileId);
    if (profile.conflictsWith?.some((c) => recentIds.includes(c))) return;

    // Decision matrix:
    // - Success/celebration: WAV + TTS
    // - Error: WAV + silent (quiet)
    // - Student call: WAV + TTS student name
    // - Transition: WAV only
    const shouldSpeak = this.shouldSpeak(profile, event);
    const shouldWav = !!profile.wavFile;
    const intensity = event.intensity ?? 2;

    // 1. WAV always plays (it's the "punctuation")
    if (shouldWav) {
      const vol = intensity === 1 ? 0.4 : intensity === 2 ? 0.7 : 1.0;
      this.playWav(profile, vol);
    }

    // 2. TTS only if context warrants it
    if (shouldSpeak) {
      let ttsText = this.selectTTSText(profile.id, event.context);
      
      // Personalize with student name
      if (event.studentName && ttsText) {
        ttsText = this.personalizeForStudent(ttsText, event.studentName, event.context);
      }

      if (ttsText) {
        // Slight delay after WAV so they don't overlap unpleasantly
        setTimeout(() => {
          this.speak(ttsText, {
            rate: intensity === 3 ? 1.15 : 1.0,
            pitch: intensity === 3 ? 1.1 : 1.0,
          });
        }, 150);
      }
    }

    // Track history
    this.history.push({ profileId: profile.id, timestamp: Date.now() });
    this.lastContext = event.context;
    this.incrementContextCounter(event.context);
  }

  /** اختيار الـ profile الأنسب */
  private selectProfile(event: AudioEvent): AudioProfile | null {
    const { context, intensity } = event;

    // Context mapping
    const contextMap: Record<AudioContext, string> = {
      "first-correct": "success",
      "streak-3": "streak-fire",
      "streak-5": "streak-fire",
      "streak-10": "streak-fire",
      "first-wrong": "error",
      "after-win-wrong": "error",
      "low-energy": "encouragement",
      "high-energy": "celebration",
      "random-selection": "student-call",
      "welcome-back": "encouragement",
      "class-famous": "victory",
      "newcomer": "student-call",
      "celebration": "celebration",
      "gift-given": "gift-given",
      "default": "transition",
    };

    const profileId = contextMap[context] || "transition";
    const baseProfile = AUDIO_PROFILES.find((p) => p.id === profileId);

    // Intensity adjustment: for high intensity, sometimes upgrade to "big" version
    if (intensity === 3 && baseProfile) {
      const bigVersion = AUDIO_PROFILES.find((p) => p.id === `${profileId}-big`);
      if (bigVersion) return bigVersion;
    }

    return baseProfile || null;
  }

  /** هل نستخدم TTS هنا؟ */
  private shouldSpeak(profile: AudioProfile, event: AudioEvent): boolean {
    // ممنوع TTS متتالي — cooldown 3 ثوان
    const lastTTS = this.ttsHistory[this.ttsHistory.length - 1];
    if (lastTTS && Date.now() - lastTTS.timestamp < 3000) return false;

    // Low intensity → less likely to speak
    if (event.intensity === 1 && Math.random() > 0.4) return false;

    // Critical moments → always speak
    if (["first-correct", "streak-5", "streak-10", "victory", "class-famous"].includes(event.context)) {
      return true;
    }

    return Math.random() > 0.5;
  }

  /** تخصيص الرسالة باسم الطالب */
  private personalizeForStudent(template: string, name: string, context: AudioContext): string {
    const firstName = name.split(" ")[0];

    switch (context) {
      case "first-correct":
        return `${firstName}! ${template}`;
      case "streak-3":
        return `${firstName}، ${template}`;
      case "streak-5":
        return `يا ${firstName}! ${template}`;
      case "streak-10":
        return `لا يمكن إيقاف ${firstName}! ${template}`;
      case "random-selection":
        return `${firstName}، دورك!`;
      case "welcome-back":
        return `أهلاً بعودتك يا ${firstName}!`;
      case "class-famous":
        return `${firstName} نجم الفصل!`;
      default:
        return `${firstName}, ${template}`;
    }
  }

  private incrementContextCounter(ctx: AudioContext) {
    this.contextCounters.set(ctx, (this.contextCounters.get(ctx) ?? 0) + 1);
  }

  /** عداد للسياق (للمنطق مثل "3 correct in a row") */
  getContextCount(ctx: AudioContext): number {
    return this.contextCounters.get(ctx) ?? 0;
  }

  /** إعادة تعيين سلسلة context */
  resetContext(ctx: AudioContext) {
    this.contextCounters.delete(ctx);
  }

  /** تتبع سلسلة إجابات صحيحة */
  trackStreak(isCorrect: boolean): AudioContext {
    if (isCorrect) {
      this.currentStreak++;
      if (this.currentStreak === 1) return "first-correct";
      if (this.currentStreak === 3) return "streak-3";
      if (this.currentStreak === 5) return "streak-5";
      if (this.currentStreak === 10) return "streak-10";
      return "default";
    } else {
      this.currentStreak = 0;
      return this.lastContext === "celebration" ? "after-win-wrong" : "first-wrong";
    }
  }

  // Settings
  setRate(r: number) { this.speechRate = Math.max(0.5, Math.min(2.0, r)); }
  setPitch(p: number) { this.speechPitch = Math.max(0.5, Math.min(2.0, p)); }
  setVolume(v: number) { this.speechVolume = Math.max(0, Math.min(1, v)); }
  setLanguage(lang: "ar" | "en") { this.voicePreference = lang; }
}

// Singleton
export const smartAudio = new SmartAudioEngine();

// React hook
export function useSmartAudio() {
  return smartAudio;
}

// Convenience functions
export function playSmartSound(context: AudioContext, opts?: Partial<AudioEvent>) {
  return smartAudio.fire({ context, ...opts });
}
