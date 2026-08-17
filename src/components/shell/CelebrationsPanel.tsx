"use client";

// ====================================================================
//  CelebrationsPanel.tsx — v10.3 نظام احتفالات متكامل
//
//  - يستخدم المصدر الموحد src/lib/celebrations.ts
//  - التخزين في قاعدة البيانات (نموذج Celebration)
//  - يمكن تعديل جميع الاحتفالات (افتراضية + مخصصة)
//  - التعديلات تؤثر فوراً على العرض (تحديث cache + DB)
// ====================================================================

import { useState, useEffect } from "react";
import { useShellStore } from "@/lib/shell-store";
import { GameOverlay } from "./GameOverlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus, Save, X, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CELEBRATIONS,
  ICON_OPTIONS,
  COLOR_OPTIONS,
  SOUND_OPTIONS,
  getAllCelebrationsFromDb,
  saveCelebrationToDb,
  deleteCelebrationFromDb,
  type CelebrationConfig,
} from "@/lib/celebrations";

export type { CelebrationConfig };

export function CelebrationsPanel({ onClose }: { onClose: () => void }) {
  const triggerCelebration = useShellStore((s) => s.triggerCelebration);
  const playSound = useShellStore((s) => s.playSound);
  const setCelebrationsList = useShellStore((s) => s.setCelebrationsList);
  const [customCelebs, setCustomCelebs] = useState<CelebrationConfig[]>([]);
  const [editing, setEditing] = useState<CelebrationConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  // تتبع التعديلات على الاحتفالات الافتراضية
  const [editedDefaults, setEditedDefaults] = useState<Record<string, CelebrationConfig>>({});

  // Load all celebrations from DB
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getAllCelebrationsFromDb();
        if (cancelled) return;
        setCustomCelebs(all.filter((c) => c.isCustom));
        // التعديلات على الافتراضي (isDefault=false, isCustom=false)
        const edits: Record<string, CelebrationConfig> = {};
        for (const c of all) {
          if (!c.isDefault && !c.isCustom) {
            edits[c.id] = c;
          }
        }
        setEditedDefaults(edits);
        // Push the full DB list into the shell-store so triggerCelebration
        // and CelebrationsOverlay can read user-edited labels/icons/sounds.
        setCelebrationsList(all);
      } catch (e) {
        console.warn("[CelebrationsPanel] load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setCelebrationsList]);

  // دمج التعديلات على الافتراضيات
  const displayCelebs = DEFAULT_CELEBRATIONS.map((c) => editedDefaults[c.id] ?? c);
  const allCelebs = [...displayCelebs, ...customCelebs];

  const fire = (celeb: CelebrationConfig) => {
    // triggerCelebration يملك الصوت + البانر + الكونفيتي + التسجيل في DB
    triggerCelebration(celeb.id);
    // C56 (P2 fix): close the panel after firing so the celebration is visible
    // without the panel covering part of the canvas. The user requested:
    // "لما اضغط احتفال عشان يظهر يقفل البانل وبعدها يظهر الاحتفال".
    onClose();
  };

  const handleSave = async (celeb: CelebrationConfig) => {
    if (isCreating) {
      const newCeleb = { ...celeb, isCustom: true };
      setCustomCelebs((prev) => [...prev, newCeleb]);
      await saveCelebrationToDb(newCeleb);
      setIsCreating(false);
    } else {
      // تعديل احتفال (افتراضي أو مخصص)
      const updatedCeleb = celeb.isDefault
        ? { ...celeb, isDefault: false, isCustom: false }
        : celeb;
      // حدّث في القائمة المحلية
      if (celeb.isDefault) {
        setEditedDefaults((prev) => ({ ...prev, [celeb.id]: updatedCeleb }));
      } else {
        setCustomCelebs((prev) => {
          const existing = prev.find((c) => c.id === celeb.id);
          if (existing) {
            return prev.map((c) => (c.id === celeb.id ? updatedCeleb : c));
          }
          return [...prev, updatedCeleb];
        });
      }
      // احفظ في DB
      await saveCelebrationToDb(updatedCeleb);
    }
    // حافظ على مزامنة قائمة الاحتفالات في shell-store بعد كل تعديل
    setCelebrationsList(allCelebs.map((c) => c.id === celeb.id ? (celeb.isDefault ? { ...celeb, isDefault: false, isCustom: false } : celeb) : c));
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    setCustomCelebs((prev) => prev.filter((c) => c.id !== id));
    await deleteCelebrationFromDb(id);
    // حافظ على مزامنة قائمة الاحتفالات في shell-store بعد الحذف
    setCelebrationsList(allCelebs.filter((c) => c.id !== id));
  };

  const handleEdit = (celeb: CelebrationConfig) => {
    setEditing({ ...celeb });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setEditing({
      id: `custom_${Date.now()}`,
      label: "احتفال جديد",
      icon: "🎉",
      color: "#FFD700",
      color2: "#fbbf24",
      tagline: "وصف قصير",
      hype: "عبارة حماسية!",
      sound: "celebrate-tada",
      renderMode: "confetti",
      isCustom: true,
    });
    setIsCreating(true);
  };

  return (
    <GameOverlay open onClose={onClose} title={`الاحتفالات (${allCelebs.length})`} accentColor="#FFD700" widthPercent={85} heightPercent={85}>
      <div className="p-4 flex flex-col h-full">
        {/* Action bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="text-xs text-white/60">
            {DEFAULT_CELEBRATIONS.length} افتراضي + {customCelebs.length} مخصص • يمكن تعديل الجميع
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            className="bg-[#FFD700] hover:bg-[#FFD700]/80 text-black h-7 text-xs"
          >
            <Plus className="w-3 h-3 ml-1" /> احتفال جديد
          </Button>
        </div>

        {/* Editor modal */}
        {editing && (
          <CelebrationEditor
            celeb={editing}
            isNew={isCreating}
            onSave={handleSave}
            onCancel={() => { setEditing(null); setIsCreating(false); }}
          />
        )}

        {/* Grid of all celebrations */}
        <div className="grid grid-cols-4 gap-2 overflow-y-auto flex-1">
          {loading ? (
            <div className="col-span-4 text-center text-white/40 text-xs py-8">
              جارٍ التحميل من قاعدة البيانات...
            </div>
          ) : allCelebs.map((c) => (
            <div
              key={c.id}
              className="flex flex-col items-center gap-1 p-3 rounded-xl transition hover:scale-105 relative group"
              style={{ backgroundColor: `${c.color}20`, border: `1px solid ${c.color}40` }}
            >
              <button
                onClick={() => fire(c)}
                className="flex flex-col items-center gap-1 w-full"
                title={c.label}
              >
                <span className="text-3xl">{c.icon}</span>
                <span className="text-[10px] font-bold text-white text-center">{c.label}</span>
                <span className="text-[8px] text-white/40 text-center hidden group-hover:block">{c.hype}</span>
              </button>
              {/* Edit button for ALL celebrations (default + custom) */}
              {/* Delete button only for custom celebrations */}
              <div className="absolute top-1 left-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => handleEdit(c)}
                  className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center"
                  title={c.isDefault ? "تعديل (يحفظ نسخة معدّلة)" : "تعديل"}
                >
                  <Pencil className="w-2.5 h-2.5 text-white" />
                </button>
                {c.isCustom && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="w-5 h-5 rounded bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center"
                    title="حذف"
                  >
                    <Trash2 className="w-2.5 h-2.5 text-red-400" />
                  </button>
                )}
              </div>
              {/* Indicator for edited defaults */}
              {editedDefaults[c.id] && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-400" title="معدّل" />
              )}
            </div>
          ))}
        </div>

        <div className="text-xs text-white/40 text-center mt-3 shrink-0">
          اضغط على أي احتفال لإطلاقه فوق منطقة العرض • يمكن تعديل جميع الاحتفالات (افتراضية ومخصصة) • محفوظة في قاعدة البيانات
        </div>
      </div>
    </GameOverlay>
  );
}

// ===== Editor component =====
function CelebrationEditor({
  celeb,
  isNew,
  onSave,
  onCancel,
}: {
  celeb: CelebrationConfig;
  isNew: boolean;
  onSave: (c: CelebrationConfig) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CelebrationConfig>(celeb);
  const playSound = useShellStore((s) => s.playSound);
  const triggerCelebration = useShellStore((s) => s.triggerCelebration);

  const update = (patch: Partial<CelebrationConfig>) => setDraft({ ...draft, ...patch });

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-10" onClick={onCancel}>
      <div className="bg-zinc-900 rounded-2xl border border-white/10 p-5 w-full max-w-md max-h-[90%] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-sm">{isNew ? "احتفال جديد" : "تعديل احتفال"}</h3>
          <button onClick={onCancel} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          {/* Preview */}
          <div
            className="rounded-xl p-4 flex flex-col items-center gap-1"
            style={{ background: `linear-gradient(135deg, ${draft.color}fa, ${draft.color2}fa)`, border: `2px solid ${draft.color}` }}
          >
            <span className="text-4xl">{draft.icon}</span>
            <span className="text-white font-black text-lg">{draft.label || "الاسم"}</span>
            <span className="text-white/80 text-xs font-bold">{draft.hype || "العبارة"}</span>
            <span className="text-white/60 text-[10px]">{draft.tagline || "الوصف"}</span>
          </div>

          {/* Label */}
          <div>
            <label className="text-[10px] text-white/60 mb-1 block">الاسم</label>
            <Input value={draft.label} onChange={(e) => update({ label: e.target.value })} className="bg-white/5 border-white/10 text-white text-sm" placeholder="مثال: احتفال النصر" />
          </div>

          {/* Hype */}
          <div>
            <label className="text-[10px] text-white/60 mb-1 block">العبارة الحماسية</label>
            <Input value={draft.hype} onChange={(e) => update({ hype: e.target.value })} className="bg-white/5 border-white/10 text-white text-sm" placeholder="مثال: أنت البطل!" />
          </div>

          {/* Tagline */}
          <div>
            <label className="text-[10px] text-white/60 mb-1 block">الوصف القصير</label>
            <Input value={draft.tagline} onChange={(e) => update({ tagline: e.target.value })} className="bg-white/5 border-white/10 text-white text-sm" placeholder="مثال: قمة التفوق" />
          </div>

          {/* Icon picker */}
          <div>
            <label className="text-[10px] text-white/60 mb-1 block">الأيقونة</label>
            <div className="grid grid-cols-8 gap-1 max-h-[80px] overflow-y-auto">
              {ICON_OPTIONS.map((ic, idx) => (
                <button
                  key={`${ic}-${idx}`}
                  onClick={() => update({ icon: ic })}
                  className={cn(
                    "w-8 h-8 rounded flex items-center justify-center text-lg transition",
                    draft.icon === ic ? "bg-[#FFD700]/30 ring-2 ring-[#FFD700]" : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  {ic}
                </button>
              ))}
            </div>
            {/* C51: Custom emoji input — paste ANY emoji from anywhere */}
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={draft.icon && !ICON_OPTIONS.includes(draft.icon) ? draft.icon : ""}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val) update({ icon: val });
                }}
                placeholder="أو الصق إيموجي مخصص هنا..."
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-sm text-center text-lg focus:outline-none focus:border-[#FFD700]/50"
                style={{ fontFamily: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif" }}
              />
              {draft.icon && (
                <div className="text-2xl px-2 py-0.5 bg-white/5 rounded border border-white/10">
                  {draft.icon}
                </div>
              )}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="text-[10px] text-white/60 mb-1 block">اللون الأساسي</label>
            <div className="flex gap-1.5 flex-wrap">
              {COLOR_OPTIONS.map((col, idx) => (
                <button
                  key={`${col}-${idx}`}
                  onClick={() => update({ color: col })}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition",
                    draft.color === col ? "border-white scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          {/* Color2 picker */}
          <div>
            <label className="text-[10px] text-white/60 mb-1 block">اللون الثانوي</label>
            <div className="flex gap-1.5 flex-wrap">
              {COLOR_OPTIONS.map((col, idx) => (
                <button
                  key={`${col}-2-${idx}`}
                  onClick={() => update({ color2: col })}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition",
                    draft.color2 === col ? "border-white scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          {/* Sound picker */}
          <div>
            <label className="text-[10px] text-white/60 mb-1 block">الصوت</label>
            <div className="flex gap-1">
              <select
                value={draft.sound}
                onChange={(e) => update({ sound: e.target.value })}
                className="flex-1 bg-white/5 border border-white/10 text-white text-xs rounded px-2 py-1.5"
              >
                {SOUND_OPTIONS.map((s, idx) => (
                  <option key={`${s}-${idx}`} value={s} className="bg-zinc-900">{s}</option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => playSound(draft.sound)}
                className="h-7 px-2 text-white/60 hover:text-white"
                title="تجربة الصوت"
              >
                <Play className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Visual renderer picker */}
          <div>
            <label className="text-[10px] text-white/60 mb-1 block">طريقة العرض</label>
            <select
              value={draft.renderMode ?? "confetti"}
              onChange={(e) => update({ renderMode: e.target.value as CelebrationConfig["renderMode"] })}
              className="w-full bg-white/5 border border-white/10 text-white text-xs rounded px-2 py-1.5"
            >
              <option value="confetti" className="bg-zinc-900">Confetti القديم (canvas)</option>
              <option value="particles" className="bg-zinc-900">Particles (tsParticles)</option>
              <option value="both" className="bg-zinc-900">كلاهما</option>
            </select>
            <div className="text-[9px] text-white/40 mt-1">اختيار المدرس يحدد العرض فقط؛ الصوت والبانر يبقيان في المسار الموحد.</div>
          </div>

          {/* Test button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { triggerCelebration(draft.id); }}
            className="w-full text-[#FFD700] hover:bg-[#FFD700]/10 h-7 text-xs"
          >
            <Play className="w-3 h-3 ml-1" /> تجربة الاحتفال كامل
          </Button>

          {/* Save/Cancel */}
          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave(draft)} className="flex-1 bg-[#10b981] hover:bg-[#10b981]/80 h-8 text-xs">
              <Save className="w-3 h-3 ml-1" /> حفظ في قاعدة البيانات
            </Button>
            <Button variant="ghost" onClick={onCancel} className="text-white/60 h-8 text-xs">إلغاء</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
