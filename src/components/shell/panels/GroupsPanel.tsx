"use client";

import { useEffect, useState, useMemo } from "react";
import { useShellStore } from "@/lib/shell-store";
import {
  getAllClasses,
  getAllGroups,
  saveGroup,
  deleteGroup,
  addGroupPoints,
  getStudentsByClass,
  autoSplitIntoGroups,
  type ClassRoom,
  type StudentGroup,
  type StudentPerClass,
} from "@/lib/data-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Save,
  Users,
  X,
  Layers,
  ChevronLeft,
  Crown,
  Shuffle,
  Pencil,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GROUP_COLORS = ["#0142A0", "#DA151C", "#10b981", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#92400e"];

export function GroupsPanel() {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [students, setStudents] = useState<StudentPerClass[]>([]);
  const [creating, setCreating] = useState(false);
  // P3 fix: editing state — when set, GroupEditor opens in EDIT mode with the
  // pre-filled group, allowing the teacher to rename, recolor, or change members.
  const [editingGroup, setEditingGroup] = useState<StudentGroup | null>(null);

  const activeClassId = useShellStore((s) => s.activeClassId);
  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const awardPoints = useShellStore((s) => s.awardPoints);
  const requestPrompt = useShellStore((s) => s.requestPrompt);
  const requestConfirm = useShellStore((s) => s.requestConfirm);
  const presentStudents = useMemo(() => students.filter((student) => !student.isAbsent), [students]);

  useEffect(() => {
    getAllClasses().then(async (list) => {
      setClasses(list);
      // If active class, auto-select
      if (activeClassId) {
        const ac = list.find((c) => c.id === activeClassId);
        if (ac) setSelectedClass(ac);
      }
    });
  }, [activeClassId]);

  useEffect(() => {
    if (selectedClass) {
      getAllGroups(selectedClass.id).then(setGroups);
      getStudentsByClass(selectedClass.id).then(setStudents);
    }
  }, [selectedClass]);

  const refresh = async () => {
    if (!selectedClass) return;
    setGroups(await getAllGroups(selectedClass.id));
    setStudents(await getStudentsByClass(selectedClass.id));
  };

  const handleSaveGroup = async (g: StudentGroup) => {
    try {
      // A student belongs to at most one group in a class. The editor allows
      // selecting students from other groups, so remove those selected IDs
      // from every sibling before persisting the target group.
      const selectedIds = new Set(g.studentIds);
      const targetIds = [...selectedIds];
      const siblingGroups = groups.filter((group) => group.id !== g.id);
      const siblingsToSave = siblingGroups
        .map((group) => ({
          ...group,
          studentIds: group.studentIds.filter((studentId) => !selectedIds.has(studentId)),
        }))
        .filter((group, index) => {
          const original = siblingGroups[index];
          return group.studentIds.length !== original.studentIds.length ||
            group.studentIds.some((studentId, studentIndex) => studentId !== original.studentIds[studentIndex]);
        });

      for (const sibling of siblingsToSave) await saveGroup(sibling);
      await saveGroup({ ...g, studentIds: targetIds });
      await refresh();
      setCreating(false);
      setEditingGroup(null);
      playSound("click");
      toast.success("تم حفظ المجموعة");
    } catch (e: any) {
      console.error("[GroupsPanel] handleSaveGroup failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    const target = groups.find((g) => g.id === id);
    const ok = await requestConfirm(
      `حذف المجموعة «${target?.name ?? id}» نهائياً؟ سيتم فك ارتباط الطلاب بها.`,
      { title: "حذف مجموعة", danger: true }
    );
    if (!ok) return;
    try {
      await deleteGroup(id);
      await refresh();
      playSound("click");
      toast.success("تم حذف المجموعة");
    } catch (e: any) {
      console.error("[GroupsPanel] handleDeleteGroup failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  const handleAwardGroup = async (g: StudentGroup, points: number) => {
    try {
      await addGroupPoints(g.id, points);
      const groupStudents = students.filter((s) => g.studentIds.includes(s.studentId));
      for (const s of groupStudents) {
        awardPoints(s.studentId, points);
      }
      await refresh();
      playSound(points > 0 ? "celebrate-clap" : "celebrate-buzz");
      toast.success(`${points > 0 ? "+" : ""}${points} لكل أعضاء ${g.name}`);
    } catch (e: any) {
      console.error("[GroupsPanel] handleAwardGroup failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  // P3 fix: move student from one group to another.
  // Removes the student from their current group's studentIds array and
  // adds them to the target group's studentIds array. Persists both groups
  // via saveGroup (upsert). If the student isn't in any group, just adds them.
  const handleMoveStudent = async (
    studentId: string,
    studentName: string,
    fromGroupId: string | null,
    toGroupId: string
  ) => {
    if (fromGroupId === toGroupId) return;
    try {
      const updatedGroups: StudentGroup[] = groups.map((g) => ({ ...g, studentIds: [...g.studentIds] }));
      // Remove from source group
      if (fromGroupId) {
        const src = updatedGroups.find((g) => g.id === fromGroupId);
        if (src) {
          src.studentIds = src.studentIds.filter((id) => id !== studentId);
        }
      }
      // Add to target group (avoid duplicates)
      const dst = updatedGroups.find((g) => g.id === toGroupId);
      if (dst) {
        if (!dst.studentIds.includes(studentId)) {
          dst.studentIds.push(studentId);
        }
      }
      // Persist both affected groups
      const affected = updatedGroups.filter((g) =>
        g.id === fromGroupId || g.id === toGroupId
      );
      for (const g of affected) {
        await saveGroup(g);
      }
      setGroups(updatedGroups);
      playSound("click");
      const targetName = updatedGroups.find((g) => g.id === toGroupId)?.name ?? "";
      toast.success(`تم نقل ${studentName} إلى ${targetName}`);
    } catch (e: any) {
      console.error("[GroupsPanel] handleMoveStudent failed:", e);
      toast.error(`فشل: ${e?.message || "خطأ"}`);
    }
  };

  // === View: Group List ===
  if (selectedClass) {
    const ranked = [...groups].sort((a, b) => b.groupPoints - a.groupPoints);
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedClass(null)}
              className="text-white/60 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-white font-bold">{selectedClass.name}</h3>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={async () => {
                if (presentStudents.length < 2) {
                  toast.error("يجب أن يكون هناك طالبان حاضران على الأقل");
                  return;
                }
                const input = await requestPrompt("كم عدد الطلاب الحاضرين في كل مجموعة؟", { defaultValue: "4", inputType: "number" });
                if (input === null) return;
                const studentsPerGroup = parseInt(input, 10);
                if (!studentsPerGroup || studentsPerGroup < 1 || studentsPerGroup > presentStudents.length) {
                  toast.error("عدد غير صحيح");
                  return;
                }
                const numGroups = Math.ceil(presentStudents.length / studentsPerGroup);
                try {
                  for (const g of groups) {
                    await deleteGroup(g.id);
                  }
                  const newGroups = await autoSplitIntoGroups(selectedClass.id, numGroups);
                  setGroups(newGroups);
                  playSound("celebrate-tada");
                  triggerConfetti();
                  toast.success(`تم تقسيم ${presentStudents.length} طالب حاضر إلى ${numGroups} مجموعة (${studentsPerGroup} طلاب لكل مجموعة)`);
                } catch (e: any) {
                  console.error("[GroupsPanel] autoSplitIntoGroups failed:", e);
                  toast.error(`فشل: ${e?.message || "خطأ"}`);
                }
              }}
              disabled={presentStudents.length < 2}
              className="bg-[#a855f7] hover:bg-[#a855f7]/80"
              title="تقسيم تلقائي بعدد طلاب لكل مجموعة"
            >
              <Shuffle className="w-4 h-4 ml-1" /> تقسيم تلقائي
            </Button>
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              disabled={presentStudents.length === 0}
              className="bg-[#0142A0] hover:bg-[#0142A0]/80"
            >
              <Plus className="w-4 h-4 ml-1" /> مجموعة
            </Button>
          </div>
        </div>

        {students.length === 0 && (
          <div className="text-center text-white/40 py-12">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>لا يوجد طلاب في هذا الصف</p>
            <p className="text-xs">أضف طلاباً من لوحة الفصول أولاً</p>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {ranked.length === 0 && students.length > 0 && (
              <div className="text-center text-white/40 py-12">
                <Layers className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>لا توجد مجموعات بعد</p>
                <p className="text-xs mt-1">استخدم «تقسيم تلقائي» أو أنشئ مجموعة يدوياً</p>
              </div>
            )}
            {ranked.map((g, idx) => {
              const groupStudents = students.filter((s) => g.studentIds.includes(s.studentId));
              // Find ungrouped students so we can show them at the bottom of the panel
              return (
                <div
                  key={g.id}
                  className="rounded-lg overflow-hidden border border-white/10"
                  style={{ borderLeftWidth: 4, borderLeftColor: g.color }}
                >
                  <div className="flex items-center gap-2 p-3" style={{ backgroundColor: `${g.color}20` }}>
                    {idx === 0 && g.groupPoints > 0 && (
                      <Crown className="w-4 h-4 text-[#FFD700]" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold">{g.name}</div>
                      <div className="text-xs text-white/60">
                        {groupStudents.length} طالب · {g.groupPoints} نقطة
                      </div>
                    </div>
                    {/* P3 fix: edit button to rename/recolor/edit members */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingGroup(g)}
                      className="h-7 w-7 p-0 text-blue-300 hover:text-blue-200"
                      title="تعديل المجموعة (إعادة تسمية/ألوان/أعضاء)"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteGroup(g.id)}
                      className="h-7 w-7 p-0 text-red-400"
                      title="حذف المجموعة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="p-2 bg-white/5">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {groupStudents.map((s) => (
                        <Popover key={s.studentId}>
                          <PopoverTrigger asChild>
                            <button
                              className="text-xs bg-white/10 hover:bg-white/20 text-white/90 px-2 py-1 rounded inline-flex items-center gap-1 transition"
                              title="انقر لنقل الطالب إلى مجموعة أخرى"
                            >
                              {s.name}
                              <ArrowRightLeft className="w-3 h-3 opacity-50" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 bg-zinc-900 border border-white/10 p-2" align="start">
                            <div className="text-xs text-white/60 mb-1.5 px-1">نقل {s.name} إلى:</div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {groups.filter((og) => og.id !== g.id).map((og) => (
                                <button
                                  key={og.id}
                                  onClick={() => {
                                    handleMoveStudent(s.studentId, s.name, g.id, og.id);
                                  }}
                                  className="w-full text-right px-2 py-1.5 rounded text-xs hover:bg-white/10 text-white/85 flex items-center gap-2 transition"
                                >
                                  <span
                                    className="w-2 h-2 rounded-full inline-block"
                                    style={{ backgroundColor: og.color }}
                                  />
                                  {og.name}
                                  <span className="text-white/40 mr-auto">{og.studentIds.length} عضو</span>
                                </button>
                              ))}
                              {groups.filter((og) => og.id !== g.id).length === 0 && (
                                <div className="text-xs text-white/40 px-2 py-2 text-center">لا توجد مجموعات أخرى</div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ))}
                      {groupStudents.length === 0 && (
                        <span className="text-xs text-white/40">لا أعضاء — اضغط تعديل لإضافة أعضاء</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleAwardGroup(g, 1)}
                        className="flex-1 h-7 bg-[#10b981]/20 hover:bg-[#10b981]/40 text-green-300 text-xs"
                      >
                        +1 للكل
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAwardGroup(g, 3)}
                        className="flex-1 h-7 bg-[#0142A0]/20 hover:bg-[#0142A0]/40 text-blue-300 text-xs"
                      >
                        +3 للكل
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAwardGroup(g, 5)}
                        className="flex-1 h-7 bg-[#f59e0b]/20 hover:bg-[#f59e0b]/40 text-amber-300 text-xs"
                      >
                        +5 للكل
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Show ungrouped students so they can be assigned via Popover */}
            <UngroupedStudentsBlock
              students={students}
              groups={groups}
              onMove={(sid, sname, toGid) => handleMoveStudent(sid, sname, null, toGid)}
            />
          </div>
        </ScrollArea>

        {creating && (
          <GroupEditor
            students={students}
            classId={selectedClass.id}
            existingGroups={groups}
            onSave={handleSaveGroup}
            onCancel={() => setCreating(false)}
          />
        )}
        {editingGroup && (
          <GroupEditor
            students={students}
            classId={selectedClass.id}
            existingGroups={groups}
            initialGroup={editingGroup}
            onSave={handleSaveGroup}
            onCancel={() => setEditingGroup(null)}
          />
        )}
      </div>
    );
  }

  // === View: Class Picker ===
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-white font-bold flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#a855f7]" />
          المجموعات
        </h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {classes.length === 0 && (
            <div className="text-center text-white/40 py-12">
              <Layers className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>أنشئ صفًا أولاً من لوحة الفصول</p>
            </div>
          )}
          {classes.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedClass(c)}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: c.color || "#0142A0" }}
              >
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold truncate">{c.name}</div>
                <div className="text-xs text-white/50">اختر لإدارة مجموعاته</div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// P3 fix: a small block showing students not in any group, with a quick
// "assign to group" popover — so the teacher can clean up after auto-split
// or after deleting a group.
function UngroupedStudentsBlock({
  students,
  groups,
  onMove,
}: {
  students: StudentPerClass[];
  groups: StudentGroup[];
  onMove: (studentId: string, studentName: string, toGroupId: string) => void;
}) {
  const assigned = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) for (const id of g.studentIds) s.add(id);
    return s;
  }, [groups]);

  const ungrouped = students.filter((s) => !assigned.has(s.studentId));

  if (ungrouped.length === 0) return null;
  if (groups.length === 0) return null; // nothing to assign to

  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-3 mt-3">
      <div className="text-xs text-white/60 mb-2 flex items-center gap-1">
        <Users className="w-3.5 h-3.5" />
        طلاب بدون مجموعة ({ungrouped.length})
      </div>
      <div className="flex flex-wrap gap-1">
        {ungrouped.map((s) => (
          <Popover key={s.studentId}>
            <PopoverTrigger asChild>
              <button className="text-xs bg-white/10 hover:bg-white/20 text-white/80 px-2 py-1 rounded inline-flex items-center gap-1 transition">
                {s.name}
                <ArrowRightLeft className="w-3 h-3 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 bg-zinc-900 border border-white/10 p-2" align="start">
              <div className="text-xs text-white/60 mb-1.5 px-1">إضافة {s.name} إلى:</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {groups.map((og) => (
                  <button
                    key={og.id}
                    onClick={() => onMove(s.studentId, s.name, og.id)}
                    className="w-full text-right px-2 py-1.5 rounded text-xs hover:bg-white/10 text-white/85 flex items-center gap-2 transition"
                  >
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: og.color }} />
                    {og.name}
                    <span className="text-white/40 mr-auto">{og.studentIds.length} عضو</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

function GroupEditor({
  students,
  classId,
  existingGroups = [],
  initialGroup,
  onSave,
  onCancel,
}: {
  students: StudentPerClass[];
  classId: string;
  existingGroups?: StudentGroup[];
  initialGroup?: StudentGroup;
  onSave: (g: StudentGroup) => void;
  onCancel: () => void;
}) {
  // P3 fix: support edit mode — pre-fill name/color/members from initialGroup
  const isEdit = !!initialGroup;
  const [name, setName] = useState(initialGroup?.name ?? "");
  const [color, setColor] = useState(initialGroup?.color ?? GROUP_COLORS[0]);
  const [selected, setSelected] = useState<string[]>(initialGroup?.studentIds ?? []);

  const toggleStudent = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // P3 fix: when editing, we want to allow the user to pick students that are
  // currently in OTHER groups too — the editor doesn't restrict membership,
  // since moving a student here will remove them from their previous group
  // (handled by the parent's save logic). We just label which group each
  // student is currently in.
  const groupOfStudent = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of existingGroups) {
      if (initialGroup && g.id === initialGroup.id) continue;
      for (const sid of g.studentIds) m.set(sid, g.name);
    }
    return m;
  }, [existingGroups, initialGroup]);

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
      <div className="bg-zinc-900 rounded-2xl border border-white/10 p-5 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto z-[210]">
        <div className="flex items-center justify-between sticky top-0 bg-zinc-900 -mx-5 px-5 py-2 -mt-5 mb-2 border-b border-white/10">
          <h3 className="text-white font-bold">
            {isEdit ? `تعديل: ${initialGroup!.name}` : "مجموعة جديدة"}
          </h3>
          <Button size="sm" variant="ghost" onClick={onCancel} className="text-white/60">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">اسم المجموعة</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: مجموعة النجوم"
            className="bg-white/5 border-white/10 text-white"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">اللون</label>
          <div className="flex gap-2 flex-wrap">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-7 h-7 rounded-full border-2",
                  color === c ? "border-white scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">
            الأعضاء ({selected.length} مختار)
          </label>
          <div className="max-h-48 overflow-y-auto space-y-1 bg-white/5 rounded-lg p-2">
            {students.map((s) => {
              const isSelected = selected.includes(s.studentId);
              const inOtherGroup = groupOfStudent.get(s.studentId);
              return (
                <button
                  key={s.studentId}
                  onClick={() => toggleStudent(s.studentId)}
                  className={cn(
                    "w-full text-right px-3 py-2 rounded-md text-sm transition flex items-center justify-between gap-2",
                    isSelected
                      ? "bg-[#0142A0] text-white"
                      : "text-white/70 hover:bg-white/5"
                  )}
                >
                  <span>{s.name}</span>
                  {inOtherGroup && !isSelected && (
                    <span className="text-[10px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                      في: {inOtherGroup}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {isEdit && (
            <p className="text-[10px] text-white/40 mt-1">
              ملاحظة: اختيار طالب من مجموعة أخرى سينقله تلقائياً إلى هذه المجموعة عند الحفظ.
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => {
              if (!name.trim()) return;
              if (selected.length === 0 && !isEdit) return;
              onSave({
                id: initialGroup?.id ?? `grp_${Date.now()}`,
                classId,
                name: name.trim(),
                color,
                studentIds: selected,
                groupPoints: initialGroup?.groupPoints ?? 0,
                createdAt: initialGroup?.createdAt ?? new Date().toISOString(),
              });
            }}
            disabled={!name.trim() || (!isEdit && selected.length === 0)}
            className="flex-1 bg-[#10b981] hover:bg-[#10b981]/80"
          >
            <Save className="w-4 h-4 ml-1" /> {isEdit ? "حفظ التعديلات" : "حفظ"}
          </Button>
          <Button variant="ghost" onClick={onCancel} className="text-white/60">
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  );
}
