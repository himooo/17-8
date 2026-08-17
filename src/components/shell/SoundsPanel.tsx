"use client";

import { useState } from "react";
import { useShellStore } from "@/lib/shell-store";
import { GameOverlay } from "./GameOverlay";

/**
 * SoundsPanel — لوحة اختبار وتشغيل كل الأصوات المتاحة
 * منظمة حسب الفئة مع معاينة فورية
 */

interface SoundEntry {
  id: string;
  label: string;
  icon: string;
  category: "success" | "error" | "celebration" | "transition" | "game" | "ui";
  description: string;
}

const SOUNDS: SoundEntry[] = [
  // === نجاح ===
  { id: "success", label: "نجاح", icon: "✅", category: "success", description: "صاعد ولطيف" },
  { id: "celebrate-correct-ding", label: "دينج صحيح", icon: "🔔", category: "success", description: "نغمة نقية" },
  { id: "celebrate-correct-fast", label: "صح سريع", icon: "⚡", category: "success", description: "سريع وحيوي" },
  { id: "celebrate-success-bell", label: "جرس النجاح", icon: "🔔", category: "success", description: "رنين ذهبي" },
  { id: "celebrate-win", label: "فوز", icon: "🏆", category: "success", description: "نغمة الفوز" },
  { id: "celebrate-level-up", label: "مستوى جديد", icon: "⬆️", category: "success", description: "ترقية" },

  // === خطأ ===
  { id: "error", label: "خطأ", icon: "❌", category: "error", description: "نغمة هابطة" },
  { id: "celebrate-wrong-buzz", label: "بازر خطأ", icon: "🔕", category: "error", description: "إنذار قصير" },
  { id: "celebrate-wrong-bonk", label: "بونك خطأ", icon: "💢", category: "error", description: "طنطنة" },
  { id: "celebrate-fail-buzzer", label: "بازر الفشل", icon: "🚫", category: "error", description: "خسارة" },
  { id: "celebrate-lose", label: "خسارة", icon: "😞", category: "error", description: "حزين" },
  { id: "celebrate-boo", label: "استهجان", icon: "👎", category: "error", description: "جمهور" },

  // === احتفالات ===
  { id: "celebrate", label: "احتفال عام", icon: "🎉", category: "celebration", description: "كونفيتي كلاسيكي" },
  { id: "celebrate-applause", label: "تصفيق", icon: "👏", category: "celebration", description: "يدوات خفيفة" },
  { id: "celebrate-applause-big", label: "تصفيق كبير", icon: "🙌", category: "celebration", description: "حاشد" },
  { id: "celebrate-applause-huge", label: "تصفيق هائل", icon: "🎊", category: "celebration", description: "مليون شخص" },
  { id: "celebrate-applause-cheer", label: "تصفيق + هتاف", icon: "📣", category: "celebration", description: "حماسي" },
  { id: "celebrate-fanfare", label: "فانفار", icon: "🎺", category: "celebration", description: "ملكية" },
  { id: "celebrate-fanfare-big", label: "فانفار كبير", icon: "🎻", category: "celebration", description: "أوركسترا" },
  { id: "celebrate-fanfare-long", label: "فانفار طويل", icon: "🎷", category: "celebration", description: "موسيقى رسمية" },
  { id: "celebrate-fanfare-short", label: "فانفار قصير", icon: "🎺", category: "celebration", description: "سينمائي" },
  { id: "celebrate-fanfare-victory", label: "فانفار النصر", icon: "🎖️", category: "celebration", description: "انتصار" },
  { id: "celebrate-fanfare-royal", label: "فانفار ملكي", icon: "👑", category: "celebration", description: "فخم" },
  { id: "celebrate-victory", label: "نصر", icon: "🏅", category: "celebration", description: "غلبان" },
  { id: "celebrate-champion", label: "البطل", icon: "🥇", category: "celebration", description: "تتويج" },
  { id: "celebrate-fireworks", label: "ألعاب نارية", icon: "🎆", category: "celebration", description: "سماوية" },
  { id: "celebrate-tada", label: "تادا!", icon: "✨", category: "celebration", description: "كشف سحري" },
  { id: "celebrate-magic", label: "سحر", icon: "🪄", category: "celebration", description: "عصاية سحرية" },
  { id: "celebrate-magic-chime", label: "أجراس سحرية", icon: "🔔", category: "celebration", description: "خيال" },
  { id: "celebrate-magic-sparkle", label: "لمعان سحري", icon: "✨", category: "celebration", description: "تألق" },
  { id: "celebrate-magic-appear", label: "ظهور سحري", icon: "🎩", category: "celebration", description: "ها هو!" },
  { id: "celebrate-magic-disappear", label: "إخفاء سحري", icon: "🎭", category: "celebration", description: "اختفى!" },
  { id: "celebrate-magic-wand", label: "عصاية سحرية", icon: "🪄", category: "celebration", description: "تأثير خاص" },
  { id: "celebrate-gift", label: "هدية", icon: "🎁", category: "celebration", description: "مفاجأة" },
  { id: "celebrate-cheer-soft", label: "هتاف ناعم", icon: "🎵", category: "celebration", description: "تشجيع خفيف" },
  { id: "celebrate-cheer-loud", label: "هتاف صاخب", icon: "📢", category: "celebration", description: "جمهور" },
  { id: "celebrate-yay", label: "ياي!", icon: "🥳", category: "celebration", description: "فرح شديد" },
  { id: "celebrate-wow", label: "واو!", icon: "😲", category: "celebration", description: "دهشة" },
  { id: "celebrate-laugh", label: "ضحك", icon: "😄", category: "celebration", description: "مرح" },
  { id: "celebrate-cash", label: "نقود", icon: "💵", category: "celebration", description: "نقود كثيرة" },
  { id: "celebrate-coin-drop", label: "سقوط قطعة", icon: "🪙", category: "celebration", description: "نقود ذهبية" },
  { id: "celebrate-referee", label: "حكم", icon: "🧑‍⚖️", category: "celebration", description: "صافرة" },
  { id: "celebrate-whistle", label: "صافرة", icon: "🎊", category: "celebration", description: "رياضية" },
  { id: "celebrate-horn", label: "هورن", icon: "📯", category: "celebration", description: "عالي" },
  { id: "celebrate-airhorn", label: "هورن هوائي", icon: "🔊", category: "celebration", description: "قوي" },
  { id: "celebrate-students", label: "طلاب", icon: "👨‍🎓", category: "celebration", description: "جمهور طلابي" },
  { id: "celebrate-crowd", label: "جمهور", icon: "👥", category: "celebration", description: "هتاف جماهيري" },
  { id: "celebrate-stamp", label: "ختم", icon: "🖋️", category: "celebration", description: "رسمي" },
  { id: "celebrate-clap", label: "تصفيق يدوي", icon: "👏", category: "celebration", description: "يدين" },
  { id: "celebrate-cuckoo", label: "كوكو", icon: "🐦", category: "celebration", description: "ساعة" },
  { id: "celebrate-bird", label: "طائر", icon: "🐦", category: "celebration", description: "طبيعة" },
  { id: "celebrate-sword", label: "سيف", icon: "⚔️", category: "celebration", description: "ملحمي" },
  { id: "celebrate-charge", label: "شحنة", icon: "⚡", category: "celebration", description: "طاقة" },
  { id: "celebrate-rocket", label: "صاروخ", icon: "🚀", category: "celebration", description: "إطلاق" },
  { id: "celebrate-drumroll", label: "طبل رول", icon: "🥁", category: "celebration", description: "ترقب" },
  { id: "celebrate-drum-roll-long", label: "طبل طويل", icon: "🥁", category: "celebration", description: "تشويق" },
  { id: "celebrate-drum-roll-longer", label: "طبل أطول", icon: "🥁", category: "celebration", description: "حماس ممتد" },
  { id: "celebrate-drum-hit", label: "ضربة طبل", icon: "🥁", category: "celebration", description: "قوية" },
  { id: "celebrate-drum-build", label: "بناء طبول", icon: "🎵", category: "celebration", description: "متصاعد" },
  { id: "celebrate-cymbal", label: "صنج", icon: "🎶", category: "celebration", description: "موسيقي" },
  { id: "celebrate-triangle", label: "مثلث", icon: "🔺", category: "celebration", description: "ناعم" },
  { id: "celebrate-thunder", label: "رعد", icon: "⚡", category: "celebration", description: "قوي" },
  { id: "celebrate-alarm", label: "إنذار", icon: "🚨", category: "celebration", description: "انتباه" },
  { id: "celebrate-buzzer", label: "بازر", icon: "📢", category: "celebration", description: "تنبيه" },
  { id: "celebrate-bell", label: "جرس", icon: "🔔", category: "celebration", description: "كلاسيكي" },
  { id: "celebrate-bell-church", label: "جرس الكنيسة", icon: "⛪", category: "celebration", description: "عميق" },
  { id: "celebrate-chime", label: "تشايم", icon: "🎐", category: "celebration", description: "هادئ" },
  { id: "celebrate-chime-bell", label: "تشايم جرس", icon: "🔔", category: "celebration", description: "جميل" },
  { id: "celebrate-ding-dong", label: "دينج دونج", icon: "🔔", category: "celebration", description: "باب" },
  { id: "celebrate-robot", label: "روبوت", icon: "🤖", category: "celebration", description: "آلي" },
  { id: "celebrate-bubble", label: "فقاعة", icon: "🫧", category: "celebration", description: "خفيف" },
  { id: "celebrate-bubble-pop", label: "فقاعة منبثقة", icon: "🎈", category: "celebration", description: "فرقعة" },
  { id: "celebrate-bubble-long", label: "فقاعات طويلة", icon: "🫧", category: "celebration", description: "ممتد" },
  { id: "celebrate-sweep-up", label: "كنس صاعد", icon: "⬆️", category: "celebration", description: "ارتفاع" },
  { id: "celebrate-sweep-down", label: "كنس هابط", icon: "⬇️", category: "celebration", description: "انخفاض" },
  { id: "celebrate-whoosh", label: "وشوشة", icon: "💨", category: "celebration", description: "هواء" },
  { id: "celebrate-pop", label: "بوب", icon: "💥", category: "celebration", description: "فرقعة صغير" },
  { id: "celebrate-sparkle", label: "تلألؤ", icon: "✨", category: "celebration", description: "بريق" },
  { id: "celebrate-mystery", label: "غموض", icon: "🔮", category: "celebration", description: "سحري غامض" },
  { id: "celebrate-medium", label: "احتفال وسط", icon: "🎉", category: "celebration", description: "متوازن" },

  // === انتقالات ===
  { id: "click", label: "نقرة", icon: "🖱️", category: "ui", description: "زر" },
  { id: "step", label: "خطوة", icon: "👣", category: "transition", description: "صغيرة" },
  { id: "celebrate-step-loud", label: "خطوة عالية", icon: "👟", category: "transition", description: "واضحة" },
  { id: "celebrate-click-loud", label: "نقرة عالية", icon: "🖲️", category: "transition", description: "مؤكدة" },

  // === ألعاب ===
  { id: "celebrate-tick", label: "تكة", icon: "⏱️", category: "game", description: "عداد" },
  { id: "celebrate-countdown", label: "عد تنازلي", icon: "⏲️", category: "game", description: "وقت" },
  { id: "celebrate-spin", label: "دوران", icon: "🌀", category: "game", description: "عجلة" },
];

const CATEGORIES = [
  { id: "success", label: "✅ نجاح", color: "#10b981" },
  { id: "error", label: "❌ خطأ", color: "#ef4444" },
  { id: "celebration", label: "🎉 احتفالات", color: "#f59e0b" },
  { id: "game", label: "🎮 ألعاب", color: "#8b5cf6" },
  { id: "transition", label: "👟 انتقالات", color: "#06b6d4" },
  { id: "ui", label: "🖱️ واجهة", color: "#64748b" },
] as const;

export function SoundsPanel({ onClose }: { onClose: () => void }) {
  const playSound = useShellStore((s) => s.playSound);
  const [activeCategory, setActiveCategory] = useState<string | null>("celebration");
  const [lastPlayed, setLastPlayed] = useState<string | null>(null);

  const play = (sound: SoundEntry) => {
    playSound(sound.id as never);
    setLastPlayed(sound.id);
    setTimeout(() => setLastPlayed(null), 1500);
  };

  const filtered = activeCategory
    ? SOUNDS.filter((s) => s.category === activeCategory)
    : SOUNDS;

  return (
    <GameOverlay open onClose={onClose} title={`🎵 مكتبة الأصوات (${SOUNDS.length})`} accentColor="#f59e0b" widthPercent={90} heightPercent={85}>
      <div className="p-4">
        {/* فلتر الفئات */}
        <div className="flex flex-wrap gap-1.5 mb-4 sticky top-0 bg-background/80 backdrop-blur z-10 pb-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
              activeCategory === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 hover:bg-secondary"
            }`}
          >
            الكل ({SOUNDS.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = SOUNDS.filter((s) => s.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as never)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? "text-white"
                    : "bg-secondary/50 hover:bg-secondary"
                }`}
                style={{
                  backgroundColor: activeCategory === cat.id ? cat.color : undefined,
                }}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        {/* الأصوات */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[55vh] overflow-y-auto">
          {filtered.map((sound) => (
            <button
              key={sound.id}
              onClick={() => play(sound)}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition hover:scale-105 active:scale-95 ${
                lastPlayed === sound.id ? "ring-2 ring-yellow-400 bg-yellow-400/20" : ""
              }`}
              style={{
                backgroundColor: lastPlayed === sound.id ? undefined : `${CATEGORIES.find((c) => c.id === sound.category)?.color}20`,
                border: `1px solid ${CATEGORIES.find((c) => c.id === sound.category)?.color}40`,
              }}
              title={sound.description}
            >
              <span className="text-2xl">{sound.icon}</span>
              <span className="text-[10px] font-bold text-white text-center leading-tight">
                {sound.label}
              </span>
            </button>
          ))}
        </div>

        <div className="text-xs text-white/40 text-center mt-3">
          اضغط على أي صوت لتشغيله فوراً — {SOUNDS.length} صوت متاح في المشروع
        </div>
      </div>
    </GameOverlay>
  );
}
