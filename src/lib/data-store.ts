// ====================================================================
//  data-store.ts v7.2 — UNIFIED DATA LAYER
//
//  This file used to be the ONLY data access layer (IndexedDB).
//  Now it's a BRIDGE: all reads go to SQLite via /api/db/* (local-db.ts),
//  and all writes go to SQLite via local-db.ts + db-sync.ts.
//
//  IndexedDB is NO LONGER USED. This file keeps the same function
//  signatures so callers don't need to change, but internally
//  delegates everything to SQLite via fetch().
//
//  This ensures SQLite is the SINGLE SOURCE OF TRUTH.
// =================================================================///
"use client";

// ---------- Types (kept for backward compatibility) ----------
export interface StudentTitle { studentId: string; title: string; awardedAt: string; }
export interface Prize { id: string; name: string; color: string; points: number; type: "title" | "points" | "gift" | "nothing"; icon?: string; createdAt: string; }
export type GiftCategory = "food" | "toy" | "title" | "activity" | "stationery" | "electronic" | "book" | "other";
export interface Gift { id: string; name: string; category: GiftCategory; image: string; description?: string; createdAt: string; }
export interface StudentGift { id: string; studentId: string; giftId: string; giftName: string; giftImage: string; awardedAt: string; }
export interface ClassRoom { id: string; name: string; description?: string; createdAt: string; studentIds: string[]; color?: string; }
export interface StudentPerClass { studentId: string; classId: string | null; name: string; points: number; correctAnswers: number; wrongAnswers: number; attempts: number; badges: string[]; createdAt: string; isAbsent?: boolean; title?: string; }
export interface AttendanceRecord { id: string; classId: string; date: string; absentStudentIds: string[]; createdAt: string; }
export interface StudentGroup { id: string; classId: string; name: string; color: string; studentIds: string[]; groupPoints: number; createdAt: string; }
export interface CustomSound { id: string; name: string; filePath: string; celebrationType: string; createdAt: string; }

// ---------- API helper ----------
async function apiCall<T = any>(operation: string, args: any[] = [], method: "POST" | "GET" = "POST"): Promise<T> {
  // Classroom data is mutable. A unique query parameter prevents an
  // intermediary cache from serving a stale roster, lesson, or setting.
  const url = method === "GET"
    ? `/api/db/${operation}?_=${Date.now()}`
    : `/api/db/${operation}`;
  const init: RequestInit = method === "POST"
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ args }) }
    : { method: "GET", cache: "no-store" };
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({ ok: false, error: "Invalid JSON" }));
  if (!json.ok) throw new Error(json.error || `DB operation failed: ${operation}`);
  return json.data as T;
}

// ---------- Default data (used for seeding) ----------
const DEFAULT_PRIZES: Prize[] = [
  { id: "p1", name: "عبقري", color: "#0142A0", points: 5, type: "title", icon: "🧠", createdAt: new Date().toISOString() },
  { id: "p2", name: "بيتزا", color: "#DA151C", points: 0, type: "gift", icon: "🍕", createdAt: new Date().toISOString() },
  { id: "p3", name: "10 نقاط", color: "#10b981", points: 10, type: "points", icon: "⭐", createdAt: new Date().toISOString() },
  { id: "p4", name: "بطل", color: "#f59e0b", points: 3, type: "title", icon: "🏆", createdAt: new Date().toISOString() },
  { id: "p5", name: "آيس كريم", color: "#a855f7", points: 0, type: "gift", icon: "🍦", createdAt: new Date().toISOString() },
  { id: "p6", name: "نجم", color: "#06b6d4", points: 7, type: "title", icon: "🌟", createdAt: new Date().toISOString() },
  { id: "p7", name: "حظ أوفر", color: "#ec4899", points: 0, type: "nothing", icon: "🎲", createdAt: new Date().toISOString() },
  { id: "p8", name: "شوكولاتة", color: "#92400e", points: 0, type: "gift", icon: "🍫", createdAt: new Date().toISOString() },
];

const DEFAULT_GIFTS: Gift[] = [
  { id: "g1", name: "بيتزا", category: "food", image: "/gifts/pizza.png", description: "بيتزا قطعة", createdAt: new Date().toISOString() },
  { id: "g2", name: "آيس كريم", category: "food", image: "/gifts/icecream.png", description: "آيس كريم كوب", createdAt: new Date().toISOString() },
  { id: "g3", name: "شوكولاتة", category: "food", image: "/gifts/chocolate.png", description: "لوح شوكولاتة", createdAt: new Date().toISOString() },
  { id: "g4", name: "كيك", category: "food", image: "/gifts/cake.png", description: "قطعة كيك", createdAt: new Date().toISOString() },
  { id: "g5", name: "حلوى", category: "food", image: "/gifts/candy.png", description: "حلوى ملونة", createdAt: new Date().toISOString() },
  { id: "g6", name: "عصير", category: "food", image: "/gifts/juice.png", description: "علبة عصير", createdAt: new Date().toISOString() },
  { id: "g7", name: "عبقري", category: "title", image: "/gifts/brain.png", description: "لقب عبقري", createdAt: new Date().toISOString() },
  { id: "g8", name: "بطل", category: "title", image: "/gifts/trophy.png", description: "لقب بطل", createdAt: new Date().toISOString() },
  { id: "g9", name: "نجم", category: "title", image: "/gifts/star2.png", description: "لقب نجم", createdAt: new Date().toISOString() },
  { id: "g10", name: "دورية حرة", category: "activity", image: "/gifts/free.png", description: "دورية حرة", createdAt: new Date().toISOString() },
  { id: "g11", name: "اختيار النشاط", category: "activity", image: "/gifts/choice.png", description: "اختيار نشاط", createdAt: new Date().toISOString() },
  { id: "g12", name: "نجمة ذهبية", category: "toy", image: "/gifts/star.png", description: "نجمة ذهبية", createdAt: new Date().toISOString() },
  { id: "g13", name: "كرة", category: "toy", image: "/gifts/ball.png", description: "كرة صغيرة", createdAt: new Date().toISOString() },
  { id: "g14", name: "لغز", category: "toy", image: "/gifts/puzzle.png", description: "لغز تركيبي", createdAt: new Date().toISOString() },
  { id: "g15", name: "قلم ملون", category: "stationery", image: "/gifts/pen.png", description: "قلم ملون", createdAt: new Date().toISOString() },
  { id: "g16", name: "أقلام", category: "stationery", image: "/gifts/pencil-set.png", description: "طقم أقلام", createdAt: new Date().toISOString() },
  { id: "g17", name: "دفتر", category: "stationery", image: "/gifts/notebook.png", description: "دفتر ملاحظات", createdAt: new Date().toISOString() },
  { id: "g18", name: "كتاب", category: "book", image: "/gifts/book-gift.png", description: "كتاب مفيد", createdAt: new Date().toISOString() },
  { id: "g19", name: "ميدالية", category: "other", image: "/gifts/medal.png", description: "ميدالية شرف", createdAt: new Date().toISOString() },
  { id: "g20", name: "ستيكر", category: "other", image: "/gifts/sticker.png", description: "ستيكر ملون", createdAt: new Date().toISOString() },
  { id: "g21", name: "صاروخ النجمة", category: "toy", image: "/gifts/rocket-star.png", description: "انطلاقة إنجاز جديدة", createdAt: new Date().toISOString() },
  { id: "g22", name: "ميدالية قوس قزح", category: "other", image: "/gifts/rainbow-medal.png", description: "تقدم يستحق الاحتفال", createdAt: new Date().toISOString() },
  { id: "g23", name: "الكتاب السحري", category: "book", image: "/gifts/magic-book.png", description: "اكتشاف وفكرة جديدة", createdAt: new Date().toISOString() },
  { id: "g24", name: "كأس الرياضيات", category: "title", image: "/gifts/math-trophy.png", description: "إتقان فكرة رياضية", createdAt: new Date().toISOString() },
  { id: "g25", name: "القلم الخارق", category: "stationery", image: "/gifts/super-pencil.png", description: "محاولة قوية ومثابرة", createdAt: new Date().toISOString() },
  { id: "g26", name: "مصباح الفكرة", category: "other", image: "/gifts/idea-lamp.png", description: "لحظة فهم وإلهام", createdAt: new Date().toISOString() },
  { id: "g27", name: "ستيكر المذنب", category: "other", image: "/gifts/comet-sticker.png", description: "تقدم لامع وسريع", createdAt: new Date().toISOString() },
  { id: "g28", name: "التاج الذهبي", category: "title", image: "/gifts/golden-crown.png", description: "إنجاز شخصي مميز", createdAt: new Date().toISOString() },
  { id: "g29", name: "شارة الفريق", category: "other", image: "/gifts/team-badge.png", description: "تعاون ومساعدة زملاء", createdAt: new Date().toISOString() },
  { id: "g30", name: "صندوق المفاجأة", category: "other", image: "/gifts/confetti-box.png", description: "مفاجأة احتفالية", createdAt: new Date().toISOString() },
  { id: "g31", name: "لغز الكوكب", category: "toy", image: "/gifts/planet-puzzle.png", description: "حل تحدٍ جديد", createdAt: new Date().toISOString() },
  { id: "g32", name: "قلب التشجيع", category: "other", image: "/gifts/heart-encouragement.png", description: "تشجيع على إعادة المحاولة", createdAt: new Date().toISOString() },
];

// ====================================================================
//  Titles
// ====================================================================
export async function getStudentTitle(studentId: string): Promise<StudentTitle | null> {
  try {
    const students = await apiCall<any[]>("students.listByClass", ["__all__"]);
    // Can't list all students easily; use stats instead
    return null; // titles handled by store
  } catch { return null; }
}

export async function setStudentTitle(studentId: string, title: string): Promise<void> {
  try {
    await apiCall("students.setTitle", [studentId, title]);
  } catch (e) { console.warn("[setStudentTitle] failed:", e); }
}

export async function removeStudentTitle(studentId: string): Promise<void> {
  try {
    await apiCall("students.setTitle", [studentId, ""]);
  } catch (e) { console.warn("[removeStudentTitle] failed:", e); }
}

// ====================================================================
//  Prizes
// ====================================================================
export async function getAllPrizes(): Promise<Prize[]> {
  try {
    const prizes = await apiCall<any[]>("prizes.list", [], "GET");
    return prizes.map((p) => ({
      id: p.id, name: p.name, color: p.color, points: p.points,
      type: p.type as any, icon: p.icon, createdAt: p.createdAt,
    }));
  } catch (e) {
    console.warn("[getAllPrizes] failed, using defaults:", e);
    return DEFAULT_PRIZES;
  }
}

export async function savePrize(prize: Prize): Promise<void> {
  try {
    await apiCall("prizes.save", [prize]);
  } catch (e) { console.warn("[savePrize] failed:", e); }
}

export async function deletePrize(id: string): Promise<void> {
  try {
    await apiCall("prizes.delete", [id]);
  } catch (e) { console.warn("[deletePrize] failed:", e); }
}

// ====================================================================
//  Gifts
// ====================================================================
function normalizeBuiltInGiftImage(image: string): string {
  // Existing SQLite seeds may still contain the pre-V14 PNG path.
  // All 32 built-in assets have a matching WebP; data URLs and custom paths stay untouched.
  if (/^\/gifts\/[a-z0-9-]+\.png$/i.test(image)) return image.replace(/\.png$/i, ".webp");
  return image;
}

export async function getAllGifts(): Promise<Gift[]> {
  const runtimeDefaults = DEFAULT_GIFTS.map((gift) => ({ ...gift, image: normalizeBuiltInGiftImage(gift.image) }));
  try {
    const gifts = await apiCall<any[]>("gifts.list", [], "GET");
    const persistedSeenImages = new Set<string>();
    const persisted = gifts.map((g) => ({
      id: g.id, name: g.name, category: g.category as GiftCategory,
      image: normalizeBuiltInGiftImage(g.image), description: g.description || "", createdAt: g.createdAt,
    })).filter((gift) => {
      if (!gift.image.startsWith("/gifts/")) return true;
      if (persistedSeenImages.has(gift.image)) return false;
      persistedSeenImages.add(gift.image);
      return true;
    });
    const persistedIds = new Set(persisted.map((gift) => gift.id));
    const persistedImages = new Set(persisted.map((gift) => gift.image));
    const missingDefaults = runtimeDefaults.filter((gift) => !persistedIds.has(gift.id) && !persistedImages.has(gift.image));
    // Keep old installations compatible while making new built-in gifts visible.
    // Persistence is best-effort and never blocks the teacher UI.
    if (missingDefaults.length > 0) {
      void Promise.all(missingDefaults.map((gift) => saveGift(gift))).catch(() => undefined);
    }
    return [...persisted, ...missingDefaults];
  } catch (e) {
    console.warn("[getAllGifts] failed, using defaults:", e);
    return runtimeDefaults;
  }
}

export async function saveGift(gift: Gift): Promise<void> {
  try {
    await apiCall("gifts.save", [gift]);
  } catch (e) { console.warn("[saveGift] failed:", e); }
}

export async function deleteGift(id: string): Promise<void> {
  try {
    await apiCall("gifts.delete", [id]);
  } catch (e) { console.warn("[deleteGift] failed:", e); }
}

// ====================================================================
//  Student Gifts
// ====================================================================
export async function getStudentGifts(studentId: string): Promise<StudentGift[]> {
  try {
    const gifts = await apiCall<any[]>("gifts.listByStudent", [studentId]);
    return gifts.map((g) => ({
      id: g.id, studentId: g.studentId, giftId: g.giftId,
      giftName: g.giftName, giftImage: g.giftImage, awardedAt: g.awardedAt,
    }));
  } catch (e) {
    console.warn("[getStudentGifts] failed:", e);
    return [];
  }
}

export async function awardGiftToStudent(studentId: string, gift: Gift): Promise<StudentGift> {
  try {
    const result = await apiCall<any>("gifts.awardToStudent", [studentId, gift.id, gift.name, gift.image]);
    return {
      id: result.id, studentId, giftId: gift.id,
      giftName: gift.name, giftImage: gift.image, awardedAt: result.awardedAt,
    };
  } catch (e) {
    console.warn("[awardGiftToStudent] failed:", e);
    return {
      id: `sg_${Date.now()}`, studentId, giftId: gift.id,
      giftName: gift.name, giftImage: gift.image, awardedAt: new Date().toISOString(),
    };
  }
}

// ====================================================================
//  Classes
// ====================================================================
export async function getAllClasses(): Promise<ClassRoom[]> {
  try {
    const classes = await apiCall<any[]>("classes.list", [], "GET");
    return classes.map((c) => ({
      id: c.id, name: c.name, description: c.description || "",
      createdAt: c.createdAt, studentIds: [], color: c.color,
    }));
  } catch (e) {
    console.warn("[getAllClasses] failed:", e);
    return [];
  }
}

export async function saveClass(cls: ClassRoom): Promise<ClassRoom & { id: string }> {
  try {
    const payload = {
      name: cls.name.trim(),
      description: cls.description || "",
      color: cls.color || "#0142A0",
    };
    // An id that already exists means edit; an id that does not exist means
    // create. This keeps the same helper safe for both ClassEditor creation
    // and future class editing flows, without attempting a duplicate INSERT.
    const existing = cls.id
      ? (await apiCall<any[]>("classes.list", [], "GET")).find((item) => item.id === cls.id)
      : undefined;
    const saved = existing
      ? await apiCall<any>("classes.update", [cls.id, payload])
      : await apiCall<any>("classes.create", [
          cls.id || `cls_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          payload.name,
          payload.description,
          payload.color,
        ]);
    return {
      id: saved.id,
      name: saved.name,
      description: saved.description || "",
      createdAt: saved.createdAt,
      studentIds: [],
      color: saved.color,
    };
  } catch (e) {
    console.warn("[saveClass] failed:", e);
    throw e;
  }
}

export async function deleteClass(id: string): Promise<void> {
  try {
    await apiCall("classes.delete", [id]);
  } catch (e) {
    console.warn("[deleteClass] failed:", e);
    throw e;
  }
}

// ====================================================================
//  Students per class
// ====================================================================
export async function getStudentsByClass(classId: string | null): Promise<StudentPerClass[]> {
  try {
    const students = await apiCall<any[]>("students.listByClass", [classId]);
    return students.map((s) => ({
      studentId: s.id, classId: s.classId, name: s.name,
      points: s.points, correctAnswers: s.correctAnswers,
      wrongAnswers: s.wrongAnswers, attempts: s.attempts,
      badges: (s.badges || []).map((b: any) => b.type || b),
      createdAt: s.createdAt, isAbsent: s.isAbsent, title: s.title,
    }));
  } catch (e) {
    console.warn("[getStudentsByClass] failed:", e);
    return [];
  }
}

export async function saveStudentPerClass(student: StudentPerClass): Promise<void> {
  try {
    await apiCall("students.upsert", [student.studentId, student.classId, {
      name: student.name, points: student.points,
      correctAnswers: student.correctAnswers, wrongAnswers: student.wrongAnswers,
      attempts: student.attempts, isAbsent: student.isAbsent || false, title: student.title,
    }]);
  } catch (e) {
    console.warn("[saveStudentPerClass] failed:", e);
    throw e;
  }
}

export async function resetClassPoints(classId: string): Promise<void> {
  try {
    const students = await getStudentsByClass(classId);
    for (const s of students) {
      await saveStudentPerClass({
        ...s, points: 0, correctAnswers: 0, wrongAnswers: 0, attempts: 0, badges: [],
      });
    }
  } catch (e) { console.warn("[resetClassPoints] failed:", e); }
}

export async function findStudentByName(name: string, classId?: string): Promise<StudentPerClass | null> {
  try {
    // P2 fix: `findStudentByName` previously searched across ALL classes.
    // That made it impossible to have two students with the same name in
    // different classes (e.g., two "Ahmed" in different schools). Now we
    // scope the search by classId when provided, and only fall back to the
    // global search when classId is undefined.
    const s = await apiCall<any>("students.findByName", [name, classId]);
    if (!s) return null;
    return {
      studentId: s.id,
      classId: s.classId,
      name: s.name,
      points: s.points,
      correctAnswers: s.correctAnswers,
      wrongAnswers: s.wrongAnswers,
      attempts: s.attempts,
      badges: (s.badges || []).map((b: { type: string }) => b.type),
      createdAt: s.createdAt,
      isAbsent: s.isAbsent,
      title: s.title || undefined,
    };
  } catch (e) {
    console.warn("[findStudentByName] failed:", e);
    return null;
  }
}

export async function moveStudentToClass(studentId: string, newClassId: string): Promise<void> {
  try {
    await apiCall("students.update", [studentId, { classId: newClassId }]);
  } catch (e) {
    console.warn("[moveStudentToClass] failed:", e);
    throw e;
  }
}

// ====================================================================
//  P2 fix: strict duplicate check inside a specific class.
//  Returns true if a student with the same name (case-insensitive, trimmed)
//  already exists in the given class.
// ====================================================================
export async function studentExistsInClass(name: string, classId: string): Promise<boolean> {
  try {
    const s = await apiCall<any>("students.findByNameInClass", [name, classId]);
    return !!s;
  } catch (e) {
    console.warn("[studentExistsInClass] failed:", e);
    return false;
  }
}

export async function deleteStudentPerClass(studentId: string): Promise<void> {
  try {
    await apiCall("students.delete", [studentId]);
  } catch (e) {
    console.warn("[deleteStudentPerClass] failed:", e);
    throw e;
  }
}

// ====================================================================
//  Groups
// ====================================================================
export async function getAllGroups(classId: string): Promise<StudentGroup[]> {
  try {
    const groups = await apiCall<any[]>("groups.list", [classId]);
    return groups.map((g) => ({
      id: g.id, classId: g.classId, name: g.name, color: g.color,
      studentIds: typeof g.studentIds === "string" ? JSON.parse(g.studentIds || "[]") : (g.studentIds || []),
      groupPoints: g.groupPoints, createdAt: g.createdAt,
    }));
  } catch (e) {
    console.warn("[getAllGroups] failed:", e);
    return [];
  }
}

export async function saveGroup(group: StudentGroup): Promise<void> {
  try {
    await apiCall("groups.save", [{
      id: group.id, classId: group.classId, name: group.name, color: group.color,
      studentIds: JSON.stringify(group.studentIds), groupPoints: group.groupPoints,
    }]);
  } catch (e) {
    console.warn("[saveGroup] failed:", e);
    throw e;
  }
}

export async function deleteGroup(id: string): Promise<void> {
  try {
    await apiCall("groups.delete", [id]);
  } catch (e) {
    console.warn("[deleteGroup] failed:", e);
    throw e;
  }
}

export async function addGroupPoints(groupId: string, points: number): Promise<void> {
  try {
    await apiCall("groups.addPoints", [groupId, points]);
  } catch (e) {
    console.warn("[addGroupPoints] failed:", e);
    throw e;
  }
}

// ====================================================================
//  File Reader
// ====================================================================
export async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ====================================================================
//  Custom Sounds
// ====================================================================
export async function getAllCustomSounds(): Promise<CustomSound[]> {
  try {
    const sounds = await apiCall<any[]>("sounds.list", [], "GET");
    return sounds.map((s) => ({
      id: s.id, name: s.name, filePath: s.filePath,
      celebrationType: s.celebrationType, createdAt: s.createdAt,
    }));
  } catch (e) {
    console.warn("[getAllCustomSounds] failed:", e);
    return [];
  }
}

export async function saveCustomSound(sound: CustomSound): Promise<void> {
  try {
    await apiCall("sounds.save", [sound]);
  } catch (e) { console.warn("[saveCustomSound] failed:", e); }
}

export async function deleteCustomSound(id: string): Promise<void> {
  try {
    await apiCall("sounds.delete", [id]);
  } catch (e) { console.warn("[deleteCustomSound] failed:", e); }
}

// ====================================================================
//  Auto Groups
// ====================================================================
export async function autoSplitIntoGroups(classId: string, numGroups: number = 4): Promise<StudentGroup[]> {
  try {
    const groups = await apiCall<any[]>("groups.autoSplit", [classId, numGroups]);
    return groups.map((g) => {
      let studentIds: string[] = [];
      if (Array.isArray(g.studentIds)) {
        studentIds = g.studentIds.filter((id: unknown): id is string => typeof id === "string");
      } else if (typeof g.studentIds === "string") {
        try {
          const parsed = JSON.parse(g.studentIds);
          studentIds = Array.isArray(parsed)
            ? parsed.filter((id: unknown): id is string => typeof id === "string")
            : [];
        } catch {
          studentIds = [];
        }
      }
      return {
        id: g.id,
        classId: g.classId,
        name: g.name,
        color: g.color || "#0142A0",
        studentIds,
        groupPoints: Number(g.groupPoints) || 0,
        createdAt: g.createdAt,
      };
    });
  } catch (e) {
    console.warn("[autoSplitIntoGroups] failed:", e);
    throw e;
  }
}

// ====================================================================
//  Fair Student Picker
// ====================================================================
export async function pickFairStudentForGame(classId: string, excludeIds: string[] = []): Promise<StudentPerClass | null> {
  try {
    const students = await getStudentsByClass(classId);
    const present = students.filter((s) => !s.isAbsent);
    if (present.length === 0) return null;
    const available = present.filter((s) => !excludeIds.includes(s.studentId));
    if (available.length === 0) return present[Math.floor(Math.random() * present.length)];
    return available[Math.floor(Math.random() * available.length)];
  } catch (e) {
    console.warn("[pickFairStudentForGame] failed:", e);
    return null;
  }
}

export async function markStudentAsked(studentId: string): Promise<void> {
  // No-op: handled by store (calledInSession)
}

export async function getStudentsNotYetAsked(classId: string): Promise<StudentPerClass[]> {
  try {
    const students = await getStudentsByClass(classId);
    return students.filter((s) => !s.isAbsent && s.attempts === 0);
  } catch (e) {
    return [];
  }
}
