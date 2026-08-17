"use client";

// ====================================================================
//  tts-service.ts — خدمة النطق المتقدم (v10.1)
//
//  يحل مشكلة CORS: المتصفح لا يستطيع جلب الصوت من Google مباشرة.
//  لذا نستخدم /api/tts proxy الذي يجلب الصوت من الخادم.
//
//  1. Google Translate TTS عبر /api/tts proxy (مجاني، جودة عالية)
//  2. Fallback: Web Speech API (لو فشل الـ proxy)
//  3. ذاكرة مؤقتة: يحفظ الـ audio blobs لإعادة الاستخدام
// ====================================================================

const TTS_CACHE = new Map<string, HTMLAudioElement>();
const TTS_PROXY_URL = "/api/tts";

// ===== LRU cap to prevent unbounded memory growth in long sessions =====
// A 45-min class with hundreds of TTS calls would otherwise accumulate
// Audio elements + object URLs that never get released.
const TTS_CACHE_MAX = 50;
function evictTtsCacheIfNeeded() {
  while (TTS_CACHE.size >= TTS_CACHE_MAX) {
    // Map iteration is insertion-order; the first entry is the oldest.
    const oldest = TTS_CACHE.keys().next().value;
    if (oldest === undefined) break;
    const evicted = TTS_CACHE.get(oldest);
    TTS_CACHE.delete(oldest);
    if (evicted) {
      try {
        evicted.pause();
        // The Audio element's src is an object URL; release it to free memory.
        if (evicted.src.startsWith("blob:")) {
          URL.revokeObjectURL(evicted.src);
        }
      } catch {}
    }
  }
}

// ===== إدارة قائمة الانتظار (Queue) لمنع تداخل الأصوات =====
let currentAudio: HTMLAudioElement | null = null;
let speakQueue: Array<{ text: string; lang: "ar" | "en"; rate: number }> = [];
let isSpeaking = false;

/**
 * إيقاف الصوت الحالي فوراً
 */
function stopCurrentAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try { speechSynthesis.cancel(); } catch {}
  }
}

/**
 * معالج قائمة الانتظار — يشغل صوت واحد في كل مرة
 */
async function processQueue() {
  if (isSpeaking) return;
  const next = speakQueue.shift();
  if (!next) return;
  isSpeaking = true;
  stopCurrentAudio();
  try {
    await playAudioInternal(next.text, next.lang, next.rate);
  } catch (e) {
    console.warn("[tts-service] queue playback error:", e);
  }
  isSpeaking = false;
  // معالجة العنصر التالي
  if (speakQueue.length > 0) {
    processQueue();
  }
}

/**
 * التشغيل الفعلي للصوت (داخلي)
 */
async function playAudioInternal(text: string, lang: "ar" | "en" = "ar", rate: number = 1.0): Promise<boolean> {
  if (!text || text.trim().length === 0) return false;

  // تحقق من الـ cache
  const cacheKey = `${lang}:${text}`;
  if (TTS_CACHE.has(cacheKey)) {
    const audio = TTS_CACHE.get(cacheKey)!;
    audio.currentTime = 0;
    audio.playbackRate = rate;
    currentAudio = audio;
    try {
      await audio.play();
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
      });
      return true;
    } catch {
      // Fall through to fetch
    }
  }

  try {
    const params = new URLSearchParams({ text, lang });
    const url = `${TTS_PROXY_URL}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TTS proxy returned ${response.status}`);
    }
    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audio.playbackRate = rate;
    evictTtsCacheIfNeeded();
    TTS_CACHE.set(cacheKey, audio);
    currentAudio = audio;
    await audio.play();
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
    });
    return true;
  } catch (error) {
    console.warn("[tts-service] Google TTS (via proxy) failed:", error);
    return false;
  }
}

/**
 * تشغيل نص عبر Google Translate TTS (عبر proxy محلي)
 * يضيف النص لقائمة الانتظار لمنع تداخل الأصوات
 * @param text النص المراد نطقه
 * @param lang اللغة (ar | en)
 * @param rate سرعة النطق (0.5 - 2.0)
 * @returns Promise<boolean> نجح أم لا
 */
export async function speakWithGoogleTTS(
  text: string,
  lang: "ar" | "en" = "ar",
  rate: number = 1.0
): Promise<boolean> {
  if (!text || text.trim().length === 0) return false;
  // أضف لقائمة الانتظار
  speakQueue.push({ text, lang, rate });
  await processQueue();
  return true;
}

/**
 * تشغيل نص عبر Web Speech API (fallback)
 */
export function speakWithWebSpeech(
  text: string,
  lang: "ar" | "en" = "ar",
  rate: number = 1.0,
  pitch: number = 1.0,
  volume: number = 1.0
): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;

  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith(lang === "ar" ? "ar" : "en"));
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    utterance.lang = lang === "ar" ? "ar-SA" : "en-US";
    speechSynthesis.speak(utterance);
    return true;
  } catch (error) {
    console.warn("[tts-service] Web Speech failed:", error);
    return false;
  }
}

/**
 * تشغيل نص مع fallback تلقائي
 * - جرّب Google Translate TTS (عبر proxy) أولاً (أجود)
 * - لو فشل → استخدم Web Speech API
 * @returns Promise<boolean> نجح أم لا
 */
export async function speak(
  text: string,
  lang: "ar" | "en" = "ar",
  rate: number = 1.0
): Promise<boolean> {
  if (!text || text.trim().length === 0) return false;

  // جرّب Google TTS (عبر proxy)
  const googleSuccess = await speakWithGoogleTTS(text, lang, rate);
  if (googleSuccess) return true;

  // Fallback: Web Speech API
  return speakWithWebSpeech(text, lang, rate);
}

/**
 * إيقاف أي نطق جاري + مسح قائمة الانتظار
 */
export function stopSpeaking() {
  if (typeof window === "undefined") return;
  // مسح قائمة الانتظار
  speakQueue = [];
  isSpeaking = false;
  // إيقاف الصوت الحالي
  stopCurrentAudio();
}

/**
 * مسح قائمة الانتظار فقط (بدون إيقاف الصوت الحالي)
 */
export function clearQueue() {
  speakQueue = [];
}

/**
 * مسح الـ cache (لتحرير الذاكرة)
 */
export function clearTTSCache() {
  TTS_CACHE.forEach((audio) => {
    try {
      if (audio.src) URL.revokeObjectURL(audio.src);
    } catch {}
  });
  TTS_CACHE.clear();
}

/**
 * هل Google TTS متاح؟ (اختبار سريع عبر proxy)
 */
export async function isGoogleTTSAvailable(): Promise<boolean> {
  try {
    const params = new URLSearchParams({ text: "test", lang: "ar" });
    const url = `${TTS_PROXY_URL}?${params.toString()}`;
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

