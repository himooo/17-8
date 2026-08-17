// ====================================================================
//  Slide Manifest Schema v3.0 - العقد بين الـ Shell والشرائح المستوردة
// ====================================================================
//  يدعم:
//  - HTML ثابت
//  - React apps (مبنية كـ static build)
//  - أفكار متداخلة (Ideas): كل فكرة لها خطواتها المستقلة
//  - شريحة واحدة أو عدة شرائح (Multi-Slide Lesson)
// ====================================================================

/** نوع الرسالة المرسلة من الـ Shell إلى الـ iframe (الشريحة) */
export type ShellToSlideMessage =
  | { type: "GOTO_STEP"; step: number; ideaId?: string }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "GOTO_IDEA"; ideaId: string; step?: number }
  | { type: "REQUEST_MANIFEST" }
  | { type: "REQUEST_CURRENT_STEP" }
  | { type: "PLAY_SOUND"; sound: "success" | "error" | "celebrate" | "click" };

/** نوع الرسالة المرسلة من الـ iframe (الشريحة) إلى الـ Shell */
export type SlideToShellMessage =
  | { type: "MANIFEST"; payload: SlideManifest }
  | { type: "STEP_CHANGED"; step: number; totalSteps: number; ideaId?: string }
  | { type: "IDEA_CHANGED"; ideaId: string; step: number; title?: string }
  | { type: "READY" }
  | { type: "ERROR"; message: string }
  | { type: "REQUEST_SOUND"; sound: "success" | "error" | "celebrate" | "click" };

/** الأصول المطلوبة من المنهج أو الشريحة؛ الرابط اختياري في manifests القديمة. */
export interface SlideAsset {
  id: string;
  description: string;
  type: "geometric-figure" | "illustration" | "photo" | "chart" | "icon";
  status: "placeholder" | "final";
  url?: string;
  alt?: string;
  source?: "teacher-upload" | "book-crop" | "ai-generated" | "external" | "unknown";
  checksum?: string;
  originalAssetId?: string;
  width?: number;
  height?: number;
}

/** شريحة فعلية داخل خطوة؛ كل الحقول الجديدة اختيارية للتوافق مع manifests القديمة. */
export interface LessonSlide {
  id: string;
  title?: string;
  type?: "content" | "example" | "question" | "interaction" | "transition" | "review";
  body?: string;
  script?: string | string[];
  notes?: string;
  assetRefs?: string[];
  questionRefs?: string[];
  virtualCommentIds?: string[];
  whiteboardPlan?: string;
  autoSlideMs?: number;
}

/** خطوة شرح؛ يمكن أن تحتوي على Slide قديمة ضمنياً أو عدة Slides جديدة. */
export interface SlideStep {
  step: number;
  id?: string;
  title?: string;
  type?: "content" | "question" | "celebration" | "transition" | "virtual-comment";
  script?: string | string[];
  notes?: string;
  slides?: LessonSlide[];
  assetRefs?: string[];
  questionRefs?: string[];
  question?: {
    id?: string;
    text?: string;
    correctAnswer?: string | number;
    options?: string[];
    rewardPoints?: number;
    difficulty?: "easy" | "medium" | "hard";
    tags?: string[];
    gameReady?: boolean;
    images?: Array<{ url: string; alt?: string; type?: string }>;
    imageRefs?: string[];
    usage?: Array<"presentation" | "moodle-interactive" | "moodle-homework" | "game">;
  };
  sound?: {
    onEnter?: string;
    onSuccess?: string;
    onError?: string;
  };
  effect?: "confetti" | "flash-red" | "flash-green" | "none";
  autoSlideMs?: number;
}

// ====================================================================
//  Virtual Comments — تعليقات افتراضية في الـ Manifest
// ====================================================================

/** تعليق افتراضي في الـ Manifest (يظهر كـ bubble فوق الكانفاس) */
export interface VirtualComment {
  /** رقم الخطوة (1-based) — الخطوة اللي هيتفعل عليها التعليق */
  step: number;
  /** الفكرة (ideaId) — لو الدرس في وضع الأفكار المتداخلة */
  ideaId?: string;
  /** ربط اختياري بشريحة محددة داخل الخطوة الجديدة */
  slideId?: string;
  /** نص التعليق (الكلام اللي الطالب "بيعلقه") */
  text: string;
  /**
   * نبرة التعليق — بتحدد لون البابل ونوعه:
   * confident (واثق), confused (محتار), excited (متحمس),
   * curious (فضولي), neutral (عادي)
   */
  tone: "confident" | "confused" | "excited" | "curious" | "neutral";
  /**
   * تلميح لمين يقول التعليق (اختياري):
   * - لو الاسم موجود في الفصل النشط → استخدمه
   * - لو الجنس محدد → اختار avatar مناسب
   */
  studentHint?: {
    name?: string;
    gender?: "male" | "female";
  };
}

/**
 * الفكرة (Idea) - مفهوم متداخل
 * الدرس الواحد قد يحتوي على عدة أفكار، كل فكرة لها خطواتها المستقلة
 * مثال: درس "الكسور" يحتوي على:
 *   - فكرة 1: تعريف الكسر (3 خطوات)
 *   - فكرة 2: جمع الكسور (4 خطوات)
 *   - فكرة 3: طرح الكسور (3 خطوات)
 */
export interface SlideIdea {
  id: string;
  title: string;
  description?: string;
  /** الخطوات الخاصة بهذه الفكرة فقط */
  steps: SlideStep[];
  /** لون مميز للفكرة (للقائمة) */
  color?: "blue" | "red" | "green" | "amber" | "purple" | "cyan";
}

/** الـ Manifest الكامل الذي ترسله الشريحة عند التحميل */
export interface SlideManifest {
  lessonId: string;
  title: string;
  subtitle?: string;

  /** نوع المحتوى: html أو react */
  contentType?: "html" | "react";

  /**
   * إجمالي عدد الخطوات (يُحسب تلقائياً من الأفكار إذا لم يُحدد)
   * إذا لم توجد أفكار، فهو عدد الخطوات في steps
   */
  totalSteps?: number;

  /** الخطوة الابتدائية */
  currentStep: number;

  /** الفكرة الابتدائية النشطة (إذا وجدت أفكار) */
  currentIdeaId?: string;

  /**
   * نمط 1: خطوات مسطحة (flat steps) - درس بسيط
   * استخدم هذا إذا كان الدرس عبارة عن سلسلة خطوات متتالية بدون تقسيم لأفكار
   */
  steps?: SlideStep[];

  /**
   * نمط 2: أفكار متداخلة (nested ideas) - درس معقد
   * استخدم هذا إذا كان الدرس يحتوي على عدة مفاهيم/أفكار
   * كل فكرة لها خطواتها الخاصة
   */
  ideas?: SlideIdea[];

  /** الأصول المطلوبة */
  assets?: SlideAsset[];

  /** نسبة العرض */
  aspectRatio?: "16:9" | "9:16" | "4:3" | "1:1";

  /** المرحلة السنية */
  targetAge?: "primary-lower" | "primary-upper" | "preparatory";

  /**
   * تعليقات افتراضية (Virtual Comments) — تظهر كـ bubbles فوق الكانفاس
   * عند الوصول لخطوة معينة. مفيدة للتصوير والتفاعل.
   */
  virtualComments?: VirtualComment[];
}

// ====================================================================
//  Helper: استخراج الخطوات الحالية بناءً على الـ idea النشط
// ====================================================================
export function getCurrentSteps(manifest: SlideManifest | null, ideaId?: string): SlideStep[] {
  if (!manifest) return [];
  // إذا وجدت أفكار، أرجع خطوات الفكرة المحددة
  if (manifest.ideas && manifest.ideas.length > 0) {
    const idea = ideaId
      ? manifest.ideas.find((i) => i.id === ideaId)
      : manifest.ideas[0];
    return idea?.steps || [];
  }
  // وإلا أرجع الخطوات المسطحة
  return manifest.steps || [];
}

export function getTotalSteps(manifest: SlideManifest | null): number {
  if (!manifest) return 0;
  if (manifest.totalSteps) return manifest.totalSteps;
  if (manifest.ideas && manifest.ideas.length > 0) {
    return manifest.ideas.reduce((sum, idea) => sum + idea.steps.length, 0);
  }
  return manifest.steps?.length || 0;
}

// ====================================================================
//  Student & Lesson Types
// ====================================================================
export interface Student {
  id: string;
  name: string;
  studentCode?: string | null;
  parentTelegramChatId?: string | null;
  parentTelegramUsername?: string | null;
  parentPhone?: string | null;
  points: number;
  correctAnswers: number;
  wrongAnswers: number;
  attempts: number;
  badges: StudentBadge[];
  lastCalled?: string;
  calledInSession?: boolean;
  /** v6.3: غائب — يُستثنى من الاختيار العشوائي */
  isAbsent?: boolean;
  /** آخر وقت عاد فيه الطالب من الغياب، لدعم أولوية re-entry */
  lastAbsentAt?: string | null;
  /** اللقب الحالي (عبقري، بطل، نجم...) — يُمنح عبر الجوائز أو لوحة المتصدرين */
  title?: string;
  moodleUserId?: number | null;
  moodleUsername?: string | null;
  moodleCourseId?: number | null;
  createdAt: string;
}

export interface StudentBadge {
  type: "correct" | "good-try" | "fast" | "creative" | "helper" | "star" | "wrong";
  awardedAt: string;
  note?: string;
}

export interface ImportedLesson {
  id: string;
  fileName: string;
  title: string;
  importedAt: string;
  content: string;
  manifest?: SlideManifest;
}

export interface ShellSettings {
  muted: boolean;
  volume: number;
  teleprompterFontSize: number;
  teleprompterSize?: "collapsed" | "small" | "medium" | "large" | "xlarge";
  teleprompterHidden?: boolean;
  teleprompterHeight?: number; // ارتفاع مخصص من السحب
  teleprompterPosX?: number; // موضع X مخصص
  teleprompterPosY?: number; // موضع Y مخصص
  teleprompterWidth?: number; // عرض مخصص (0 = full width)
  notesOverlayOpen?: boolean;
  whiteboardEnabled: boolean;
  autoClearOnStepChange: boolean;
  presentationMode: "manual" | "auto";
  theme: "dark";
  penThickness: number; // 1-20 (flexible)
  penColor: "blue" | "red" | "green" | "black" | "white" | "yellow";
  iframeDevice?: "desktop" | "tablet" | "mobile";
  iframeZoom?: 50 | 75 | 90 | 100 | 125 | 150;
  /** اتجاه العرض: أفقي 16:9 أو عمودي 9:16 */
  iframeOrientation?: "landscape" | "portrait";
  /** نسبة العرض المخصصة */
  iframeAspect?: "16:9" | "9:16" | "4:3" | "1:1" | "auto";
  /** تكبير/تصغير مخصص لمنطقة العرض */
  stageScale?: number; // 0.5 - 1.5
  /** وضع الدقة العالية (Precision Mode) - تفعيل أدق للرسم */
  precisionMode?: boolean;
  /** مستوى الدقة (1-5) - كلما زاد زادت دقة المنحنيات */
  precisionScale?: number;
  /** نوع خلفية السبورة: شفاف | مسطر | شبكة | منقط */
  whiteboardBackground?: "transparent" | "lined" | "grid" | "dotted";
  /** وضع مساحة العمل: landscape (اسكربت يمين) | portrait (اسكربت فوق) */
  workspaceMode?: "landscape" | "portrait";
  /**
   * تفعيل/تعطيل التعليقات الافتراضية (⏱️ الذهبل للمنظورة)
   * - عند true: يظهر تعليق bubble على بعض الخطوات (من manifest)
   * - عند false: مخفي — المدرس يتحكم عادي
   */
  virtualCommentsEnabled?: boolean;
  /** مدة بقاء الـ bubble قبل الاختفاء التلقائي (مللي ثانية). الافتراضي: 6000 */
  virtualCommentAutoHideMs?: number;
  /** تفعيل/تعطيل النظام الصوتي (TTS) — ينطق أسماء الطلاب والاحتفالات والهدايا */
  ttsEnabled?: boolean;
  /** تفعيل نطق أسماء الطلاب عند اختيارهم */
  ttsSpeakStudentName?: boolean;
  /** تفعيل نطق النقاط والإحصائيات */
  ttsSpeakPoints?: boolean;
  /** تفعيل نطق الاحتفالات */
  ttsSpeakCelebrations?: boolean;
  /** تفعيل نطق الهدايا */
  ttsSpeakGifts?: boolean;
  /** سرعة النطق (0.5 - 2.0) */
  ttsRate?: number;
  /** ميزات AI اختيارية — لا تعمل ولا ترسل بيانات قبل التفعيل الصريح */
  aiEnabled?: boolean;
  /** النموذج الافتراضي في Gemini */
  aiModel?: string;
  /** درجة العشوائية في الإجابات التعليمية */
  aiTemperature?: number;
  /** الحد الأقصى التقريبي لمخرجات AI */
  aiMaxOutputTokens?: number;
  /** إرسال سياق الدرس الحالي فقط عند طلب المعلم */
  aiIncludeLessonContext?: boolean;
  /** نتائج LessonContext المحفوظة حسب lessonId، لا تتضمن أسراراً */
  lessonContext?: Record<string, unknown>;
  /** جسر إجابات App الخارجي، مغلق افتراضياً ويعمل بسحب محلي بعد تفعيله */
  liveSyncEnabled?: boolean;
  liveSyncPollMs?: number;
  /** وضع بوابة العدالة: off يترك الاختيار، soft ينبه، strict يمنع التكرار غير العادل */
  fairnessMode?: "off" | "soft" | "strict";
  /** إعدادات Audio Mixer V10، محلية واختيارية. */
  audioMixerEnabled?: boolean;
  audioMasterVolume?: number;
  audioChannels?: Record<"music" | "effects" | "tts" | "ambient", { volume: number; muted: boolean }>;
  ambianceType?: "none" | "calm" | "focus" | "energetic" | "celebration";
  hapticsEnabled?: boolean;
}

export interface LogEntry {
  timestamp: string;
  type: "info" | "warning" | "error";
  message: string;
}

// ====================================================================
//  Class-Linked Student - طالب مرتبط بصف معين (للقوائم الصفية)
// ====================================================================
export interface ClassLinkedStudent {
  id: string;
  name: string;
  classId: string;
  points: number;
  correctAnswers: number;
  wrongAnswers: number;
  attempts: number;
  badges: string[];
  title?: string;
  isAbsent?: boolean;
  createdAt: string;
}

export interface StudentGroup {
  id: string;
  classId: string;
  name: string;
  color: string;
  studentIds: string[];
  groupPoints: number;
  createdAt: string;
}

// ====================================================================
//  Mini-Game Types - أنواع الألعاب الصغيرة
// ====================================================================
export type GameType =
  | "wheel"
  | "lucky-wheel"
  | "dice"
  | "reaction"
  | "tug-of-war"
  | "quiz-show"
  | "math-challenge"
  | "memory"
  | "spin-bottle"
  | "hot-potato"
  | "simon-says"
  // P1-12 fix: 6 newer game types added to the union so setActiveGame accepts them.
  // Without these, the activeGame guard in KeyboardShortcuts can't detect them.
  | "question-challenge"
  | "group-battle"
  | "duel-quiz"
  | "mystery-box"
  | "quick-fire"
  | "gift-rain";

export interface GameSession {
  id: string;
  type: GameType;
  startedAt: string;
  participants: string[]; // student IDs
  config?: Record<string, unknown>;
}

// ====================================================================
//  Lesson Question - سؤال من المنهج
// ====================================================================
export interface LessonQuestion {
  /** SQLite LessonQuestion id when hydrated from the local curriculum bank. */
  id?: string;
  /** Source lesson id, preserved from the active manifest for audit/reporting. */
  lessonId?: string;
  text: string;
  correctAnswer?: string | number;
  options?: string[];
  rewardPoints?: number;
  ideaTitle?: string;
  step?: number;
  /** v6.0: ID of the idea this question belongs to ("flat" if lesson uses flat steps) */
  ideaId?: string;
  /** v6.0: Step number inside the idea */
  stepNumber?: number;
  /** v6.0: Difficulty for adaptive game selection */
  difficulty?: "easy" | "medium" | "hard";
  /** v6.0: Free-form tags for filtering */
  tags?: string[];
  /** v6.0: Whether the question is ready to use in games */
  gameReady?: boolean;
  /** الصور المرتبطة بالسؤال؛ تظهر فقط عندما تكون موجودة */
  images?: Array<{ url: string; alt?: string; type?: string }>;
  /** معرفات الأصول الأصلية داخل حزمة المنهج */
  imageRefs?: string[];
  /** قنوات الاستخدام المعتمدة لهذا السؤال */
  usage?: Array<"presentation" | "moodle-interactive" | "moodle-homework" | "game">;
  /** ربط اختياري بشريحة محددة */
  slideId?: string;
}
