"use client";

import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from "react";
import { useShellStore, useLeaderboard, type StudentLiveStatus } from "@/lib/shell-store";
import type { StudentBadge } from "@/lib/slide-schema";
import {
  parseStudentList,
  getBadgeLabel,
  getBadgeIcon,
  formatTime,
} from "@/lib/shell-utils";
import { getAllGifts, type Gift } from "@/lib/data-store";
import { pickStudentManual } from "@/lib/game-utils";
import { StudentReportPanel } from "@/components/shell/StudentReportPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Upload,
  Trophy,
  Star,
  Award,
  RotateCcw,
  Crown,
  ChevronDown,
  ChevronUp,
  Users,
  X,
  Search,
  Filter,
  Zap,
  Sparkles,
  Medal,
  Gift as GiftIcon,
  Heart,
  ThumbsUp,
  BarChart3,
  FileText,
  UserCheck,
  Share2,
  PlugZap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { announce } from "@/lib/tts-announcer";
import { localDb } from "@/lib/local-db";
import { StudentShareCard } from "../StudentShareCard";
import { GameOverlay } from "../GameOverlay";

/**
 * StudentsPanel v4.0 - لوحة إدارة الطلاب المتطورة
 *
 * الميزات:
 * - إضافة فردية + استيراد جماعي
 * - بحث + فلترة
 * - لوحة متصدرين قابلة للطي
 * - نقاط تراكمية + شارات
 * - تتبع الإجابات الصحيحة/الخاطئة
 * - إحصائيات لكل طالب
 * - 5 أزرار مكافآت متعددة (صحيحة +3, محاولة +1, نجمة +5, ذهبية +10, إبداع +7)
 * - رسائل تأكيد لكل عملية حذف
 * - toast notifications
 */
export function StudentsPanel() {
  const [newName, setNewName] = useState("");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filterType, setFilterType] = useState<"all" | "called" | "uncalled">("all");
  // v10.3: مشاركة كارت الطالب + ملاحظات يدوية
  const [shareCardStudent, setShareCardStudent] = useState<{ id: string; name: string } | null>(null);
  const [noteStudent, setNoteStudent] = useState<{ id: string; name: string } | null>(null);
  const [noteText, setNoteText] = useState("");

  const students = useShellStore((s) => s.students);
  const studentLiveStatuses = useShellStore((s) => s.studentLiveStatuses);
  const addStudent = useShellStore((s) => s.addStudent);
  const addStudentsBulk = useShellStore((s) => s.addStudentsBulk);
  const removeStudent = useShellStore((s) => s.removeStudent);
  const clearStudents = useShellStore((s) => s.clearStudents);
  const awardPoints = useShellStore((s) => s.awardPoints);
  const awardCorrect = useShellStore((s) => s.awardCorrect);
  const awardWrong = useShellStore((s) => s.awardWrong);
  const awardGoodTry = useShellStore((s) => s.awardGoodTry);
  const awardBadge = useShellStore((s) => s.awardBadge);
  const recordStudentActivity = useShellStore((s) => s.recordStudentActivity);
  const resetSession = useShellStore((s) => s.resetSession);
  const requestConfirm = useShellStore((s) => s.requestConfirm);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const triggerRedFlash = useShellStore((s) => s.triggerRedFlash);
  const triggerGreenFlash = useShellStore((s) => s.triggerGreenFlash);
  const playSound = useShellStore((s) => s.playSound);
  const currentlyCalledStudent = useShellStore((s) => s.currentlyCalledStudent);
  const activeClassId = useShellStore((s) => s.activeClassId);
  const setActivePanel = useShellStore((s) => s.setActivePanel);
  const rewardActionRef = useRef<string | null>(null);
  const rewardActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (rewardActionTimerRef.current !== null) clearTimeout(rewardActionTimerRef.current);
  }, []);
  const beginRewardAction = (studentId: string, action: string) => {
    const key = `${studentId}:${action}`;
    if (rewardActionRef.current === key) return false;
    rewardActionRef.current = key;
    if (rewardActionTimerRef.current !== null) clearTimeout(rewardActionTimerRef.current);
    rewardActionTimerRef.current = setTimeout(() => {
      if (rewardActionRef.current === key) rewardActionRef.current = null;
      rewardActionTimerRef.current = null;
    }, 600);
    return true;
  };

  const leaderboard = useLeaderboard();

  // ===== Class-aware student add logic =====
  // P1 fix (2025-AUG): previously, when no class was active, we created a
  // "default class" with a local id like `cls_default_${Date.now()}` and
  // passed it to `saveClass()`. But `saveClass` ignored the id and let
  // Prisma generate its own cuid — so `setActiveClassId(localId)` pointed
  // at a class that didn't exist in the DB. The follow-up `useEffect` then
  // fetched students for that ghost classId, got an empty list, and
  // REPLACED the store (wiping the freshly-added student). Net effect:
  // the student appeared for a fraction of a second then vanished.
  //
  // The fix: `saveClass` now accepts an `id` and returns the created row.
  // We use the returned id (which matches what's in the DB) for
  // `setActiveClassId`, so subsequent loads actually find the students.
  const handleAdd = async () => {
    if (!newName.trim()) return;
    const name = newName.trim();
    let classIdForAdd = activeClassId;
    if (!classIdForAdd) {
      toast.loading("لا يوجد صف نشط — جاري إنشاء الصف الافتراضي...", { id: "auto-class" });
      try {
        const { saveClass, studentExistsInClass } = await import("@/lib/data-store");
        const id = `cls_default_${Date.now()}`;
        const created = await saveClass({
          id,
          name: "الصف الافتراضي",
          description: "تم إنشاؤه تلقائياً عند أول إضافة طالب بدون صف نشط",
          createdAt: new Date().toISOString(),
          studentIds: [],
          color: "#0142A0",
        });
        classIdForAdd = created.id; // ← use the DB-confirmed id (may differ if the DB rejected our id)
        useShellStore.getState().setActiveClassId(classIdForAdd);
        toast.dismiss("auto-class");
        toast.success("تم إنشاء الصف الافتراضي وتفعيله — يمكنك الآن إضافة الطلاب");
      } catch (e) {
        toast.dismiss("auto-class");
        toast.error("فعّل صف أولاً من لوحة الفصول لتتمكن من إضافة الطلاب");
        return;
      }
    }
    // P2 fix: strict duplicate check — re-fetch from DB before adding,
    // because the in-memory store may be out of sync (e.g., the user
    // just added the same name from ClassesPanel in another tab).
    try {
      const { studentExistsInClass } = await import("@/lib/data-store");
      if (classIdForAdd && await studentExistsInClass(name, classIdForAdd)) {
        toast.warning(`الطالب "${name}" موجود بالفعل في هذا الصف`);
        return;
      }
    } catch (e) {
      // soft-fail — fall through to the store-level check
    }
    try {
      await addStudent(name); // adds to store + waits for SQLite, scoped to the active class
      toast.success(`تمت إضافة: ${name} للصف النشط`);
      setNewName("");
    } catch (e) {
      console.error("[StudentsPanel] student write failed:", e);
      toast.error("تعذر حفظ الطالب في قاعدة البيانات؛ لم يتم اعتماد الإضافة");
    }
  };

  const handleBulkImport = async () => {
    const rawNames = parseStudentList(bulkText);
    if (rawNames.length === 0) {
      toast.error("لا توجد أسماء صحيحة");
      return;
    }
    let classIdForAdd = activeClassId;
    if (!classIdForAdd) {
      toast.loading("لا يوجد صف نشط — جاري إنشاء الصف الافتراضي...", { id: "auto-class-bulk" });
      try {
        const { saveClass } = await import("@/lib/data-store");
        const id = `cls_default_${Date.now()}`;
        const created = await saveClass({
          id,
          name: "الصف الافتراضي",
          description: "تم إنشاؤه تلقائياً عند أول إضافة طالب بدون صف نشط",
          createdAt: new Date().toISOString(),
          studentIds: [],
          color: "#0142A0",
        });
        classIdForAdd = created.id;
        useShellStore.getState().setActiveClassId(classIdForAdd);
        toast.dismiss("auto-class-bulk");
        toast.success("تم إنشاء الصف الافتراضي وتفعيله");
      } catch (e) {
        toast.dismiss("auto-class-bulk");
        toast.error("فعّل صف أولاً من لوحة الفصول لاستيراد الطلاب");
        return;
      }
    }
    // P2 fix: de-duplicate the input list itself (case-insensitive, trimmed)
    // before hitting the store. The store check is case-sensitive; we tighten
    // it here so "Ahmed" and "ahmed" are treated as the same name within
    // a single bulk import.
    const seen = new Set<string>();
    const uniqueNames: string[] = [];
    let skippedDuplicates = 0;
    for (const n of rawNames) {
      const key = n.trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) {
        skippedDuplicates++;
        continue;
      }
      seen.add(key);
      uniqueNames.push(n.trim());
    }
    // Check duplicates separately from the authoritative write. If the read
    // check is unavailable, fall back to store-level de-duplication; if the
    // write itself fails, surface the error and never retry blindly.
    let namesToAdd = uniqueNames;
    try {
      const { studentExistsInClass } = await import("@/lib/data-store");
      const filtered: string[] = [];
      for (const n of uniqueNames) {
        const exists = await studentExistsInClass(n, classIdForAdd);
        if (exists) skippedDuplicates++;
        else filtered.push(n);
      }
      namesToAdd = filtered;
    } catch (e) {
      console.warn("[StudentsPanel] duplicate check failed; using store guard", e);
    }
    if (namesToAdd.length === 0) {
      toast.warning(`كل الأسماء موجودة بالفعل في هذا الصف (${skippedDuplicates} مكرر)`);
      setBulkText("");
      setShowBulkImport(false);
      return;
    }
    try {
      await addStudentsBulk(namesToAdd);
      const duplicateSuffix = skippedDuplicates > 0 ? ` (${skippedDuplicates} مكرر تجاهل)` : "";
      toast.success(`تم استيراد ${namesToAdd.length} طالب للصف النشط${duplicateSuffix}`);
    } catch (e) {
      console.error("[StudentsPanel] bulk student write failed:", e);
      toast.error("تعذر حفظ الطلاب في قاعدة البيانات؛ لم يتم اعتماد الإضافة");
      return;
    }
    setBulkText("");
    setShowBulkImport(false);
  };

  // ===== P2-14: استيراد ملف CSV/TXT من LMS =====
  // يقرأ الملف عبر File API (لا يخرج للشبكة) ويمرره إلى parseStudentCsv
  // ثم يغذيه على bulk-import الحالي بنفس منطق إنشاء الصف الافتراضي.
  const csvInputRef = React.useRef<HTMLInputElement>(null);

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // نُعيد تعيين الحقل ليُسمح بنفس الملف مرتين
    if (!file) return;
    const { parseStudentCsv } = await import("@/lib/csv-parser");
    const text = await file.text();
    const { names, errors } = parseStudentCsv(text);
    if (names.length === 0) {
      toast.error(errors?.[errors.length - 1] ?? "تعذر قراءة الملف");
      return;
    }
    let classIdForAdd = activeClassId;
    if (!classIdForAdd) {
      toast.loading("لا يوجد صف نشط — جاري إنشاء الصف الافتراضي...", { id: "auto-class-csv" });
      try {
        const { saveClass } = await import("@/lib/data-store");
        const id = `cls_default_${Date.now()}`;
        const created = await saveClass({
          id,
          name: "الصف الافتراضي",
          description: "تم إنشاؤه تلقائياً عند استيراد CSV بدون صف نشط",
          createdAt: new Date().toISOString(),
          studentIds: [],
          color: "#0142A0",
        });
        classIdForAdd = created.id;
        useShellStore.getState().setActiveClassId(classIdForAdd);
        toast.dismiss("auto-class-csv");
        toast.success("تم إنشاء الصف الافتراضي وتفعيله");
      } catch {
        toast.dismiss("auto-class-csv");
        toast.error("فعّل صف أولاً من لوحة الفصول لاستيراد CSV");
        return;
      }
    }
    // P2 fix: de-duplicate within the CSV itself, then against the DB.
    const seen = new Set<string>();
    const uniqueNames: string[] = [];
    let skipped = 0;
    for (const n of names) {
      const key = String(n).trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);
      uniqueNames.push(String(n).trim());
    }
    try {
      const { studentExistsInClass } = await import("@/lib/data-store");
      const filtered: string[] = [];
      for (const n of uniqueNames) {
        const exists = await studentExistsInClass(n, classIdForAdd);
        if (exists) { skipped++; } else { filtered.push(n); }
      }
      if (filtered.length === 0) {
        toast.warning(`كل الأسماء موجودة بالفعل في هذا الصف (${skipped} مكرر)`);
        return;
      }
      await addStudentsBulk(filtered);
      const msg = errors && errors.length > 0
        ? `تم الاستيراد مع تنبيهات: ${errors.join(" · ")}${skipped ? ` (${skipped} مكرر تجاهل)` : ""}`
        : `تم استيراد ${filtered.length} طالب من ${file.name} 📂${skipped ? ` (${skipped} مكرر تجاهل)` : ""}`;
      if (errors && errors.length > 0) toast.warning(msg); else toast.success(msg);
    } catch {
      await addStudentsBulk(uniqueNames);
      toast.success(`تم استيراد ${uniqueNames.length} طالب من ${file.name} 📂`);
    }
  };

  const handleCorrect = (studentId: string, name: string) => {
    if (!beginRewardAction(studentId, "correct")) return;
    awardCorrect(studentId, 3);
    triggerConfetti();
    playSound("success");
    toast.success(`إجابة صحيحة! ${name} +3 نقاط 🏆`);
  };

  const handleGoodTry = (studentId: string, name: string) => {
    if (!beginRewardAction(studentId, "good-try")) return;
    awardGoodTry(studentId);
    triggerGreenFlash();
    playSound("click");
    toast.info(`محاولة جيدة! ${name} +1 نقطة ⭐`);
  };

  const handleWrong = (studentId: string, name: string) => {
    if (!beginRewardAction(studentId, "wrong")) return;
    awardWrong(studentId);
    triggerRedFlash();
    playSound("error");
    toast.error(`إجابة خاطئة - ${name}`);
  };

  const handleStar = (studentId: string, name: string) => {
    if (!beginRewardAction(studentId, "star")) return;
    awardPoints(studentId, 5);
    awardBadge(studentId, "star");
    triggerConfetti();
    playSound("celebrate");
    toast.success(`نجمة! ${name} +5 نقاط ✨`);
  };

  const handleGold = (studentId: string, name: string) => {
    if (!beginRewardAction(studentId, "gold")) return;
    awardPoints(studentId, 10);
    awardBadge(studentId, "fast");
    triggerConfetti();
    playSound("celebrate");
    toast.success(`مكافأة ذهبية! ${name} +10 نقاط 🥇`);
  };

  const handleCreative = (studentId: string, name: string) => {
    if (!beginRewardAction(studentId, "creative")) return;
    awardPoints(studentId, 7);
    awardBadge(studentId, "creative");
    triggerGreenFlash();
    playSound("success");
    toast.success(`تفكير إبداعي! ${name} +7 نقاط 🎨`);
  };

  const handleHelper = (studentId: string, name: string) => {
    if (!beginRewardAction(studentId, "helper")) return;
    awardPoints(studentId, 4);
    awardBadge(studentId, "helper");
    playSound("click");
    toast.info(`مساعدة زملاء! ${name} +4 نقاط 🤝`);
  };

  // ===== Gift awarding =====
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [showGiftPicker, setShowGiftPicker] = useState<string | null>(null); // studentId

  const awardGiftToStudentStore = useShellStore((s) => s.awardGiftToStudent);

  useEffect(() => {
    getAllGifts().then(setGifts);
  }, []);

  // ===== Load students from SQLite (via data-store.ts bridge) =====
  // v7.2: SQLite is the SINGLE source of truth.
  // On activeClassId change (including becoming null), (re)load the
  // matching roster from SQLite and REPLACE the store — this ensures the
  // panel never keeps showing a stale roster from a class that was just
  // deleted or deselected.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getStudentsByClass } = await import("@/lib/data-store");
        const classStudents = await getStudentsByClass(activeClassId);
        if (cancelled) return;
        // C14: preserve calledInSession across class switches.
        // The previous code hard-coded `calledInSession: false` whenever the
        // roster was reloaded, which silently reset the fair-rotation state
        // for every student each time the teacher changed class. We merge the
        // prior in-memory flag (keyed by studentId) into the freshly-loaded
        // students so already-called students stay marked as called within
        // the same session.
        const prevCalledById = new Map(
          useShellStore.getState().students.map((s) => [s.id, !!s.calledInSession])
        );
        // Convert StudentPerClass → Student shape and REPLACE store
        const storeStudents = classStudents.map((s) => ({
          id: s.studentId,
          name: s.name,
          points: s.points,
          correctAnswers: s.correctAnswers,
          wrongAnswers: s.wrongAnswers,
          attempts: s.attempts,
          badges: (s.badges || []).map((b: string) => ({
            type: b as StudentBadge["type"],
            awardedAt: s.createdAt,
          })),
          calledInSession: prevCalledById.get(s.studentId) ?? false,
          isAbsent: s.isAbsent,
          title: s.title,
          createdAt: s.createdAt,
        }));
        useShellStore.setState({ students: storeStudents });
      } catch (err) {
        console.error("[StudentsPanel] failed to load students:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [activeClassId]);

  const handleAwardGift = (studentId: string, studentName: string, gift: Gift) => {
    if (!beginRewardAction(studentId, `gift:${gift.id}`)) return;
    // One authoritative action owns SQLite persistence, activity logging,
    // overlay state, and announcement. Calling the DB bridge plus the store
    // action created duplicate gifts and duplicate activity records.
    awardGiftToStudentStore(studentId, studentName, gift.id, gift.name, gift.image);
    setShowGiftPicker(null);
    playSound("celebrate-gift");
    triggerConfetti();
    toast.success(`🎁 ${studentName} حصل على ${gift.name}!`);
  };

  const liveStatusForStudent = (student: (typeof students)[number]) => studentLiveStatuses[student.id] ?? (student.moodleUserId ? studentLiveStatuses[`moodle:${student.moodleUserId}`] : undefined) ?? (student.studentCode ? studentLiveStatuses[`custom:${student.studentCode}`] : undefined);

  // Filter students
  const filteredStudents = useMemo(() => students.filter((s) => {
    if (deferredSearchQuery && !s.name.includes(deferredSearchQuery)) return false;
    if (filterType === "called" && !s.calledInSession) return false;
    if (filterType === "uncalled" && s.calledInSession) return false;
    return true;
  }), [students, deferredSearchQuery, filterType]);

  // Stats
  const totalPoints = students.reduce((sum, s) => sum + s.points, 0);
  const totalCorrect = students.reduce((sum, s) => sum + s.correctAnswers, 0);
  const totalWrong = students.reduce((sum, s) => sum + s.wrongAnswers, 0);
  const calledCount = students.filter((s) => s.calledInSession).length;
  const absentCount = students.filter((s) => s.isAbsent).length;
  const presentCount = students.length - absentCount;

  // Absence toggle
  const setStudentAbsent = useShellStore((s) => s.setStudentAbsent);
  const handleToggleAbsent = (studentId: string, currentlyAbsent: boolean, name: string) => {
    setStudentAbsent(studentId, !currentlyAbsent);
    toast.success(!currentlyAbsent ? `${name} سُجِّل غائباً` : `${name} عاد للحضور`);
  };

  // ===== اختيار طالب يدوياً للتفاعل المباشر (بدون عجلة) =====
  const handleManualSelect = (studentId: string, name: string) => {
    const picked = pickStudentManual(studentId);
    if (!picked) {
      toast.error("لا يمكن اختيار طالب غائب أو غير موجود");
      return;
    }
    useShellStore.setState({ currentlyCalledStudent: picked });
    playSound("click");
    toast.success(`تم اختيار: ${name}`);
    announce("student-picked", { studentName: name });
  };

  // ===== حفظ ملاحظة يدوية للطالب =====
  const handleSaveNote = async () => {
    if (!noteStudent || !noteText.trim()) return;
    try {
      const sessionId = useShellStore.getState().currentSessionId;
      await localDb.studentNotes.create({
        studentId: noteStudent.id,
        sessionId,
        text: noteText.trim(),
      });
      // سجل في StudentActivity
      await localDb.studentActivities.create({
        studentId: noteStudent.id,
        sessionId,
        type: "note",
        pointsDelta: 0,
        description: noteText.trim(),
      });
      toast.success(`تم حفظ ملاحظة لـ ${noteStudent.name}`);
      announce("gift-awarded", { studentName: noteStudent.name, giftName: "ملاحظة" });
      setNoteStudent(null);
      setNoteText("");
    } catch (e) {
      console.error("[StudentsPanel] save note error:", e);
      toast.error("فشل حفظ الملاحظة");
    }
  };

  // ===== Confirmation handlers =====
  const handleRemoveStudent = async (id: string, name: string) => {
    if (await requestConfirm(`هل تريد حذف الطالب "${name}"؟ سيتم مسح كل نقاطه التراكمية.`, { danger: true })) {
      await removeStudent(id);
      toast.success(`تم حذف: ${name}`);
    }
  };

  const handleClearAll = async () => {
    if (
      await requestConfirm(
        `هل تريد حذف جميع الطلاب (${students.length})؟ سيتم مسح كل النقاط التراكمية ولا يمكن التراجع.`,
        { danger: true }
      )
    ) {
      await clearStudents();
      toast.success("تم حذف جميع الطلاب");
    }
  };

  // ===== P2-10: تقرير الطالب =====
  const [reportStudentId, setReportStudentId] = useState<string | null>(null);

  const handleResetSession = async () => {
    // توحيد الدلالات: "جلسة جديدة" = تصفير calledInSession فقط + بدء جلسة
    // جديدة في SQLite (snapshot للنقاط). النقاط التراكمية لا تُمسّ هنا —
    // تصفير النقاط يتم من لوحة الفصول (زر منفصل يأخذ تأكيداً أشد).
    if (calledCount === 0 && students.length === 0) {
      toast.info("لا يوجد طلاب تم استدعاؤهم في هذه الجلسة");
      return;
    }
    const ok = await requestConfirm(
      `هل تريد بدء جلسة جديدة؟ سيتم إعادة تعيين ${calledCount} طالب تم استدعاؤهم (لن تتأثر النقاط التراكمية)، وسيبدأ تسجيل جلسة جديدة في قاعدة البيانات.`
    );
    if (!ok) return;
    resetSession(); // يصفّر calledInSession + calledGroupIds (لا يلمس النقاط)
    // ابدأ جلسة SQLite جديدة وأغلق القديمة إن وُجدت
    const store = useShellStore.getState();
    if (store.currentSessionId) await store.endCurrentSession();
    // P1-13 fix: await startNewSession — the next line reads currentSessionId which
    // is only set after the async session-create completes. Without await, the snapshot
    // for the new session was never taken.
    await store.startNewSession();
    // التقط snapshot للنقاط حتى تكون delta الجلسة المحفوظة دقيقة
    if (store.currentSessionId) {
      import("@/lib/local-db").then((m) =>
        m.localDb.sessions.snapshotStudents(store.currentSessionId!).catch(() => null)
      );
    }
    playSound("click");
    toast.success(`تم بدء جلسة جديدة — ${calledCount} طالب متاحين للاختيار من جديد`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      {students.length > 0 && (
        <div className="p-2 border-b border-border bg-secondary/20">
          <div className="grid grid-cols-4 gap-1 text-center">
            <div className="bg-secondary/50 rounded p-1 border border-border">
              <div className="text-[9px] text-muted-foreground">الطلاب</div>
              <div className="font-bold text-sm text-primary">{students.length}</div>
            </div>
            <div className="bg-secondary/50 rounded p-1 border border-border">
              <div className="text-[9px] text-muted-foreground">النقاط</div>
              <div className="font-bold text-sm text-success" style={{ color: "#6ee7b7" }}>
                {totalPoints}
              </div>
            </div>
            <div className="bg-secondary/50 rounded p-1 border border-border">
              <div className="text-[9px] text-muted-foreground">صح</div>
              <div className="font-bold text-sm text-success" style={{ color: "#6ee7b7" }}>
                {totalCorrect}
              </div>
            </div>
            <div className="bg-secondary/50 rounded p-1 border border-border">
              <div className="text-[9px] text-muted-foreground">خطأ</div>
              <div className="font-bold text-sm text-accent">{totalWrong}</div>
            </div>
          </div>
          <div className="text-[9px] text-muted-foreground text-center mt-1">
            تم استدعاء {calledCount} من {students.length}
          </div>
        </div>
      )}

      {/* Add student */}
      <div className="p-2 border-b border-border bg-secondary/20 space-y-1">
        {showBulkImport ? (
          <>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="ألصق أسماء الطلاب (كل اسم في سطر أو مفصول بفاصلة)"
              className="text-xs min-h-[80px] resize-none"
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                className="h-7 text-xs flex-1 bg-primary hover:bg-primary/90"
                onClick={handleBulkImport}
              >
                <Upload className="w-3 h-3 ml-1" />
                استيراد ({parseStudentList(bulkText).length})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowBulkImport(false)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex gap-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="اسم الطالب..."
              className="flex-1 h-8"
            />
            <Button
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                activeClassId
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-amber-500/80 hover:bg-amber-500 text-black"
              )}
              onClick={handleAdd}
              title={activeClassId ? "إضافة" : "لا يوجد صف نشط — سيتم إنشاء الصف الافتراضي"}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 border-border"
              onClick={() => setShowBulkImport(true)}
              title="استيراد جماعي"
            >
              <Upload className="w-3 h-3" />
            </Button>
            {/* P2-14: زر استيراد CSV/txt من ملف LMS */}
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={handleCsvFile}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 border-border text-cyan-400"
              onClick={() => csvInputRef.current?.click()}
              title="استيراد أسماء الطلاب من ملف CSV/TXT (تصدير أنظمة LMS)"
            >
              <FileText className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 border-border text-violet-400"
              onClick={() => setActivePanel("moodle")}
              title="فتح إعدادات ومزامنة Moodle للمراجعة اليدوية"
            >
              <PlugZap className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* إزالة قسم الطالب المُستدعى حالياً لإعطاء مساحة أكبر لعرض الطلاب */}

      {/* Gift Picker Modal */}
      {showGiftPicker && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          {/* C33 (P2 fix): use Z_MODAL_BACKDROP=200 instead of z-50 */}
          <div className="bg-zinc-900 rounded-2xl border border-white/10 p-4 w-full max-w-sm z-[210]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold">اختر هدية</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowGiftPicker(null)} className="text-white/60">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
              {gifts.length === 0 && (
                <div className="col-span-3 text-center text-white/40 py-8">
                  لا توجد هدايا - أضفها من لوحة الهدايا
                </div>
              )}
              {gifts.map((g) => {
                const student = students.find((s) => s.id === showGiftPicker);
                return (
                  <button
                    key={g.id}
                    onClick={() => student && handleAwardGift(student.id, student.name, g)}
                    className="bg-white/5 hover:bg-white/10 rounded-lg p-2 transition group"
                  >
                    <div className="aspect-square bg-white/5 rounded-md overflow-hidden mb-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.image} alt={g.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-white text-xs truncate">{g.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      {students.length > 0 && (
        <div className="p-2 border-b border-border bg-secondary/20 space-y-1">
          <div className="flex items-center gap-1">
            <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم..."
              className="flex-1 h-6 text-[11px]"
            />
          </div>
          <div className="flex gap-0.5">
            {[
              { id: "all" as const, label: "الكل" },
              { id: "called" as const, label: "تم استدعاؤهم" },
              { id: "uncalled" as const, label: "لم يُستدعوا" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={cn(
                  "flex-1 h-6 text-[10px] rounded border transition-colors",
                  filterType === f.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-accent/10"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard toggle */}
      {students.length > 0 && (
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className="flex items-center justify-between px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors border-b border-border"
        >
          <span className="flex items-center gap-1">
            <Crown className="w-3 h-3" />
            المتصدرون ({students.length})
          </span>
          {showLeaderboard ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}

      <ScrollArea className="flex-1 panel-scroll">
        <div className="p-1.5 space-y-0.5">
          {students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs">لا يوجد طلاب</p>
              <p className="text-[10px] mt-1 opacity-70">
                أضف طلاباً بالأعلى لبدء التفاعل
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">لا نتائج مطابقة</p>
            </div>
          ) : showLeaderboard ? (
            leaderboard
              .filter((s) => filteredStudents.includes(s))
              .map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  liveStatus={liveStatusForStudent(student)}
                  rank={leaderboard.findIndex((s) => s.id === student.id) + 1}
                  isCurrentlyCalled={currentlyCalledStudent?.id === student.id}
                  onCorrect={() => handleCorrect(student.id, student.name)}
                  onGoodTry={() => handleGoodTry(student.id, student.name)}
                  onWrong={() => handleWrong(student.id, student.name)}
                  onStar={() => handleStar(student.id, student.name)}
                  onGold={() => handleGold(student.id, student.name)}
                  onCreative={() => handleCreative(student.id, student.name)}
                  onHelper={() => handleHelper(student.id, student.name)}
                  onPoints={(p) => { if (beginRewardAction(student.id, `points:${p}`)) awardPoints(student.id, p); }}
                  onRemove={() => handleRemoveStudent(student.id, student.name)}
                  onToggleAbsent={() => handleToggleAbsent(student.id, !!student.isAbsent, student.name)}
                  onSelect={() => handleManualSelect(student.id, student.name)}
                  onShare={() => setShareCardStudent({ id: student.id, name: student.name })}
                  onNote={() => setNoteStudent({ id: student.id, name: student.name })}
                />
              ))
          ) : (
            filteredStudents.map((student) => (
              <StudentRow
                key={student.id}
                student={student}
                rank={leaderboard.findIndex((s) => s.id === student.id) + 1}
                isCurrentlyCalled={currentlyCalledStudent?.id === student.id}
                onCorrect={() => handleCorrect(student.id, student.name)}
                onGoodTry={() => handleGoodTry(student.id, student.name)}
                onWrong={() => handleWrong(student.id, student.name)}
                onStar={() => handleStar(student.id, student.name)}
                onGold={() => handleGold(student.id, student.name)}
                onCreative={() => handleCreative(student.id, student.name)}
                onHelper={() => handleHelper(student.id, student.name)}
                onPoints={(p) => awardPoints(student.id, p)}
                onRemove={() => handleRemoveStudent(student.id, student.name)}
                onToggleAbsent={() => handleToggleAbsent(student.id, !!student.isAbsent, student.name)}
                onSelect={() => handleManualSelect(student.id, student.name)}
                onShare={() => setShareCardStudent({ id: student.id, name: student.name })}
                onNote={() => setNoteStudent({ id: student.id, name: student.name })}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer actions */}
      {students.length > 0 && (
        <div className="border-t border-border p-2 bg-secondary/20 flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1 border-border"
            onClick={handleResetSession}
            title="إعادة تعيين الجلسة (يصفر من تم استدعاؤهم، لا النقاط)"
          >
            <RotateCcw className="w-3 h-3 ml-1" />
            جلسة جديدة
          </Button>
          {/* P2-10: زر تقرير الطالب — يفتح التقرير لأول طالب أو الطالب المستدعى */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-[#fbbf24] hover:bg-amber-500/10"
            onClick={() => {
              const id = currentlyCalledStudent?.id ?? students[0]?.id;
              if (id) setReportStudentId(id);
            }}
            title="تقرير الطالب (يُعرض الطالب المستدعى حالياً أو أول طالب)"
          >
            <BarChart3 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-accent hover:bg-accent/10"
            onClick={handleClearAll}
            title="حذف الكل"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* P2-10: لوحة تقرير الطالب المفصلة */}
      {reportStudentId && (
        <StudentReportPanel
          studentId={reportStudentId}
          onClose={() => setReportStudentId(null)}
        />
      )}

      {/* ===== v10.3: مشاركة كارت الطالب ===== */}
      {shareCardStudent && (
        <StudentShareCard
          studentId={shareCardStudent.id}
          studentName={shareCardStudent.name}
          onClose={() => setShareCardStudent(null)}
        />
      )}

      {/* ===== v10.3: ملاحظة يدوية للطالب ===== */}
      {noteStudent && (
        <GameOverlay open onClose={() => setNoteStudent(null)} title={`ملاحظة: ${noteStudent.name}`} accentColor="#fbbf24" widthPercent={50} heightPercent={40}>
          <div className="p-4 flex flex-col gap-3">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="اكتب ملاحظة قصيرة لهذا الطالب..."
              className="w-full bg-secondary/50 border border-border rounded-lg p-3 text-sm text-foreground resize-none"
              rows={3}
              autoFocus
              maxLength={200}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setNoteStudent(null); setNoteText(""); }}>
                إلغاء
              </Button>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black" onClick={handleSaveNote} disabled={!noteText.trim()}>
                حفظ الملاحظة
              </Button>
            </div>
          </div>
        </GameOverlay>
      )}
    </div>
  );
}

// ====================================================================
//  Reward Button - زر مكافأة صغير
// ====================================================================
function RewardButton({
  onClick,
  icon,
  label,
  color,
  title,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-7 rounded text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all hover:scale-105"
      style={{
        background: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ====================================================================
//  Student Row Component
// ====================================================================
interface StudentRowProps {
  student: ReturnType<typeof useShellStore.getState>["students"][number];
  rank: number;
  liveStatus?: StudentLiveStatus;
  isCurrentlyCalled: boolean;
  onCorrect: () => void;
  onGoodTry: () => void;
  onWrong: () => void;
  onStar: () => void;
  onGold: () => void;
  onCreative: () => void;
  onHelper: () => void;
  onPoints: (p: number) => void;
  onRemove: () => void;
  onToggleAbsent: () => void;
  onSelect?: () => void;
  onShare?: () => void;
  onNote?: () => void;
}

function StudentRow({
  student,
  rank,
  liveStatus,
  isCurrentlyCalled,
  onCorrect,
  onGoodTry,
  onWrong,
  onStar,
  onGold,
  onCreative,
  onHelper,
  onPoints,
  onRemove,
  onToggleAbsent,
  onSelect,
  onShare,
  onNote,
}: StudentRowProps) {
  const [expanded, setExpanded] = useState(false);

  const rankColor =
    rank === 1
      ? "text-yellow-400"
      : rank === 2
      ? "text-gray-400"
      : rank === 3
      ? "text-orange-400"
      : "text-muted-foreground";

  const accuracy =
    student.attempts > 0
      ? Math.round((student.correctAnswers / student.attempts) * 100)
      : 0;

  return (
    <div
      style={{ contentVisibility: "auto", containIntrinsicSize: "72px" }}
      className={cn(
        "rounded-md border transition-colors selectable-card",
        isCurrentlyCalled
          ? "border-primary bg-primary/10 student-active"
          : student.isAbsent
          ? "border-red-500/40 bg-red-500/5"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-center gap-1 p-1.5">
        <span className={cn("text-[10px] font-bold w-5 text-center", rankColor)}>
          #{rank}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-right min-w-0"
        >
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "text-xs truncate",
                isCurrentlyCalled ? "font-bold text-primary" : student.isAbsent ? "text-red-400 line-through" : liveStatus?.status === "correct" ? "text-emerald-400" : liveStatus?.status === "wrong" ? "text-red-400" : liveStatus?.status === "waiting" ? "text-amber-300" : "text-foreground"
              )}
            >
              {student.name}
            </span>
            {student.calledInSession && (
              <span className="text-[9px] text-success" style={{ color: "#6ee7b7" }}>✓</span>
            )}
            {liveStatus && <span title={liveStatus.label || liveStatus.status} className={cn("text-[8px] rounded-full px-1", liveStatus.status === "correct" ? "bg-emerald-500/15 text-emerald-300" : liveStatus.status === "wrong" ? "bg-red-500/15 text-red-300" : liveStatus.status === "waiting" ? "bg-amber-500/15 text-amber-300" : "bg-slate-500/15 text-slate-300")}>{liveStatus.status === "correct" ? "صح" : liveStatus.status === "wrong" ? "خطأ" : liveStatus.status === "waiting" ? "ينتظر" : "غير معروف"}</span>}
            {student.isAbsent && (
              <span className="text-[8px] text-red-400 font-bold bg-red-500/20 px-1 rounded">غائب</span>
            )}
            {/* P2-12: اللقب التلقائي — يُحسب في المتجر ويُعرض هنا فوراً */}
            {student.title && (
              <span className="text-[9px] text-amber-400 font-bold bg-amber-400/10 px-1.5 rounded-full max-w-[80px] truncate" title={student.title}>
                {student.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
            <span>{student.points} نقطة</span>
            <span>•</span>
            <span>{student.correctAnswers}/{student.attempts}</span>
            {student.attempts > 0 && (
              <>
                <span>•</span>
                <span style={{ color: accuracy >= 70 ? "#6ee7b7" : accuracy >= 40 ? "#fbbf24" : "#fca5a5" }}>
                  {accuracy}%
                </span>
              </>
            )}
          </div>
        </button>
        {/* Absence toggle — ALWAYS visible (not just in expanded view) */}
        <button
          onClick={onToggleAbsent}
          className={cn(
            "tool-btn shrink-0",
            student.isAbsent
              ? "bg-red-500/30 hover:bg-red-500/50 text-red-400"
              : "hover:bg-amber-500/20 text-amber-400"
          )}
          style={{ width: 26, height: 26 }}
          title={student.isAbsent ? "إلغاء الغياب" : "تسجيل غياب"}
        >
          {student.isAbsent ? <X className="w-3 h-3" /> : <span className="text-[10px]">غ</span>}
        </button>
        {/* اختيار يدوي للطالب — تفاعل مباشر بدون عجلة */}
        {onSelect && !student.isAbsent && (
          <button
            onClick={onSelect}
            className={cn(
              "tool-btn shrink-0",
              isCurrentlyCalled
                ? "bg-primary text-primary-foreground"
                : "hover:bg-primary/20 text-primary"
            )}
            style={{ width: 26, height: 26 }}
            title={isCurrentlyCalled ? "محدد حالياً" : "اختيار هذا الطالب"}
          >
            <UserCheck className="w-3 h-3" />
          </button>
        )}
        {/* مشاركة كارت الطالب لولي الأمر */}
        {onShare && (
          <button
            onClick={onShare}
            className="tool-btn hover:bg-green-500/20 shrink-0"
            style={{ width: 26, height: 26, color: "#6ee7b7" }}
            title="مشاركة كارت الطالب"
          >
            <Share2 className="w-3 h-3" />
          </button>
        )}
        {/* إضافة ملاحظة يدوية */}
        {onNote && (
          <button
            onClick={onNote}
            className="tool-btn hover:bg-amber-500/20 shrink-0"
            style={{ width: 26, height: 26, color: "#fbbf24" }}
            title="إضافة ملاحظة"
          >
            <FileText className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={onCorrect}
          className="tool-btn hover:bg-success/20 shrink-0"
          style={{ width: 26, height: 26, color: "#6ee7b7" }}
          title="إجابة صحيحة (+3)"
        >
          <Trophy className="w-3 h-3" />
        </button>
        <button
          onClick={onStar}
          className="tool-btn hover:bg-purple-500/20 shrink-0"
          style={{ width: 26, height: 26, color: "#c084fc" }}
          title="نجمة (+5)"
        >
          <Star className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border/50 p-1.5 space-y-1 bg-secondary/20">
          {/* Quick point buttons */}
          <div className="grid grid-cols-4 gap-0.5">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] border-border"
              onClick={() => onPoints(1)}
            >
              +1
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] border-border"
              onClick={() => onPoints(2)}
            >
              +2
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] border-border"
              onClick={() => onPoints(5)}
            >
              +5
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] border-border"
              onClick={() => onPoints(-1)}
            >
              -1
            </Button>
          </div>

          {/* Action buttons - 7 rewards */}
          <div className="grid grid-cols-4 gap-0.5">
            <RewardButton onClick={onCorrect} icon={<Trophy className="w-2.5 h-2.5" />} label="+3" color="#10b981" title="صحيحة" />
            <RewardButton onClick={onGoodTry} icon={<Award className="w-2.5 h-2.5" />} label="+1" color="#f59e0b" title="محاولة" />
            <RewardButton onClick={onStar} icon={<Star className="w-2.5 h-2.5" />} label="+5" color="#a855f7" title="نجمة" />
            <RewardButton onClick={onWrong} icon={<X className="w-2.5 h-2.5" />} label="خطأ" color="#ef4444" title="خطأ" />
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            <RewardButton onClick={onGold} icon={<Medal className="w-2.5 h-2.5" />} label="+10" color="#fbbf24" title="ذهبية" />
            <RewardButton onClick={onCreative} icon={<Sparkles className="w-2.5 h-2.5" />} label="+7" color="#06b6d4" title="إبداع" />
            <RewardButton onClick={onHelper} icon={<Heart className="w-2.5 h-2.5" />} label="+4" color="#ec4899" title="مساعدة" />
          </div>

          {/* Detailed stats */}
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div className="bg-card rounded p-1 border border-border">
              <span className="text-muted-foreground">صحيحة: </span>
              <span className="font-bold text-success" style={{ color: "#6ee7b7" }}>
                {student.correctAnswers}
              </span>
            </div>
            <div className="bg-card rounded p-1 border border-border">
              <span className="text-muted-foreground">خاطئة: </span>
              <span className="font-bold text-accent">{student.wrongAnswers}</span>
            </div>
          </div>

          {/* Badges */}
          {student.badges.length > 0 && (
            <div>
              <div className="text-[9px] text-muted-foreground mb-0.5">الشارات ({student.badges.length})</div>
              <div className="flex flex-wrap gap-0.5">
                {student.badges.slice(-8).map((badge, i) => (
                  <span
                    key={i}
                    title={`${getBadgeLabel(badge.type)} - ${formatTime(badge.awardedAt)}`}
                    className="text-[10px] px-1 py-0.5 rounded bg-secondary border border-border"
                  >
                    {getBadgeIcon(badge.type)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {student.lastCalled && (
            <div className="text-[9px] text-muted-foreground">
              آخر استدعاء: {formatTime(student.lastCalled)}
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] w-full text-accent hover:bg-accent/10"
            onClick={onRemove}
          >
            <Trash2 className="w-3 h-3 ml-1" />
            حذف الطالب
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-6 text-[10px] w-full",
              student.isAbsent
                ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                : "text-amber-400 hover:bg-amber-500/10"
            )}
            onClick={onToggleAbsent}
            title={student.isAbsent ? "إلغاء الغياب" : "تسجيل غياب"}
          >
            {student.isAbsent ? "✗ غائب — إلغاء" : "◯ تسجيل غياب"}
          </Button>
        </div>
      )}
    </div>
  );
}
