"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, GitCompare, HeartPulse, Link2, Loader2, PlugZap, RefreshCw, Shield, Trash2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useShellStore } from "@/lib/shell-store";
import { localDb, type MoodleDiscoveryPayload, type MoodleMappingBundle } from "@/lib/local-db";
import { CustomAppPanel } from "./CustomAppPanel";

type MoodleSafeConfig = { enabled: boolean; baseUrl: string; courseId: number | null; curriculumKey: string | null; hasToken: boolean; webhookEnabled?: boolean; webhookEndpoint?: string; lastSyncAt: string | null; lastSyncStatus: string | null; lastSyncError: string | null };
type LocalStudent = { id: string; name: string; moodleUserId?: number | null; moodleUsername?: string | null; moodleCourseId?: number | null };
type LocalClass = { id: string; name: string };
type MoodleSyncResult = { syncedAt?: string; mode?: string; cursor?: string; nextPollMs?: number; students: number; attempts: number; changed?: number; skipped?: number; requests?: number; homeworkSnapshots: number; homeworkQuestions: number; failures: Array<{ scope: string; error: string }> };
type MoodleHealth = { enabled: boolean; connectionOk?: boolean; lastProbeAt?: string | null; probe?: { at: string; ok: boolean; latencyMs: number; error?: string | null } | null; lastSyncAt?: string | null; lastSyncStatus?: string; mappedStudents?: number; totalMoodleStudents?: number; unmappedStudents?: number; mappedActivities?: number; totalMoodleActivities?: number; needsReviewActivities?: number; pendingEvents?: number; failedEvents24h?: number; pendingRetries?: number; deadRetries?: number; webhookSuccessRate?: number; reconcileStatus?: string; lastReconciledAt?: string | null; alerts?: Array<{ severity: "critical" | "warning" | "info"; message: string }> };
type MoodleReconcile = { status: string; students?: { total: number; mapped: number; missing: number; newStudents: number; missingList: Array<Record<string, unknown>>; newStudentsList: Array<Record<string, unknown>> }; groups?: { total: number; groupDrift: Array<Record<string, unknown>> }; activities?: { total: number; mapped: number; newActivities: number; orphanActivities: number; drift: number; newActivitiesList: Array<Record<string, unknown>>; orphanActivitiesList: Array<Record<string, unknown>>; driftList: Array<Record<string, unknown>> }; failures?: Array<{ resource: string; error: string }> };

async function moodlePost<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/moodle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const payload = await response.json().catch(() => ({ ok: false, error: "استجابة Moodle غير صالحة" }));
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "فشل طلب Moodle");
  return payload.data as T;
}

function textField(value: unknown) { return typeof value === "string" ? value : ""; }
function numberField(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function arrayField(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function tagList(value: unknown): string[] { return arrayField(value).filter((item): item is string => typeof item === "string"); }
function ideaFromTags(tags: string[]) {
  const tag = tags.find((item) => /(?:^|:)idea:[^:]+:[^:]+/i.test(item));
  const match = tag?.match(/(?:^|:)idea:([^:]+):([^:]+)/i);
  return match ? { lessonKey: match[1], ideaKey: match[2], tag } : null;
}
function lessonFromTags(tags: string[]) {
  const tag = tags.find((item) => /(?:^|:)homework:[^:]+/i.test(item));
  const match = tag?.match(/(?:^|:)homework:([^:]+)/i);
  return match ? { lessonKey: match[1], tag } : null;
}

export function MoodlePanel() {
  const [config, setConfig] = useState<MoodleSafeConfig>({ enabled: false, baseUrl: "", courseId: null, curriculumKey: null, hasToken: false, lastSyncAt: null, lastSyncStatus: null, lastSyncError: null });
  const [baseUrl, setBaseUrl] = useState("");
  const [courseId, setCourseId] = useState("");
  const [curriculumKey, setCurriculumKey] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<MoodleDiscoveryPayload | null>(null);
  const [mappings, setMappings] = useState<MoodleMappingBundle | null>(null);
  const [selectedClassByGroup, setSelectedClassByGroup] = useState<Record<number, string>>({});
  const [autoLinked, setAutoLinked] = useState(0);
  const [syncStats, setSyncStats] = useState<MoodleSyncResult | null>(null);
  const [health, setHealth] = useState<MoodleHealth | null>(null);
  const [reconcileResult, setReconcileResult] = useState<MoodleReconcile | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [localClasses, setLocalClasses] = useState<LocalClass[]>([]);
  const [manualStudentByMoodle, setManualStudentByMoodle] = useState<Record<number, string>>({});
  const localStudents = useShellStore((state) => state.students) as LocalStudent[];
  const activeClassId = useShellStore((state) => state.activeClassId);

  const discoveredUsers = useMemo(() => arrayField(discovery?.users).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")), [discovery]);
  const discoveredGroups = useMemo(() => arrayField(discovery?.groups).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")), [discovery]);
  const quizCount = useMemo(() => { const raw = discovery?.quizzes; return Array.isArray(raw) ? raw.length : arrayField((raw as { quizzes?: unknown[] } | undefined)?.quizzes).length; }, [discovery]);
  const assignmentCount = useMemo(() => { const raw = discovery?.assignments; return Array.isArray(raw) ? raw.length : arrayField((raw as { courses?: unknown[] } | undefined)?.courses?.flatMap((course: any) => arrayField(course?.assignments))).length; }, [discovery]);
  const unmappedUsers = useMemo(() => discoveredUsers.filter((item) => {
    const moodleUserId = numberField(item.id);
    const username = textField(item.username).toLowerCase();
    const name = textField(item.fullname).trim().toLowerCase();
    return !localStudents.some((student) => student.moodleUserId === moodleUserId || (username && student.moodleUsername?.toLowerCase() === username) || (name && student.name.trim().toLowerCase() === name));
  }), [discoveredUsers, localStudents]);

  const load = async () => {
    const response = await fetch("/api/moodle", { cache: "no-store" });
    const payload = await response.json().catch(() => ({ ok: false }));
    if (payload?.ok) {
      setConfig(payload.data);
      setBaseUrl(payload.data.baseUrl || "");
      setCourseId(payload.data.courseId ? String(payload.data.courseId) : "");
      setCurriculumKey(payload.data.curriculumKey || "");
    }
    try { setMappings(await localDb.moodleMappings.list()); } catch { /* mapping DB is optional during first setup */ }
    try { setLocalClasses((await localDb.classes.list()).map((item) => ({ id: item.id, name: item.name }))); } catch { /* classes may not exist before first seed */ }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!config.enabled) return;
    const refreshHealth = () => { void moodlePost<MoodleHealth>({ action: "health" }).then(setHealth).catch(() => undefined); };
    refreshHealth();
    const timer = window.setInterval(refreshHealth, 30_000);
    const groupTimer = config.hasToken && config.courseId ? window.setInterval(() => { void moodlePost({ action: "syncGroups" }).catch(() => undefined); }, 5 * 60_000) : null;
    const probeTimer = config.hasToken ? window.setInterval(() => { void moodlePost({ action: "probe" }).then(() => refreshHealth()).catch(() => undefined); }, 5 * 60_000) : null;
    return () => { window.clearInterval(timer); if (groupTimer) window.clearInterval(groupTimer); if (probeTimer) window.clearInterval(probeTimer); };
  }, [config.enabled, config.hasToken, config.courseId]);

  const save = async () => {
    setBusy(true); setStatus(null);
    try {
      const next = await moodlePost<MoodleSafeConfig>({ action: "config.save", enabled: config.enabled, baseUrl, courseId: Number(courseId), curriculumKey, ...(token.trim() ? { token: token.trim() } : {}) });
      setConfig(next); setToken(""); setStatus("تم حفظ إعدادات Moodle بشكل مشفر، وأصبح curriculumKey هو مرجع المحتوى المشترك للفصول.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "تعذر حفظ إعدادات Moodle"); }
    finally { setBusy(false); }
  };

  const runProbe = async () => {
    setBusy(true); setStatus("جاري فحص صحة اتصال Moodle...");
    try { const result = await moodlePost<MoodleHealth["probe"] & { enabled: boolean; ok: boolean; consecutiveFailures?: number }>({ action: "probe" }); setStatus(result.ok ? `الاتصال يعمل (${result.latencyMs}ms)` : `فشل الفحص: ${result.error || "Moodle لا يستجيب"}`); const next = await moodlePost<MoodleHealth>({ action: "health" }); setHealth(next); }
    catch (error) { setStatus(error instanceof Error ? error.message : "تعذر فحص Moodle"); }
    finally { setBusy(false); }
  };

  const reconcile = async () => {
    setBusy(true); setStatus("جاري مقارنة Moodle بالخرائط المحلية واكتشاف الطلاب والأنشطة المنقولة...");
    try { const result = await moodlePost<MoodleReconcile>({ action: "reconcile" }); setReconcileResult(result); setStatus(result.status === "drift" ? "تم اكتشاف تغييرات تحتاج مراجعة؛ لم تُحذف بيانات محلية." : "المصالحة مكتملة: الخرائط المحلية متوافقة مع Moodle."); const next = await moodlePost<MoodleHealth>({ action: "health" }); setHealth(next); }
    catch (error) { setStatus(error instanceof Error ? error.message : "تعذرت مصالحة Moodle"); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setStatus("جاري اختبار الاتصال...");
    try { const result = await moodlePost<{ connected: boolean; siteName: string }>({ action: "test" }); setStatus(`تم الاتصال بنجاح: ${result.siteName}`); await load(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "فشل اختبار Moodle"); }
    finally { setBusy(false); }
  };

  const discover = async () => {
    setBusy(true); setStatus("جاري اكتشاف المقرر والمجموعات والطلاب والأنشطة..."); setDiscovery(null); setAutoLinked(0);
    try {
      const result = await moodlePost<MoodleDiscoveryPayload>({ action: "discover" });
      // Provider payloads may omit optional collections; normalize at the UI boundary
      // so opening the panel or a partial discovery response never crashes the shell.
      const normalizedResult = {
        ...result,
        users: arrayField(result.users),
        groups: arrayField(result.groups),
        sections: arrayField(result.sections),
        activities: arrayField(result.activities),
        failures: arrayField(result.failures),
      } as MoodleDiscoveryPayload;
      setDiscovery(normalizedResult);
      const course = arrayField(normalizedResult.courses).find((item) => item && typeof item === "object" && Number((item as any).id) === normalizedResult.courseId) as Record<string, unknown> | undefined;
      const courseMap = await localDb.moodleMappings.saveCourse({ moodleCourseId: result.courseId, curriculumKey: curriculumKey || `moodle-course-${result.courseId}`, label: textField(course?.fullname || course?.shortname) || `Moodle #${result.courseId}` });
      const courseMapId = textField(courseMap.id);
      if (courseMapId) {
        for (const section of arrayField(normalizedResult.sections)) {
          const item = section as Record<string, unknown>;
          const sectionId = numberField(item.id);
          if (sectionId !== null) await localDb.moodleMappings.saveSection({ courseMapId, moodleSectionId: sectionId, sectionKey: textField(item.sectionKey) || `section-${sectionId}`, name: textField(item.name), orderIndex: numberField(item.sectionIndex) ?? 0, visible: item.visible !== false });
        }
        for (const group of arrayField(normalizedResult.groups)) {
          const item = group as Record<string, unknown>;
          const groupId = numberField(item.id);
          if (groupId) await localDb.moodleMappings.saveGroup({ courseMapId, moodleGroupId: groupId, className: textField(item.name) });
        }
        const quizPayload = Array.isArray(normalizedResult.quizzes) ? normalizedResult.quizzes : arrayField((normalizedResult.quizzes as { quizzes?: unknown[] } | undefined)?.quizzes);
        const assignmentCourses = Array.isArray(normalizedResult.assignments) ? normalizedResult.assignments : arrayField((normalizedResult.assignments as { courses?: unknown[] } | undefined)?.courses);
        const assignments = assignmentCourses.flatMap((course: any) => arrayField(course?.assignments));
        const lessonKeys = new Set<string>();
        const ideaKeys = new Set<string>();
        const normalizedActivities = arrayField(normalizedResult.activities).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
        for (const raw of (normalizedActivities.length ? normalizedActivities : quizPayload.concat(assignments))) {
          const item = raw as Record<string, unknown>;
          const id = numberField(item.id);
          if (id === null) continue;
          const tags = tagList(item.tags);
          const idea = ideaFromTags(tags);
          const homework = lessonFromTags(tags);
          const lessonKey = idea?.lessonKey || homework?.lessonKey || textField(item.lessonKey) || "lesson-unmapped";
          const ideaKey = idea?.ideaKey || (textField(item.ideaKey) || null);
          const mappingMode = textField(item.mappingMode) || (idea ? "tag" : "order");
          const confidence = typeof item.confidence === "number" ? item.confidence : idea ? 1 : 0.65;
          const needsReview = item.needsReview === true || confidence < 0.6;
          lessonKeys.add(lessonKey);
          if (ideaKey) ideaKeys.add(`${lessonKey}|${ideaKey}`);
          await localDb.moodleMappings.saveLesson({ curriculumKey: curriculumKey || `moodle-course-${result.courseId}`, lessonKey, title: textField(item.lessonTitle || item.name) || lessonKey });
          if (ideaKey) await localDb.moodleMappings.saveIdea({ curriculumKey: curriculumKey || `moodle-course-${result.courseId}`, lessonKey, ideaKey, title: textField(item.ideaTitle) || ideaKey });
          const isHomework = Boolean(homework) || /واجب|homework/i.test(textField(item.name));
          if (isHomework) {
            await localDb.moodleMappings.saveHomework({ courseMapId, moodleActivityId: id, activityType: textField(item.activityType) || (item.submissiontypes ? "assignment" : "quiz"), curriculumKey: curriculumKey || `moodle-course-${result.courseId}`, lessonKey, externalKey: tags.find((tag) => /homework/i.test(tag)) || null, name: textField(item.name), enabled: item.visible !== 0 });
          } else {
            await localDb.moodleMappings.saveActivity({ courseMapId, sectionMapId: textField(item.sectionMapId) || null, moodleSectionId: numberField(item.sectionId), moodleActivityId: id, activityType: textField(item.activityType) || "quiz", curriculumKey: curriculumKey || `moodle-course-${result.courseId}`, lessonKey, ideaKey, externalKey: tags[0] || null, name: textField(item.name), visible: item.visible === 1 || item.visible === true, mappingMode, confidence, needsReview, sourceFingerprint: textField(item.fingerprint) || null, orderIndex: numberField(item.orderIndex) ?? 0, dueAt: textField(item.dueAt) || null });
          }
        }
      }
      try { setMappings(await localDb.moodleMappings.list()); } catch { /* discovery still remains useful */ }
      setStatus(normalizedResult.failures.length ? `تم الاكتشاف مع ${normalizedResult.failures.length} خدمة غير متاحة؛ البيانات الناجحة محفوظة وحالتها موضحة.` : `تم اكتشاف ${discoveredUsers.length || normalizedResult.users.length} طالباً و${discoveredGroups.length || normalizedResult.groups.length} مجموعة و${quizCount} اختباراً و${assignmentCount} واجباً و${normalizedResult.sections.length} وحدة، مع ${normalizedResult.tagStats?.needsReview || 0} نشاط يحتاج مراجعة.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "فشل اكتشاف بيانات Moodle"); }
    finally { setBusy(false); }
  };

  const syncResults = async () => {
    setBusy(true); setStatus("جاري سحب إجابات الأنشطة والواجبات من Moodle...");
    try {
      const result = await moodlePost<MoodleSyncResult>({ action: "syncResults" });
      setSyncStats(result);
      setStatus(result.failures.length ? `اكتملت المزامنة جزئياً: ${result.attempts} إجابة و${result.homeworkQuestions} سؤال واجب، مع ${result.failures.length} تحذير.` : `اكتملت المزامنة: ${result.attempts} إجابة نشاط و${result.homeworkSnapshots} Snapshot واجب و${result.homeworkQuestions} سؤال واجب.`);
      await load();
    } catch (error) { setStatus(error instanceof Error ? error.message : "تعذر سحب نتائج Moodle"); }
    finally { setBusy(false); }
  };

  const syncAllResults = async () => {
    setBusy(true); setStatus("جاري سحب نتائج كل المقررات المرتبطة مع الحفاظ على cursor مستقل لكل مقرر...");
    try {
      const maps = await moodlePost<Array<{ moodleCourseId: number }>>({ action: "listCourseMaps" });
      if (!maps.length) throw new Error("لا توجد خرائط مقررات مفعلة؛ نفّذ discovery أولاً");
      let attempts = 0; let homeworkSnapshots = 0; let homeworkQuestions = 0; let changed = 0; let skipped = 0; let requests = 0; const failures: Array<{ scope: string; error: string }> = [];
      for (const map of maps) {
        try { const result = await moodlePost<MoodleSyncResult>({ action: "syncResults", courseId: map.moodleCourseId }); attempts += result.attempts; homeworkSnapshots += result.homeworkSnapshots; homeworkQuestions += result.homeworkQuestions; changed += result.changed ?? 0; skipped += result.skipped ?? 0; requests += result.requests ?? 0; failures.push(...result.failures.map((failure) => ({ scope: `course:${map.moodleCourseId}/${failure.scope}`, error: failure.error }))); } catch (error) { failures.push({ scope: `course:${map.moodleCourseId}`, error: error instanceof Error ? error.message : "فشل مزامنة المقرر" }); }
      }
      setSyncStats({ students: maps.length, attempts, homeworkSnapshots, homeworkQuestions, changed, skipped, requests, failures, mode: "multi-course" });
      setStatus(failures.length ? `اكتملت مزامنة ${maps.length} مقررات مع ${failures.length} تحذير.` : `اكتملت مزامنة ${maps.length} مقررات بنجاح.`);
      await load();
    } catch (error) { setStatus(error instanceof Error ? error.message : "تعذرت مزامنة المقررات"); }
    finally { setBusy(false); }
  };

  const autoLinkStudents = async () => {
    if (!discovery || !config.courseId) return;
    setBusy(true); setStatus("جاري المطابقة التلقائية عبر Moodle User ID ثم username ثم الاسم...");
    let linked = 0;
    try {
      const course = mappings?.courses.find((item) => Number(item.moodleCourseId) === config.courseId);
      const courseMapId = textField(course?.id);
      if (!courseMapId) throw new Error("اكتشف المقرر أولاً لإنشاء خريطة المحتوى");
      for (const item of discoveredUsers) {
        const moodleUserId = numberField(item.id);
        if (!moodleUserId) continue;
        const username = textField(item.username).toLowerCase();
        const name = textField(item.fullname).trim().toLowerCase();
        const match = localStudents.find((student) => student.moodleUserId === moodleUserId || (username && student.moodleUsername?.toLowerCase() === username) || (name && student.name.trim().toLowerCase() === name));
        const groupId = numberField(arrayField(item.groups)[0] && (arrayField(item.groups)[0] as any)?.id);
        if (match) {
          await localDb.students.update(match.id, { moodleUserId, moodleUsername: textField(item.username) || null, moodleCourseId: config.courseId });
          await localDb.moodleMappings.saveStudent({ courseMapId, moodleUserId, moodleGroupId: groupId, studentId: match.id, classId: activeClassId ?? null, moodleUsername: textField(item.username) || null, displayName: textField(item.fullname) || match.name });
          linked += 1;
        } else {
          await localDb.moodleMappings.saveStudent({ courseMapId, moodleUserId, moodleGroupId: groupId, displayName: textField(item.fullname), moodleUsername: textField(item.username) || null });
        }
      }
      setAutoLinked(linked); setMappings(await localDb.moodleMappings.list()); setStatus(`اكتملت المطابقة التلقائية: ${linked} طالباً مطابقاً محلياً، والباقي محفوظ كطلاب Moodle يحتاجون مراجعة.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "تعذر إكمال المطابقة التلقائية"); }
    finally { setBusy(false); }
  };

  const manuallyMapStudent = async (user: Record<string, unknown>) => {
    const moodleUserId = numberField(user.id);
    const studentId = moodleUserId ? manualStudentByMoodle[moodleUserId] : "";
    const student = localStudents.find((item) => item.id === studentId);
    if (!moodleUserId || !student) { setStatus("اختر طالباً محلياً قبل حفظ الربط اليدوي."); return; }
    setBusy(true);
    try {
      const course = mappings?.courses.find((item) => Number(item.moodleCourseId) === config.courseId);
      if (!course?.id) throw new Error("اكتشف المقرر أولاً لإنشاء خريطة الطلاب");
      const groupId = numberField(arrayField(user.groups)[0] && (arrayField(user.groups)[0] as any)?.id);
      await localDb.students.update(student.id, { moodleUserId, moodleUsername: textField(user.username) || null, moodleCourseId: config.courseId });
      await localDb.moodleMappings.saveStudent({ courseMapId: course.id, moodleUserId, moodleGroupId: groupId, studentId: student.id, classId: activeClassId ?? null, moodleUsername: textField(user.username) || null, displayName: textField(user.fullname) || student.name });
      setMappings(await localDb.moodleMappings.list());
      setManualStudentByMoodle((current) => { const next = { ...current }; delete next[moodleUserId]; return next; });
      setStatus(`تم ربط Moodle User ${moodleUserId} بالطالب المحلي «${student.name}».`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "تعذر حفظ الربط اليدوي"); }
    finally { setBusy(false); }
  };

  const mapGroup = async (group: Record<string, unknown>) => {
    const groupId = numberField(group.id);
    const classId = groupId ? selectedClassByGroup[groupId] : "";
    if (!groupId || !classId) { setStatus("اختر الفصل المحلي قبل حفظ ربط المجموعة."); return; }
    setBusy(true);
    try {
      const course = mappings?.courses.find((item) => Number(item.moodleCourseId) === config.courseId);
      if (!course?.id) throw new Error("اكتشف المقرر أولاً");
      await localDb.moodleMappings.saveGroup({ courseMapId: course.id, moodleGroupId: groupId, classId, className: textField(group.name) });
      setMappings(await localDb.moodleMappings.list()); setStatus(`تم ربط مجموعة Moodle «${textField(group.name)}» بالفصل المحلي.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "تعذر حفظ ربط المجموعة"); }
    finally { setBusy(false); }
  };

  const rotateWebhook = async () => {
    setBusy(true); setStatus("جاري إنشاء secret جديد للـwebhook...");
    try {
      const result = await moodlePost<MoodleSafeConfig & { secretForSetup?: string }>({ action: "webhook.rotate" });
      setConfig(result); setWebhookSecret(result.secretForSetup || null); setStatus("تم تفعيل webhook. احفظ secret في Moodle أو الـlocal plugin؛ لن يظهر مرة أخرى بعد مغادرة هذه اللوحة.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "تعذر إنشاء webhook secret"); }
    finally { setBusy(false); }
  };

  const disableWebhook = async () => {
    setBusy(true);
    try { const next = await moodlePost<MoodleSafeConfig>({ action: "webhook.disable" }); setConfig(next); setWebhookSecret(null); setStatus("تم تعطيل webhook، وسيستمر adaptive polling عند الحاجة."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "تعذر تعطيل webhook"); }
    finally { setBusy(false); }
  };

  const clearToken = async () => {
    setBusy(true);
    try { const next = await moodlePost<MoodleSafeConfig>({ action: "config.clearToken" }); setConfig(next); setToken(""); setStatus("تم حذف Token Moodle وتعطيل الاتصال."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "تعذر حذف Token"); }
    finally { setBusy(false); }
  };

  return <div className="h-full min-h-0 overflow-y-auto overscroll-contain" dir="rtl"><div className="space-y-3 p-3 pb-20">
    <section className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /><div><div className="text-xs font-bold">ربط Moodle متعدد الفصول</div><div className="text-[10px] text-muted-foreground">Moodle يشغّل الحل والواجب، وبسالسة تسحب وتحلل فقط.</div></div></div>
      <div className="flex items-center justify-between text-[10px]"><span>الاتصال مفعّل</span><Switch checked={config.enabled} onCheckedChange={(value) => setConfig((current) => ({ ...current, enabled: value }))} /></div>
    </section>
    <section className="rounded-lg border p-3 space-y-2">
      <label className="block text-[10px]">رابط Moodle<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://school.example.com" className="mt-1 h-8 w-full rounded border bg-background px-2 text-xs" /></label>
      <label className="block text-[10px]">Course ID<input value={courseId} onChange={(event) => setCourseId(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="mt-1 h-8 w-full rounded border bg-background px-2 text-xs" /></label>
      <label className="block text-[10px]">مرجع المحتوى المشترك curriculumKey<input value={curriculumKey} onChange={(event) => setCurriculumKey(event.target.value.replace(/[^a-zA-Z0-9._:-]/g, "-"))} placeholder="grade4-math-2026" className="mt-1 h-8 w-full rounded border bg-background px-2 text-xs font-mono" /></label>
      <label className="block text-[10px]">Web Service Token {config.hasToken && <span className="text-emerald-600">(محفوظ)</span>}<input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={config.hasToken ? "اتركه فارغاً للإبقاء على الحالي" : "أدخل Token Moodle"} className="mt-1 h-8 w-full rounded border bg-background px-2 text-xs font-mono" /></label>
      <div className="flex flex-wrap gap-1"><Button size="sm" className="h-8 text-[10px]" onClick={() => void save()} disabled={busy || !baseUrl || !courseId || !curriculumKey}><Shield className="ml-1 h-3 w-3" /> حفظ مشفر</Button><Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={() => void test()} disabled={busy || !config.hasToken}><PlugZap className="ml-1 h-3 w-3" /> اختبار الاتصال</Button>{config.hasToken && <Button size="sm" variant="outline" className="h-8 text-[10px] text-red-600" onClick={() => void clearToken()} disabled={busy}><Trash2 className="ml-1 h-3 w-3" /> حذف Token</Button>}</div>
      {config.hasToken && <div className="rounded border border-sky-200 bg-sky-50 p-2 text-[10px] text-sky-900"><div className="font-bold">ربط فوري اختياري</div><div className="mt-1">الافتراضي adaptive polling منخفض الكلفة. يمكنك تفعيل endpoint موقّع من Moodle local plugin أو Custom App لإرسال الحدث فوراً.</div><div className="mt-1 font-mono text-[9px]">{config.webhookEndpoint || "/api/moodle/webhook"}</div><div className="mt-1 flex flex-wrap gap-1"><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void rotateWebhook()} disabled={busy}>إنشاء/تدوير secret</Button>{config.webhookEnabled && <Button size="sm" variant="outline" className="h-7 text-[10px] text-red-600" onClick={() => void disableWebhook()} disabled={busy}>تعطيل</Button>}</div>{webhookSecret && <div className="mt-1 break-all rounded bg-white p-1 font-mono text-[9px]" dir="ltr">{webhookSecret}</div>}</div>}
    </section>
    {config.enabled && <section className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-bold text-sky-950"><HeartPulse className="h-3.5 w-3.5" /> صحة تكامل Moodle</div><div className="flex gap-1"><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void runProbe()} disabled={busy || !config.hasToken}>فحص الآن</Button><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void reconcile()} disabled={busy || !config.hasToken || !config.courseId}><GitCompare className="ml-1 h-3 w-3" /> مصالحة</Button></div></div>{health && <><div className="grid grid-cols-2 gap-1 text-[10px]"><div className={`rounded p-1.5 ${health.connectionOk ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>الاتصال: <b>{health.connectionOk ? "يعمل" : "غير متاح"}</b><div className="text-[9px]">{health.probe ? `${health.probe.latencyMs}ms` : "لم يُفحص بعد"}</div></div><div className="rounded bg-white p-1.5">آخر sync: <b>{health.lastSyncAt ? new Date(health.lastSyncAt).toLocaleString("ar-EG") : "أبداً"}</b><div className="text-[9px]">{health.lastSyncStatus || "never"}</div></div><div className="rounded bg-white p-1.5">الطلاب: <b>{health.mappedStudents ?? 0}/{health.totalMoodleStudents ?? 0}</b><div className="text-[9px]">غير مربوط: {health.unmappedStudents ?? 0}</div></div><div className="rounded bg-white p-1.5">الأنشطة: <b>{health.mappedActivities ?? 0}/{health.totalMoodleActivities ?? 0}</b><div className="text-[9px]">مراجعة: {health.needsReviewActivities ?? 0}</div></div><div className="rounded bg-white p-1.5">الأحداث: <b>{health.pendingEvents ?? 0}</b><div className="text-[9px]">فشل 24س: {health.failedEvents24h ?? 0}</div></div><div className="rounded bg-white p-1.5">Retry: <b>{health.pendingRetries ?? 0}</b><div className="text-[9px]">نهائي: {health.deadRetries ?? 0}</div></div></div>{health.alerts?.map((alert, index) => <div key={`${alert.message}-${index}`} className={`rounded p-1.5 text-[10px] ${alert.severity === "critical" ? "bg-red-100 text-red-900" : alert.severity === "warning" ? "bg-amber-100 text-amber-900" : "bg-white text-slate-700"}`}>{alert.message}</div>)}</>}</section>}
    {reconcileResult && <section className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-1 text-[10px]"><div className="font-bold">نتيجة آخر مصالحة: {reconcileResult.status === "drift" ? "تغييرات تحتاج مراجعة" : "متوافق"}</div><div>الطلاب: {reconcileResult.students?.total ?? 0} إجمالي، {reconcileResult.students?.missing ?? 0} مفقود، {reconcileResult.students?.newStudents ?? 0} جديد، {reconcileResult.students?.mapped ?? 0} مربوط.</div><div>المجموعات: {reconcileResult.groups?.groupDrift.length ?? 0} تغيير عضوية.</div><div>الأنشطة: {reconcileResult.activities?.newActivities ?? 0} جديد، {reconcileResult.activities?.orphanActivities ?? 0} محذوف من Moodle، {reconcileResult.activities?.drift ?? 0} تغيرت بصمتها.</div>{reconcileResult.failures?.length ? <div className="text-amber-800">تحذيرات: {reconcileResult.failures.map((item) => `${item.resource}: ${item.error}`).join(" | ")}</div> : null}</section>}
    <section className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold"><RefreshCw className="h-3.5 w-3.5" /> اكتشاف ومزامنة أولية</div>
      <p className="text-[10px] text-muted-foreground">تُكتشف المجموعات والطلاب والاختبارات والواجبات مرة واحدة، ثم تُبنى خرائط تلقائية للمحتوى المشترك دون ربط كل سؤال يدوياً.</p>
      <Button size="sm" variant="outline" className="h-8 w-full text-[10px]" onClick={() => void discover()} disabled={busy || !config.hasToken || !config.courseId}><RefreshCw className="ml-1 h-3 w-3" /> اكتشاف Course / Groups / Activities</Button>
      {discovery && <div className="grid grid-cols-2 gap-1 text-[10px]"><div className="rounded bg-secondary/40 p-1.5">الطلاب: <b>{discoveredUsers.length}</b></div><div className="rounded bg-secondary/40 p-1.5">المجموعات: <b>{discoveredGroups.length}</b></div><div className="rounded bg-secondary/40 p-1.5">الوحدات: <b>{discovery.sections.length}</b></div><div className="rounded bg-secondary/40 p-1.5">الأنشطة: <b>{discovery.activities.length}</b></div><div className="rounded bg-secondary/40 p-1.5">اختبارات: <b>{quizCount}</b></div><div className="rounded bg-secondary/40 p-1.5">واجبات: <b>{assignmentCount}</b></div><div className="rounded bg-amber-50 p-1.5 text-amber-800">تحتاج مراجعة: <b>{discovery.tagStats?.needsReview || 0}</b></div><div className="rounded bg-emerald-50 p-1.5 text-emerald-800">وسوم صريحة: <b>{discovery.tagStats?.tagged || 0}</b></div></div>}
      {discovery && <Button size="sm" className="h-8 w-full text-[10px]" onClick={() => void autoLinkStudents()} disabled={busy}><UsersRound className="ml-1 h-3 w-3" /> مطابقة الطلاب تلقائياً {autoLinked ? `(${autoLinked} مكتمل)` : ""}</Button>}
      {discovery && unmappedUsers.length > 0 && <section className="rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-950 space-y-2"><div className="font-bold">طلاب Moodle غير مربوطين — ربط يدوي</div><div className="text-[9px] text-amber-800">الطلاب الجدد لا تُهمل إجاباتهم؛ اربط كل طالب محلياً مرة واحدة، وسيبقى المحتوى مشتركاً بين الفصول.</div><div className="max-h-56 space-y-1 overflow-y-auto">{unmappedUsers.map((user) => { const moodleUserId = numberField(user.id); if (!moodleUserId) return null; return <div key={moodleUserId} className="flex items-center gap-1 rounded border border-amber-200 bg-white p-1.5"><span className="min-w-0 flex-1 truncate">{textField(user.fullname) || `Moodle #${moodleUserId}`}</span><select value={manualStudentByMoodle[moodleUserId] || ""} onChange={(event) => setManualStudentByMoodle((current) => ({ ...current, [moodleUserId]: event.target.value }))} className="h-7 max-w-[45%] rounded border bg-background px-1 text-[10px]"><option value="">اختر الطالب المحلي</option>{localStudents.filter((student) => !student.moodleUserId || student.moodleUserId === moodleUserId).map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select><Button size="sm" className="h-7 text-[10px]" onClick={() => void manuallyMapStudent(user)} disabled={busy || !manualStudentByMoodle[moodleUserId]}>ربط</Button></div>; })}</div></section>}
      <div className="flex gap-1"><Button size="sm" className="h-8 flex-1 text-[10px]" onClick={() => void syncResults()} disabled={busy || !config.hasToken || !config.courseId}><Download className="ml-1 h-3 w-3" /> سحب نتائج المقرر</Button><Button size="sm" variant="outline" className="h-8 flex-1 text-[10px]" onClick={() => void syncAllResults()} disabled={busy || !config.hasToken}><Download className="ml-1 h-3 w-3" /> كل المقررات</Button></div>
      {syncStats && <div className="grid grid-cols-2 gap-1 text-[9px]"><div className="rounded bg-emerald-50 p-1.5 text-emerald-800">إجابات النشاط: <b>{syncStats.attempts}</b></div><div className="rounded bg-emerald-50 p-1.5 text-emerald-800">أسئلة الواجب: <b>{syncStats.homeworkQuestions}</b></div><div className="rounded bg-secondary/40 p-1.5">Snapshots: <b>{syncStats.homeworkSnapshots}</b></div><div className="rounded bg-secondary/40 p-1.5">المتغير: <b>{syncStats.changed ?? 0}</b></div><div className="rounded bg-secondary/40 p-1.5">تخطى القديم: <b>{syncStats.skipped ?? 0}</b></div><div className="rounded bg-secondary/40 p-1.5">طلبات Moodle: <b>{syncStats.requests ?? 0}</b></div><div className="rounded bg-secondary/40 p-1.5">الفاصل التالي: <b>{Math.round((syncStats.nextPollMs ?? 5000) / 1000)}ث</b></div><div className="rounded bg-secondary/40 p-1.5">الطلاب: <b>{syncStats.students}</b></div></div>}
    </section>
    {discovery && discoveredGroups.length > 0 && <section className="rounded-lg border p-3 space-y-2"><div className="text-xs font-bold">ربط Groups بالفصول</div><p className="text-[10px] text-muted-foreground">يتم هذا الربط مرة واحدة لكل Group فقط؛ المحتوى يظل مشتركاً والنتائج تظل معزولة.</p><div className="max-h-60 space-y-1 overflow-y-auto">{discoveredGroups.map((group) => { const groupId = numberField(group.id); if (!groupId) return null; return <div key={groupId} className="flex items-center gap-1 rounded border p-1.5 text-[10px]"><span className="min-w-0 flex-1 truncate">{textField(group.name) || `Group #${groupId}`}</span><select value={selectedClassByGroup[groupId] || ""} onChange={(event) => setSelectedClassByGroup((current) => ({ ...current, [groupId]: event.target.value }))} className="h-7 max-w-[42%] rounded border bg-background px-1 text-[10px]"><option value="">اختر الفصل</option>{localClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button size="sm" className="h-7 text-[10px]" onClick={() => void mapGroup(group)} disabled={busy || !selectedClassByGroup[groupId]}>حفظ</Button></div>; })}</div></section>}
    {arrayField(discovery?.failures).length ? <section className="rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-900">تم حفظ البيانات الناجحة، لكن بعض خدمات Moodle غير متاحة: {arrayField(discovery?.failures).map((item) => { const failure = item as Record<string, unknown>; return `${textField(failure.resource)}: ${textField(failure.error)}`; }).join(" | ")}</section> : null}
    {mappings && <div className="rounded bg-secondary/30 p-2 text-[9px] text-muted-foreground">خرائط محلية: {mappings.courses.length} مقرر، {mappings.groups.length} مجموعة، {mappings.students.length} طالب، {mappings.activities.length} نشاط، {mappings.homeworks.length} واجب. {autoLinked ? `تمت مطابقة ${autoLinked} طالباً.` : ""}</div>}
    <CustomAppPanel />
    {busy && <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> جارٍ تنفيذ طلب المدرس...</div>}
    {status && <div className="rounded bg-secondary/40 p-2 text-[10px]">{status}</div>}
    {config.lastSyncAt && <div className="text-[9px] text-muted-foreground">آخر مزامنة: {new Date(config.lastSyncAt).toLocaleString("ar-EG")} — {config.lastSyncStatus === "ok" ? "ناجحة" : config.lastSyncStatus === "stale" ? "جزئية/قديمة" : config.lastSyncError || "غير مكتملة"}</div>}
  </div></div>;
}
