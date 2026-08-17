import { db } from "./db";

export type MoodleEventInput = {
  courseId: number;
  moodleUserId: number | null;
  questionId: number | null;
  ideaId: string | null;
};

export type MoodleEventValidation = {
  valid: boolean;
  errors: string[];
  courseMapId?: string;
  studentId?: string;
  activityMapId?: string;
  curriculumKey?: string;
  lessonKey?: string;
  ideaKey?: string | null;
  questionMapId?: string;
};

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export async function validateMoodleEvent(input: MoodleEventInput): Promise<MoodleEventValidation> {
  const errors: string[] = [];
  const courseMap = await db.moodleCourseMap.findFirst({
    where: { moodleCourseId: input.courseId, enabled: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!courseMap) {
    errors.push(`courseId ${input.courseId} is not mapped or enabled`);
    return { valid: false, errors };
  }

  let studentId: string | undefined;
  if (input.moodleUserId == null) {
    errors.push("moodleUserId is required for a Moodle answer event");
  } else {
    const studentMap = await db.moodleStudentMap.findFirst({
      where: { courseMapId: courseMap.id, moodleUserId: input.moodleUserId, enabled: true },
    });
    if (!studentMap) errors.push(`moodleUserId ${input.moodleUserId} is not mapped to a local student`);
    else if (!studentMap.studentId) errors.push(`moodleUserId ${input.moodleUserId} has no local student target`);
    else studentId = studentMap.studentId;
  }

  const ideaValue = input.ideaId?.trim() || null;
  const activityCandidates: Array<{ ideaKey?: string; lessonKey?: string; externalKey?: string }> = [];
  if (ideaValue) {
    activityCandidates.push({ ideaKey: ideaValue }, { lessonKey: ideaValue }, { externalKey: ideaValue });
    const [lessonPart, ideaPart] = ideaValue.split("|");
    if (lessonPart && ideaPart) activityCandidates.push({ lessonKey: lessonPart, ideaKey: ideaPart });
  }
  let activityMap = activityCandidates.length
    ? await db.moodleActivityMap.findFirst({ where: { courseMapId: courseMap.id, OR: activityCandidates }, orderBy: { updatedAt: "desc" } })
    : null;
  if (ideaValue && !activityMap) errors.push(`ideaId ${ideaValue} is not mapped in this Moodle course`);

  let questionMapId: string | undefined;
  if (input.questionId != null) {
    const activityIds = activityMap ? [activityMap.id] : (await db.moodleActivityMap.findMany({ where: { courseMapId: courseMap.id }, select: { id: true } })).map((item) => item.id);
    const questionMap = await db.moodleQuestionMap.findFirst({ where: { moodleQuestionId: input.questionId, activityMapId: { in: activityIds } } });
    if (!questionMap) errors.push(`questionId ${input.questionId} is not mapped in this Moodle course`);
    else {
      questionMapId = questionMap.id;
      if (!activityMap) activityMap = await db.moodleActivityMap.findUnique({ where: { id: questionMap.activityMapId } });
    }
  }

  if (!ideaValue && input.questionId == null) errors.push("ideaId or questionId is required for a Moodle answer event");

  return {
    valid: errors.length === 0,
    errors,
    courseMapId: courseMap.id,
    studentId,
    activityMapId: activityMap?.id,
    curriculumKey: activityMap?.curriculumKey,
    lessonKey: activityMap?.lessonKey,
    ideaKey: activityMap?.ideaKey ?? ideaValue,
    questionMapId,
  };
}

export async function processMoodleSyncEvent(eventId: string): Promise<{ ok: boolean; validation: MoodleEventValidation }> {
  const event = await db.moodleSyncEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Moodle sync event not found");
  const validation = await validateMoodleEvent({ courseId: event.courseId, moodleUserId: event.moodleUserId, questionId: event.questionId, ideaId: event.ideaId });
  const metadata = { ...parseMetadata(event.metadataJson), validationErrors: validation.errors, validationCheckedAt: new Date().toISOString(), courseMapId: validation.courseMapId ?? null, studentId: validation.studentId ?? null, activityMapId: validation.activityMapId ?? null, questionMapId: validation.questionMapId ?? null };
  if (validation.valid) {
    await db.moodleSyncEvent.update({ where: { id: event.id }, data: { status: "processed", processedAt: new Date(), metadataJson: JSON.stringify(metadata) } });
  } else {
    await db.moodleSyncEvent.update({ where: { id: event.id }, data: { status: "pending-validation", processedAt: null, metadataJson: JSON.stringify(metadata) } });
  }
  return { ok: validation.valid, validation };
}

export function retryBackoffMs(retryCount: number): number {
  return Math.min(5 * 60 * 1000, 5000 * Math.pow(2, Math.max(0, retryCount - 1)));
}
