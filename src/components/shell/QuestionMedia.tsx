"use client";
/* صور الأسئلة قد تكون أصولاً محلية أو روابط خارجية؛ نستخدم img عمداً لعرضها دون تهيئة مضيف. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { renderEquationText } from "@/lib/whiteboard-v10";

type QuestionMediaProps = {
  text: string;
  images?: Array<{ url: string; alt?: string; type?: string }>;
  className?: string;
};

function isSafeImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith("/manus-storage/");
}

function RichQuestionText({ text }: { text: string }) {
  const parts = text.split(/(\$\$?[\s\S]*?\$\$?|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g).filter(Boolean);
  return <>{parts.map((part, index) => {
    const isMath = /^\$\$?[\s\S]*\$\$?$/.test(part) || /^\\\([\s\S]*\\\)$/.test(part) || /^\\\[[\s\S]*\\\]$/.test(part);
    if (!isMath) return <span key={`${index}-${part}`}>{part}</span>;
    const value = part.replace(/^\$\$?|\$\$?$/g, "").replace(/^\\\(|\\\)$|^\\\[|\\\]$/g, "").trim();
    return <span key={`${index}-${part}`} dir="ltr" className="mx-1 inline-block rounded bg-slate-950/40 px-1.5 font-mono text-[0.96em]" title="صيغة رياضية">{renderEquationText(value)}</span>;
  })}</>;
}

export function QuestionMedia({ text, images = [], className = "" }: QuestionMediaProps) {
  const [failed, setFailed] = useState<string[]>([]);
  const visibleImages = images.filter((image) => isSafeImageUrl(image.url) && !failed.includes(image.url));
  return <div className={`space-y-3 ${className}`}>
    <div className="whitespace-pre-wrap leading-8"><RichQuestionText text={text} /></div>
    {visibleImages.length > 0 && <div className={`grid gap-2 ${visibleImages.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"}`} aria-label="صور السؤال">
      {visibleImages.map((image, index) => <figure key={`${image.url}-${index}`} className="overflow-hidden rounded-xl border border-white/10 bg-white/95 p-2">
        <img src={image.url} alt={image.alt || "صورة مرتبطة بالسؤال"} className="mx-auto max-h-64 w-full object-contain" onError={() => setFailed((current) => current.includes(image.url) ? current : [...current, image.url])} />
        {image.alt && <figcaption className="mt-1 text-center text-[10px] text-slate-500">{image.alt}</figcaption>}
      </figure>)}
    </div>}
  </div>;
}

export default QuestionMedia;

