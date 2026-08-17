"use client";

// ====================================================================
//  tts-announcer.ts — نظام الإعلان الصوتي الشامل (v10.2)
//
//  يغطي كل تفاصيل البرنامج:
//  - اختيار الطلاب (اسم الطالب + تشجيع)
//  - الإجابة الصحيحة (نقاط + تشجيع)
//  - الإجابة الخاطئة (تشجيع على المحاولة)
//  - محاولة جيدة (+1 نقطة)
//  - منح نقاط إضافية
//  - منح شارات (نجمة، ذهبية، إبداع، مساعدة)
//  - منح هدايا
//  - الاحتفالات (كونفيتي، قلوب، نجوم، ألعاب نارية، ...)
//  - تغيير اللقب (عبقري، بطل، نجم)
//  - بدء/انتهاء الجلسة
//
//  يعتمد على: tts-service.ts (Google TTS via proxy + fallback)
// ====================================================================

import { speak, stopSpeaking } from "./tts-service";

// ===== أنواع الأحداث =====

export type TtsEvent =
  | "student-picked"          // اختيار طالب
  | "answer-correct"          // إجابة صحيحة
  | "answer-wrong"            // إجابة خاطئة
  | "good-try"                // محاولة جيدة
  | "points-awarded"          // منح نقاط
  | "badge-awarded"           // منح شارة
  | "gift-awarded"            // منح هدية
  | "celebration-fired"       // احتفال
  | "title-changed"           // تغيير اللقب
  | "session-started"         // بدء الجلسة
  | "session-ended"           // انتهاء الجلسة
  | "student-absent"          // تغيير حالة الغياب
  | "wheel-spin"              // دوران العجلة
  | "game-start"              // بدء لعبة
  | "game-win"                // فوز في لعبة
  | "step-changed"            // تغيير الخطوة
  | "idea-changed"            // تغيير الفكرة
  | "lesson-loaded";          // تحميل درس

export interface TtsContext {
  studentName?: string;
  points?: number;
  totalPoints?: number;
  badgeType?: string;
  giftName?: string;
  celebrationType?: string;
  celebrationLabel?: string;
  oldTitle?: string;
  newTitle?: string;
  step?: number;
  totalSteps?: number;
  ideaTitle?: string;
  lessonTitle?: string;
  gameName?: string;
  isAbsent?: boolean;
}

// ===== القوالب الصوتية (جمل طبيعية متنوعة) =====

const TEMPLATES: Record<TtsEvent, string[]> = {
  "student-picked": [
    "دور {name}! يلا ورينا إجابتك",
    "{name}، أنت الاختيار! ما رأيك؟",
    "تم اختيار {name}! هيا بنا",
    "{name}، أنت في المضمون! جاوب بثقة",
    "دورك يا {name}! خد وقتك وفكر",
  ],
  "answer-correct": [
    "إجابة صحيحة! أحسنت يا {name}",
    "ممتاز يا {name}! +{points} نقاط",
    "صحيح! رائع يا {name}",
    "أحسنت! إجابة صحيحة يا {name}",
    "ممتاز! {name} يتألق اليوم",
  ],
  "answer-wrong": [
    "إجابة خاطئة يا {name}، حاول مرة أخرى",
    "ليست صحيحة يا {name}، لا بأس",
    "خطأ يا {name}، ركز وحاول تاني",
    "إجابة غير صحيحة يا {name}، شد حيلك",
    "خطأ يا {name}، المحاولة الجاية!",
  ],
  "good-try": [
    "محاولة جيدة يا {name}! +1 نقطة",
    "أحسنت المحاولة يا {name}",
    "محاولة ممتازة يا {name}! استمر",
    "جيد يا {name}! +1 نقطة",
    "محاولة قوية يا {name}!",
  ],
  "points-awarded": [
    "{points} نقاط لـ {name}! مجموعك {total}",
    "رائع! {name} حصل على {points} نقاط",
    "أحسنت يا {name}! +{points} نقاط",
    "{name} يكسب {points} نقاط إضافية",
    "ممتاز يا {name}! {points} نقاط جديدة",
  ],
  "badge-awarded": [
    "شارة {badge} لـ {name}!",
    "{name} يحصل على شارة {badge}",
    "رائع يا {name}! شارة {badge} جديدة",
    "أحسنت يا {name}! حصلت على {badge}",
  ],
  "gift-awarded": [
    "هدية لـ {name}! {gift}",
    "{name} يحصل على {gift}!",
    "رائع يا {name}! هدية جديدة: {gift}",
    "مبروك يا {name}! {gift} لك",
    "{name} يستحق {gift}! أحسنت",
  ],
  "celebration-fired": [
    "{label}! احتفال رائع",
    "يلا نحتفل! {label}",
    "احتفال مميز! {label}",
    "رائع! {label}",
    "{label}! أحسنتم",
  ],
  "title-changed": [
    "{name} صار {title}!",
    "مبروك يا {name}! لقب جديد: {title}",
    "رائع! {name} أصبح {title}",
    "{name} يحقق لقب {title}! أحسنت",
  ],
  "session-started": [
    "بدأت الجلسة! يلا نتعلم",
    "أهلاً بكم في جلسة جديدة",
    "جلسة جديدة بدأت! استعدوا",
    "هيا بنا! الجلسة بدأت",
  ],
  "session-ended": [
    "انتهت الجلسة! أحسنتم جميعاً",
    "شكراً لكم! الجلسة انتهت",
    "انتهينا! أحسنتم اليوم",
    "جلسة رائعة! شكراً لكم",
  ],
  "student-absent": [
    "{name} غائب اليوم",
    "تم تسجيل غياب {name}",
    "{name} غير موجود اليوم",
  ],
  "wheel-spin": [
    "دوران العجلة! من سيكون الاختيار؟",
    "العجلة تدور! انتظروا",
    "يلا نشوف مين الاختيار!",
  ],
  "game-start": [
    "لعبة {game}! استعدوا",
    "يبدأ {game}! هيا بنا",
    "لعبة جديدة: {game}",
  ],
  "game-win": [
    "فوز رائع! أحسنتم",
    "مبروك للفائزين!",
    "أحسنتم! لعبتم بشكل ممتاز",
  ],
  "step-changed": [
    "خطوة {step} من {total}",
    "الخطوة {step}",
  ],
  "idea-changed": [
    "الفكرة الجديدة: {idea}",
    "ننتقل إلى: {idea}",
    "الفكرة التالية: {idea}",
  ],
  "lesson-loaded": [
    "تم تحميل الدرس: {lesson}",
    "درس جديد: {lesson}",
    "هيا نبدأ درس: {lesson}",
  ],
};

// ===== ترجمة الشارات والألقاب للعربية =====

const BADGE_NAMES: Record<string, string> = {
  "correct": "إجابة صحيحة",
  "good-try": "محاولة جيدة",
  "fast": "سريع",
  "creative": "تفكير إبداعي",
  "helper": "مساعدة زملاء",
  "star": "نجمة",
  "wrong": "خطأ",
};

const TITLE_NAMES: Record<string, string> = {
  "genius": "عبقري",
  "champion": "بطل",
  "star": "نجم",
  "beginner": "مبتدئ",
};

const CELEBRATION_NAMES: Record<string, string> = {
  "confetti": "كونفيتي",
  "hearts": "قلوب الحب",
  "stars": "نجوم ساطعة",
  "money": "كنز النجاح",
  "balloons": "بالونات طائرة",
  "fireworks": "ألعاب نارية",
  "gift-rain": "هطول الهدايا",
  "rainbow": "قوس قزح",
  "mega": "احتفال ضخم",
  "snow": "ثلج لامع",
  "cannon": "مدفع النجوم",
  "golden-shower": "مطر ذهبي",
  "school-pride": "فخر المدرسة",
  "disco": "ديسكو",
  "spring-blossom": "أزهار الربيع",
  "tornado": "إعصار الطاقة",
  "diamond": "ألماس لامع",
  "emoji-rain": "مطر الابتسامات",
  "champion": "بطل الأبطال",
  "star-rain": "مطر النجوم",
  "heart-explosion": "انفجار الحب",
  "title-parade": "موكب الأوسمة",
  "rocket": "صاروخ الإقلاع",
  "swords": "صدام السيوف",
  "crown": "التاج الملكي",
  "medal": "وسام الشرف",
  "shield": "درع البطولة",
  "target": "إصابة الهدف",
  "party": "حفلة البوب",
  "dragon": "نار التنين",
  "magic-wand": "عصا السحر",
  "ice-crystal": "بلورة الثلج",
  "lightning": "صاعقة البرق",
  "treasure": "كنز مكتشف",
  "medal-stars": "نجوم الميدالية",
  "double-rainbow": "قوس مزدوج",
};

// ===== الحالة =====

let ttsEnabled = true;
let ttsRate = 1.5; // 🟢 v3: تسريع النطق افتراضياً (1.5x) للسلاسة — was 1.3
let speakStudentName = true;
let speakPoints = true;
let speakCelebrations = true;
let speakGifts = true;

/**
 * تهيئة النظام الصوتي من الإعدادات
 */
export function initTtsAnnouncer(settings: {
  ttsEnabled?: boolean;
  ttsRate?: number;
  ttsSpeakStudentName?: boolean;
  ttsSpeakPoints?: boolean;
  ttsSpeakCelebrations?: boolean;
  ttsSpeakGifts?: boolean;
}) {
  ttsEnabled = settings.ttsEnabled ?? true;
  // 🟢 v3: default rate 1.5 (was 1.0) — user requested faster default speech
  ttsRate = settings.ttsRate ?? 1.5;
  speakStudentName = settings.ttsSpeakStudentName ?? true;
  speakPoints = settings.ttsSpeakPoints ?? true;
  speakCelebrations = settings.ttsSpeakCelebrations ?? true;
  speakGifts = settings.ttsSpeakGifts ?? true;
}

/**
 * تحديث إعداد واحد
 */
export function updateTtsSetting(key: string, value: any) {
  switch (key) {
    case "ttsEnabled": ttsEnabled = value; break;
    case "ttsRate": ttsRate = value; break;
    case "ttsSpeakStudentName": speakStudentName = value; break;
    case "ttsSpeakPoints": speakPoints = value; break;
    case "ttsSpeakCelebrations": speakCelebrations = value; break;
    case "ttsSpeakGifts": speakGifts = value; break;
  }
}

// ===== دوال مساعدة =====

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: string, ctx: TtsContext): string {
  let result = template;
  if (ctx.studentName) result = result.replace(/\{name\}/g, ctx.studentName);
  if (ctx.points !== undefined) result = result.replace(/\{points\}/g, String(ctx.points));
  if (ctx.totalPoints !== undefined) result = result.replace(/\{total\}/g, String(ctx.totalPoints));
  if (ctx.badgeType) {
    const badgeName = BADGE_NAMES[ctx.badgeType] || ctx.badgeType;
    result = result.replace(/\{badge\}/g, badgeName);
  }
  if (ctx.giftName) result = result.replace(/\{gift\}/g, ctx.giftName);
  if (ctx.celebrationLabel) {
    result = result.replace(/\{label\}/g, ctx.celebrationLabel);
  } else if (ctx.celebrationType) {
    const celebName = CELEBRATION_NAMES[ctx.celebrationType] || ctx.celebrationType;
    result = result.replace(/\{label\}/g, celebName);
  }
  if (ctx.newTitle) {
    const titleName = TITLE_NAMES[ctx.newTitle] || ctx.newTitle;
    result = result.replace(/\{title\}/g, titleName);
  }
  if (ctx.step !== undefined) result = result.replace(/\{step\}/g, String(ctx.step));
  if (ctx.totalSteps !== undefined) result = result.replace(/\{total\}/g, String(ctx.totalSteps));
  if (ctx.ideaTitle) result = result.replace(/\{idea\}/g, ctx.ideaTitle);
  if (ctx.lessonTitle) result = result.replace(/\{lesson\}/g, ctx.lessonTitle);
  if (ctx.gameName) result = result.replace(/\{game\}/g, ctx.gameName);
  return result;
}

// ===== الواجهة العامة =====

/**
 * إعلان حدث عبر النظام الصوتي
 * @param event نوع الحدث
 * @param ctx سياق الحدث (اسم الطالب، النقاط، إلخ)
 */
export async function announce(event: TtsEvent, ctx: TtsContext = {}): Promise<void> {
  if (!ttsEnabled) return;

  // تحقق من الإعدادات الفرعية
  if (event === "student-picked" && !speakStudentName) return;
  if ((event === "answer-correct" || event === "points-awarded" || event === "good-try") && !speakPoints) return;
  if (event === "celebration-fired" && !speakCelebrations) return;
  if (event === "gift-awarded" && !speakGifts) return;

  const templates = TEMPLATES[event];
  if (!templates || templates.length === 0) return;

  const template = pickRandom(templates);
  const text = fillTemplate(template, ctx);

  if (!text || text.trim().length === 0) return;

  try {
    await speak(text, "ar", ttsRate);
  } catch (e) {
    console.warn("[tts-announcer] speak failed:", e);
  }
}

/**
 * إيقاف أي إعلان جاري
 */
export function stopAnnouncement() {
  stopSpeaking();
}

/**
 * هل النظام الصوتي مفعّل؟
 */
export function isTtsEnabled(): boolean {
  return ttsEnabled;
}

/**
 * اختبار سريع للنظام الصوتي
 */
export async function testTts(): Promise<boolean> {
  return await speak("النظام الصوتي يعمل بشكل جيد", "ar", ttsRate);
}
