"use client";

import { useShellStore } from "@/lib/shell-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  FileImage,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AssetsPanel - مدير الأصول والصور الوهمية
 */
export function AssetsPanel() {
  const manifest = useShellStore((s) => s.manifest);
  const assets = manifest?.assets || [];

  return (
    <div className="flex flex-col h-full">
      {/* Summary */}
      <div className="p-2 border-b border-border bg-secondary/20">
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className="bg-secondary/50 rounded p-2 text-center border border-border">
            <div className="text-muted-foreground">الإجمالي</div>
            <div className="font-bold text-base text-primary">{assets.length}</div>
          </div>
          <div className="bg-secondary/50 rounded p-2 text-center border border-border">
            <div className="text-muted-foreground">مكتملة</div>
            <div className="font-bold text-base text-success" style={{ color: "#10b981" }}>
              {assets.filter((a) => a.status === "final").length}
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 panel-scroll">
        <div className="p-2 space-y-1.5">
          {assets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs">لا توجد أصول مطلوبة</p>
              <p className="text-[10px] mt-1 opacity-70">
                الشرائح التي تحتوي صور وهمية ستعرضها هنا
              </p>
            </div>
          ) : (
            assets.map((asset, idx) => {
              const isFinal = asset.status === "final";
              return (
                <div
                  key={asset.id + idx}
                  className={cn(
                    "rounded-md border p-2",
                    isFinal
                      ? "border-success/40 bg-success/5"
                      : "border-accent/30 bg-accent/5"
                  )}
                  style={{
                    borderColor: isFinal ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.3)",
                    background: isFinal ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)",
                  }}
                >
                  <div className="flex items-start gap-1.5">
                    <FileImage
                      className={cn(
                        "w-4 h-4 flex-shrink-0 mt-0.5",
                        isFinal ? "text-success" : "text-accent"
                      )}
                      style={{ color: isFinal ? "#10b981" : "#ef4444" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <code className="text-[10px] font-mono text-primary truncate">
                          {asset.id}
                        </code>
                        {isFinal ? (
                          <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0" style={{ color: "#10b981" }} />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-accent flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5 leading-snug text-foreground">
                        {asset.description}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                            isFinal
                              ? "bg-success/15 text-success"
                              : "bg-accent/15 text-accent"
                          )}
                          style={{
                            background: isFinal ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: isFinal ? "#6ee7b7" : "#fca5a5",
                          }}
                        >
                          {isFinal ? "نهائي" : "وهمي"}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {asset.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
