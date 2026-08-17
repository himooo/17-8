"use client";

import { useEffect, useState } from "react";
import { useShellStore } from "@/lib/shell-store";
import {
  getAllGifts,
  saveGift,
  deleteGift,
  readFileAsDataURL,
  type Gift,
  type GiftCategory,
} from "@/lib/data-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Trash2, Save, Edit, Gift as GiftIcon, X, Upload, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES: { id: GiftCategory; label: string; icon: string; color: string }[] = [
  { id: "food", label: "طعام", icon: "🍔", color: "#f59e0b" },
  { id: "toy", label: "ألعاب", icon: "🧸", color: "#ec4899" },
  { id: "title", label: "ألقاب", icon: "👑", color: "#a855f7" },
  { id: "activity", label: "أنشطة", icon: "🎯", color: "#06b6d4" },
  { id: "stationery", label: "قرطاسية", icon: "✏️", color: "#10b981" },
  { id: "electronic", label: "إلكترونيات", icon: "📱", color: "#3b82f6" },
  { id: "book", label: "كتب", icon: "📚", color: "#92400e" },
  { id: "other", label: "أخرى", icon: "🎁", color: "#6b7280" },
];

const CATEGORY_LABELS: Record<GiftCategory, string> = {
  food: "طعام",
  toy: "ألعاب",
  title: "ألقاب",
  activity: "أنشطة",
  stationery: "قرطاسية",
  electronic: "إلكترونيات",
  book: "كتب",
  other: "أخرى",
};

export function GiftsPanel() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [editing, setEditing] = useState<Gift | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<GiftCategory | "all">("all");

  const playSound = useShellStore((s) => s.playSound);
  const requestConfirm = useShellStore((s) => s.requestConfirm);

  useEffect(() => {
    getAllGifts().then(setGifts);
  }, []);

  const handleSave = async (gift: Gift) => {
    // C34 (P2 fix): try/catch on DB call
    try {
      await saveGift(gift);
      const list = await getAllGifts();
      setGifts(list);
      setEditing(null);
      playSound("click");
      toast.success("تم حفظ الهدية");
    } catch (e: any) {
      console.error("[GiftsPanel] handleSave failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleDelete = async (id: string) => {
    // C9: destructive action — require explicit confirmation before deleting a gift.
    const target = gifts.find((g) => g.id === id);
    const ok = await requestConfirm(
      `حذف الهدية "${target?.name ?? id}" نهائياً؟`,
      { title: "حذف هدية", danger: true }
    );
    if (!ok) return;
    // C34 (P2 fix): try/catch on DB call
    try {
      await deleteGift(id);
      const list = await getAllGifts();
      setGifts(list);
      playSound("click");
      toast.success("تم حذف الهدية");
    } catch (e: any) {
      console.error("[GiftsPanel] handleDelete failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  // Filter gifts
  const filtered = gifts.filter((g) => {
    if (activeCategory !== "all" && g.category !== activeCategory) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by category
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    gifts: filtered.filter((g) => g.category === cat.id),
  })).filter((g) => g.gifts.length > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-white font-bold flex items-center gap-2">
          <GiftIcon className="w-4 h-4 text-[#ec4899]" />
          مكتبة الهدايا
          <span className="text-xs text-white/40">({gifts.length})</span>
        </h3>
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              id: `g_${Date.now()}`,
              name: "هدية جديدة",
              category: activeCategory === "all" ? "toy" : activeCategory,
              image: "/gifts/star.png",
              description: "",
              createdAt: new Date().toISOString(),
            })
          }
          className="bg-[#ec4899] hover:bg-[#ec4899]/80"
        >
          <Plus className="w-4 h-4 ml-1" /> هدية
        </Button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-white/10">
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن هدية..."
            className="bg-white/5 border-white/10 text-white text-xs h-8 pr-7"
          />
        </div>
      </div>

      {/* Categories filter */}
      <div className="p-2 border-b border-white/10">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "px-2 py-1 rounded-md text-[10px] font-bold transition",
              activeCategory === "all"
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
            الكل ({gifts.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = gifts.filter((g) => g.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1",
                  activeCategory === cat.id
                    ? "text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                )}
                style={activeCategory === cat.id ? { backgroundColor: cat.color } : undefined}
              >
                <span>{cat.icon}</span>
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {grouped.length === 0 && (
            <div className="text-center text-white/40 py-12">
              <GiftIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>لا توجد هدايا</p>
            </div>
          )}
          {grouped.map((cat) => (
            <div key={cat.id}>
              <div className="text-xs text-white/60 mb-2 px-1 flex items-center gap-1 font-bold">
                <span className="text-base">{cat.icon}</span>
                <span style={{ color: cat.color }}>{cat.label}</span>
                <span className="text-white/30 font-normal">({cat.gifts.length})</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {cat.gifts.map((g) => (
                  <div
                    key={g.id}
                    className="bg-white/5 hover:bg-white/10 rounded-lg p-2 group transition cursor-pointer"
                    onClick={() => setEditing(g)}
                  >
                    <div className="aspect-square bg-white/5 rounded-md overflow-hidden mb-1 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.image}
                        alt={g.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.opacity = "0.3";
                        }}
                      />
                    </div>
                    <div className="text-white text-xs font-bold truncate">{g.name}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(g.id);
                      }}
                      className="mt-1 text-[10px] text-red-400 opacity-0 group-hover:opacity-100 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> حذف
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {editing && (
        <GiftEditor
          gift={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function GiftEditor({
  gift,
  onSave,
  onCancel,
}: {
  gift: Gift;
  onSave: (g: Gift) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Gift>(gift);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      setDraft({ ...draft, image: dataUrl });
      toast.success("تم رفع الصورة");
    } catch {
      toast.error("فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
      {/* C33 (P2 fix): use Z_MODAL_BACKDROP=200 instead of z-50 */}
      <div className="bg-zinc-900 rounded-2xl border border-white/10 p-5 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto z-[210]">
        <div className="flex items-center justify-between sticky top-0 bg-zinc-900 -mx-5 px-5 py-2 -mt-5 mb-2 border-b border-white/10">
          <h3 className="text-white font-bold">تعديل الهدية</h3>
          <Button size="sm" variant="ghost" onClick={onCancel} className="text-white/60">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="aspect-square bg-white/5 rounded-lg overflow-hidden flex items-center justify-center relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draft.image} alt={draft.name} className="w-full h-full object-cover" loading="eager" decoding="async" />
          <label className="absolute bottom-2 right-2 bg-black/70 text-white px-3 py-1.5 rounded-md text-xs cursor-pointer hover:bg-black/90">
            <Upload className="w-3 h-3 inline ml-1" />
            {uploading ? "جاري الرفع..." : "تغيير الصورة"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </label>
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
          <label className="text-xs text-white/60 mb-1 block">الفئة</label>
          <div className="grid grid-cols-4 gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setDraft({ ...draft, category: c.id })}
                className={cn(
                  "px-1 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-0.5 transition",
                  draft.category === c.id
                    ? "text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                )}
                style={draft.category === c.id ? { backgroundColor: c.color } : undefined}
              >
                <span className="text-base">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">الوصف</label>
          <Textarea
            value={draft.description || ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="bg-white/5 border-white/10 text-white min-h-[60px]"
          />
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
