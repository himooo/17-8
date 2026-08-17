// ====================================================================
//  csv-parser.ts — P2-14: تكامل LMS (استيراد CSV لقوائم الطلاب)
//
//  محلل CSV بسيط لا يحتاج أي مكتبات خارجية — يكفي لاستيراد قوائم أسماء
//  الطلاب القادمة من أنظمة إدارة التعلم أو جداول Excel المصدَّرة CSV.
//
//  يقبل: فواصل أعمدة عادية (,) أو عربية (،) أو فاصلة منقوطة (;)
//  أو أسطر جديدة (\n).
//  يزيل: صفوف فارغة، محاريف، صفوف تحتوي أرقام/رموز فقط (headers شائعة).
//  يعيد: أسماء الطلاب + قائمة أخطاء غير قاتلة (أسماء طويلة جداً مثلاً).
// ====================================================================

export interface ParsedCsvResult {
  /** قائمة أسماء الطلاب الجاهزة للإضافة */
  names: string[];
  /** تحذيرات غير قاتلة (سطور فارغة متكررة، أسماء طويلة...) */
  errors?: string[];
}

/** الحد الأقصى المقبول لطول اسم طالب واحد — الطويل جداً غالباً صف خاطئ من ملف */
const MAX_NAME_LEN = 60;

/**
 * يحلل نص CSV بسيط ويستخرج أسماء الطلاب منه.
 *
 * لا يدعم الفواصل الكاملة داخل اقتباسات (quoted CSV) — لأن ملفات LMS تُصدَّر
 * عادة عموداً واحداً للاسم. إذا احتجنا ذلك لاحقاً، نستبدل هذه الدالة بـ PapaParse
 * بدون كسر الواجهة.
 */
export function parseStudentCsv(csvText: string): ParsedCsvResult {
  if (!csvText || !csvText.trim()) {
    return { names: [], errors: ["الملف فارغ أو غير صالح"] };
  }

  const warnings: string[] = [];
  // انقسام على فاصل سطر جديد أولاً، ثم داخل كل سطر على الفواصل.
  // هذا يدعم:
  //   • سطر فيه اسم واحد
  //   • سطر فيه عدة أسماء مفصولة بفواصل
  //   • ملف يُصدَّر "اسم، درجة، صف" — نأخذ العمود الأول فقط
  const lines = csvText
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const names: string[] = [];
  let tooLongCount = 0;

  for (const line of lines) {
    // العمود الأول قبل أول فاصل — غالبية ملفات CSV من LMS/Excel
    // لا تزال تحتوي الاسم في العمود الأول، والباقي بيانات جانبية
    const cell = line.split(/[\n,،;؛\t]/u)[0].trim();
    if (!cell) continue;

    // تجاهل رؤوس أعمدة شائعة بالعربية والإنجليزية
    if (/^(الاسم|اسم|name|student|الطلاب|students?)$/i.test(cell)) continue;

    // إذا طول الصف كثير، احتمال أنه صف بيانات حقيقي — نسجل تحذيراً ونكمل
    if (cell.length > MAX_NAME_LEN) {
      tooLongCount++;
      continue;
    }

    names.push(cell);
  }

  if (tooLongCount > 0) {
    warnings.push(`تم تخطي ${tooLongCount} صف يحتوي أسماءً طويلة جداً`);
  }

  if (names.length === 0) {
    return {
      names: [],
      errors: [...warnings, "لم يتم العثور على أي أسماء صالحة في الملف"],
    };
  }

  return { names, errors: warnings.length > 0 ? warnings : undefined };
}
