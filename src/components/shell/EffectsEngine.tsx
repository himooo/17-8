// ====================================================================
//  CelebrationEngine.tsx — v8.0
//  نظام احتفالات متطور لكل صوت وكل مناسبة.
//
//  المميزات:
//    - كلمات عربية متحركة (أحسنت! / ممتاز! / بطل! / إلخ)
//    - أنيميشن CSS مخصص لكل نوع (قلوب، نجوم، ألعاب نارية، قصاصات)
//    - canvas-confetti لأشكال ثلاثية الأبعاد (قلوب، نجوم، مربعات)
//    - كل صوت له احتفاله الخاص المختلف تماماً
// =================================================================///
"use client";

import { useEffect, useRef, useState } from "react";
import { useShellStore } from "@/lib/shell-store";
import { fireCelebrationByType } from "@/lib/shell-utils";
import { useStageBounds } from "@/lib/stage-bounds";

// ====================================================================
//  خريطة: كل صوت → احتفاله + كلمته العربية
// ====================================================================
const SOUND_CELEBRATION_MAP: Record<string, {
  type: string;        // نوع canvas-confetti
  word: string | null; // كلمة عربية متحركة
  color: string;       // لون الكلمة
}> = {
  // ----- تصفيق -----
  "applause": { type: "confetti", word: "👏 تصفيق", color: "#FFD700" },
  "celebrate-applause-big": { type: "confetti", word: "تصفيق كبير!", color: "#FFD700" },
  "celebrate-applause-cheer": { type: "confetti", word: "هييييا!", color: "#FFD700" },
  "celebrate-applause-huge": { type: "mega", word: "تصفيق هائل!", color: "#FFD700" },
  "celebrate-cheer-loud": { type: "confetti", word: "هيا بنا!", color: "#FFD700" },
  "celebrate-cheer-soft": { type: "spring-blossom", word: "أحسنت", color: "#fbcfe8" },
  "celebrate-clap": { type: "confetti", word: "👏", color: "#FFD700" },
  "dragon-studio-crowd-cheer-406646": { type: "confetti", word: "الجمهور يهتف!", color: "#FFD700" },

  // ----- أجراس -----
  "celebrate-bell": { type: "chime", word: "🔔", color: "#FFFFFF" },
  "celebrate-bell-church": { type: "chime", word: "كنيسة", color: "#FFFFFF" },
  "celebrate-chime": { type: "chime", word: "رنين", color: "#FFFFFF" },
  "celebrate-chime-bell": { type: "chime", word: "🔔", color: "#FFFFFF" },
  "celebrate-ding-dong": { type: "chime", word: "دنگ دنگ", color: "#FFFFFF" },
  "celebrate-success-bell": { type: "chime", word: "نجاح!", color: "#10b981" },
  "celebrate-triangle": { type: "chime", word: "🔔", color: "#FFFFFF" },

  // ----- صحيح -----
  "celebrate-correct-ding": { type: "stars", word: "صحيح!", color: "#10b981" },
  "celebrate-correct-fast": { type: "stars", word: "صحيح! سريع!", color: "#10b981" },

  // ----- خطأ -----
  "celebrate-boo": { type: "none", word: "بووو!", color: "#ef4444" },
  "celebrate-buzz": { type: "none", word: "خطأ", color: "#ef4444" },
  "celebrate-buzzer": { type: "none", word: "خطأ!", color: "#ef4444" },
  "celebrate-wrong-buzz": { type: "none", word: "إجابة خاطئة", color: "#ef4444" },
  "celebrate-wrong-bonk": { type: "none", word: "بونك!", color: "#ef4444" },
  "celebrate-fail-buzzer": { type: "none", word: "فشل", color: "#ef4444" },
  "celebrate-lose": { type: "none", word: "خسارة", color: "#ef4444" },

  // ----- احتفال كبير -----
  "celebrate-tada": { type: "mega", word: "تادا!", color: "#FFD700" },
  "celebrate-win": { type: "champion", word: "فوز!", color: "#FFD700" },
  "celebrate-victory": { type: "champion", word: "نصر!", color: "#FFD700" },
  "celebrate-champion": { type: "champion", word: "بطل!", color: "#FFD700" },
  "celebrate-yay": { type: "balloons", word: "ياي!", color: "#ec4899" },
  "celebrate-wow": { type: "rainbow", word: "وااو!", color: "#a855f7" },

  // ----- فانفير -----
  "celebrate-fanfare-big": { type: "cannon", word: "فانفير!", color: "#0142A0" },
  "celebrate-fanfare-long": { type: "cannon", word: "فانفير طويل!", color: "#0142A0" },
  "celebrate-fanfare-royal": { type: "cannon", word: "ملكي!", color: "#FFD700" },
  "celebrate-fanfare-short": { type: "cannon", word: "فانفير!", color: "#0142A0" },
  "celebrate-fanfare-victory": { type: "cannon", word: "نصر!", color: "#FFD700" },

  // ----- طبول -----
  "celebrate-drum-roll-long": { type: "tornado", word: "طبول...", color: "#92400e" },
  "celebrate-drum-roll-longer": { type: "tornado", word: "طبول...", color: "#92400e" },
  "celebrate-drumroll": { type: "tornado", word: "طبول", color: "#92400e" },
  "celebrate-drum-build": { type: "tornado", word: "تصاعد...", color: "#92400e" },
  "celebrate-drum-hit": { type: "diamond", word: "ضربة!", color: "#FFFFFF" },
  "celebrate-cymbal": { type: "diamond", word: "صنج!", color: "#FFFFFF" },
  "celebrate-charge": { type: "tornado", word: "هجوم!", color: "#DA151C" },
  "celebrate-stamp": { type: "diamond", word: "ختم!", color: "#FFFFFF" },

  // ----- هدايا -----
  "celebrate-gift": { type: "gift-rain", word: "🎁 هدية!", color: "#ec4899" },

  // ----- نقود -----
  "celebrate-cash": { type: "money", word: "نقود!", color: "#10b981" },
  "celebrate-coin-drop": { type: "money", word: "عملة!", color: "#10b981" },

  // ----- سحر -----
  "celebrate-magic": { type: "sparkle", word: "✨ سحر!", color: "#a855f7" },
  "celebrate-magic-appear": { type: "sparkle", word: "ظهور سحري!", color: "#a855f7" },
  "celebrate-magic-disappear": { type: "sparkle", word: "اختفاء!", color: "#a855f7" },
  "celebrate-magic-sparkle": { type: "sparkle", word: "✨", color: "#a855f7" },
  "celebrate-magic-chime": { type: "sparkle", word: "رنين سحري", color: "#a855f7" },
  "celebrate-magic-wand": { type: "sparkle", word: "عصا سحرية!", color: "#a855f7" },
  "celebrate-sparkle": { type: "sparkle", word: "✨", color: "#a855f7" },

  // ----- صواريخ وألعاب نارية -----
  "celebrate-rocket": { type: "fireworks", word: "صاروخ!", color: "#FFD700" },
  "dragon-studio-fireworks-07-419025": { type: "fireworks", word: "ألعاب نارية!", color: "#FFD700" },

  // ----- مستوى أعلى -----
  "celebrate-level-up": { type: "star-rain", word: "مستوى أعلى!", color: "#FFD700" },

  // ----- فقاعات -----
  "celebrate-bubble": { type: "spring-blossom", word: "فقاعة!", color: "#06b6d4" },
  "celebrate-bubble-long": { type: "spring-blossom", word: "فقاعات!", color: "#06b6d4" },
  "celebrate-bubble-pop": { type: "spring-blossom", word: "بوب!", color: "#06b6d4" },

  // ----- صافرة -----
  "celebrate-whistle": { type: "none", word: null, color: "#FFFFFF" },
  "celebrate-referee": { type: "none", word: "حكم!", color: "#FFFFFF" },

  // ----- مثير -----
  "celebrate-mystery": { type: "disco", word: "غامض...", color: "#8338ec" },
  "celebrate-countdown": { type: "none", word: "عد تنازلي...", color: "#FFFFFF" },
  "celebrate-tick": { type: "none", word: null, color: "#FFFFFF" },

  // ----- طيور وضحك -----
  "celebrate-bird": { type: "spring-blossom", word: "طائر!", color: "#10b981" },
  "celebrate-laugh": { type: "emoji-rain", word: "هههه!", color: "#FFD700" },
  "celebrate-cuckoo": { type: "spring-blossom", word: "كوكو!", color: "#10b981" },

  // ----- روبوت -----
  "celebrate-robot": { type: "diamond", word: "روبوت!", color: "#3a86ff" },

  // ----- صوت سيف -----
  "celebrate-sword": { type: "diamond", word: "سيف!", color: "#C0C0C0" },

  // ----- مسح صوتي -----
  "celebrate-sweep-down": { type: "none", word: null, color: "#FFFFFF" },
  "celebrate-sweep-up": { type: "none", word: null, color: "#FFFFFF" },
  "celebrate-whoosh": { type: "none", word: null, color: "#FFFFFF" },

  // ----- تنبيه -----
  "celebrate-alarm": { type: "none", word: "تنبيه!", color: "#ef4444" },
  "celebrate-thunder": { type: "none", word: "رعد!", color: "#ef4444" },
  "celebrate-pop": { type: "sparkle", word: "بوب!", color: "#a855f7" },
  "celebrate-click-loud": { type: "none", word: null, color: "#FFFFFF" },
  "celebrate-step-loud": { type: "none", word: null, color: "#FFFFFF" },

  // ----- بوق السيارة -----
  "ennismore-goofy-ahh-car-horn-200870": { type: "none", word: "بوق!", color: "#FFD700" },
  "dragon-studio-air-horn-sound-effect-372453": { type: "none", word: "بوق قوي!", color: "#FFD700" },
  "universfield-wah-wah-horn-117724": { type: "none", word: "واه واه!", color: "#ef4444" },
  "dragon-studio-gun-reload-2-504027": { type: "none", word: null, color: "#FFFFFF" },

  // ----- أصوات عامة -----
  "click": { type: "none", word: null, color: "#FFFFFF" },
  "step": { type: "none", word: null, color: "#FFFFFF" },

  // ----- أضواء ديسكو -----
  "celebrate-spin": { type: "disco", word: "دوران!", color: "#8338ec" },
};

// الكلمات الافتراضية لكل نوع احتفال
const DEFAULT_WORDS: Record<string, { word: string | null; color: string }> = {
  "confetti": { word: "أحسنت!", color: "#FFD700" },
  "hearts": { word: "❤️ أحبك!", color: "#ec4899" },
  "stars": { word: "⭐ ممتاز!", color: "#FFD700" },
  "money": { word: "نقود!", color: "#10b981" },
  "mega": { word: "احتفال كبير!", color: "#FFD700" },
  "gift-rain": { word: "🎁 هدايا!", color: "#ec4899" },
  "balloons": { word: "🎈 بالونات!", color: "#ec4899" },
  "fireworks": { word: "ألعاب نارية!", color: "#FFD700" },
  "star-rain": { word: "مطر النجوم!", color: "#FFD700" },
  "heart-explosion": { word: "انفجار قلوب!", color: "#ec4899" },
  "title-parade": { word: "عرض!", color: "#0142A0" },
  "rainbow": { word: "قوس قزح!", color: "#a855f7" },
  "snow": { word: "ثلج!", color: "#FFFFFF" },
  "cannon": { word: "مدفع!", color: "#0142A0" },
  "golden-shower": { word: "ذهب!", color: "#FFD700" },
  "school-pride": { word: "فخر!", color: "#0142A0" },
  "disco": { word: "ديسكو!", color: "#8338ec" },
  "spring-blossom": { word: "أزهار!", color: "#fbcfe8" },
  "tornado": { word: "إعصار!", color: "#92400e" },
  "diamond": { word: "ألماس!", color: "#FFFFFF" },
  "emoji-rain": { word: "إيموجي!", color: "#FFD700" },
  "champion": { word: "بطل!", color: "#FFD700" },
  "sparkle": { word: "✨", color: "#a855f7" },
  "chime": { word: "🔔", color: "#FFFFFF" },
  "none": { word: null, color: "#FFFFFF" },
};

// ====================================================================
//  EffectsEngine — يستمع للإشارات ويطلق الاحتفالات
// ====================================================================
export function EffectsEngine() {
  const confettiSignal = useShellStore((s) => s.confettiSignal);
  const redFlashSignal = useShellStore((s) => s.redFlashSignal);
  const greenFlashSignal = useShellStore((s) => s.greenFlashSignal);
  const isPicking = useShellStore((s) => s.isPicking);
  const currentlyCalledStudent = useShellStore((s) => s.currentlyCalledStudent);
  const students = useShellStore((s) => s.students);
  const celebrationType = useShellStore((s) => s.celebrationType);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const playSound = useShellStore((s) => s.playSound);

  // ===== Word overlay state =====
  const [wordOverlay, setWordOverlay] = useState<{ word: string; color: string; id: number } | null>(null);
  const wordIdRef = useRef(0);

  // ===== Confetti =====
  const prevConfetti = useRef(0);
  useEffect(() => {
    if (confettiSignal > prevConfetti.current) {
      let type = celebrationType || "confetti";
      let word: string | null = null;
      let color = "#FFD700";

      // If celebrationType is set, use it + its word
      if (celebrationType) {
        const mapped = SOUND_CELEBRATION_MAP[celebrationType];
        if (mapped) {
          type = mapped.type;
          word = mapped.word;
          color = mapped.color;
        }
        setTimeout(() => setCelebrationType(null), 2000);
      } else {
        // Default: random celebration
        const types = Object.keys(DEFAULT_WORDS).filter(t => t !== "none");
        type = types[confettiSignal % types.length];
        const def = DEFAULT_WORDS[type];
        word = def.word;
        color = def.color;
      }

      // Fire confetti
      if (type !== "none") {
        fireCelebrationByType(type);
      }

      // Show word overlay
      if (word) {
        const id = ++wordIdRef.current;
        setWordOverlay({ word, color, id });
        setTimeout(() => {
          setWordOverlay(prev => prev?.id === id ? null : prev);
        }, 2500);
      }
    }
    prevConfetti.current = confettiSignal;
  }, [confettiSignal, celebrationType, setCelebrationType]);

  // ===== Red flash =====
  const prevRedFlash = useRef(0);
  useEffect(() => {
    if (redFlashSignal > prevRedFlash.current) {
      const el = document.createElement("div");
      el.style.cssText = `position:fixed;inset:0;background:rgba(239,68,68,0.2);pointer-events:none;z-index:9998;animation:red-flash-anim 0.4s ease-out forwards;`;
      if (!document.getElementById("red-flash-keyframes")) {
        const style = document.createElement("style");
        style.id = "red-flash-keyframes";
        style.textContent = `@keyframes red-flash-anim{0%,100%{opacity:0}50%{opacity:1}}`;
        document.head.appendChild(style);
      }
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 500);
    }
    prevRedFlash.current = redFlashSignal;
  }, [redFlashSignal]);

  // ===== Green flash =====
  const prevGreenFlash = useRef(0);
  useEffect(() => {
    if (greenFlashSignal > prevGreenFlash.current) {
      const el = document.createElement("div");
      el.style.cssText = `position:fixed;inset:0;background:rgba(16,185,129,0.15);pointer-events:none;z-index:9998;animation:green-flash-anim 0.4s ease-out forwards;`;
      if (!document.getElementById("green-flash-keyframes")) {
        const style = document.createElement("style");
        style.id = "green-flash-keyframes";
        style.textContent = `@keyframes green-flash-anim{0%,100%{opacity:0}50%{opacity:1}}`;
        document.head.appendChild(style);
      }
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 500);
    }
    prevGreenFlash.current = greenFlashSignal;
  }, [greenFlashSignal]);

  return (
    <>
      {isPicking && <NameRoulette students={students} />}
      {currentlyCalledStudent && !isPicking && (
        <StudentCallout student={currentlyCalledStudent} />
      )}
      {wordOverlay && <WordOverlay key={wordOverlay.id} word={wordOverlay.word} color={wordOverlay.color} />}
    </>
  );
}

// ====================================================================
//  WordOverlay — كلمة عربية متحركة في وسط الشاشة
// ====================================================================
function WordOverlay({ word, color }: { word: string; color: string }) {
  const bounds = useStageBounds();
  return (
    <div
      className="fixed z-[9999] flex items-center justify-center pointer-events-none"
      style={{
        left: bounds ? `${bounds.left}px` : 0,
        top: bounds ? `${bounds.top}px` : 0,
        width: bounds ? `${bounds.width}px` : "100vw",
        height: bounds ? `${bounds.height}px` : "100vh",
        animation: "word-pop 2.5s ease-out forwards",
      }}
    >
      <style>{`
        @keyframes word-pop {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          15% { transform: scale(1.3) rotate(5deg); opacity: 1; }
          30% { transform: scale(1) rotate(0deg); opacity: 1; }
          70% { transform: scale(1) rotate(0deg); opacity: 1; }
          100% { transform: scale(1.5) rotate(0deg); opacity: 0; }
        }
      `}</style>
      <div
        className="text-7xl font-black drop-shadow-2xl"
        style={{
          color,
          textShadow: `0 0 20px ${color}88, 0 0 40px ${color}44, 4px 4px 8px rgba(0,0,0,0.5)`,
          fontFamily: "Cairo, sans-serif",
        }}
      >
        {word}
      </div>
    </div>
  );
}

// ====================================================================
//  NameRoulette - حركة سحب الأسماء
// ====================================================================
function NameRoulette({ students }: { students: { name: string }[] }) {
  const [displayName, setDisplayName] = useState<string>(students[0]?.name || "");
  const bounds = useStageBounds();

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayName(students[i % students.length]?.name || "");
    }, 80);
    return () => clearInterval(interval);
  }, [students]);

  return (
    <div
      className="fixed z-[100] flex items-center justify-center pointer-events-none"
      style={{
        left: bounds ? `${bounds.left}px` : 0,
        top: bounds ? `${bounds.top}px` : 0,
        width: bounds ? `${bounds.width}px` : "100vw",
        height: bounds ? `${bounds.height}px` : "100vh",
      }}
    >
      <div className="bg-card border-4 border-primary rounded-3xl px-12 py-8 shadow-2xl animate-scale-in">
        <div className="text-[10px] text-muted-foreground text-center mb-2">جاري الاختيار...</div>
        <div className="text-5xl font-bold brand-text-gradient text-center min-w-[300px]">{displayName}</div>
        <div className="flex justify-center gap-1 mt-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ====================================================================
//  StudentCallout - عرض اسم الطالب بحجم كبير
// ====================================================================
function StudentCallout({ student }: { student: { id?: string; name: string; points: number } }) {
  // Use stable id to avoid remounting when points change mid-animation.
  // Fall back to name only if no id is available.
  return <StudentCalloutInner key={student.id ?? student.name} student={student} />;
}

function StudentCalloutInner({ student }: { student: { name: string; points: number } }) {
  const [visible, setVisible] = useState(true);
  const bounds = useStageBounds();
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;

  return (
    <div
      className="fixed -translate-x-1/2 z-[90] pointer-events-none animate-scale-in"
      style={{
        left: bounds ? `${bounds.centerX}px` : "50%",
        top: bounds ? `${bounds.top + bounds.height / 3}px` : "33%",
      }}
    >
      <div className="bg-card border-2 border-primary rounded-2xl px-8 py-5 shadow-2xl text-center">
        <div className="text-xs text-muted-foreground mb-1">الطالب المختار</div>
        <div className="text-4xl font-bold text-primary">{student.name}</div>
        <div className="text-sm text-muted-foreground mt-1">{student.points} نقطة</div>
      </div>
    </div>
  );
}
