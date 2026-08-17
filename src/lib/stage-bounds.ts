"use client";
import { useEffect, useState } from "react";

export interface StageBounds {
  left: number; top: number; width: number; height: number;
  right: number; bottom: number; centerX: number; centerY: number;
}
export function getStageBounds(): StageBounds | null {
  if (typeof window === "undefined") return null;
  const stage = document.querySelector(".iframe-visible-area") as HTMLElement | null;
  if (!stage) return null;
  const r = stage.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom, centerX: r.left + r.width / 2, centerY: r.top + r.height / 2 };
}

/**
 * Reactively tracks the iframe-visible-area bounds (resize/orientation/
 * fullscreen/layout changes). For any overlay that must stay fully inside
 * what's actually visible to students during screen-share/projection.
 */
export function useStageBounds(active: boolean = true): StageBounds | null {
  const [bounds, setBounds] = useState<StageBounds | null>(null);
  useEffect(() => {
    if (!active) return;
    const update = () => setBounds(getStageBounds());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const interval = setInterval(update, 300);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      clearInterval(interval);
    };
  }, [active]);
  return bounds;
}
