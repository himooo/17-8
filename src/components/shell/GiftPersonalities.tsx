"use client";

import { useShellStore } from "@/lib/shell-store";
import { playSmartSound } from "@/lib/smart-audio";

/**
 * GiftPersonality — كل هدية لها شخصية وصوت مميز
 *
 * بدل إعطاء "هدية عامة" لكل طالب، النظام يقترح
 * الهدية المناسبة حسب شخصية الطالب وسياق الإنجاز
 */

interface GiftPersonality {
  id: string;
  name: string;           // اسم الهدية
  emoji: string;          // الإيموجي المميز
  personality: string;    // الشخصية المرتبطة بها
  sound: string;          // الصوت الخاص بها
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;
}

const GIFT_PERSONALITIES: GiftPersonality[] = [
  { id: "star-badge", name: "نجمة ذهبية", emoji: "⭐", personality: "النجاح المستمر", sound: "celebrate-chime", rarity: "common", description: "للطالب المثابر الذي يحاول دائماً" },
  { id: "trophy", name: "كأس الفوز", emoji: "🏆", personality: "الانتصار الكبير", sound: "celebrate-champion", rarity: "epic", description: "للفوز بالمركز الأول في منافسة" },
  { id: "rocket", name: "صاروخ", emoji: "🚀", personality: "الانطلاق السريع", sound: "celebrate-rocket", rarity: "common", description: "للإجابة السريعة البارعة" },
  { id: "crown", name: "تاج الملك", emoji: "👑", personality: "القيادة", sound: "celebrate-fanfare-royal", rarity: "legendary", description: "لأداء استثنائي متكرر" },
  { id: "shield", name: "درع الحماية", emoji: "🛡️", personality: "الثبات والصبر", sound: "celebrate-success-bell", rarity: "common", description: "للطالب الذي لا يستسلم" },
  { id: "gem", name: "جوهرة نادرة", emoji: "💎", personality: "الإتقان", sound: "celebrate-gift", rarity: "rare", description: "للإجابات المتقنة والمميزة" },
  { id: "medal", name: "ميدالية", emoji: "🥇", personality: "الإنجاز", sound: "celebrate-fanfare-short", rarity: "rare", description: "للإنجازات المحددة" },
  { id: "lightning", name: "برق", emoji: "⚡", personality: "السرعة الفائقة", sound: "celebrate-whoosh", rarity: "common", description: "لأسرع إجابة صحيحة" },
  { id: "brain", name: "عقل ذكي", emoji: "🧠", personality: "التفكير العميق", sound: "celebrate-magic-chime", rarity: "rare", description: "لأسئلة تتطلب تفكير عميق" },
  { id: "book", name: "كتاب الحكمة", emoji: "📚", personality: "المعرفة", sound: "celebrate-bell", rarity: "common", description: "للطالب المثقف" },
  { id: "bell", name: "الجرس الذهبي", emoji: "🔔", personality: "الإعلان عن خبر", sound: "celebrate-ding-dong", rarity: "common", description: "لإعلان خبر سار للطالب" },
  { id: "heart", name: "قلب ذهبي", emoji: "💛", personality: "اللطف", sound: "celebrate-cheer-soft", rarity: "common", description: "للطالب اللطيف والمتعاون" },
];

// ============================================================
// Smart Gift Suggester
// ============================================================

export function suggestGift(studentPersonality?: string): GiftPersonality {
  if (!studentPersonality) {
    return GIFT_PERSONALITIES[Math.floor(Math.random() * GIFT_PERSONALITIES.length)];
  }
  const matches: Record<string, string> = {
    "النجم السريع ⚡": "lightning",
    "العبقري الدقيق 🎯": "brain",
    "المفكر السريع 🚀": "rocket",
    "النشيط دائماً 🔥": "star-badge",
    "المخضرم الموثوق 💪": "shield",
    "الهادئ المراقب 👀": "book",
    "الصاعد المتحدي 🌱": "heart",
    "المتعلم المجتهد 📚": "book",
  };
  const matchId = matches[studentPersonality];
  return GIFT_PERSONALITIES.find((g) => g.id === matchId) || GIFT_PERSONALITIES[0];
}

// ============================================================
// QuickGiftPanel — إعطاء هدية فورية
// ============================================================

export function QuickGiftPanel({ onClose }: { onClose: () => void }) {
  const currentlyCalledStudent = useShellStore((s) => s.currentlyCalledStudent);
  const awardGiftToStudent = useShellStore((s) => s.awardGiftToStudent);
  const playSound = useShellStore((s) => s.playSound);

  const give = (gift: GiftPersonality) => {
    if (!currentlyCalledStudent) {
      // Fallback: silent no-op — the panel only opens when a student is selected anyway.
      playSound("error");
      return;
    }

    awardGiftToStudent(
      currentlyCalledStudent.id,
      currentlyCalledStudent.name,
      gift.id,
      gift.name,
      gift.emoji
    );

    playSmartSound("gift-given", {
      studentName: currentlyCalledStudent.name,
      studentId: currentlyCalledStudent.id,
      intensity: 2,
    });

    playSound(gift.sound as never);
  };

  return (
    <div className="p-3 space-y-3">
      <div className="text-xs font-bold text-white/70 uppercase">
        {currentlyCalledStudent ? `هدية لـ ${currentlyCalledStudent.name}` : "هدية فورية — اختر طالباً أولاً"}
      </div>
      <div className="grid grid-cols-4 gap-1.5 max-h-[50vh] overflow-y-auto">
        {GIFT_PERSONALITIES.map((g) => (
          <button
            key={g.id}
            onClick={() => give(g)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 transition"
            style={{ backgroundColor: "#ffffff08" }}
            title={`${g.name} — ${g.description}`}
          >
            <span className="text-xl">{g.emoji}</span>
            <span className="text-[8px] text-white/70 text-center leading-tight">{g.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
