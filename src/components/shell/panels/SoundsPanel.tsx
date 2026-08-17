"use client";

import { useState, useEffect } from "react";
import { useShellStore } from "@/lib/shell-store";
import {
  getAllCustomSounds,
  saveCustomSound,
  deleteCustomSound,
  readFileAsDataURL,
  type CustomSound,
} from "@/lib/data-store";
import { audioEngine } from "@/lib/shell-utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX, Play, Music, Search, Plus, Trash2, Save, X, Upload, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// كل الأصوات = احتفالات
// الهدف: لما طالب يجاوب صح = احتفال نجاح + صوت
// لما طالب يغلط = احتفال محاولة + صوت ناعم
// لما عايز أشجع طالب = احتفال + صوت

const CELEBRATION_TYPES = [
  { id: "confetti", label: "كونفيتي", icon: "🎉" },
  { id: "hearts", label: "قلوب", icon: "💖" },
  { id: "stars", label: "نجوم", icon: "⭐" },
  { id: "money", label: "نقود", icon: "💰" },
  { id: "balloons", label: "بالونات", icon: "🎈" },
  { id: "fireworks", label: "ألعاب نارية", icon: "🎆" },
  { id: "gift-rain", label: "هطول هدايا", icon: "🎁" },
  { id: "rainbow", label: "قوس قزح", icon: "🌈" },
  { id: "mega", label: "احتفال ضخم", icon: "🏆" },
  { id: "snow", label: "ثلج", icon: "❄️" },
  { id: "cannon", label: "مدفع كونفيتي", icon: "🎊" },
  { id: "golden-shower", label: "مطر ذهبي", icon: "✨" },
  { id: "school-pride", label: "فخر مدرسي", icon: "🎓" },
  { id: "disco", label: "ديسكو", icon: "🪩" },
  { id: "spring-blossom", label: "أزهار", icon: "🌸" },
  { id: "tornado", label: "إعصار", icon: "🌪️" },
  { id: "diamond", label: "ألماس", icon: "💎" },
  { id: "emoji-rain", label: "مطر إيموجي", icon: "😄" },
  { id: "champion", label: "بطل", icon: "🥇" },
  { id: "star-rain", label: "مطر نجوم", icon: "🌟" },
  { id: "heart-explosion", label: "انفجار قلوب", icon: "💗" },
  { id: "title-parade", label: "عرض ألقاب", icon: "🎖️" },
  { id: "none", label: "بدون احتفال", icon: "🚫" },
];

// تصنيفات الأصوات - كلها احتفالات
const SOUND_CATEGORIES = [
  {
    name: "🎉 نجاح وتشجيع",
    icon: "🎉",
    desc: "للإجابة الصحيحة والاحتفال بالطالب",
    sounds: [
      { id: "success", name: "نجاح", celebration: "confetti" },
      { id: "celebrate", name: "احتفال عام", celebration: "confetti" },
      { id: "celebrate-tada", name: "تـدا!", celebration: "stars" },
      { id: "celebrate-win", name: "فوز", celebration: "champion" },
      { id: "celebrate-victory", name: "نصر", celebration: "champion" },
      { id: "celebrate-champion", name: "بطل", celebration: "champion" },
      { id: "celebrate-fanfare", name: "فانفير", celebration: "confetti" },
      { id: "celebrate-fanfare-big", name: "فانفير كبير", celebration: "mega" },
      { id: "celebrate-fanfare-short", name: "فانفير قصير", celebration: "stars" },
      { id: "celebrate-fanfare-long", name: "فانفير طويل", celebration: "mega" },
      { id: "celebrate-fanfare-victory", name: "فانفير نصر", celebration: "champion" },
      { id: "celebrate-fanfare-royal", name: "فانفير ملكي", celebration: "title-parade" },
      { id: "celebrate-level-up", name: "تطوير مستوى", celebration: "stars" },
      { id: "celebrate-correct-fast", name: "صح سريع", celebration: "stars" },
      { id: "celebrate-correct-ding", name: "صح دينج", celebration: "confetti" },
      { id: "celebrate-success-bell", name: "جرس نجاح", celebration: "confetti" },
      { id: "celebrate-yay", name: "ياااي", celebration: "balloons" },
      { id: "celebrate-wow", name: "واو", celebration: "stars" },
      { id: "celebrate-laugh", name: "ضحكة", celebration: "emoji-rain" },
      { id: "bisalasa-success-bright", name: "نجاح مشرق", celebration: "stars" },
      { id: "bisalasa-success-perfect", name: "إتقان الفكرة", celebration: "champion" },
      { id: "bisalasa-level-up", name: "صعود المستوى", celebration: "stars" },
    ],
  },
  {
    name: "💪 محاولة وتشجيع",
    icon: "💪",
    desc: "لما الطالب يغلط - حاول مرة أخرى",
    sounds: [
      { id: "error", name: "خطأ", celebration: "none" },
      { id: "celebrate-lose", name: "خسارة", celebration: "none" },
      { id: "celebrate-boo", name: "بوو", celebration: "none" },
      { id: "celebrate-wrong-buzz", name: "خطأ طنين", celebration: "none" },
      { id: "celebrate-wrong-bonk", name: "خطأ بونك", celebration: "none" },
      { id: "celebrate-fail-buzzer", name: "بزر فشل", celebration: "none" },
      { id: "celebrate-buzz", name: "طنين", celebration: "none" },
      { id: "celebrate-buzzer", name: "بزر", celebration: "none" },
      { id: "bisalasa-gentle-correction", name: "إعادة محاولة لطيفة", celebration: "none" },
    ],
  },
  {
    name: "👏 تصفيق وهتاف",
    icon: "👏",
    desc: "تشجيع جماعي للطلاب",
    sounds: [
      { id: "celebrate-clap", name: "تصفيق", celebration: "confetti" },
      { id: "celebrate-applause", name: "تصفيق متوسط", celebration: "confetti" },
      { id: "celebrate-applause-big", name: "تصفيق كبير", celebration: "confetti" },
      { id: "celebrate-applause-huge", name: "تصفيق ضخم", celebration: "mega" },
      { id: "celebrate-applause-cheer", name: "تصفيق وهتاف", celebration: "mega" },
      { id: "celebrate-cheer-soft", name: "هتاف خفيف", celebration: "confetti" },
      { id: "celebrate-cheer-loud", name: "هتاف عالٍ", celebration: "confetti" },
      { id: "celebrate-students", name: "فرحة طلاب", celebration: "confetti" },
      { id: "celebrate-crowd", name: "هتاف جمهور", celebration: "confetti" },
      { id: "bisalasa-celebration-small", name: "احتفال فردي هادئ", celebration: "stars" },
      { id: "bisalasa-celebration-class", name: "نجاح الصف", celebration: "mega" },
    ],
  },
  {
    name: "🎁 هدايا ومكافآت",
    icon: "🎁",
    desc: "عند منح هدية أو مكافأة",
    sounds: [
      { id: "celebrate-gift", name: "هدية", celebration: "gift-rain" },
      { id: "celebrate-cash", name: "كاش", celebration: "money" },
      { id: "celebrate-coin-drop", name: "سقوط عملة", celebration: "money" },
      { id: "celebrate-sparkle", name: "لمعان", celebration: "golden-shower" },
      { id: "celebrate-magic", name: "سحر", celebration: "rainbow" },
      { id: "celebrate-magic-wand", name: "عصا سحرية", celebration: "rainbow" },
      { id: "celebrate-magic-sparkle", name: "سحر لامع", celebration: "golden-shower" },
      { id: "celebrate-magic-appear", name: "ظهور سحري", celebration: "stars" },
      { id: "celebrate-magic-disappear", name: "اختفاء سحري", celebration: "none" },
      { id: "celebrate-magic-chime", name: "رنين سحري", celebration: "diamond" },
      { id: "bisalasa-gift-reveal", name: "ظهور الهدية", celebration: "gift-rain" },
      { id: "bisalasa-badge-unlock", name: "فتح الشارة", celebration: "champion" },
    ],
  },
  {
    name: "🎺 أبواق وأجراس",
    icon: "🎺",
    desc: "إعلانات وأصوات احتفالية",
    sounds: [
      { id: "celebrate-bell", name: "جرس", celebration: "confetti" },
      { id: "celebrate-bell-church", name: "جرس كنيسة", celebration: "confetti" },
      { id: "celebrate-chime", name: "رنين", celebration: "confetti" },
      { id: "celebrate-chime-bell", name: "جرس طويل", celebration: "confetti" },
      { id: "celebrate-ding-dong", name: "دينج دونج", celebration: "confetti" },
      { id: "celebrate-horn", name: "بوق", celebration: "confetti" },
      { id: "celebrate-airhorn", name: "بوق هوائي", celebration: "confetti" },
      { id: "celebrate-whistle", name: "صفير", celebration: "confetti" },
      { id: "celebrate-referee", name: "صفارة حكم", celebration: "none" },
    ],
  },
  {
    name: "🥁 طبول",
    icon: "🥁",
    desc: "إيقاعات احتفالية",
    sounds: [
      { id: "celebrate-drumroll", name: "طبل متدحرج", celebration: "confetti" },
      { id: "celebrate-drum-roll-long", name: "طبل طويل", celebration: "confetti" },
      { id: "celebrate-drum-roll-longer", name: "طبل أطول", celebration: "confetti" },
      { id: "celebrate-drum-hit", name: "ضربة طبل", celebration: "confetti" },
      { id: "celebrate-drum-build", name: "طبل تصاعدي", celebration: "confetti" },
      { id: "celebrate-cymbal", name: "صنج", celebration: "confetti" },
      { id: "celebrate-countdown", name: "عد تنازلي", celebration: "confetti" },
    ],
  },
  {
    name: "🎆 ألعاب نارية وضخمة",
    icon: "🎆",
    desc: "احتفالات كبيرة",
    sounds: [
      { id: "celebrate-fireworks", name: "ألعاب نارية", celebration: "fireworks" },
      { id: "celebrate-rocket", name: "صاروخ", celebration: "fireworks" },
      { id: "celebrate-charge", name: "هجوم", celebration: "confetti" },
      { id: "celebrate-thunder", name: "رعد", celebration: "fireworks" },
      { id: "applause", name: "تصفيق أصلي", celebration: "confetti" },
      { id: "bisalasa-fireworks-impact", name: "أثر الألعاب النارية", celebration: "fireworks" },
    ],
  },
  {
    name: "🌈 أجواء ومرح",
    icon: "🌈",
    desc: "أصوات ممتعة للمرح",
    sounds: [
      { id: "celebrate-bubble", name: "فقاعة", celebration: "balloons" },
      { id: "celebrate-bubble-pop", name: "بوب فقاعة", celebration: "balloons" },
      { id: "celebrate-bubble-long", name: "فقاعة طويلة", celebration: "balloons" },
      { id: "celebrate-bird", name: "عصفور", celebration: "spring-blossom" },
      { id: "celebrate-whoosh", name: "مرور", celebration: "tornado" },
      { id: "celebrate-spin", name: "دوران", celebration: "tornado" },
      { id: "celebrate-cuckoo", name: "كوكو", celebration: "none" },
      { id: "celebrate-robot", name: "روبوت", celebration: "disco" },
      { id: "celebrate-triangle", name: "مثلث موسيقي", celebration: "confetti" },
      { id: "celebrate-sweep-up", name: "صعود", celebration: "stars" },
      { id: "celebrate-sweep-down", name: "هبوط", celebration: "none" },
      { id: "celebrate-mystery", name: "غموض", celebration: "rainbow" },
      { id: "bisalasa-student-picker", name: "كشف الاختيار العادل", celebration: "none" },
      { id: "bisalasa-session-finish", name: "نهاية الحصة", celebration: "school-pride" },
    ],
  },
  {
    name: "⚔️ حماس وتنافس",
    icon: "⚔️",
    desc: "أصوات للتحدي والمسابقات",
    sounds: [
      { id: "celebrate-sword", name: "سيف", celebration: "confetti" },
      { id: "celebrate-alarm", name: "إنذار", celebration: "none" },
      { id: "celebrate-tick", name: "تيك", celebration: "none" },
    ],
  },
  {
    name: "📝 أختام ونقرات",
    icon: "📝",
    desc: "أصوات أساسية",
    sounds: [
      { id: "click", name: "نقرة", celebration: "none" },
      { id: "step", name: "خطوة", celebration: "none" },
      { id: "celebrate-stamp", name: "ختم", celebration: "confetti" },
      { id: "celebrate-pop", name: "بوب", celebration: "balloons" },
      { id: "celebrate-click-loud", name: "نقرة عالية", celebration: "none" },
      { id: "celebrate-step-loud", name: "خطوة عالية", celebration: "none" },
    ],
  },
];

export function SoundsPanel() {
  const playSound = useShellStore((s) => s.playSound);
  const settings = useShellStore((s) => s.settings);
  const updateSettings = useShellStore((s) => s.updateSettings);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const requestConfirm = useShellStore((s) => s.requestConfirm);
  const [search, setSearch] = useState("");
  const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
  const [editing, setEditing] = useState<CustomSound | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const loadCustom = async () => {
    const list = await getAllCustomSounds();
    setCustomSounds(list);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCustom(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handlePlaySound = (soundId: string, celebration?: string) => {
    playSound(soundId);
    if (celebration && celebration !== "none") {
      setCelebrationType(celebration);
      triggerConfetti();
    }
  };

  const handleSaveCustom = async (sound: CustomSound) => {
    // C34 (P2 fix): try/catch on DB call
    try {
      await saveCustomSound(sound);
      audioEngine.addCustomSound(sound.id, sound.filePath);
      await loadCustom();
      setEditing(null);
      toast.success("تم حفظ الصوت المخصص");
    } catch (e: any) {
      console.error("[SoundsPanel] handleSaveCustom failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleDeleteCustom = async (id: string) => {
    // C11: destructive action — require explicit confirmation before deleting.
    const ok = await requestConfirm(
      `حذف الصوت المخصص نهائياً؟`,
      { title: "حذف صوت", danger: true }
    );
    if (!ok) return;
    // C34 (P2 fix): try/catch on DB call
    try {
      await deleteCustomSound(id);
      audioEngine.removeCustomSound(id);
      await loadCustom();
      toast.success("تم حذف الصوت");
    } catch (e: any) {
      console.error("[SoundsPanel] handleDeleteCustom failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const filtered = SOUND_CATEGORIES.map((cat) => ({
    ...cat,
    sounds: cat.sounds.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => cat.sounds.length > 0);

  const totalBuiltIn = SOUND_CATEGORIES.reduce((sum, c) => sum + c.sounds.length, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-white font-bold flex items-center gap-2">
          <Music className="w-4 h-4 text-[#06b6d4]" />
          مكتبة الأصوات والاحتفالات
          <span className="text-xs text-white/40">({totalBuiltIn + customSounds.length})</span>
        </h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() =>
              setEditing({
                id: `cs_${Date.now()}`,
                name: "صوت مخصص",
                filePath: "",
                celebrationType: "confetti",
                createdAt: new Date().toISOString(),
              })
            }
            className="bg-[#06b6d4] hover:bg-[#06b6d4]/80 h-7"
          >
            <Plus className="w-3 h-3 ml-1" /> صوت
          </Button>
          <button
            onClick={() => updateSettings({ muted: !settings.muted })}
            className={cn(
              "p-2 rounded-md transition",
              settings.muted
                ? "bg-red-500/20 text-red-400"
                : "bg-white/5 text-white/60 hover:text-white"
            )}
          >
            {settings.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Volume slider */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Volume2 className="w-4 h-4 text-white/40 shrink-0" />
          <Slider
            value={[Math.round((settings.volume ?? 0.7) * 100)]}
            onValueChange={(v) => updateSettings({ volume: v[0] / 100 })}
            min={0}
            max={100}
            step={5}
            className="flex-1"
          />
          <span className="text-xs text-white/60 w-8 text-left">
            {Math.round((settings.volume ?? 0.7) * 100)}%
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-white/10">
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن صوت..."
            className="bg-white/5 border-white/10 text-white text-xs h-8 pr-7"
          />
        </div>
      </div>

      {/* Categories - تصنيف فوق */}
      <div className="p-2 border-b border-white/10 overflow-x-auto">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "px-2 py-1 rounded-md text-[10px] font-bold transition shrink-0",
              activeCategory === "all"
                ? "bg-[#06b6d4] text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
            الكل
          </button>
          {SOUND_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-bold transition shrink-0 whitespace-nowrap",
                activeCategory === cat.name
                  ? "bg-[#06b6d4] text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              )}
              title={cat.desc}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Custom Sounds */}
          {customSounds.length > 0 && (
            <div>
              <div className="text-xs text-[#06b6d4] mb-2 px-1 flex items-center gap-1 font-bold">
                <span>🎵</span>
                أصوات مخصصة ({customSounds.length})
              </div>
              <div className="grid grid-cols-2 gap-2">
                {customSounds.map((cs) => {
                  const celeb = CELEBRATION_TYPES.find((c) => c.id === cs.celebrationType);
                  return (
                    <div
                      key={cs.id}
                      className="bg-[#06b6d4]/10 border border-[#06b6d4]/30 rounded-lg p-2 group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <button
                          onClick={() => handlePlaySound(cs.id, cs.celebrationType)}
                          disabled={settings.muted}
                          className="flex items-center gap-2 text-white text-sm flex-1 text-right disabled:opacity-30"
                        >
                          <Play className="w-3 h-3 shrink-0 text-[#06b6d4]" />
                          <span className="truncate">{cs.name}</span>
                        </button>
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => setEditing(cs)}
                            className="text-white/60 hover:text-white p-1"
                          >
                            <span className="text-[10px]">✏️</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCustom(cs.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {celeb && celeb.id !== "none" && (
                        <div className="text-[10px] text-white/60 flex items-center gap-1">
                          <span>{celeb.icon}</span>
                          {celeb.label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Built-in sounds - كل الفئات ظاهرة دائماً */}
          {filtered.map((cat) => (
            <div key={cat.name}>
              <div className="text-xs text-white/60 mb-1 px-1 flex items-center gap-1 font-bold">
                <span className="text-base">{cat.icon}</span>
                <span>{cat.name}</span>
                <span className="text-white/30 font-normal">({cat.sounds.length})</span>
              </div>
              <div className="text-[10px] text-white/40 mb-2 px-1">{cat.desc}</div>
              <div className="grid grid-cols-2 gap-2">
                {cat.sounds.map((sound) => {
                  const celeb = CELEBRATION_TYPES.find((c) => c.id === sound.celebration);
                  return (
                    <button
                      key={sound.id}
                      onClick={() => handlePlaySound(sound.id, sound.celebration)}
                      disabled={settings.muted}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-[#0142A0]/30 transition text-white/80 hover:text-white text-sm disabled:opacity-30 disabled:cursor-not-allowed text-right"
                    >
                      <Play className="w-3 h-3 shrink-0 text-[#FFD700]" />
                      <span className="truncate flex-1">{sound.name}</span>
                      {celeb && celeb.id !== "none" && (
                        <span className="text-[10px]">{celeb.icon}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filtered.length === 0 && customSounds.length === 0 && (
            <div className="text-center text-white/40 py-8">
              لا توجد نتائج
            </div>
          )}
          <div className="text-xs text-white/30 text-center pt-2 pb-4 px-4 border-t border-white/5 mt-4">
            كل صوت مرتبط باحتفال - اضغط لتجربته
            <br />
            الحد الأقصى 3 ثواني لكل صوت
          </div>
        </div>
      </ScrollArea>

      {editing && (
        <CustomSoundEditor
          sound={editing}
          onSave={handleSaveCustom}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CustomSoundEditor({
  sound,
  onSave,
  onCancel,
}: {
  sound: CustomSound;
  onSave: (s: CustomSound) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CustomSound>(sound);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      setDraft({ ...draft, filePath: dataUrl });
      toast.success("تم رفع الصوت");
    } catch {
      toast.error("فشل رفع الصوت");
    } finally {
      setUploading(false);
    }
  };

  // C15: Play preview MUST work even before the sound is saved (audioEngine
  // only knows about saved sounds). Play the draft's dataUrl directly.
  const playPreview = () => {
    if (!draft.filePath) return;
    try {
      const a = new Audio(draft.filePath);
      void a.play().catch((e) => console.warn("preview play failed:", e));
    } catch (e) {
      console.warn("preview play failed:", e);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
      {/* C33 (P2 fix): use Z_MODAL_BACKDROP=200 instead of z-50 */}
        <div className="bg-zinc-900 rounded-2xl border border-white/10 p-5 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto z-[210]">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold">صوت مخصص جديد</h3>
          <Button size="sm" variant="ghost" onClick={onCancel} className="text-white/60">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">اسم الصوت</label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="bg-white/5 border-white/10 text-white"
            placeholder="مثال: نصر عظيم"
          />
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">ملف الصوت</label>
          <div className="flex items-center gap-2">
            <label className="flex-1 bg-white/5 border border-white/10 rounded-md p-3 text-center cursor-pointer hover:bg-white/10">
              <Upload className="w-4 h-4 mx-auto mb-1 text-white/60" />
              <div className="text-xs text-white/80">
                {uploading ? "جاري الرفع..." : draft.filePath ? "✓ تم الرفع" : "ارفع ملف صوت"}
              </div>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </label>
            {draft.filePath && (
              <Button
                onClick={playPreview}
                className="bg-[#06b6d4] hover:bg-[#06b6d4]/80"
              >
                <Play className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-2 block">الاحتفال المرتبط</label>
          <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto">
            {CELEBRATION_TYPES.map((c) => (
              <button
                key={c.id}
                onClick={() => setDraft({ ...draft, celebrationType: c.id })}
                className={cn(
                  "px-1 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-0.5 transition",
                  draft.celebrationType === c.id
                    ? "bg-[#06b6d4] text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                )}
              >
                <span className="text-base">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => onSave(draft)}
            disabled={!draft.filePath}
            className="flex-1 bg-[#10b981] hover:bg-[#10b981]/80 disabled:opacity-30"
          >
            <Save className="w-4 h-4 ml-1" /> حفظ
          </Button>
          <Button variant="ghost" onClick={onCancel} className="text-white/60">
            إلغاء
          </Button>
        </div>
        </div>
    </div>
  );
}
