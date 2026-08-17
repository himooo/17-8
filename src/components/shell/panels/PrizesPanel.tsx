"use client";

import { useEffect, useState } from "react";
import { useShellStore } from "@/lib/shell-store";
import {
  getAllPrizes,
  savePrize,
  deletePrize,
  type Prize,
} from "@/lib/data-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Trash2, Save, Edit, Award, X } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = ["#0142A0", "#DA151C", "#10b981", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#92400e"];
const TYPES: Prize["type"][] = ["title", "points", "gift", "nothing"];
const ICONS = [
  "🧠", "🍕", "⭐", "🏆", "🍦", "🌟", "🎲", "🍫", "🎯", "✏️", "🦸", "👑",
  "🎁", "🎈", "💯", "🔥", "💎", "🎨", "📚", "⚽", "🧩", "🎮", "🎸", "🚀",
  "💝", "🌹", "🍀", "⚡", "🌈", "🎉", "🎊", "🥇", "🥈", "🥉", "🎖️", "🏅",
];

export function PrizesPanel() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [editing, setEditing] = useState<Prize | null>(null);
  const [creating, setCreating] = useState(false);

  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const requestConfirm = useShellStore((s) => s.requestConfirm);

  useEffect(() => {
    getAllPrizes().then(setPrizes);
  }, []);

  const handleSave = async (prize: Prize) => {
    // C34 (P2 fix): try/catch on DB call
    try {
      await savePrize(prize);
      const list = await getAllPrizes();
      setPrizes(list);
      setEditing(null);
      setCreating(false);
      playSound("click");
      toast.success("تم حفظ الجائزة");
    } catch (e: any) {
      console.error("[PrizesPanel] handleSave failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleDelete = async (id: string) => {
    // C8: destructive action — require explicit confirmation before deleting a prize.
    const target = prizes.find((p) => p.id === id);
    const ok = await requestConfirm(
      `حذف الجائزة "${target?.name ?? id}" نهائياً؟`,
      { title: "حذف جائزة", danger: true }
    );
    if (!ok) return;
    // C34 (P2 fix): try/catch on DB call
    try {
      await deletePrize(id);
      const list = await getAllPrizes();
      setPrizes(list);
      playSound("click");
      toast.success("تم حذف الجائزة");
    } catch (e: any) {
      console.error("[PrizesPanel] handleDelete failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-white font-bold flex items-center gap-2">
          <Award className="w-4 h-4 text-[#FFD700]" />
          جوائز عجلة الحظ
        </h3>
        <Button
          size="sm"
          onClick={() => {
            setCreating(true);
            setEditing({
              id: `p_${Date.now()}`,
              name: "جائزة جديدة",
              color: COLORS[Math.floor(Math.random() * COLORS.length)],
              points: 0,
              type: "title",
              icon: "⭐",
              createdAt: new Date().toISOString(),
            });
          }}
          className="bg-[#0142A0] hover:bg-[#0142A0]/80"
        >
          <Plus className="w-4 h-4 ml-1" /> جائزة
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {prizes.length === 0 && (
            <div className="text-center text-white/40 py-12">لا توجد جوائز بعد</div>
          )}
          {prizes.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition group"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: p.color }}
              >
                {p.icon || "⭐"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold truncate">{p.name}</div>
                <div className="text-xs text-white/50">
                  {p.type === "points" && `${p.points} نقطة`}
                  {p.type === "title" && "لقب"}
                  {p.type === "gift" && "هدية"}
                  {p.type === "nothing" && "حظ أوفر"}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(p)}
                  className="h-8 w-8 p-0 text-white/70 hover:text-white"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(p.id)}
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {editing && (
        <PrizeEditor
          prize={editing}
          onSave={handleSave}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
          isNew={creating}
        />
      )}
    </div>
  );
}

function PrizeEditor({
  prize,
  onSave,
  onCancel,
  isNew,
}: {
  prize: Prize;
  onSave: (p: Prize) => void;
  onCancel: () => void;
  isNew: boolean;
}) {
  const [draft, setDraft] = useState<Prize>(prize);
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
      {/* C33 (P2 fix): use Z_MODAL_BACKDROP=200 instead of z-50 */}
      <div className="bg-zinc-900 rounded-2xl border border-white/10 p-5 w-full max-w-md space-y-4 z-[210]">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold">{isNew ? "جائزة جديدة" : "تعديل الجائزة"}</h3>
          <Button size="sm" variant="ghost" onClick={onCancel} className="text-white/60">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">الاسم</label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">النوع</label>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setDraft({ ...draft, type: t })}
                className={cn(
                  "px-2 py-2 rounded-md text-xs font-bold",
                  draft.type === t
                    ? "bg-[#0142A0] text-white"
                    : "bg-white/5 text-white/60"
                )}
              >
                {t === "title" ? "لقب" : t === "points" ? "نقاط" : t === "gift" ? "هدية" : "حظ أوفر"}
              </button>
            ))}
          </div>
        </div>

        {draft.type === "points" && (
          <div>
            <label className="text-xs text-white/60 mb-1 block">عدد النقاط</label>
            <Input
              type="number"
              value={draft.points}
              onChange={(e) => setDraft({ ...draft, points: parseInt(e.target.value) || 0 })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
        )}

        <div>
          <label className="text-xs text-white/60 mb-1 block">اللون</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setDraft({ ...draft, color: c })}
                className={cn(
                  "w-7 h-7 rounded-full border-2",
                  draft.color === c ? "border-white scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">الأيقونة</label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setDraft({ ...draft, icon: ic })}
                className={cn(
                  "w-9 h-9 rounded-md text-lg flex items-center justify-center",
                  draft.icon === ic ? "bg-[#0142A0]" : "bg-white/5"
                )}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => onSave(draft)}
            className="flex-1 bg-[#10b981] hover:bg-[#10b981]/80"
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
