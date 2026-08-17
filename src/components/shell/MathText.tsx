// ====================================================================
//  MathText.tsx — Renders math expressions in React components
//  Supports LaTeX-style fractions: \frac{a}{b} → visual fraction
//  Supports $$...$$ and $...$ delimiters
//
//  Usage: <MathText text="احسب \frac{1}{5} + \frac{2}{5} = \frac{3}{5}" />
// =================================================================///
"use client";

import React from "react";

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Parse a text string and render math expressions inline.
 * Supports:
 *   - \frac{a}{b} → fraction with numerator/denominator
 *   - \times → ×
 *   - \div → ÷
 *   - \pm → ±
 *   - \leq → ≤
 *   - \geq → ≥
 *   - \neq → ≠
 *   - \sqrt{x} → √x̄
 *   - x^{n} → xⁿ (superscript)
 *   - x_{n} → xₙ (subscript)
 */
export function MathText({ text, className }: MathTextProps) {
  if (!text) return null;

  // Split text into segments: math vs plain text
  // Math segments are wrapped in $...$ or $$...$$
  const segments: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Look for $$...$$ first (display math)
    const displayMatch = remaining.match(/^\$\$([\s\S]+?)\$\$/);
    if (displayMatch) {
      segments.push(renderMath(displayMatch[1], key++, true));
      remaining = remaining.slice(displayMatch[0].length);
      continue;
    }
    // Look for $...$ (inline math)
    const inlineMatch = remaining.match(/^\$([^$]+?)\$/);
    if (inlineMatch) {
      segments.push(renderMath(inlineMatch[1], key++, false));
      remaining = remaining.slice(inlineMatch[0].length);
      continue;
    }
    // Plain text until next $ or end
    const nextDollar = remaining.indexOf("$");
    if (nextDollar === -1) {
      segments.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
      break;
    }
    segments.push(<React.Fragment key={key++}>{remaining.slice(0, nextDollar)}</React.Fragment>);
    remaining = remaining.slice(nextDollar);
  }

  return <span className={className}>{segments}</span>;
}

function renderMath(expr: string, key: number, display: boolean): React.ReactNode {
  // Parse \frac{a}{b}
  const parts: React.ReactNode[] = [];
  let remaining = expr;
  let partKey = 0;

  while (remaining.length > 0) {
    // \frac{a}{b}
    const fracMatch = remaining.match(/^\\frac\{([^}]*)\}\{([^}]*)\}/);
    if (fracMatch) {
      parts.push(
        <span key={partKey++} className="inline-flex flex-col items-center align-middle mx-1" style={{ verticalAlign: "middle" }}>
          <span className="text-[0.8em] leading-tight">{fracMatch[1]}</span>
          <span className="border-t border-current w-full my-0.5" />
          <span className="text-[0.8em] leading-tight">{fracMatch[2]}</span>
        </span>
      );
      remaining = remaining.slice(fracMatch[0].length);
      continue;
    }
    // \times, \div, \pm, \leq, \geq, \neq
    const symMatch = remaining.match(/^\\(times|div|pm|leq|geq|neq|cdot|infty|pi|theta|alpha|beta|gamma|delta|sqrt)\b/);
    if (symMatch) {
      const symbols: Record<string, string> = {
        times: "×", div: "÷", pm: "±", leq: "≤", geq: "≥", neq: "≠",
        cdot: "·", infty: "∞", pi: "π", theta: "θ", alpha: "α", beta: "β",
        gamma: "γ", delta: "δ", sqrt: "√",
      };
      if (symMatch[1] === "sqrt") {
        // \sqrt{x} → √x̄ (simplified)
        const sqrtMatch = remaining.match(/^\\sqrt\{([^}]*)\}/);
        if (sqrtMatch) {
          parts.push(
            <span key={partKey++}>
              √<span style={{ borderTop: "1px solid currentColor" }}>{sqrtMatch[1]}</span>
            </span>
          );
          remaining = remaining.slice(sqrtMatch[0].length);
          continue;
        }
      }
      parts.push(<span key={partKey++}>{symbols[symMatch[1]] || ""}</span>);
      remaining = remaining.slice(symMatch[0].length);
      continue;
    }
    // Superscript x^{n} or x^n
    const supMatch = remaining.match(/^([^{])\^(\{([^}]*)\}|.)/);
    if (supMatch) {
      const sup = supMatch[3] || supMatch[2];
      parts.push(
        <span key={partKey++}>
          {supMatch[1]}
          <sup className="text-[0.7em]">{sup}</sup>
        </span>
      );
      remaining = remaining.slice(supMatch[0].length);
      continue;
    }
    // Subscript x_{n} or x_n
    const subMatch = remaining.match(/^([^{])_(\{([^}]*)\}|.)/);
    if (subMatch) {
      const sub = subMatch[3] || subMatch[2];
      parts.push(
        <span key={partKey++}>
          {subMatch[1]}
          <sub className="text-[0.7em]">{sub}</sub>
        </span>
      );
      remaining = remaining.slice(subMatch[0].length);
      continue;
    }
    // Regular character
    parts.push(<span key={partKey++}>{remaining[0]}</span>);
    remaining = remaining.slice(1);
  }

  return (
    <span key={key} className={display ? "block text-center my-2 text-lg font-bold" : "inline"}>
      {parts}
    </span>
  );
}
