// ====================================================================
//  title-rules.ts — نظام الألقاب التلقائية (P2-12)
//
//  قواعد مرتّبة حسب الأولوية: يُمنح الطالب أعلى لقب تتحقق شروطه.
//  تُستدعى بعد كل عملية منح نقاط/إجابة صحيحة/خطأ لتحديث اللقب تلقائياً.
// ====================================================================

/** إحصائيات الطالب التي تُبنى عليها شروط الألقاب */
export interface TitleStats {
  points: number;   // إجمالي النقاط التراكمية
  correct: number;  // عدد الإجابات الصحيحة
  wrong: number;    // عدد الإجابات الخاطئة
  badges: number;   // عدد الشارات المكتسبة
}

/** قاعدة لقب واحدة */
export interface TitleRule {
  id: string;
  icon: string; // إيموجي اللقب
  name: string; // اسم اللقب
  /** شرط التحقق — إذا أرجع true يكون الطالب مؤهلاً لهذا اللقب */
  condition: (stats: TitleStats) => boolean;
  /** الأولوية — الأعلى يكسب عند تحقق أكثر من شرط */
  priority: number;
}

/**
 * قائمة قواعد الألقاب (من الأدنى للأعلى تقديراً).
 * القاعدة priority 0 (مبتدئ) تعمل كافتراضي — دائماً متحققة.
 */
export const TITLE_RULES: TitleRule[] = [
  { id: "novice",   name: "مبتدئ",        icon: "🌱", priority: 0, condition: (s) => s.points >= 0 },
  { id: "rusher",   name: "سريع",         icon: "⚡", priority: 1, condition: (s) => s.correct >= 20 },
  { id: "genius",   name: "عبقري",        icon: "🧠", priority: 2, condition: (s) => s.correct >= 50 },
  { id: "champion", name: "بطل",          icon: "🏆", priority: 3, condition: (s) => s.points >= 100 },
  { id: "star",     name: "نجم الأسبوع",  icon: "⭐", priority: 4, condition: (s) => s.points >= 200 },
  { id: "legend",   name: "أسطورة",       icon: "👑", priority: 5, condition: (s) => s.points >= 500 },
];

/**
 * يحسب اللقب المستحق لطالب بناءً على إحصائياته.
 * يمرّ على القواعد من الأعلى أولوية للأدنى ويرجع أول لقب تتحقق شروطه.
 * @returns اسم اللقب + إيموجي مدمجين، مثل "⭐ نجم الأسبوع"
 */
export function computeTitle(stats: TitleStats): string {
  // نسخة مرتبة تنازلياً حسب الأولوية — أول تحقق شرط = الفائز
  const sorted = [...TITLE_RULES].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (rule.condition(stats)) {
      return `${rule.icon} ${rule.name}`;
    }
  }
  // احتياط نظري (قاعدة novice دائماً متحققة)
  return `${TITLE_RULES[0].icon} ${TITLE_RULES[0].name}`;
}

/**
 * يجلب القاعدة الكاملة المستحقة (للعرض المفصل في التقارير).
 */
export function computeTitleRule(stats: TitleStats): TitleRule {
  const sorted = [...TITLE_RULES].sort((a, b) => b.priority - a.priority);
  return sorted.find((r) => r.condition(stats)) ?? TITLE_RULES[0];
}
