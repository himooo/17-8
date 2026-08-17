"use client";

import { useEffect } from "react";
import { useShellStore } from "@/lib/shell-store";
import { Gift } from "lucide-react";
import { fireGiftRain } from "@/lib/shell-utils";
import { GameOverlay } from "./GameOverlay";

/**
 * AwardedGiftDisplay v6.3 - عرض الهدية المُمنوحة للطالب
 * - يظهر كويندو centered داخل الكانفاس (عبر GameOverlay)
 * - يطلق هطول الهدايا
 * - يعرض الهدية فقط؛ الحفظ وتسجيل النشاط يحدثان في store action المركزي
 * - يختفي تلقائياً بعد 5 ثواني
 */
export function AwardedGiftDisplay() {
  const awardedGiftDisplay = useShellStore((s) => s.awardedGiftDisplay);
  const setAwardedGiftDisplay = useShellStore((s) => s.setAwardedGiftDisplay);
  const playSound = useShellStore((s) => s.playSound);

  useEffect(() => {
    if (awardedGiftDisplay) {
      playSound("celebrate-gift");
      fireGiftRain();
      const timer = setTimeout(() => {
        setAwardedGiftDisplay(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [awardedGiftDisplay, setAwardedGiftDisplay, playSound]);

  if (!awardedGiftDisplay) return null;

  return (
    <GameOverlay
      open={!!awardedGiftDisplay}
      onClose={() => setAwardedGiftDisplay(null)}
      title="🎁 هدية!"
      accentColor="#ec4899"
      widthPercent={70}
      heightPercent={70}
    >
      <div className="w-full h-full bg-gradient-to-br from-pink-950 via-zinc-900 to-purple-950 flex items-center justify-center p-6 overflow-y-auto">
        <div className="bg-gradient-to-br from-[#ec4899] to-[#a855f7] rounded-3xl p-6 border-4 border-[#FFD700] shadow-2xl animate-in zoom-in duration-500 w-full max-w-sm">
          <div className="text-center">
            <Gift className="w-10 h-10 text-[#FFD700] mx-auto mb-2" />
            <div className="text-white/80 text-sm mb-1">🎉 هدية لـ</div>
            <div className="text-3xl font-bold text-white mb-3 drop-shadow-lg">
              {awardedGiftDisplay.studentName}
            </div>
            <div className="bg-white/20 rounded-2xl p-4 mb-3 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={awardedGiftDisplay.giftImage}
                alt={awardedGiftDisplay.giftName}
                className="w-28 h-28 object-cover rounded-xl mx-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="text-xl font-bold text-white mt-2">
                {awardedGiftDisplay.giftName}
              </div>
            </div>
            <div className="text-white/70 text-sm">مبروك! 🎊</div>
          </div>
        </div>
      </div>
    </GameOverlay>
  );
}
