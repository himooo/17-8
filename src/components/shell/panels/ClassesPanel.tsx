"use client";

import { useEffect, useState } from "react";
import { useShellStore } from "@/lib/shell-store";
import {
  getAllClasses,
  saveClass,
  deleteClass,
  getStudentsByClass,
  saveStudentPerClass,
  resetClassPoints,
  findStudentByName,
  moveStudentToClass,
  deleteStudentPerClass,
  type ClassRoom,
  type StudentPerClass,
} from "@/lib/data-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Save,
  Users,
  X,
  School,
  ChevronLeft,
  Award,
  RotateCcw,
  Check,
  XCircle,
  ClipboardCheck,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

// مفتاح تاريخ اليوم بصيغة YYYY-MM-DD — يُستخدم لمطابقة سجل اليوم فقط
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const COLORS = ["#0142A0", "#DA151C", "#10b981", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899"];

export function ClassesPanel() {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selected, setSelected] = useState<ClassRoom | null>(null);
  const [students, setStudents] = useState<StudentPerClass[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const activeClassId = useShellStore((s) => s.activeClassId);
  const setActiveClassId = useShellStore((s) => s.setActiveClassId);
  const playSound = useShellStore((s) => s.playSound);
  const requestConfirm = useShellStore((s) => s.requestConfirm);

  // ===== P2-11: مسح الحضور اليومي =====
  // وضع المسح يعرض أزرار تبديل (غائب/حاضر) لكل طالب ويجمع المعرفات الغائبة
  // في مجموعة محلية قبل حفظها دفعة واحدة عبر attendance.save.
  const [attendanceScanMode, setAttendanceScanMode] = useState(false);
  const [pendingAbsentIds, setPendingAbsentIds] = useState<Set<string>>(new Set());
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  // مفتاح اليوم — إذا اختلف، نعيد تعيين حالة المسح
  const [scanDate, setScanDate] = useState<string>(() => todayKey());

  // يبدأ مسحاً جديداً: الكل حاضرون افتراضياً والمجموعة فارغة
  const handleStartAttendanceScan = () => {
    const tk = todayKey();
    // يوم جديد؟ نُعيد تعيين الغائبين تلقائياً قبل بدء المسح
    if (tk !== scanDate) {
      setScanDate(tk);
      setPendingAbsentIds(new Set());
      toast.info("تم بدء مسح حضور ليوم جديد");
    } else {
      setPendingAbsentIds(new Set());
    }
    setAttendanceScanMode(true);
    playSound("click");
  };

  // تبديل حالة الغياب المحلية لطالب أثناء المسح (لا يلمس الـ DB قبل الحفظ)
  const handleTogglePendingAbsent = (studentId: string) => {
    setPendingAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  // حفظ سجل اليوم النهائي — يُكتب مرة واحدة في AttendanceRecord ويرسل setAbsent للكل
  const handleSaveAttendance = async () => {
    if (!selected) return;
    if (attendanceBusy) return;
    setAttendanceBusy(true);
    try {
      const { localDb } = await import("@/lib/local-db");
      const tk = todayKey();
      const absentArray = Array.from(pendingAbsentIds);
      const record = await localDb.attendance.save(selected.id, tk, absentArray);
      if (!record) throw new Error("attendance.save returned null");
      // طبّق flags الغياب على المتجر/الـ DB لكل طالب حتى تنعكس في كل الألعاب
      for (const s of students) {
        const shouldBeAbsent = pendingAbsentIds.has(s.studentId);
        if ((s.isAbsent ?? false) !== shouldBeAbsent) {
          useShellStore.getState().setStudentAbsent(s.studentId, shouldBeAbsent);
        }
      }
      const list = await getStudentsByClass(selected.id);
      setStudents(list);
      playSound("celebrate-stamp");
      toast.success(
        absentArray.length === 0
          ? `تم تسجيل الحضور ليوم ${tk} — الكل حاضرون ✓`
          : `تم تسجيل الحضور ليوم ${tk} — الغائبون: ${absentArray.length}`
      );
      setAttendanceScanMode(false);
      setPendingAbsentIds(new Set());
    } catch (e) {
      console.warn("[Attendance] save failed:", e);
      toast.error("تعذّر حفظ سجل الحضور — تحقق من اتصال قاعدة البيانات");
    } finally {
      setAttendanceBusy(false);
    }
  };

  const loadClasses = async () => {
    const list = await getAllClasses();
    setClasses(list);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadClasses(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      void getStudentsByClass(selected.id).then((list) => {
        if (alive) setStudents(list);
      });
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [selected]);

  const handleSaveClass = async (cls: ClassRoom) => {
    await saveClass(cls);
    await loadClasses();
    setCreating(false);
    setEditingClass(null);
    playSound("click");
    toast.success("تم حفظ الصف");
  };

  const handleDeleteClass = async (id: string) => {
    const cls = classes.find((c) => c.id === id);
    const ok = await requestConfirm(
      `هل تريد حذف الصف "${cls?.name || ""}"؟ سيتم حذف كل طلابه ومجموعاته نهائياً.`,
      { title: "حذف صف", danger: true }
    );
    if (!ok) return;
    // C34 (P2 fix): try/catch on DB call
    try {
      await deleteClass(id);
      if (activeClassId === id) setActiveClassId(null);
      if (selected?.id === id) setSelected(null);
      await loadClasses();
      playSound("click");
      toast.success("تم حذف الصف");
    } catch (e: any) {
      console.error("[ClassesPanel] handleDeleteClass failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleAddStudents = async () => {
    if (!selected) return;
    const rawNames = bulkText
      .split(/[\n,،;؛\t]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (rawNames.length === 0) return;

    // C34 (P2 fix): try/catch on DB call
    try {
      // P2 fix: de-duplicate the input itself first (case-insensitive,
      // trimmed) so the same name twice in one bulk doesn't slip through.
      const seenInBulk = new Set<string>();
      const uniqueNames: string[] = [];
      let duplicateInInputCount = 0;
      for (const n of rawNames) {
        const key = n.trim().toLowerCase();
        if (!key) continue;
        if (seenInBulk.has(key)) { duplicateInInputCount++; continue; }
        seenInBulk.add(key);
        uniqueNames.push(n.trim());
      }

      // P2 fix: re-fetch the current class roster from the DB so we don't
      // trust a possibly-stale local `students` state. The previous code
      // only checked against the local state which could lag behind changes
      // made from the Students panel or another tab.
      const freshRoster = await getStudentsByClass(selected.id);
      const existingInClass = new Set(freshRoster.map((s) => s.name.trim().toLowerCase()));

      let addedCount = 0;
      let movedCount = 0;
      let duplicateInClassCount = 0;

      for (const name of uniqueNames) {
        const nameKey = name.toLowerCase();
        // P2 fix: strict duplicate check — case-insensitive on the class roster
        if (existingInClass.has(nameKey)) {
          duplicateInClassCount++;
          continue;
        }
        // P2 fix: also use the strict DB-level check (in case the local
        // roster is stale, e.g., another tab just inserted the same name).
        const { studentExistsInClass } = await import("@/lib/data-store");
        const alreadyExists = await studentExistsInClass(name, selected.id);
        if (alreadyExists) {
          duplicateInClassCount++;
          existingInClass.add(nameKey);
          continue;
        }
        // Check if name exists in another class - move it (legacy behavior
        // — kept for now, but we explicitly warn the user via toast).
        const existing = await findStudentByName(name);
        if (existing) {
          if (existing.classId !== selected.id) {
            await moveStudentToClass(existing.studentId, selected.id);
            movedCount++;
            existingInClass.add(nameKey);
          }
        } else {
          // New student
          const newStudent: StudentPerClass = {
            studentId: `sc_${Date.now()}_${addedCount}_${Math.random().toString(36).slice(2, 6)}`,
            classId: selected.id,
            name,
            points: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            attempts: 0,
            badges: [],
            createdAt: new Date().toISOString(),
          };
          await saveStudentPerClass(newStudent);
          addedCount++;
          existingInClass.add(nameKey);
        }
      }
      const list = await getStudentsByClass(selected.id);
      setStudents(list);
      // If this is the active class, also refresh the shell store so the
      // Students panel sees the new students immediately.
      if (selected.id === activeClassId) {
        const { useShellStore: store } = await import("@/lib/shell-store");
        const prevCalledById = new Map(
          store.getState().students.map((s) => [s.id, !!s.calledInSession])
        );
        const storeStudents = list.map((s) => ({
          id: s.studentId,
          name: s.name,
          points: s.points,
          correctAnswers: s.correctAnswers,
          wrongAnswers: s.wrongAnswers,
          attempts: s.attempts,
          badges: (s.badges || []).map((b: string) => ({ type: b as any, awardedAt: s.createdAt })),
          calledInSession: prevCalledById.get(s.studentId) ?? false,
          isAbsent: s.isAbsent,
          title: s.title,
          createdAt: s.createdAt,
        }));
        store.setState({ students: storeStudents });
      }
      setBulkText("");
      setShowAddStudents(false);
      playSound("celebrate-clap");
      const parts: string[] = [];
      if (addedCount > 0) parts.push(`${addedCount} جديد`);
      if (movedCount > 0) parts.push(`${movedCount} نُقل من صف آخر`);
      const totalDuplicates = duplicateInClassCount + duplicateInInputCount;
      if (totalDuplicates > 0) parts.push(`${totalDuplicates} مكرر تجاهل`);
      toast.success(parts.length > 0 ? `تم: ${parts.join(" · ")}` : "لا شيء لإضافته");
    } catch (e: any) {
      console.error("[ClassesPanel] handleAddStudents failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!selected) return;
    // C7: destructive action — require explicit confirmation before deleting
    // the student from this class. find the student's name first for a clear msg.
    const target = students.find((st) => st.studentId === studentId);
    const ok = await requestConfirm(
      `حذف الطالب "${target?.name ?? studentId}" من الصف "${selected.name}"؟`,
      { title: "حذف طالب", danger: true }
    );
    if (!ok) return;
    // C34 (P2 fix): try/catch on DB call
    try {
      if (selected.id === activeClassId) {
        // removeStudent() updates the reactive store and waits for the DB delete
        // before this handler refreshes the class roster.
        await useShellStore.getState().removeStudent(studentId);
      } else {
        await deleteStudentPerClass(studentId);
      }
      const list = await getStudentsByClass(selected.id);
      setStudents(list);
      playSound("click");
      toast.success("تم حذف الطالب من الصف");
    } catch (e: any) {
      console.error("[ClassesPanel] handleDeleteStudent failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleAward = async (student: StudentPerClass, points: number, type: "correct" | "wrong") => {
    // C34 (P2 fix): try/catch on DB call
    try {
      const updated: StudentPerClass = {
        ...student,
        points: student.points + points,
        correctAnswers: type === "correct" ? student.correctAnswers + 1 : student.correctAnswers,
        wrongAnswers: type === "wrong" ? student.wrongAnswers + 1 : student.wrongAnswers,
        attempts: student.attempts + 1,
      };
      await saveStudentPerClass(updated);
      const list = await getStudentsByClass(selected!.id);
      setStudents(list);
      // If this class is also the live teaching class, keep the reactive
      // store (leaderboard, StudentCards, etc.) in sync too.
      if (selected?.id === activeClassId) {
        useShellStore.setState((s) => ({
          students: s.students.map((st) =>
            st.id === student.studentId
              ? { ...st, points: updated.points, correctAnswers: updated.correctAnswers, wrongAnswers: updated.wrongAnswers, attempts: updated.attempts }
              : st
          ),
        }));
      }
      playSound(type === "correct" ? "celebrate-clap" : "celebrate-buzz");
    } catch (e: any) {
      console.error("[ClassesPanel] handleAward failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleResetPoints = async () => {
    if (!selected) return;
    // تأكيد واضح — تصفير النقاط إجراء تدميري للنقاط التراكمية لكل طلاب الصف
    const ok = await requestConfirm(
      `تصفير نقاط كل طلاب الصف "${selected.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      { title: "تصفير النقاط", danger: true }
    );
    if (!ok) return;
    // C34 (P2 fix): try/catch on DB call
    try {
      await resetClassPoints(selected.id);
      const list = await getStudentsByClass(selected.id);
      setStudents(list);
      if (selected.id === activeClassId) {
        useShellStore.setState((s) => ({
          students: s.students.map((st) => ({
            ...st, points: 0, correctAnswers: 0, wrongAnswers: 0, attempts: 0, badges: [],
          })),
        }));
      }
      playSound("click");
      toast.success("تم تصفير النقاط");
    } catch (e: any) {
      console.error("[ClassesPanel] handleResetPoints failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleActivate = (cls: ClassRoom) => {
    setActiveClassId(cls.id);
    playSound("celebrate-stamp");
    toast.success(`الصف النشط: ${cls.name}`);
  };

  // عرض تفاصيل الصف
  if (selected) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(null)}
              className="text-white/60 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-white font-bold">{selected.name}</h3>
            {activeClassId === selected.id && (
              <span className="text-xs bg-[#10b981] text-white px-2 py-0.5 rounded-full">نشط</span>
            )}
          </div>
          <div className="flex gap-1">
            {/* P2-11: مسح الحضور اليومي */}
            <Button
              size="sm"
              variant={attendanceScanMode ? "default" : "ghost"}
              onClick={handleStartAttendanceScan}
              disabled={attendanceScanMode}
              className={cn(
                "h-8",
                attendanceScanMode
                  ? "bg-amber-500 text-black"
                  : "text-white/60 hover:text-white"
              )}
              title="سجّل حضور اليوم — كل الطلاب حاضرون افتراضياً، اضغط على من تريد تسجيله غائباً ثم احفظ"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleResetPoints}
              className="text-white/60 hover:text-white h-8"
              title="تصفير النقاط"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            {!activeClassId || activeClassId !== selected.id ? (
              <Button
                size="sm"
                onClick={() => handleActivate(selected)}
                className="bg-[#10b981] hover:bg-[#10b981]/80 h-8"
              >
                تنشيط
              </Button>
            ) : null}
          </div>
        </div>

        {/* P2-11: شريط حالة مسح الحضور اليومي + أزرار الحفظ/الإلغاء */}
        {attendanceScanMode && (
          <div className="p-2 border-b border-amber-500/30 bg-amber-500/10 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-300 font-bold">
                🗓️ مسح حضور {scanDate} — الغائبون: {pendingAbsentIds.size}
              </span>
              <span className="text-white/50">اضغط على الطالب لتقليبة غيابه</span>
            </div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                onClick={handleSaveAttendance}
                disabled={attendanceBusy}
                className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-500"
              >
                <Save className="w-3 h-3 ml-1" />
                احفظ سجل اليوم
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-white/60"
                onClick={() => {
                  setAttendanceScanMode(false);
                  setPendingAbsentIds(new Set());
                }}
                title="إلغاء المسح بدون حفظ"
              >
                إلغاء
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {students.length === 0 && !showAddStudents && (
              <div className="text-center text-white/40 py-12">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>لا يوجد طلاب في هذا الصف</p>
              </div>
            )}
            {students.map((s) => (
              <div
                key={s.studentId}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg transition group",
                  s.isAbsent
                    ? "bg-red-500/10 hover:bg-red-500/20 opacity-70"
                    : "bg-white/5 hover:bg-white/10"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className={cn("font-bold truncate", s.isAbsent ? "text-red-300 line-through" : "text-white")}>
                    {s.name}
                    {s.isAbsent && <span className="mr-1 text-[9px] bg-red-500/30 text-red-300 px-1 rounded font-normal">غائب</span>}
                  </div>
                  <div className="text-xs text-white/50">
                    {s.points} نقطة · {s.correctAnswers} ✓ · {s.wrongAnswers} ✗
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {/* P2-11: أثناء مسح الحضور نعرض زر تبديل فقط بدلاً من أزرار التقييم */}
                  {attendanceScanMode ? (
                    <Button
                      size="sm"
                      onClick={() => handleTogglePendingAbsent(s.studentId)}
                      className={cn(
                        "h-7 px-3 text-[11px] font-bold",
                        pendingAbsentIds.has(s.studentId)
                          ? "bg-red-500/30 text-red-300 hover:bg-red-500/50"
                          : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40"
                      )}
                      title={pendingAbsentIds.has(s.studentId) ? "اضغط لإلغاء الغياب" : "اضغط لتسجيله غائباً"}
                    >
                      {pendingAbsentIds.has(s.studentId) ? "غائب ✗" : "حاضر ✓"}
                    </Button>
                  ) : null}
                  {/* توحيد زر الغياب: نفس معنى ومفهوم "غ" المستخدم في StudentsPanel.
                      يستدعي setStudentAbsent حتى ينعكس على كل القوائم والألعاب.
                      يُخفى أثناء مسح الحضور لتفادي الالتباس بين الوضعين. */}
                  {!attendanceScanMode && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const next = !s.isAbsent;
                        useShellStore.getState().setStudentAbsent(s.studentId, next);
                        // أعد تحميل القائمة من SQLite حتى تتطابق الحالة محلياً ومع المتجر
                        if (selected) {
                          getStudentsByClass(selected.id).then(setStudents);
                        }
                        toast.success(next ? `${s.name} سُجِّل غائباً` : `${s.name} عاد للحضور`);
                      }}
                      className={cn(
                        "h-7 w-7 p-0",
                        s.isAbsent
                          ? "text-red-300 hover:bg-red-500/30"
                          : "text-amber-300 hover:bg-amber-500/20"
                      )}
                      title={s.isAbsent ? "إلغاء الغياب" : "تسجيل غياب"}
                    >
                      <span className="text-[10px] font-bold">{s.isAbsent ? "✗" : "غ"}</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAward(s, 1, "correct")}
                    className="h-7 px-2 text-green-400 hover:bg-green-500/20 text-xs"
                    title="صحيحة +1"
                  >
                    +1
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAward(s, 3, "correct")}
                    className="h-7 px-2 text-blue-400 hover:bg-blue-500/20 text-xs"
                    title="صحيحة +3"
                  >
                    +3
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAward(s, 5, "correct")}
                    className="h-7 px-2 text-amber-400 hover:bg-amber-500/20 text-xs"
                    title="ممتاز +5"
                  >
                    +5
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAward(s, -1, "wrong")}
                    className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/20"
                    title="خطأ -1"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteStudent(s.studentId)}
                    className="h-7 w-7 p-0 text-red-400/60 hover:bg-red-500/20 opacity-0 group-hover:opacity-100"
                    title="حذف من الصف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {showAddStudents && (
          <div className="p-3 border-t border-white/10 bg-zinc-900/95">
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="اكتب أسماء الطلاب، كل اسم في سطر أو مفصولة بفاصلة"
              className="bg-white/5 border-white/10 text-white min-h-[100px] mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={handleAddStudents}
                className="flex-1 bg-[#10b981] hover:bg-[#10b981]/80"
              >
                إضافة الطلاب
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddStudents(false);
                  setBulkText("");
                }}
                className="text-white/60"
              >
                إلغاء
              </Button>
            </div>
          </div>
        )}

        {!showAddStudents && (
          <div className="p-3 border-t border-white/10">
            <Button
              onClick={() => setShowAddStudents(true)}
              className="w-full bg-[#0142A0] hover:bg-[#0142A0]/80"
            >
              <Plus className="w-4 h-4 ml-1" /> إضافة طلاب
            </Button>
          </div>
        )}
      </div>
    );
  }

  // عرض قائمة الصفوف
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-white font-bold flex items-center gap-2">
          <School className="w-4 h-4 text-[#0142A0]" />
          الفصول
        </h3>
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className="bg-[#0142A0] hover:bg-[#0142A0]/80"
        >
          <Plus className="w-4 h-4 ml-1" /> صف
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {classes.length === 0 && (
            <div className="text-center text-white/40 py-12">
              <School className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>لا توجد فصول بعد</p>
              <p className="text-xs">أنشئ صفًا لإدارة طلابه</p>
            </div>
          )}
          {classes.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition group cursor-pointer"
              onClick={() => setSelected(c)}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: c.color || "#0142A0" }}
              >
                <School className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold truncate">{c.name}</div>
                {c.description && (
                  <div className="text-xs text-white/50 truncate">{c.description}</div>
                )}
              </div>
              {activeClassId === c.id && (
                <span className="text-xs bg-[#10b981] text-white px-2 py-0.5 rounded-full">نشط</span>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingClass(c);
                }}
                className="h-8 w-8 p-0 text-cyan-300 opacity-0 group-hover:opacity-100"
                title="تعديل الفصل"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClass(c.id);
                }}
                className="h-8 w-8 p-0 text-red-400 opacity-0 group-hover:opacity-100"
                title="حذف الفصل"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {(creating || editingClass) && (
        <ClassEditor
          initialClass={editingClass}
          onSave={handleSaveClass}
          onCancel={() => {
            setCreating(false);
            setEditingClass(null);
          }}
        />
      )}
    </div>
  );
}

function ClassEditor({
  initialClass,
  onSave,
  onCancel,
}: {
  initialClass?: ClassRoom | null;
  onSave: (c: ClassRoom) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialClass?.name ?? "");
  const [description, setDescription] = useState(initialClass?.description ?? "");
  const [color, setColor] = useState(initialClass?.color ?? COLORS[0]);

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
      {/* C33 (P2 fix): use Z_MODAL_BACKDROP=200 instead of z-50 */}
      <div className="bg-zinc-900 rounded-2xl border border-white/10 p-5 w-full max-w-md space-y-4 z-[210]">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold">{initialClass ? "تعديل الفصل" : "صف جديد"}</h3>
          <Button size="sm" variant="ghost" onClick={onCancel} className="text-white/60">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">اسم الصف</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: الصف السادس - أ"
            className="bg-white/5 border-white/10 text-white"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">الوصف (اختياري)</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: فصل الصباح"
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">اللون</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-8 h-8 rounded-full border-2",
                  color === c ? "border-white scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() =>
              name.trim() &&
              onSave({
                id: initialClass?.id ?? `cls_${Date.now()}`,
                name: name.trim(),
                description,
                color,
                createdAt: new Date().toISOString(),
                studentIds: [],
              })
            }
            className="flex-1 bg-[#10b981] hover:bg-[#10b981]/80"
          >
            <Save className="w-4 h-4 ml-1" /> حفظ
          </Button>
          <Button variant="ghost" onClick={onCancel} className="text-white/60">
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  );
}
