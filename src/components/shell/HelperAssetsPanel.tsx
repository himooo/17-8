"use client";

import { useState, useEffect, useRef } from "react";
import { useShellStore } from "@/lib/shell-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FileText,
  Image as ImageIcon,
  Video,
  Globe,
  Upload,
  Trash2,
  Plus,
  Code,
} from "lucide-react";
import { CanvasPanel } from "./CanvasPanel";
import {
  saveHelperAsset,
  getHelperAssets,
  deleteHelperAsset,
  readFileAsDataURL,
  getAssetType,
  type HelperAsset,
} from "@/lib/helper-assets";

/**
 * HelperAssetsPanel v3.0
 *
 * - قائمة الأدوات المساعدة (overlay)
 * - عند عرض أداة: تُعرض داخل منطقة العرض (iframe-stage) عبر store
 * - السبورة تعمل فوقها بشكل طبيعي (z-index 10 > 5)
 * - يمكن للمعلمة الرسم عليها أثناء العرض
 * - دعم: PDF، صور، فيديو، iframe، embed code
 */
export function HelperAssetsPanel({ onClose }: { onClose: () => void }) {
  const [assets, setAssets] = useState<HelperAsset[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [embedCode, setEmbedCode] = useState("");
  const [iframeUrl, setIframeUrl] = useState("");
  const [iframeName, setIframeName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lessons = useShellStore((s) => s.lessons);
  const activeLessonId = useShellStore((s) => s.activeLessonId);
  const activeLesson = lessons.find((l) => l.id === activeLessonId);
  const setViewingHelperAsset = useShellStore((s) => s.setViewingHelperAsset);

  useEffect(() => {
    if (activeLessonId) {
      getHelperAssets(activeLessonId).then(setAssets).catch(console.error);
    }
  }, [activeLessonId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !activeLessonId) return;
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await readFileAsDataURL(file);
        const asset: HelperAsset = {
          id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          lessonId: activeLessonId,
          name: file.name,
          type: getAssetType(file.name),
          data: dataUrl,
          createdAt: new Date().toISOString(),
        };
        await saveHelperAsset(asset);
      } catch (err) {
        console.error("Failed to save asset:", err);
      }
    }
    getHelperAssets(activeLessonId).then(setAssets);
    setShowAddForm(false);
  };

  // C12: helper — iframe src must never be javascript:/data:html etc.
  // Returns true if the URL is safe to load in an iframe.
  const isSafeIframeUrl = (url: string): boolean => {
    if (!url) return false;
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith("javascript:")) return false;
    if (trimmed.startsWith("vbscript:")) return false;
    if (trimmed.startsWith("data:text/html")) return false;
    if (trimmed.startsWith("data:application/xhtml")) return false;
    return true;
  };

  const handleAddIframe = async () => {
    if (!iframeUrl.trim() || !activeLessonId) return;
    const url = iframeUrl.trim();
    if (!isSafeIframeUrl(url)) {
      toast.error("رابط iframe غير آمن — لا يُسمح بـ javascript:/data:html.");
      return;
    }
    const asset: HelperAsset = {
      id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      lessonId: activeLessonId,
      name: iframeName.trim() || url,
      type: "iframe",
      data: url,
      createdAt: new Date().toISOString(),
    };
    // C34 (P2 fix): try/catch on DB call
    try {
      await saveHelperAsset(asset);
      getHelperAssets(activeLessonId).then(setAssets);
      setIframeUrl("");
      setIframeName("");
      setShowAddForm(false);
    } catch (e: any) {
      console.error("[HelperAssetsPanel] handleAddIframe failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleAddEmbedCode = async () => {
    if (!embedCode.trim() || !activeLessonId) return;
    const srcMatch = embedCode.match(/src=["']([^"']+)["']/i);
    const src = srcMatch ? srcMatch[1] : embedCode.trim();
    if (!isSafeIframeUrl(src)) {
      toast.error("رابط iframe غير آمن — لا يُسمح بـ javascript:/data:html.");
      return;
    }

    const asset: HelperAsset = {
      id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      lessonId: activeLessonId,
      name: iframeName.trim() || (src.length > 40 ? src.substring(0, 40) + "..." : src),
      type: "iframe",
      data: src,
      createdAt: new Date().toISOString(),
    };
    // C34 (P2 fix): try/catch on DB call
    try {
      await saveHelperAsset(asset);
      getHelperAssets(activeLessonId).then(setAssets);
      setEmbedCode("");
      setIframeName("");
      setShowAddForm(false);
    } catch (e: any) {
      console.error("[HelperAssetsPanel] handleAddEmbedCode failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleDelete = async (id: string) => {
    // C34 (P2 fix): try/catch on DB call
    try {
      await deleteHelperAsset(id);
      if (activeLessonId) getHelperAssets(activeLessonId).then(setAssets);
    } catch (e: any) {
      console.error("[HelperAssetsPanel] handleDelete failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleViewAsset = (asset: HelperAsset) => {
    // عرض الأداة داخل منطقة العرض عبر store
    // السبورة (z-index 10) ستكون فوق الأداة (z-index 5)
    setViewingHelperAsset({
      type: asset.type,
      data: asset.data,
      name: asset.name,
    });
    // تفعيل السبورة تلقائياً لكي تتمكن المعلمة من الرسم
    useShellStore.getState().updateSettings({ whiteboardEnabled: true });
    useShellStore.getState().setWhiteboardTool("select"); // ابدأ بوضع التحديد
    onClose(); // أغلق القائمة
  };

  return (
    <CanvasPanel open onClose={onClose} title={`الأدوات المساعدة${activeLesson ? ` - ${activeLesson.title}` : ""}`} accentColor="#0142A0" widthPercent={85} heightPercent={85}>
      <div className="flex flex-col h-full">
        {showAddForm ? (
          <div className="p-4 space-y-3 bg-secondary/20 max-h-[60vh] overflow-y-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.svg,.webp,.mp4,.webm,.mov"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 hover:bg-primary/10 transition-colors text-sm text-primary"
            >
              <Upload className="w-4 h-4" />
              رفع ملف من الجهاز (PDF / صورة / فيديو)
            </button>

            <div className="text-center text-xs text-muted-foreground">أو</div>

            <div className="space-y-2">
              <input
                type="text"
                value={iframeName}
                onChange={(e) => setIframeName(e.target.value)}
                placeholder="اسم الأداة (اختياري)"
                className="w-full h-9 px-3 text-sm rounded border border-input bg-background"
              />
              <div className="flex gap-2">
                <input
                  type="url"
                  value={iframeUrl}
                  onChange={(e) => setIframeUrl(e.target.value)}
                  placeholder="https:// رابط موقع مباشر"
                  className="flex-1 h-9 px-3 text-sm rounded border border-input bg-background"
                />
                <button
                  onClick={handleAddIframe}
                  disabled={!iframeUrl.trim()}
                  className="h-9 px-4 rounded bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 inline ml-1" />
                  إضافة
                </button>
              </div>
            </div>

            <div className="text-center text-xs text-muted-foreground">أو</div>

            <div className="space-y-2">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Code className="w-3 h-3" />
                لصق كود embed (iframe HTML)
              </div>
              <textarea
                value={embedCode}
                onChange={(e) => setEmbedCode(e.target.value)}
                placeholder='<iframe src="https://..." width="500" height="380"></iframe>'
                className="w-full min-h-[80px] px-3 py-2 text-xs rounded border border-input bg-background font-mono resize-none"
              />
              <button
                onClick={handleAddEmbedCode}
                disabled={!embedCode.trim()}
                className="w-full h-9 rounded bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="w-4 h-4 inline ml-1" />
                إضافة من كود embed
              </button>
            </div>

            <button
              onClick={() => setShowAddForm(false)}
              className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              إلغاء
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-3">
              {assets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Upload className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">لا توجد أدوات مساعدة لهذا الدرس</p>
                  <p className="text-xs mt-1 opacity-70">
                    اضغط &quot;إضافة أداة&quot; لرفع ملفات أو إضافة روابط أو كود embed
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer group"
                      onClick={() => handleViewAsset(asset)}
                    >
                      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                        {asset.type === "pdf" && <FileText className="w-5 h-5 text-red-400" />}
                        {asset.type === "image" && <ImageIcon className="w-5 h-5 text-green-400" />}
                        {asset.type === "video" && <Video className="w-5 h-5 text-blue-400" />}
                        {asset.type === "iframe" && <Globe className="w-5 h-5 text-purple-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{asset.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {asset.type === "pdf" ? "PDF" : asset.type === "image" ? "صورة" : asset.type === "video" ? "فيديو" : "رابط/embed"}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }}
                        className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:bg-accent/20 hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border bg-secondary/20">
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                إضافة أداة مساعدة
              </button>
            </div>
          </>
        )}
      </div>
    </CanvasPanel>
  );
}
