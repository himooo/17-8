"use client";

import { useEffect, useRef } from "react";
import { useShellStore } from "@/lib/shell-store";

/**
 * VirtualCommentLayer — منصّة تشغيل التعليقات الافتراضية
 *
 * السلوك (محدّث):
 * - التعليق يظهر كـ "خطوة مستقلة" قبل الشريحة
 * - عند الضغط على السهم (Next):
 *   1) لو الخطوة التالية لها تعليق → اعرض التعليق فقط (لا تغيّر الشريحة)
 *   2) اضغط Next مرة ثانية → انتقل للشريحة فعلاً
 *   3) لو الخطوة التالية ليس لها تعليق → انتقل مباشرة
 * - هذا الـ layer لا يشغّل التعليقات تلقائياً عند تغيير الخطوة
 *   (الـ interstitial system في nextStep/prevStep يتولى ذلك)
 * - هذا الـ layer فقط يخفي التعليقات عند بدء لعبة
 */
export function VirtualCommentLayer() {
  const activeGame = useShellStore((s) => s.activeGame);
  const dismissVirtualComment = useShellStore((s) => s.dismissVirtualComment);

  // ─── لما اللعبة تشتغل → اختفي أي bubble موجود ───
  useEffect(() => {
    if (activeGame) dismissVirtualComment();
  }, [activeGame, dismissVirtualComment]);

  return null;
}
