"use client";

import { localDb } from "./local-db";

// ===== Types =====

export interface CelebrationConfig {
  id: string;
  label: string;
  icon: string;
  color: string;
  color2: string;
  tagline: string;
  hype: string;
  sound: string;
  /** Visual renderer selected by the teacher; legacy records default to confetti. */
  renderMode?: "confetti" | "particles" | "both";
  isDefault?: boolean;
  isCustom?: boolean;
  sortOrder?: number;
  // P1-6 fix: removed `effect?: CelebrationEffect` field — was dead.
  // The CelebrationEffect type lived in celebration-engine.ts together
  // with fireAdvancedCelebration() / cleanupCelebrationEngine() /
  // isEngineReady(), none of which were imported anywhere. The twin module
  // celebration-effects.ts (CELEBRATION_EFFECTS, getCelebrationEffect) was
  // equally dead. Both files are deleted in this pass; the canonical engine
  // lives in shell-utils.ts:fireCelebrationByType().
}

// ===== 36 default celebrations — مصدر واحد موحد =====

export const DEFAULT_CELEBRATIONS: CelebrationConfig[] = [
  { id: "confetti", label: "كونفيتي", icon: "🎉", color: "#f59e0b", color2: "#fb923c", tagline: "فرحة وسعادة", hype: "أداء مذهل!", sound: "celebrate-tada", renderMode: "confetti", isDefault: true, sortOrder: 0 },
  { id: "hearts", label: "قلوب الحب", icon: "💖", color: "#ec4899", color2: "#f472b6", tagline: "الحب يملأ القاعة", hype: "عمل رائع!", sound: "celebrate-chime", isDefault: true, sortOrder: 1 },
  { id: "stars", label: "نجوم ساطعة", icon: "⭐", color: "#fbbf24", color2: "#fde047", tagline: "تألّق مستمر", hype: "أداء مميز!", sound: "celebrate-sparkle", isDefault: true, sortOrder: 2 },
  { id: "money", label: "كنز النجاح", icon: "💰", color: "#10b981", color2: "#34d399", tagline: "مكافأة مستحقة", hype: "نقاط مضاعفة!", sound: "celebrate-cash", isDefault: true, sortOrder: 3 },
  { id: "balloons", label: "بالونات طائرة", icon: "🎈", color: "#a855f7", color2: "#c084fc", tagline: "إلى الأعالي!", hype: "روح عالية!", sound: "celebrate-bubble", isDefault: true, sortOrder: 4 },
  { id: "fireworks", label: "ألعاب نارية", icon: "🎆", color: "#ef4444", color2: "#fb7185", tagline: "انفجار نجاح!", hype: "إنجاز عظيم!", sound: "celebrate-fireworks", isDefault: true, sortOrder: 5 },
  { id: "gift-rain", label: "هطول الهدايا", icon: "🎁", color: "#ec4899", color2: "#a78bfa", tagline: "مفاجآت متتالية", hype: "هدايا للجميع!", sound: "celebrate-gift", isDefault: true, sortOrder: 6 },
  { id: "rainbow", label: "قوس قزح", icon: "🌈", color: "#3b82f6", color2: "#818cf8", tagline: "ألوان الإبداع", hype: "جميل جداً!", sound: "celebrate-magic-chime", isDefault: true, sortOrder: 7 },
  { id: "mega", label: "احتفال ضخم", icon: "🏆", color: "#fbbf24", color2: "#f59e0b", tagline: "أقصى درجات الفخر", hype: "إنجاز تاريخي!", sound: "celebrate-victory", isDefault: true, sortOrder: 8 },
  { id: "snow", label: "ثلج لامع", icon: "❄️", color: "#06b6d4", color2: "#67e8f9", tagline: "براءة ونقاء", hype: "هدوء وتميز!", sound: "celebrate-bell-church", isDefault: true, sortOrder: 9 },
  { id: "cannon", label: "مدفع النجوم", icon: "🎊", color: "#f59e0b", color2: "#f97316", tagline: "طاقة انفجارية", hype: "بوم! نجاح!", sound: "celebrate-rocket", isDefault: true, sortOrder: 10 },
  { id: "golden-shower", label: "مطر ذهبي", icon: "✨", color: "#fbbf24", color2: "#fef08a", tagline: "قيمة حقيقية", hype: "تستحق الذهب!", sound: "celebrate-coin-drop", isDefault: true, sortOrder: 11 },
  { id: "school-pride", label: "فخر المدرسة", icon: "🎓", color: "#0142A0", color2: "#2563eb", tagline: "انتماء وتميز", hype: "فخر بسلاسة!", sound: "celebrate-fanfare-royal", isDefault: true, sortOrder: 12 },
  { id: "disco", label: "ديسكو لايتس", icon: "🪩", color: "#8338ec", color2: "#a855f7", tagline: "أجواء احتفالية", hype: "وقت الرقص!", sound: "celebrate-cymbal", isDefault: true, sortOrder: 13 },
  { id: "spring-blossom", label: "أزهار الربيع", icon: "🌸", color: "#f9a8d4", color2: "#fbcfe8", tagline: "إبداع يتفتح", hype: "أزهر عملك!", sound: "celebrate-magic", isDefault: true, sortOrder: 14 },
  { id: "tornado", label: "إعصار الطاقة", icon: "🌪️", color: "#06b6d4", color2: "#22d3ee", tagline: "سرعة وقوة", hype: "لا يُقهر!", sound: "celebrate-whoosh", isDefault: true, sortOrder: 15 },
  { id: "diamond", label: "ألماس لامع", icon: "💎", color: "#bfdbfe", color2: "#e0e7ff", tagline: "نقاء التميز", hype: "ثمين ونادر!", sound: "celebrate-sparkle", isDefault: true, sortOrder: 16 },
  { id: "emoji-rain", label: "مطر الابتسامات", icon: "😄", color: "#FFD700", color2: "#fde047", tagline: "بهجة وسعادة", hype: "ابتسامة عريضة!", sound: "celebrate-laugh", isDefault: true, sortOrder: 17 },
  { id: "champion", label: "بطل الأبطال", icon: "🥇", color: "#fbbf24", color2: "#f59e0b", tagline: "قمة التفوق", hype: "أنت البطل!", sound: "celebrate-champion", isDefault: true, sortOrder: 18 },
  { id: "star-rain", label: "مطر النجوم", icon: "🌟", color: "#fbbf24", color2: "#fef08a", tagline: "سحر لامع", hype: "تلألأ!", sound: "celebrate-sweep-up", isDefault: true, sortOrder: 19 },
  { id: "heart-explosion", label: "انفجار الحب", icon: "💗", color: "#ec4899", color2: "#f472b6", tagline: "حماس كبير", hype: "قلوب تشتعل!", sound: "celebrate-pop", isDefault: true, sortOrder: 20 },
  { id: "title-parade", label: "موكب الأوسمة", icon: "🎖️", color: "#0142A0", color2: "#3b82f6", tagline: "تكريم مستحق", hype: "وسام شرف!", sound: "celebrate-drum-roll-longer", isDefault: true, sortOrder: 21 },
  { id: "rocket", label: "صاروخ الإقلاع", icon: "🚀", color: "#FFD700", color2: "#fbbf24", tagline: "انطلاقة قوية!", hype: "للقمة!", sound: "celebrate-rocket", isDefault: true, sortOrder: 22 },
  { id: "swords", label: "صدام السيوف", icon: "⚔️", color: "#C0C0C0", color2: "#FFFFFF", tagline: "قوة وبأس!", hype: "لا يُهزم!", sound: "celebrate-sword", isDefault: true, sortOrder: 23 },
  { id: "crown", label: "التاج الملكي", icon: "👑", color: "#FFD700", color2: "#fde047", tagline: "ملكية حقيقية", hype: "أنت الملك!", sound: "celebrate-fanfare-royal", isDefault: true, sortOrder: 24 },
  { id: "medal", label: "وسام الشرف", icon: "🏅", color: "#FFD700", color2: "#C0C0C0", tagline: "تكريم رفيع", hype: "وسام مستحق!", sound: "celebrate-level-up", isDefault: true, sortOrder: 25 },
  { id: "shield", label: "درع البطولة", icon: "🛡️", color: "#0142A0", color2: "#3b82f6", tagline: "مناعة وقوة", hype: "لا يُكسر!", sound: "celebrate-bell", isDefault: true, sortOrder: 26 },
  { id: "target", label: "إصابة الهدف", icon: "🎯", color: "#DA151C", color2: "#FFD700", tagline: "دقة مميتة!", hype: "في المركز!", sound: "celebrate-correct-ding", isDefault: true, sortOrder: 27 },
  { id: "party", label: "حفلة البوب", icon: "🎉", color: "#ec4899", color2: "#a855f7", tagline: "انفجار فرح!", hype: "بارتي!", sound: "celebrate-tada", isDefault: true, sortOrder: 28 },
  { id: "dragon", label: "نار التنين", icon: "🐉", color: "#DA151C", color2: "#f59e0b", tagline: "قوة ملتهبة!", hype: "تنين!", sound: "celebrate-fanfare-big", isDefault: true, sortOrder: 29 },
  { id: "magic-wand", label: "عصا السحر", icon: "🪄", color: "#a855f7", color2: "#c084fc", tagline: "سحر حقيقي!", hype: "أبراكادابرا!", sound: "celebrate-magic-wand", isDefault: true, sortOrder: 30 },
  { id: "ice-crystal", label: "بلورة الثلج", icon: "🧊", color: "#bfdbfe", color2: "#dbeafe", tagline: "برودة التميز", hype: "جامد!", sound: "celebrate-chime-bell", isDefault: true, sortOrder: 31 },
  { id: "lightning", label: "صاعقة البرق", icon: "⚡", color: "#FFD700", color2: "#FFFFFF", tagline: "سرعة البرق!", hype: "زار!", sound: "celebrate-thunder", isDefault: true, sortOrder: 32 },
  { id: "treasure", label: "كنز مكتشف", icon: "💰", color: "#FFD700", color2: "#a855f7", tagline: "ثروة مستحقة!", hype: "كنز!", sound: "celebrate-coin-drop", isDefault: true, sortOrder: 33 },
  { id: "medal-stars", label: "نجوم الميدالية", icon: "🌟", color: "#FFD700", color2: "#C0C0C0", tagline: "تميز متعدد", hype: "نجوم!", sound: "celebrate-sparkle", isDefault: true, sortOrder: 34 },
  { id: "double-rainbow", label: "قوس مزدوج", icon: "🌈", color: "#3b82f6", color2: "#a855f7", tagline: "دهشة مزدوجة!", hype: "وااو!", sound: "celebrate-magic-chime", isDefault: true, sortOrder: 35 },
];

export const DEFAULT_CELEBRATIONS_MAP: Record<string, CelebrationConfig> = Object.fromEntries(
  DEFAULT_CELEBRATIONS.map((c) => [c.id, c])
);

// ===== Migration from old localStorage key =====
const OLD_CUSTOM_STORAGE_KEY = "bisalasa-custom-celebrations";
const MIGRATION_FLAG_KEY = "bisalasa-celebrations-migrated-to-db";

export async function migrateCelebrationsFromLocalStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) return;
  try {
    const saved = localStorage.getItem(OLD_CUSTOM_STORAGE_KEY);
    if (saved) {
          const oldCustom = JSON.parse(saved) as Array<Partial<CelebrationConfig>>;
      for (const c of oldCustom) {
        if (!c.id || c.id.startsWith("custom_")) {
          try {
            await localDb.celebration.save({
              id: c.id,
              label: c.label,
              icon: c.icon,
              color: c.color,
              color2: c.color2,
              tagline: c.tagline,
              hype: c.hype,
              sound: c.sound,
              renderMode: c.renderMode ?? "confetti",
              isDefault: false,
              isCustom: true,
              sortOrder: 1000,
            });
          } catch {}
        }
      }
    }
    localStorage.setItem(MIGRATION_FLAG_KEY, "1");
  } catch (e) {
    console.warn("[celebrations] migration error:", e);
  }
}

export async function ensureDefaultCelebrationsSeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await localDb.celebration.seedDefaults(
      DEFAULT_CELEBRATIONS.map((c) => ({
        id: c.id,
        label: c.label,
        icon: c.icon,
        color: c.color,
        color2: c.color2,
        tagline: c.tagline,
        hype: c.hype,
        sound: c.sound,
        renderMode: c.renderMode ?? "confetti",
        sortOrder: c.sortOrder ?? 0,
      }))
    );
  } catch (e) {
    console.warn("[celebrations] seed error:", e);
  }
}

export async function getAllCelebrationsFromDb(): Promise<CelebrationConfig[]> {
  if (typeof window === "undefined") return DEFAULT_CELEBRATIONS;
  try {
    await migrateCelebrationsFromLocalStorage();
    await ensureDefaultCelebrationsSeeded();
    const rows = await localDb.celebration.list();
    if (rows.length === 0) return DEFAULT_CELEBRATIONS;
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      icon: r.icon,
      color: r.color,
      color2: r.color2,
      tagline: r.tagline,
      hype: r.hype,
      sound: r.sound,
      renderMode: r.renderMode ?? "confetti",
      isDefault: r.isDefault,
      isCustom: r.isCustom,
      sortOrder: r.sortOrder,
    }));
  } catch (e) {
    console.warn("[celebrations] getAllCelebrationsFromDb error:", e);
    return DEFAULT_CELEBRATIONS;
  }
}

export async function saveCelebrationToDb(c: CelebrationConfig): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const id = c.isCustom && !c.id.startsWith("custom_") && !c.isDefault
      ? `custom_${Date.now()}`
      : c.id;
    // P10 fix: pass through the actual isDefault/isCustom flags from the
    // input instead of hard-coding isCustom=true. The previous hard-coding
    // caused edited DEFAULT celebrations to be saved as "custom" in the DB,
    // which made the side-panel CelebrationsPanel (a separate instance)
    // show BOTH the original default AND the edited version (as a custom)
    // — so the user saw the old celebration even after editing it.
    //
    // The caller (CelebrationsPanel.handleSave) passes:
    //   - For edited defaults: { isDefault: false, isCustom: false }
    //   - For custom celebrations: { isDefault: false, isCustom: true }
    // So we just forward these flags.
    await localDb.celebration.save({
      id,
      label: c.label,
      icon: c.icon,
      color: c.color,
      color2: c.color2,
      tagline: c.tagline,
      hype: c.hype,
      sound: c.sound,
      renderMode: c.renderMode ?? "confetti",
      isDefault: c.isDefault ?? false,
      isCustom: c.isCustom ?? false,
      sortOrder: c.sortOrder ?? 1000,
    });
  } catch (e) {
    console.warn("[celebrations] saveCelebrationToDb error:", e);
  }
}

export async function deleteCelebrationFromDb(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await localDb.celebration.delete(id);
  } catch (e) {
    console.warn("[celebrations] deleteCelebrationFromDb error:", e);
  }
}

export function getCelebrationMeta(id: string): CelebrationConfig | null {
  if (DEFAULT_CELEBRATIONS_MAP[id]) return DEFAULT_CELEBRATIONS_MAP[id];
  return null;
}

export function getCelebrationMetaOrDefault(id: string): CelebrationConfig {
  return DEFAULT_CELEBRATIONS_MAP[id] ?? DEFAULT_CELEBRATIONS[0];
}

export function getCelebrationSound(id: string): string {
  const c = DEFAULT_CELEBRATIONS_MAP[id];
  return c?.sound ?? "celebrate-tada";
}

export const ICON_OPTIONS = [
  "🎉","💖","⭐","💰","🎈","🎆","🎁","🌈","🏆","❄️","🎊","✨","🎓","🪩","🌸","🌪️","💎","😄","🥇","🌟","💗","🎖️",
  "🚀","⚔️","👑","🏅","🛡️","🎯","🐉","🪄","🧊","⚡","🔥","💫","🎪","🎨","🎵","🥈","🥉","🎇","💝","🎀","🪙","🌠",
];

export const COLOR_OPTIONS = [
  "#f59e0b","#ec4899","#fbbf24","#10b981","#a855f7","#ef4444","#3b82f6","#FFD700",
  "#06b6d4","#8338ec","#0142A0","#DA151C","#bfdbfe","#f9a8d4","#C0C0C0","#FFFFFF",
];

export const SOUND_OPTIONS = [
  "celebrate-tada","celebrate-chime","celebrate-sparkle","celebrate-cash","celebrate-bubble",
  "celebrate-fireworks","celebrate-gift","celebrate-magic-chime","celebrate-victory","celebrate-bell-church",
  "celebrate-rocket","celebrate-coin-drop","celebrate-fanfare-royal","celebrate-cymbal","celebrate-magic",
  "celebrate-whoosh","celebrate-laugh","celebrate-champion","celebrate-sweep-up","celebrate-pop",
  "celebrate-drum-roll-longer","celebrate-sword","celebrate-level-up","celebrate-bell","celebrate-correct-ding",
  "celebrate-fanfare-big","celebrate-magic-wand","celebrate-chime-bell","celebrate-thunder",
  "success","error","celebrate","click",
];
