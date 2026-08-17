import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { decryptMoodleToken, encryptMoodleToken } from "@/lib/moodle-crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate", Pragma: "no-cache", Expires: "0" };
const MAX_URL_LENGTH = 500;

type MoodleHealthProbe = { at: string; ok: boolean; latencyMs: number; error?: string | null };
type MoodleSettings = { enabled: boolean; baseUrl: string; courseId: number | null; curriculumKey?: string; tokenEncrypted?: string; webhookSecretEncrypted?: string; webhookEnabled?: boolean; lastSyncAt?: string | null; lastSyncStatus?: "ok" | "error" | "stale" | null; lastSyncError?: string | null; healthProbe?: MoodleHealthProbe; consecutiveProbeFailures?: number };

type MoodleActivity = { id: number; name: string; activityType: string; sectionId: number | null; sectionKey: string | null; lessonKey: string; ideaKey: string | null; mappingMode: "tag" | "metadata" | "order" | "review"; confidence: number; needsReview: boolean; orderIndex: number; tags: string[]; visible: boolean; dueAt: string | null; fingerprint: string };

type MoodleSection = { id: number; name: string; sectionKey: string; sectionIndex: number; visible: boolean; activities: MoodleActivity[] };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

function cleanBaseUrl(value: unknown) {
  const raw = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  if (!raw || raw.length > MAX_URL_LENGTH || !/^https?:\/\//i.test(raw)) throw new Error("رابط Moodle يجب أن يبدأ بـ http أو https");
  const url = new URL(raw);
  if (url.username || url.password || url.hash) throw new Error("رابط Moodle غير صالح");
  return url.toString().replace(/\/$/, "");
}

async function readSettings(): Promise<Record<string, unknown>> {
  const row = await db.appSettings.findUnique({ where: { id: "singleton" } });
  if (!row?.settingsJson) return {};
  try { const parsed = JSON.parse(row.settingsJson); return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}

async function readMoodle(): Promise<MoodleSettings> {
  const settings = await readSettings();
  const raw = settings.moodle;
  if (!raw || typeof raw !== "object") return { enabled: false, baseUrl: "", courseId: null };
  const value = raw as Record<string, unknown>;
  const probe = value.healthProbe && typeof value.healthProbe === "object" ? value.healthProbe as Record<string, unknown> : undefined;
  return { enabled: value.enabled === true, baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : "", courseId: typeof value.courseId === "number" ? value.courseId : null, curriculumKey: typeof value.curriculumKey === "string" ? value.curriculumKey : undefined, tokenEncrypted: typeof value.tokenEncrypted === "string" ? value.tokenEncrypted : undefined, webhookSecretEncrypted: typeof value.webhookSecretEncrypted === "string" ? value.webhookSecretEncrypted : undefined, webhookEnabled: value.webhookEnabled === true, lastSyncAt: typeof value.lastSyncAt === "string" ? value.lastSyncAt : null, lastSyncStatus: value.lastSyncStatus === "ok" || value.lastSyncStatus === "error" || value.lastSyncStatus === "stale" ? value.lastSyncStatus : null, lastSyncError: typeof value.lastSyncError === "string" ? value.lastSyncError : null, healthProbe: probe && typeof probe.at === "string" && typeof probe.ok === "boolean" && typeof probe.latencyMs === "number" ? { at: probe.at, ok: probe.ok, latencyMs: probe.latencyMs, error: typeof probe.error === "string" ? probe.error : null } : undefined, consecutiveProbeFailures: typeof value.consecutiveProbeFailures === "number" ? value.consecutiveProbeFailures : 0 };
}

function safeMoodle(moodle: MoodleSettings) {
  return { enabled: moodle.enabled, baseUrl: moodle.baseUrl, courseId: moodle.courseId, curriculumKey: moodle.curriculumKey ?? null, hasToken: Boolean(moodle.tokenEncrypted), webhookEnabled: moodle.webhookEnabled === true && Boolean(moodle.webhookSecretEncrypted), webhookEndpoint: "/api/moodle/webhook", lastSyncAt: moodle.lastSyncAt ?? null, lastSyncStatus: moodle.lastSyncStatus ?? null, lastSyncError: moodle.lastSyncError ?? null, healthProbe: moodle.healthProbe ?? null, consecutiveProbeFailures: moodle.consecutiveProbeFailures ?? 0 };
}

async function saveMoodle(next: MoodleSettings) {
  const settings = await readSettings();
  settings.moodle = next;
  await db.appSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", settingsJson: JSON.stringify(settings) }, update: { settingsJson: JSON.stringify(settings) } });
}

function parseObjectJson(value: string | null | undefined): Record<string, unknown> { try { const parsed = value ? JSON.parse(value) : {}; return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}; } catch { return {}; } }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []; }
function tagValues(item: Record<string, unknown>): string[] {
  const raw = [...stringArray(item.tags), ...stringArray((item.customdata as any)?.tags), ...stringArray((item.metadata as any)?.tags)];
  const description = typeof item.description === "string" ? item.description : "";
  const embedded = description.match(/bisalasa:[A-Za-z0-9:_-]+/gi) || [];
  return [...new Set([...raw, ...embedded])];
}
function tagMatch(tags: string[], pattern: RegExp): string | null { return tags.find((tag) => pattern.test(tag)) ?? null; }
function tagParts(tag: string | null, pattern: RegExp): string[] | null { const match = tag?.match(pattern); return match ? match.slice(1) : null; }
function safeSectionKey(value: string, index: number) { const normalized = value.trim().toLowerCase().replace(/[^a-z0-9а-я\u0600-\u06ff]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80); return normalized ? `section-${normalized}` : `section-${index + 1}`; }
function activityFingerprint(item: Record<string, unknown>) { return createHash("sha1").update(JSON.stringify({ id: item.id, name: item.name, visible: item.visible, tags: tagValues(item), timemodified: item.timemodified ?? null, duedate: item.duedate ?? item.dueAt ?? null })).digest("hex"); }
function asActivityRows(payload: unknown, defaultType: string): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];
  const object = payload as Record<string, unknown>;
  const direct = object[defaultType === "quiz" ? "quizzes" : "assignments"];
  if (Array.isArray(direct)) return direct.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (Array.isArray(object.courses)) return object.courses.flatMap((course) => course && typeof course === "object" && Array.isArray((course as any).assignments) ? (course as any).assignments : []).filter((item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  return [];
}

function normalizeDiscovery(contents: unknown[], quizzesPayload: unknown, assignmentsPayload: unknown) {
  const sectionRows = Array.isArray(contents) ? contents.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
  const moduleSection = new Map<number, { id: number; key: string; order: number }>();
  const sections: MoodleSection[] = sectionRows.map((raw, index) => {
    const id = Number(raw.id ?? raw.section ?? index);
    const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : `Section ${index + 1}`;
    const keyTag = tagMatch(tagValues(raw), /(?:^|:)section:([^:]+)/i);
    const sectionKey = tagParts(keyTag, /(?:^|:)section:([^:]+)/i)?.[0] || safeSectionKey(name, index);
    const section = { id: Number.isInteger(id) ? id : index, name, sectionKey, sectionIndex: index, visible: raw.visible !== 0 && raw.visible !== false, activities: [] } satisfies MoodleSection;
    const modules = Array.isArray(raw.modules) ? raw.modules : [];
    modules.forEach((module, moduleIndex) => { const moduleId = Number((module as any)?.instance ?? (module as any)?.id); if (Number.isInteger(moduleId)) moduleSection.set(moduleId, { id: section.id, key: section.sectionKey, order: moduleIndex }); });
    return section;
  });
  if (!sections.length) sections.push({ id: 0, name: "Course activities", sectionKey: "section-1", sectionIndex: 0, visible: true, activities: [] });
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const rows: Record<string, unknown>[] = [...asActivityRows(quizzesPayload, "quiz").map((item: Record<string, unknown>) => ({ ...item, activityType: "quiz" })), ...asActivityRows(assignmentsPayload, "assignment").map((item: Record<string, unknown>) => ({ ...item, activityType: "assignment" }))];
  const activities: MoodleActivity[] = rows.map((item, rowIndex) => {
    const id = Number(item.id);
    const tags = tagValues(item);
    const ideaTag = tagMatch(tags, /(?:^|:)idea:([^:]+):([^:]+)/i);
    const lessonTag = tagMatch(tags, /(?:^|:)lesson:([^:]+)/i) || tagMatch(tags, /(?:^|:)homework:([^:]+)/i);
    const sectionTag = tagMatch(tags, /(?:^|:)section:([^:]+)/i);
    const orderTag = tagMatch(tags, /(?:^|:)order:(\d+)/i);
    const idea = tagParts(ideaTag, /(?:^|:)idea:([^:]+):([^:]+)/i);
    const lesson = tagParts(lessonTag, /(?:^|:)(?:lesson|homework):([^:]+)/i);
    const sectionFromModule = moduleSection.get(id);
    const taggedSection = sectionTag ? sections.find((section) => section.sectionKey === `section-${tagParts(sectionTag, /(?:^|:)section:([^:]+)/i)?.[0]}` || section.name === sectionTag) : null;
    const section = taggedSection || (sectionFromModule ? sectionById.get(sectionFromModule.id) : null) || sections[Math.min(rowIndex, sections.length - 1)];
    const metadata = item as any;
    const metadataLesson = typeof metadata.lessonKey === "string" ? metadata.lessonKey.trim() : "";
    const metadataIdea = typeof metadata.ideaKey === "string" ? metadata.ideaKey.trim() : "";
    const mappingMode: MoodleActivity["mappingMode"] = idea ? "tag" : metadataLesson || metadataIdea ? "metadata" : section ? "order" : "review";
    const confidence = idea ? 1 : metadataLesson || metadataIdea ? 0.9 : section ? 0.65 : 0.35;
    const activity: MoodleActivity = { id: Number.isInteger(id) ? id : rowIndex + 1, name: typeof item.name === "string" ? item.name : `Activity ${rowIndex + 1}`, activityType: String(item.activityType || "quiz"), sectionId: section?.id ?? null, sectionKey: section?.sectionKey ?? null, lessonKey: lesson?.[0] || idea?.[0] || metadataLesson || section?.sectionKey || "lesson-unmapped", ideaKey: idea?.[1] || metadataIdea || null, mappingMode, confidence, needsReview: confidence < 0.6, orderIndex: Number(tagParts(orderTag, /(?:^|:)order:(\d+)/i)?.[0] || sectionFromModule?.order || rowIndex), tags, visible: item.visible === true || item.visible === 1, dueAt: item.duedate || item.dueAt ? new Date(Number(item.duedate || item.dueAt) * (Number(item.duedate || item.dueAt) < 2_000_000_000 ? 1000 : 1)).toISOString() : null, fingerprint: activityFingerprint(item) };
    if (section) section.activities.push(activity);
    return activity;
  });
  sections.forEach((section) => section.activities.sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id));
  const tagged = activities.filter((activity) => activity.mappingMode === "tag").length;
  const inferred = activities.filter((activity) => activity.mappingMode === "metadata" || activity.mappingMode === "order").length;
  return { sections, activities, tagStats: { tagged, inferred, needsReview: activities.filter((activity) => activity.needsReview).length } };
}

async function moodleRequest(moodle: MoodleSettings, functionName: string, params: Record<string, string | number | Array<string | number>> = {}) {
  if (!moodle.baseUrl || !moodle.tokenEncrypted) throw new Error("أكمل إعداد رابط Moodle وToken أولاً");
  const token = await decryptMoodleToken(moodle.tokenEncrypted);
  const url = new URL(`${moodle.baseUrl}/webservice/rest/server.php`);
  url.searchParams.set("wstoken", token);
  url.searchParams.set("wsfunction", functionName);
  url.searchParams.set("moodlewsrestformat", "json");
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item, index) => url.searchParams.set(`${key}[${index}]`, String(item)));
    else url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.exception || payload?.errorcode) throw new Error(typeof payload?.message === "string" ? payload.message.slice(0, 240) : `Moodle HTTP ${response.status}`);
  return payload;
}

export async function GET() {
  try { return json({ ok: true, data: safeMoodle(await readMoodle()) }); }
  catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : "تعذر قراءة إعدادات Moodle" }, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "config.get";
    if (action === "config.get") return json({ ok: true, data: safeMoodle(await readMoodle()) });
    if (action === "config.save") {
      const previous = await readMoodle();
      const baseUrl = body.baseUrl ? cleanBaseUrl(body.baseUrl) : previous.baseUrl;
      const courseIdRaw = Number(body.courseId);
      const courseId = Number.isInteger(courseIdRaw) && courseIdRaw > 0 ? courseIdRaw : previous.courseId;
      const token = typeof body.token === "string" ? body.token.trim() : "";
      const curriculumKey = typeof body.curriculumKey === "string" && body.curriculumKey.trim() ? body.curriculumKey.trim().slice(0, 160) : previous.curriculumKey;
      const next: MoodleSettings = { ...previous, enabled: body.enabled === true, baseUrl, courseId, curriculumKey, webhookEnabled: body.webhookEnabled === true ? true : previous.webhookEnabled === true, tokenEncrypted: token ? await encryptMoodleToken(token) : previous.tokenEncrypted, lastSyncError: null };
      await saveMoodle(next);
      return json({ ok: true, data: safeMoodle(next) });
    }
    if (action === "config.reset") {
      const settings = await readSettings();
      delete settings.moodle;
      await db.appSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", settingsJson: JSON.stringify(settings) }, update: { settingsJson: JSON.stringify(settings) } });
      return json({ ok: true, data: safeMoodle({ enabled: false, baseUrl: "", courseId: null }) });
    }
    if (action === "webhook.rotate") {
      const current = await readMoodle();
      const secret = randomBytes(32).toString("hex");
      const next = { ...current, webhookEnabled: true, webhookSecretEncrypted: await encryptMoodleToken(secret) };
      await saveMoodle(next);
      return json({ ok: true, data: { ...safeMoodle(next), secretForSetup: secret } });
    }
    if (action === "webhook.disable") {
      const current = await readMoodle();
      const next = { ...current, webhookEnabled: false };
      await saveMoodle(next);
      return json({ ok: true, data: safeMoodle(next) });
    }
    if (action === "config.clearToken") {
      const current = await readMoodle();
      const next = { ...current, tokenEncrypted: undefined, enabled: false };
      await saveMoodle(next);
      return json({ ok: true, data: safeMoodle(next) });
    }
    if (action === "test") {
      const moodle = await readMoodle();
      const info = await moodleRequest(moodle, "core_webservice_get_site_info");
      return json({ ok: true, data: { connected: true, siteName: typeof info?.sitename === "string" ? info.sitename : "Moodle", userId: info?.userid ?? null } });
    }
    if (action === "discover") {
      const moodle = await readMoodle();
      if (!moodle.courseId) return json({ ok: false, error: "أدخل Course ID أولاً" }, 400);
      const courseId = moodle.courseId;
      const failures: Array<{ resource: string; error: string }> = [];
      const bestEffort = async <T>(resource: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await fn(); } catch (error) { failures.push({ resource, error: error instanceof Error ? error.message : "تعذر السحب" }); return fallback; }
      };
      const courses = await bestEffort("courses", () => moodleRequest(moodle, "core_course_get_courses"), [] as unknown[]);
      const groups = await bestEffort("groups", () => moodleRequest(moodle, "core_group_get_course_groups", { courseid: courseId }), [] as unknown[]);
      const users = await bestEffort("students", () => moodleRequest(moodle, "core_enrol_get_enrolled_users", { courseid: courseId }), [] as unknown[]);
      const contents = await bestEffort("sections", () => moodleRequest(moodle, "core_course_get_contents", { courseid: courseId }), [] as unknown[]);
      const quizzes = await bestEffort("quizzes", () => moodleRequest(moodle, "mod_quiz_get_quizzes_by_courses", { courseids: [courseId] }), { quizzes: [] });
      const assignments = await bestEffort("assignments", () => moodleRequest(moodle, "mod_assign_get_assignments", { courseids: [courseId] }), { courses: [] });
      const normalized = normalizeDiscovery(contents, quizzes, assignments);
      const next = { ...moodle, lastSyncAt: new Date().toISOString(), lastSyncStatus: failures.length === 0 ? "ok" as const : "stale" as const, lastSyncError: failures.length ? failures.map((item) => `${item.resource}: ${item.error}`).join(" | ").slice(0, 240) : null };
      await saveMoodle(next);
      return json({ ok: true, data: { courseId, courses, sections: normalized.sections, activities: normalized.activities, groups, users, quizzes, assignments, tagStats: normalized.tagStats, failures, sampledAt: next.lastSyncAt } });
    }
    if (action === "probe") {
      const moodle = await readMoodle();
      if (!moodle.enabled || !moodle.baseUrl || !moodle.tokenEncrypted) return json({ ok: true, data: { enabled: false, ok: false, at: new Date().toISOString(), latencyMs: 0, consecutiveFailures: 0, error: "Moodle غير مفعّل أو Token غير موجود" } });
      const started = Date.now();
      let probeOk = false;
      let error: string | null = null;
      try { await moodleRequest(moodle, "core_webservice_get_site_info"); probeOk = true; } catch (probeError) { error = probeError instanceof Error ? probeError.message.slice(0, 240) : "فشل فحص الاتصال"; }
      const at = new Date().toISOString();
      const consecutiveFailures = probeOk ? 0 : (moodle.consecutiveProbeFailures || 0) + 1;
      await saveMoodle({ ...moodle, healthProbe: { at, ok: probeOk, latencyMs: Date.now() - started, error }, consecutiveProbeFailures: consecutiveFailures });
      return json({ ok: true, data: { enabled: true, ok: probeOk, at, latencyMs: Date.now() - started, consecutiveFailures, error } });
    }
    if (action === "health") {
      const moodle = await readMoodle();
      if (!moodle.enabled) return json({ ok: true, data: { enabled: false, alerts: [] } });
      const courseMap = moodle.courseId ? await db.moodleCourseMap.findFirst({ where: { moodleCourseId: moodle.courseId }, orderBy: { updatedAt: "desc" } }) : null;
      const cursor = courseMap ? await db.moodleSyncCursor.findUnique({ where: { scopeKey: `results:${courseMap.id}` } }) : null;
      const metadata = parseObjectJson(courseMap?.metadataJson);
      const mappedStudents = courseMap ? await db.moodleStudentMap.count({ where: { courseMapId: courseMap.id, enabled: true } }) : 0;
      const totalStudents = Number(metadata.totalMoodleStudents) || mappedStudents;
      const mappedActivities = courseMap ? await db.moodleActivityMap.count({ where: { courseMapId: courseMap.id, visible: true } }) : 0;
      const totalActivities = Number(metadata.totalMoodleActivities) || mappedActivities;
      const pendingEvents = moodle.courseId ? await db.moodleSyncEvent.count({ where: { courseId: moodle.courseId, status: { in: ["accepted", "pending-validation"] } } }) : 0;
      const failedEvents24h = moodle.courseId ? await db.moodleSyncEvent.count({ where: { courseId: moodle.courseId, status: { in: ["failed", "pending-validation"] }, receivedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }) : 0;
      const pendingRetries = await db.moodleSyncRetry.count({ where: { status: { in: ["pending", "retrying"] } } });
      const deadRetries = await db.moodleSyncRetry.count({ where: { status: "dead" } });
      const recentEvents = moodle.courseId ? await db.moodleSyncEvent.findMany({ where: { courseId: moodle.courseId }, orderBy: { receivedAt: "desc" }, take: 100, select: { status: true } }) : [];
      const successfulEvents = recentEvents.filter((event) => event.status === "processed").length;
      const webhookSuccessRate = recentEvents.length ? Math.round((successfulEvents / recentEvents.length) * 100) : 100;
      const alerts: Array<{ severity: "critical" | "warning" | "info"; message: string }> = [];
      const connectionOk = moodle.healthProbe?.ok === true;
      if (!connectionOk) alerts.push({ severity: "critical", message: "Moodle لا يستجيب في آخر health probe" });
      if ((moodle.consecutiveProbeFailures || 0) >= 3) alerts.push({ severity: "critical", message: `${moodle.consecutiveProbeFailures} فحوص اتصال متتالية فاشلة` });
      if (failedEvents24h > 5) alerts.push({ severity: "warning", message: `${failedEvents24h} حدث يحتاج تحققاً في آخر 24 ساعة` });
      if (pendingRetries > 0 || deadRetries > 0) alerts.push({ severity: deadRetries > 0 ? "critical" : "warning", message: `${pendingRetries} retry معلّق و${deadRetries} retry نهائي` });
      if ((courseMap?.reconcileStatus || "never") === "drift") alerts.push({ severity: "warning", message: "تم اكتشاف تغيّر في طلاب أو أنشطة Moodle ويحتاج مراجعة" });
      return json({ ok: true, data: { enabled: true, connectionOk, lastProbeAt: moodle.healthProbe?.at || null, probe: moodle.healthProbe || null, lastSyncAt: cursor?.lastSyncAt?.toISOString() || moodle.lastSyncAt || null, lastSyncStatus: cursor?.status || moodle.lastSyncStatus || "never", mappedStudents, totalMoodleStudents: totalStudents, unmappedStudents: Math.max(0, totalStudents - mappedStudents), mappedActivities, totalMoodleActivities: totalActivities, needsReviewActivities: courseMap ? await db.moodleActivityMap.count({ where: { courseMapId: courseMap.id, needsReview: true } }) : 0, pendingEvents, failedEvents24h, pendingRetries, deadRetries, webhookSuccessRate, reconcileStatus: courseMap?.reconcileStatus || "never", lastReconciledAt: courseMap?.lastReconciledAt?.toISOString() || null, alerts } });
    }
    if (action === "reconcile") {
      const moodle = await readMoodle();
      if (!moodle.courseId) return json({ ok: false, error: "أدخل Course ID أولاً" }, 400);
      const courseMap = await db.moodleCourseMap.findFirst({ where: { moodleCourseId: moodle.courseId }, orderBy: { updatedAt: "desc" } });
      if (!courseMap) return json({ ok: false, error: "نفّذ اكتشاف Moodle أولاً لإنشاء خريطة المقرر" }, 400);
      const failures: Array<{ resource: string; error: string }> = [];
      let remoteUsers: any[] = [];
      let remoteContents: any[] = [];
      let remoteQuizzes: unknown = { quizzes: [] };
      let remoteAssignments: unknown = { courses: [] };
      let remoteGroups: any[] = [];
      try { const payload = await moodleRequest(moodle, "core_enrol_get_enrolled_users", { courseid: moodle.courseId }); remoteUsers = Array.isArray(payload) ? payload : []; } catch (error) { failures.push({ resource: "students", error: error instanceof Error ? error.message : "تعذر سحب الطلاب" }); }
      try { const payload = await moodleRequest(moodle, "core_course_get_contents", { courseid: moodle.courseId }); remoteContents = Array.isArray(payload) ? payload : []; } catch (error) { failures.push({ resource: "sections", error: error instanceof Error ? error.message : "تعذر سحب الوحدات" }); }
      try { remoteQuizzes = await moodleRequest(moodle, "mod_quiz_get_quizzes_by_courses", { courseids: [moodle.courseId] }); } catch (error) { failures.push({ resource: "quizzes", error: error instanceof Error ? error.message : "تعذر سحب الاختبارات" }); }
      try { remoteAssignments = await moodleRequest(moodle, "mod_assign_get_assignments", { courseids: [moodle.courseId] }); } catch (error) { failures.push({ resource: "assignments", error: error instanceof Error ? error.message : "تعذر سحب الواجبات" }); }
      try { const payload = await moodleRequest(moodle, "core_group_get_course_groups", { courseid: moodle.courseId }); remoteGroups = Array.isArray(payload) ? payload : []; } catch (error) { failures.push({ resource: "groups", error: error instanceof Error ? error.message : "تعذر سحب المجموعات" }); }
      const normalized = normalizeDiscovery(remoteContents, remoteQuizzes, remoteAssignments);
      const now = new Date();
      const localStudents = await db.moodleStudentMap.findMany({ where: { courseMapId: courseMap.id } });
      const remoteStudentIds = new Set(remoteUsers.map((item) => Number(item?.id)).filter((id) => Number.isInteger(id)));
      const missingStudents = localStudents.filter((item) => !remoteStudentIds.has(item.moodleUserId));
      const newStudents = remoteUsers.filter((item) => Number.isInteger(Number(item?.id)) && !localStudents.some((local) => local.moodleUserId === Number(item.id))).map((item) => ({ moodleUserId: Number(item.id), name: typeof item.fullname === "string" ? item.fullname : "", username: typeof item.username === "string" ? item.username : null }));
      const groupDrift: Array<{ moodleUserId: number; previousGroupId: number | null; currentGroupId: number | null }> = [];
      if (!failures.some((failure) => failure.resource === "students")) {
        for (const local of localStudents) {
          const remote = remoteUsers.find((item) => Number(item?.id) === local.moodleUserId);
          if (!remote) await db.moodleStudentMap.update({ where: { id: local.id }, data: { enabled: false, metadataJson: JSON.stringify({ ...parseObjectJson(local.metadataJson), missingInMoodleAt: now.toISOString() }) } });
          else {
            const remoteGroupId = Number((Array.isArray(remote.groups) ? remote.groups[0] : null)?.id);
            const currentGroupId = Number.isInteger(remoteGroupId) && remoteGroupId > 0 ? remoteGroupId : null;
            if (currentGroupId !== (local.moodleGroupId ?? null)) groupDrift.push({ moodleUserId: local.moodleUserId, previousGroupId: local.moodleGroupId ?? null, currentGroupId });
            await db.moodleStudentMap.update({ where: { id: local.id }, data: { enabled: true, moodleGroupId: currentGroupId, moodleUsername: typeof remote.username === "string" ? remote.username : local.moodleUsername, displayName: typeof remote.fullname === "string" ? remote.fullname : local.displayName, lastSeenAt: now, metadataJson: JSON.stringify({ ...parseObjectJson(local.metadataJson), lastReconciledAt: now.toISOString(), groupDrift: currentGroupId !== (local.moodleGroupId ?? null) }) } });
          }
        }
      }
      const localActivities = await db.moodleActivityMap.findMany({ where: { courseMapId: courseMap.id } });
      const remoteActivityByKey = new Map(normalized.activities.map((item) => [`${item.id}:${item.activityType}`, item]));
      const localActivityKeys = new Set(localActivities.map((item) => `${item.moodleActivityId}:${item.activityType}`));
      const newActivities = normalized.activities.filter((item) => !localActivityKeys.has(`${item.id}:${item.activityType}`));
      const orphanActivities = localActivities.filter((item) => !remoteActivityByKey.has(`${item.moodleActivityId}:${item.activityType}`));
      const driftActivities: Array<{ id: string; moodleActivityId: number; oldFingerprint: string | null; newFingerprint: string }> = [];
      if (!failures.some((failure) => ["sections", "quizzes", "assignments"].includes(failure.resource))) {
        for (const local of localActivities) {
          const remote = remoteActivityByKey.get(`${local.moodleActivityId}:${local.activityType}`);
          if (!remote) {
            await db.moodleActivityMap.update({ where: { id: local.id }, data: { visible: false, needsReview: true, metadataJson: JSON.stringify({ ...parseObjectJson(local.metadataJson), missingInMoodleAt: now.toISOString() }) } });
          } else if (local.sourceFingerprint && local.sourceFingerprint !== remote.fingerprint) {
            driftActivities.push({ id: local.id, moodleActivityId: local.moodleActivityId, oldFingerprint: local.sourceFingerprint, newFingerprint: remote.fingerprint });
            await db.moodleActivityMap.update({ where: { id: local.id }, data: { name: remote.name, visible: remote.visible, lastSeenAt: now, sourceFingerprint: remote.fingerprint, needsReview: true, metadataJson: JSON.stringify({ ...parseObjectJson(local.metadataJson), fingerprintChanged: true, oldFingerprint: local.sourceFingerprint, newFingerprint: remote.fingerprint, driftDetectedAt: now.toISOString() }) } });
          } else {
            await db.moodleActivityMap.update({ where: { id: local.id }, data: { name: remote.name, visible: remote.visible, lastSeenAt: now, sourceFingerprint: remote.fingerprint } });
          }
        }
      }
      const drift = missingStudents.length > 0 || newStudents.length > 0 || newActivities.length > 0 || orphanActivities.length > 0 || groupDrift.length > 0 || driftActivities.length > 0;
      await db.moodleCourseMap.update({ where: { id: courseMap.id }, data: { lastReconciledAt: now, lastGroupSyncAt: now, reconcileStatus: drift ? "drift" : "ok", metadataJson: JSON.stringify({ ...parseObjectJson(courseMap.metadataJson), totalMoodleStudents: remoteUsers.length, totalMoodleActivities: normalized.activities.length, lastReconcile: { missingStudents: missingStudents.length, newStudents: newStudents.length, newActivities: newActivities.length, orphanActivities: orphanActivities.length, groupDrift: groupDrift.length, driftActivities: driftActivities.length, at: now.toISOString() } }) } });
      return json({ ok: true, data: { courseId: moodle.courseId, status: drift ? "drift" : "ok", sampledAt: now.toISOString(), failures, students: { total: remoteUsers.length, mapped: localStudents.filter((item) => item.enabled && remoteStudentIds.has(item.moodleUserId)).length, missing: missingStudents.length, newStudents: newStudents.length, missingList: missingStudents.slice(0, 50).map((item) => ({ moodleUserId: item.moodleUserId, displayName: item.displayName, studentId: item.studentId })), newStudentsList: newStudents.slice(0, 50) }, groups: { total: remoteGroups.length, groupDrift: groupDrift.slice(0, 50) }, activities: { total: normalized.activities.length, mapped: localActivities.length, newActivities: newActivities.length, orphanActivities: orphanActivities.length, drift: driftActivities.length, newActivitiesList: newActivities.slice(0, 50), orphanActivitiesList: orphanActivities.slice(0, 50).map((item) => ({ id: item.moodleActivityId, name: item.name })), driftList: driftActivities.slice(0, 50) } } });
    }
    if (action === "syncGroups") {
      const moodle = await readMoodle();
      if (!moodle.courseId) return json({ ok: false, error: "أدخل Course ID أولاً" }, 400);
      const courseMap = await db.moodleCourseMap.findFirst({ where: { moodleCourseId: moodle.courseId, enabled: true }, orderBy: { updatedAt: "desc" } });
      if (!courseMap) return json({ ok: false, error: "نفّذ اكتشاف Moodle أولاً" }, 400);
      const users = await moodleRequest(moodle, "core_enrol_get_enrolled_users", { courseid: moodle.courseId });
      const localMaps = await db.moodleStudentMap.findMany({ where: { courseMapId: courseMap.id } });
      const drift: Array<{ moodleUserId: number; previousGroupId: number | null; currentGroupId: number | null }> = [];
      const now = new Date();
      for (const local of localMaps) {
        const remote = Array.isArray(users) ? users.find((item: any) => Number(item?.id) === local.moodleUserId) : null;
        if (!remote) continue;
        const remoteGroupId = Number((Array.isArray(remote.groups) ? remote.groups[0] : null)?.id);
        const currentGroupId = Number.isInteger(remoteGroupId) && remoteGroupId > 0 ? remoteGroupId : null;
        if (currentGroupId !== (local.moodleGroupId ?? null)) drift.push({ moodleUserId: local.moodleUserId, previousGroupId: local.moodleGroupId ?? null, currentGroupId });
        await db.moodleStudentMap.update({ where: { id: local.id }, data: { moodleGroupId: currentGroupId, lastSeenAt: now, metadataJson: JSON.stringify({ ...parseObjectJson(local.metadataJson), lastGroupSyncAt: now.toISOString(), groupChanged: currentGroupId !== (local.moodleGroupId ?? null) }) } });
      }
      await db.moodleCourseMap.update({ where: { id: courseMap.id }, data: { lastGroupSyncAt: now } });
      return json({ ok: true, data: { courseId: moodle.courseId, syncedAt: now.toISOString(), changed: drift.length, drift } });
    }
    if (action === "listCourseMaps") {
      const maps = await db.moodleCourseMap.findMany({ where: { enabled: true }, orderBy: { updatedAt: "desc" }, select: { id: true, moodleCourseId: true, curriculumKey: true, label: true, lastReconciledAt: true, reconcileStatus: true } });
      return json({ ok: true, data: maps.map((map) => ({ ...map, lastReconciledAt: map.lastReconciledAt?.toISOString() || null })) });
    }
    if (action === "syncResults") {
      const moodle = await readMoodle();
      const requestedCourseId = Number(body.courseId);
      const targetCourseId = Number.isInteger(requestedCourseId) && requestedCourseId > 0 ? requestedCourseId : moodle.courseId;
      if (!targetCourseId) return json({ ok: false, error: "أدخل Course ID أولاً" }, 400);
      const courseMap = await db.moodleCourseMap.findFirst({ where: { moodleCourseId: targetCourseId, enabled: true }, orderBy: { updatedAt: "desc" } });
      if (!courseMap) return json({ ok: false, error: "نفّذ اكتشاف Moodle أولاً لإنشاء خريطة المقرر" }, 400);
      const studentMaps = await db.moodleStudentMap.findMany({ where: { courseMapId: courseMap.id, enabled: true }, take: 5000 });
      const activityMaps = await db.moodleActivityMap.findMany({ where: { courseMapId: courseMap.id }, take: 5000 });
      const homeworkMaps = await db.moodleHomeworkMap.findMany({ where: { courseMapId: courseMap.id, enabled: true }, take: 5000 });
      const cursorScope = `results:${courseMap.id}`;
      const syncCursor = await db.moodleSyncCursor.findUnique({ where: { scopeKey: cursorScope } });
      const cursorDate = syncCursor?.lastCursor ? new Date(syncCursor.lastCursor) : null;
      let previousAttemptKeys = new Set<string>();
      try { const parsed = JSON.parse(syncCursor?.metadataJson || "{}"); previousAttemptKeys = new Set(Array.isArray(parsed.attemptKeys) ? parsed.attemptKeys.filter((value: unknown): value is string => typeof value === "string") : []); } catch {}
      const questionMaps = await db.moodleQuestionMap.findMany({ where: { activityMapId: { in: activityMaps.map((item) => item.id) } } });
      const failures: Array<{ scope: string; error: string }> = [];
      let attemptCount = 0;
      let homeworkSnapshotCount = 0;
      let homeworkQuestionCount = 0;
      let changedCount = 0;
      let skippedCount = 0;
      let requestCount = 0;
      let latestChangedAt = cursorDate;
      const overlapMs = 5000;
      const asNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : Number(value);
      const asDate = (value: unknown) => { const numeric = asNumber(value); if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric < 2_000_000_000 ? numeric * 1000 : numeric); if (typeof value === "string" && value) return new Date(value); return null; };
      const getAttemptRows = (payload: unknown) => { const value = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}; return Array.isArray(value.attempts) ? value.attempts : Array.isArray(payload) ? payload : []; };
      const getQuestionRows = (attempt: any, review: any) => { const source = review?.questions || review?.items || attempt?.questions || attempt?.items; return Array.isArray(source) ? source : []; };
      for (const student of studentMaps) {
        for (const activity of activityMaps) {
          try {
            requestCount += 1;
            const attemptsPayload = await moodleRequest(moodle, "mod_quiz_get_user_attempts", { quizid: activity.moodleActivityId, userid: student.moodleUserId });
            const attempts = getAttemptRows(attemptsPayload);
            if (!attempts.length) { skippedCount += 1; continue; }
            const latest = attempts[attempts.length - 1] as any;
            const latestAt = asDate(latest?.timemodified ?? latest?.timefinish);
            const attemptKey = `quiz:${activity.id}:${student.moodleUserId}:${String(latest.id || latestAt?.toISOString() || "none")}`;
            if (previousAttemptKeys.has(attemptKey) || (cursorDate && latestAt && latestAt.getTime() <= cursorDate.getTime() - overlapMs)) { skippedCount += 1; continue; }
            previousAttemptKeys.add(attemptKey);
            if (latestAt && (!latestChangedAt || latestAt > latestChangedAt)) latestChangedAt = latestAt;
            changedCount += 1;
            let review: any = null;
            try { requestCount += 1; review = await moodleRequest(moodle, "mod_quiz_get_attempt_review", { attemptid: Number(latest.id) }); } catch {}
            const ideaKey = activity.ideaKey || "lesson_unmapped";
            const ideaRun = await db.ideaRun.findFirst({ where: { sessionId: null, curriculumKey: activity.curriculumKey, lessonKey: activity.lessonKey, ideaKey, activityMapId: activity.id, status: "active" }, orderBy: { startedAt: "desc" } }) || await db.ideaRun.create({ data: { curriculumKey: activity.curriculumKey, lessonKey: activity.lessonKey, ideaKey, activityMapId: activity.id, status: "active" } });
            for (const rawQuestion of getQuestionRows(latest, review)) {
              const question = rawQuestion as Record<string, unknown>;
              const moodleQuestionId = Number(question.questionid ?? question.id ?? question.slot);
              if (!Number.isInteger(moodleQuestionId)) continue;
              const mapping = questionMaps.find((item) => item.moodleQuestionId === moodleQuestionId && item.activityMapId === activity.id);
              const isCorrect = typeof question.correct === "boolean" ? question.correct : typeof question.iscorrect === "boolean" ? question.iscorrect : typeof question.state === "string" ? question.state === "gradedright" : null;
              await db.ideaQuestionAttempt.upsert({ where: { ideaRunId_moodleUserId_moodleQuestionId_moodleAttemptId: { ideaRunId: ideaRun.id, moodleUserId: student.moodleUserId, moodleQuestionId, moodleAttemptId: Number(latest.id) || 0 } }, create: { ideaRunId: ideaRun.id, questionMapId: mapping?.id ?? null, studentId: student.studentId, moodleUserId: student.moodleUserId, moodleAttemptId: Number(latest.id) || 0, moodleQuestionId, studentAnswer: typeof question.answer === "string" ? question.answer : typeof question.response === "string" ? question.response : null, isCorrect, pointsEarned: asNumber(question.points ?? question.mark) || 0, status: isCorrect === null ? "pending" : "answered", startedAt: asDate(latest.timestart), submittedAt: asDate(latest.timefinish), metadataJson: JSON.stringify({ source: "moodle", activityId: activity.moodleActivityId, tag: mapping?.tag ?? null }) }, update: { questionMapId: mapping?.id ?? null, studentAnswer: typeof question.answer === "string" ? question.answer : typeof question.response === "string" ? question.response : null, isCorrect, pointsEarned: asNumber(question.points ?? question.mark) || 0, status: isCorrect === null ? "pending" : "answered", submittedAt: asDate(latest.timefinish), metadataJson: JSON.stringify({ source: "moodle", activityId: activity.moodleActivityId, tag: mapping?.tag ?? null }) } });
              attemptCount += 1;
            }
          } catch (error) { failures.push({ scope: `quiz:${activity.moodleActivityId}/user:${student.moodleUserId}`, error: error instanceof Error ? error.message : "فشل سحب المحاولة" }); }
        }
        for (const homework of homeworkMaps) {
          try {
            requestCount += 1;
            const payload = await moodleRequest(moodle, homework.activityType === "assignment" ? "mod_assign_get_submissions" : "mod_quiz_get_user_attempts", homework.activityType === "assignment" ? { assignmentids: [homework.moodleActivityId], userids: [student.moodleUserId] } : { quizid: homework.moodleActivityId, userid: student.moodleUserId });
            const rows = homework.activityType === "assignment" ? (((payload as any)?.assignments || [])[0]?.submissions || []) : getAttemptRows(payload);
            const latest = rows.length ? rows[rows.length - 1] as any : null;
            const latestAt = asDate(latest?.timemodified ?? latest?.timefinish);
            const submissionKey = `homework:${homework.id}:${student.moodleUserId}:${String(latest?.id || latestAt?.toISOString() || "none")}`;
            if (previousAttemptKeys.has(submissionKey) || (cursorDate && latestAt && latestAt.getTime() <= cursorDate.getTime() - overlapMs)) { skippedCount += 1; continue; }
            previousAttemptKeys.add(submissionKey);
            if (latest) changedCount += 1;
            if (latestAt && (!latestChangedAt || latestAt > latestChangedAt)) latestChangedAt = latestAt;
            const questions = latest ? getQuestionRows(latest, null) : [];
            const totalQuestions = Number(latest?.questioncount ?? latest?.totalquestions ?? questions.length ?? 0) || 0;
            const answeredQuestions = questions.filter((question: any) => question.answer != null || question.response != null || question.isanswered === true).length;
            const correctQuestions = questions.filter((question: any) => question.correct === true || question.iscorrect === true || question.state === "gradedright").length;
            const wrongQuestions = Math.max(0, answeredQuestions - correctQuestions);
            const snapshot = await db.homeworkSnapshot.upsert({ where: { homeworkMapId_moodleUserId: { homeworkMapId: homework.id, moodleUserId: student.moodleUserId } }, create: { homeworkMapId: homework.id, studentId: student.studentId, moodleUserId: student.moodleUserId, moodleSubmissionId: latest?.id ? Number(latest.id) : null, status: latest ? "submitted" : "not_submitted", totalQuestions, answeredQuestions, unansweredQuestions: Math.max(0, totalQuestions - answeredQuestions), correctQuestions, wrongQuestions, completionPct: totalQuestions ? Math.round((answeredQuestions / totalQuestions) * 10000) / 100 : 0, successOnAnsweredPct: answeredQuestions ? Math.round((correctQuestions / answeredQuestions) * 10000) / 100 : null, successOnTotalPct: totalQuestions ? Math.round((correctQuestions / totalQuestions) * 10000) / 100 : null, moodleGrade: typeof latest?.grade === "number" ? latest.grade : null, moodleMaxGrade: typeof latest?.maxgrade === "number" ? latest.maxgrade : null, submittedAt: asDate(latest?.timemodified ?? latest?.timefinish), dueAt: homework.dueAt, sourceUpdatedAt: new Date(), metadataJson: JSON.stringify({ source: "moodle", activityId: homework.moodleActivityId }) }, update: { studentId: student.studentId, moodleSubmissionId: latest?.id ? Number(latest.id) : null, status: latest ? "submitted" : "not_submitted", totalQuestions, answeredQuestions, unansweredQuestions: Math.max(0, totalQuestions - answeredQuestions), correctQuestions, wrongQuestions, completionPct: totalQuestions ? Math.round((answeredQuestions / totalQuestions) * 10000) / 100 : 0, successOnAnsweredPct: answeredQuestions ? Math.round((correctQuestions / answeredQuestions) * 10000) / 100 : null, successOnTotalPct: totalQuestions ? Math.round((correctQuestions / totalQuestions) * 10000) / 100 : null, moodleGrade: typeof latest?.grade === "number" ? latest.grade : null, moodleMaxGrade: typeof latest?.maxgrade === "number" ? latest.maxgrade : null, submittedAt: asDate(latest?.timemodified ?? latest?.timefinish), sourceUpdatedAt: new Date(), metadataJson: JSON.stringify({ source: "moodle", activityId: homework.moodleActivityId }) } });
            homeworkSnapshotCount += 1;
            for (const rawQuestion of questions) {
              const question = rawQuestion as Record<string, unknown>;
              const moodleQuestionId = Number(question.questionid ?? question.id ?? question.slot);
              if (!Number.isInteger(moodleQuestionId)) continue;
              const tags = Array.isArray(question.tags) ? question.tags.filter((tag: unknown): tag is string => typeof tag === "string") : [];
              const tag = tags.find((candidate) => /(?:^|:)idea:[^:]+:[^:]+/i.test(candidate));
              const ideaMatch = tag?.match(/(?:^|:)idea:([^:]+):([^:]+)/i);
              await db.homeworkQuestionResult.upsert({ where: { snapshotId_moodleQuestionId: { snapshotId: snapshot.id, moodleQuestionId } }, create: { snapshotId: snapshot.id, moodleQuestionId, curriculumKey: homework.curriculumKey, lessonKey: homework.lessonKey, ideaKey: ideaMatch?.[2] ?? (typeof question.ideaKey === "string" ? question.ideaKey : null), studentAnswer: typeof question.answer === "string" ? question.answer : typeof question.response === "string" ? question.response : null, isAnswered: question.answer != null || question.response != null || question.isanswered === true, isCorrect: typeof question.correct === "boolean" ? question.correct : typeof question.iscorrect === "boolean" ? question.iscorrect : null, pointsEarned: asNumber(question.points ?? question.mark) || 0, answeredAt: asDate(question.answeredAt ?? latest?.timemodified), metadataJson: JSON.stringify({ source: "moodle", tag: tag ?? null }) }, update: { curriculumKey: homework.curriculumKey, lessonKey: homework.lessonKey, ideaKey: ideaMatch?.[2] ?? (typeof question.ideaKey === "string" ? question.ideaKey : null), studentAnswer: typeof question.answer === "string" ? question.answer : typeof question.response === "string" ? question.response : null, isAnswered: question.answer != null || question.response != null || question.isanswered === true, isCorrect: typeof question.correct === "boolean" ? question.correct : typeof question.iscorrect === "boolean" ? question.iscorrect : null, pointsEarned: asNumber(question.points ?? question.mark) || 0, answeredAt: asDate(question.answeredAt ?? latest?.timemodified), metadataJson: JSON.stringify({ source: "moodle", tag: tag ?? null }) } });
              homeworkQuestionCount += 1;
            }
          } catch (error) { failures.push({ scope: `homework:${homework.moodleActivityId}/user:${student.moodleUserId}`, error: error instanceof Error ? error.message : "فشل سحب الواجب" }); }
        }
      }
      const now = new Date().toISOString();
      const nextPollMs = failures.length ? Math.min(120000, Math.max(10000, (syncCursor?.nextPollMs || 5000) * 2)) : changedCount > 0 ? 5000 : Math.min(30000, Math.max(5000, (syncCursor?.nextPollMs || 5000) + 5000));
      await db.moodleSyncCursor.upsert({ where: { scopeKey: cursorScope }, create: { scopeKey: cursorScope, courseMapId: courseMap.id, lastCursor: latestChangedAt?.toISOString() || now, lastSyncAt: new Date(now), lastSuccessAt: failures.length ? null : new Date(now), status: failures.length ? "stale" : "ok", error: failures.length ? failures.map((item) => `${item.scope}: ${item.error}`).join(" | ").slice(0, 240) : null, syncedCount: changedCount, changedCount, skippedCount, requestCount, nextPollMs, lastChangedAt: latestChangedAt, metadataJson: JSON.stringify({ mode: cursorDate ? "delta" : "initial", overlapMs, attemptKeys: [...previousAttemptKeys].slice(-2000) }) }, update: { lastCursor: latestChangedAt?.toISOString() || syncCursor?.lastCursor || now, lastSyncAt: new Date(now), lastSuccessAt: failures.length ? syncCursor?.lastSuccessAt : new Date(now), status: failures.length ? "stale" : "ok", error: failures.length ? failures.map((item) => `${item.scope}: ${item.error}`).join(" | ").slice(0, 240) : null, syncedCount: changedCount, changedCount, skippedCount, requestCount, nextPollMs, lastChangedAt: latestChangedAt, metadataJson: JSON.stringify({ mode: cursorDate ? "delta" : "initial", overlapMs, attemptKeys: [...previousAttemptKeys].slice(-2000) }) } });
      await saveMoodle({ ...moodle, lastSyncAt: now, lastSyncStatus: failures.length ? "stale" : "ok", lastSyncError: failures.length ? failures.map((item) => `${item.scope}: ${item.error}`).join(" | ").slice(0, 240) : null });
      return json({ ok: true, data: { courseId: targetCourseId, mode: cursorDate ? "delta" : "initial", cursor: latestChangedAt?.toISOString() || now, nextPollMs, students: studentMaps.length, attempts: attemptCount, changed: changedCount, skipped: skippedCount, requests: requestCount, homeworkSnapshots: homeworkSnapshotCount, homeworkQuestions: homeworkQuestionCount, failures } });
    }
    if (action === "liveStatus") {
      const moodle = await readMoodle();
      if (!moodle.courseId) return json({ ok: false, error: "أدخل Course ID أولاً" }, 400);
      const users = await moodleRequest(moodle, "core_enrol_get_enrolled_users", { courseid: moodle.courseId });
      const now = Date.now();
      const sampledAt = new Date().toISOString();
      const statuses = Array.isArray(users) ? users.filter((item: any) => item && Number.isInteger(item.id)).map((item: any) => {
        const lastAccess = Number(item.lastaccess || 0) * 1000;
        const activeRecently = lastAccess > 0 && now - lastAccess < 90_000;
        return { moodleUserId: Number(item.id), status: activeRecently ? "waiting" : "unknown", updatedAt: sampledAt, label: activeRecently ? "نشط مؤخراً" : "لا توجد إجابة منشورة" };
      }) : [];
      const scopeKey = `engagement:${moodle.courseId}`;
      const previous = await db.moodleSyncCursor.findUnique({ where: { scopeKey } });
      let previousFingerprint: string | null = null;
      try { previousFingerprint = JSON.parse(previous?.metadataJson || "{}").fingerprint || null; } catch {}
      const fingerprint = createHash("sha1").update(JSON.stringify(statuses.map((item) => [item.moodleUserId, item.status, item.label]))).digest("hex");
      const changed = fingerprint !== previousFingerprint;
      const nextPollMs = changed ? 5000 : Math.min(30000, Math.max(5000, (previous?.nextPollMs || 5000) + 5000));
      await db.moodleSyncCursor.upsert({ where: { scopeKey }, create: { scopeKey, courseMapId: null, lastCursor: sampledAt, lastSyncAt: new Date(sampledAt), lastSuccessAt: new Date(sampledAt), status: "ok", syncedCount: statuses.length, changedCount: changed ? 1 : 0, skippedCount: changed ? 0 : 1, requestCount: 1, nextPollMs, lastChangedAt: changed ? new Date(sampledAt) : null, metadataJson: JSON.stringify({ fingerprint, semantics: "engagement_only" }) }, update: { lastCursor: sampledAt, lastSyncAt: new Date(sampledAt), lastSuccessAt: new Date(sampledAt), status: "ok", syncedCount: statuses.length, changedCount: { increment: changed ? 1 : 0 }, skippedCount: { increment: changed ? 0 : 1 }, requestCount: { increment: 1 }, nextPollMs, lastChangedAt: changed ? new Date(sampledAt) : previous?.lastChangedAt, metadataJson: JSON.stringify({ fingerprint, semantics: "engagement_only" }) } });
      return json({ ok: true, data: { statuses, sampledAt, changed, nextPollMs, semantics: "engagement_only" } });
    }
    if (action === "syncStudents") {
      const moodle = await readMoodle();
      if (!moodle.courseId) return json({ ok: false, error: "أدخل Course ID أولاً" }, 400);
      const users = await moodleRequest(moodle, "core_enrol_get_enrolled_users", { courseid: moodle.courseId });
      const students = Array.isArray(users) ? users.filter((item: any) => item && Number.isInteger(item.id)).map((item: any) => ({ moodleUserId: Number(item.id), moodleUsername: typeof item.username === "string" ? item.username : null, name: typeof item.fullname === "string" ? item.fullname : [item.firstname, item.lastname].filter(Boolean).join(" "), email: typeof item.email === "string" ? item.email : null })) : [];
      const next = { ...moodle, lastSyncAt: new Date().toISOString(), lastSyncStatus: "ok" as const, lastSyncError: null };
      await saveMoodle(next);
      return json({ ok: true, data: { students, count: students.length, syncedAt: next.lastSyncAt } });
    }
    return json({ ok: false, error: "إجراء Moodle غير معروف" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر الاتصال بـMoodle";
    try { const current = await readMoodle(); await saveMoodle({ ...current, lastSyncAt: new Date().toISOString(), lastSyncStatus: "error", lastSyncError: message.slice(0, 240) }); } catch {}
    return json({ ok: false, error: message }, 502);
  }
}
