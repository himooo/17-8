"use client";

import { cn } from "@/lib/utils";

interface BisalasaLogoProps {
  size?: number;
  showText?: boolean;
  variant?: "full" | "icon" | "text";
  className?: string;
}

/**
 * BisalasaLogo - شعار بسلاسة
 * - ابتسامة زرقاء (#0142A0)
 * - عيون حمراء (#DA151C)
 * - بدون وجه - فقط الابتسامة والعيون
 */
export function BisalasaLogo({
  size = 32,
  showText = true,
  variant = "full",
  className,
}: BisalasaLogoProps) {
  if (variant === "text") {
    return (
      <span
        className={cn("font-bold text-[#0142A0]", className)}
        style={{ fontSize: size * 0.7 }}
      >
        بسلاسة
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="shrink-0 flex items-center justify-center rounded-lg"
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          background: "white",
        }}
      >
        <svg
          width={size * 0.85}
          height={size * 0.85}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* العيون الحمراء (نقاط صغيرة نظيفة) */}
          <circle cx="11.5" cy="11" r="2" fill="#DA151C" />
          <circle cx="20.5" cy="11" r="2" fill="#DA151C" />
          {/* الابتسامة الزرقاء (قوس خفيف أنيق) */}
          <path
            d="M7 16 Q16 25 25 16"
            stroke="#0142A0"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
      {showText && variant === "full" && (
        <div className="flex flex-col leading-tight">
          <span
            className="font-bold text-white"
            style={{ fontSize: size * 0.45 }}
          >
            بسلاسة
          </span>
          <span
            className="text-white/60"
            style={{ fontSize: size * 0.25 }}
          >
            غرفة عمليات المدرس
          </span>
        </div>
      )}
    </div>
  );
}
