// ====================================================================
//  /grades — صفحة الدرجات القابلة للطباعة (v2)
//  التعديلات:
//    1. استخدام نفس لوجو بسلاسة (SVG inline)
//    2. العنوان: "بسلاسة مع م.آية" بدل "بِسَلَاسَة — منصة المدرس الذكية"
//    3. إضافة عمود "كسب في المجاميع" (نقاط من ألعاب المجموعات)
//    4. تبسيط عمود الشارات: عرض الأعداد فقط (شارات + هدايا + احتفالات)
//    5. الألوان لا تتغير عند الطباعة (print-color-adjust: exact)
// ====================================================================
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { buildClassReport } from "@/lib/report-aggregator";

export const dynamic = "force-dynamic";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}

type StudentRow = {
  id: string;
  name: string;
  classId: string | null;
  lifetimePoints: number;
  lifetimeCorrect: number;
  lifetimeWrong: number;
  lifetimeAttempts: number;
  sessionPoints: number;
  sessionCorrect: number;
  sessionWrong: number;
  sessionAttempts: number;
  badgesCount: number;
  giftsCount: number;
  celebrationsCount: number;
  groupPoints: number; // نقاط من StudentActivity
  interactiveAnswered: number;
  interactiveCorrect: number;
  interactiveAccuracy: number | null;
  homeworkGrade: number | null;
  homeworkMaxGrade: number | null;
  homeworkCompletion: number | null;
  gamePoints: number;
  gameCount: number;
  title: string | null;
  isAbsent: boolean;
};

async function loadRows(classId: string | null, sessionId: string | null): Promise<{
  rows: StudentRow[];
  className: string;
  sessionName: string;
  sessionStartedAt: string | null;
}> {
  // An unassigned Moodle import is a staging record, not a classroom roster
  // member. The grades page used to include those rows whenever it was opened
  // without classId, which looked like ghost students. Keep the intentional
  // "all classes" view, but scope it to students that belong to a real class.
  const where: any = classId ? { classId } : { classId: { not: null } };

  const students = await db.student.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      badges: { select: { type: true } },
      gifts: { select: { giftName: true } },
    },
  });

  // 🟢 v2: جلب StudentActivity بشكل منفصل (ما فيش relation مباشر في Student model)
  // لاستخراج نقاط المجاميع + عدد الاحتفالات
  const studentIds = students.map((s) => s.id);
  const activities = await db.studentActivity.findMany({
    where: {
      studentId: { in: studentIds },
      ...(sessionId ? { sessionId } : {}),
    },
    select: { studentId: true, type: true, pointsDelta: true },
  });
  //groupBy studentId
  const activitiesByStudent = new Map<string, { type: string; pointsDelta: number }[]>();
  for (const a of activities) {
    if (!a.studentId) continue;
    if (!activitiesByStudent.has(a.studentId)) activitiesByStudent.set(a.studentId, []);
    activitiesByStudent.get(a.studentId)!.push({ type: a.type, pointsDelta: a.pointsDelta });
  }

  let className = "كل الفصول";
  if (classId) {
    const cls = await db.classRoom.findUnique({ where: { id: classId } });
    className = cls?.name ?? "صف غير معروف";
  }

  let sessionName = "—";
  let sessionStartedAt: string | null = null;
  if (sessionId) {
    const session = await db.session.findUnique({ where: { id: sessionId } });
    sessionName = session?.name ?? "—";
    sessionStartedAt = session ? session.startedAt.toISOString() : null;
  }

  const unified = await buildClassReport({ classId, sessionId });
  const unifiedByStudent = new Map(unified.rows.map((row) => [row.student.id, row]));

  // Load session snapshots
  let snapshots: Map<string, { pointsStart: number; correctStart: number; wrongStart: number; attemptsStart: number }> = new Map();
  if (sessionId) {
    const raw = await db.sessionStudentSnapshot.findMany({ where: { sessionId } });
    snapshots = new Map(raw.map((s) => [s.studentId, {
      pointsStart: s.pointsStart,
      correctStart: s.correctStart,
      wrongStart: s.wrongStart,
      attemptsStart: s.attemptsStart,
    }]));
  }

  const rows: StudentRow[] = students.map((s) => {
    const snap = snapshots.get(s.id);
    const studentActivities = activitiesByStudent.get(s.id) ?? [];
    // 🟢 v2: استخراج نقاط المجاميع من StudentActivity (type: "game" أو "points")
    const activityPoints = studentActivities
      .filter((a) => a.type === "game" || a.type === "points")
      .reduce((sum, a) => sum + (a.pointsDelta || 0), 0);
    const unifiedRow = unifiedByStudent.get(s.id);
    // 🟢 v2: عدد الاحتفالات = عدد الأنشطة من نوع "celebration"
    const celebrationsCount = studentActivities.filter((a) => a.type === "celebration").length;
    return {
      id: s.id,
      name: s.name,
      classId: s.classId,
      lifetimePoints: s.points,
      lifetimeCorrect: s.correctAnswers,
      lifetimeWrong: s.wrongAnswers,
      lifetimeAttempts: s.attempts,
      sessionPoints: snap ? Math.max(0, s.points - snap.pointsStart) : s.points,
      sessionCorrect: snap ? Math.max(0, s.correctAnswers - snap.correctStart) : s.correctAnswers,
      sessionWrong: snap ? Math.max(0, s.wrongAnswers - snap.wrongStart) : s.wrongAnswers,
      sessionAttempts: snap ? Math.max(0, s.attempts - snap.attemptsStart) : s.attempts,
      badgesCount: s.badges.length,
      giftsCount: s.gifts.length,
      celebrationsCount,
      groupPoints: activityPoints,
      interactiveAnswered: unifiedRow?.interactive.answered ?? 0,
      interactiveCorrect: unifiedRow?.interactive.correct ?? 0,
      interactiveAccuracy: unifiedRow?.interactive.accuracyPct ?? null,
      homeworkGrade: unifiedRow?.homework.latest?.moodleGrade ?? null,
      homeworkMaxGrade: unifiedRow?.homework.latest?.moodleMaxGrade ?? null,
      homeworkCompletion: unifiedRow?.homework.latest?.completionPct ?? null,
      gamePoints: unifiedRow?.games.points ?? 0,
      gameCount: unifiedRow?.games.gameCount ?? 0,
      title: s.title,
      isAbsent: s.isAbsent,
    };
  });

  return { rows, className, sessionName, sessionStartedAt };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId");
  const sessionId = url.searchParams.get("sessionId");

  const { rows, className, sessionName, sessionStartedAt } = await loadRows(classId, sessionId);

  // Sort: by session points desc (default), then by lifetime points
  const sortedBySession = [...rows].sort((a, b) => b.sessionPoints - a.sessionPoints || b.lifetimePoints - a.lifetimePoints);
  const sortedByLifetime = [...rows].sort((a, b) => b.lifetimePoints - a.lifetimePoints || b.lifetimeCorrect - a.lifetimeCorrect);

  const sessionLeader = sortedBySession[0];
  const lifetimeLeader = sortedByLifetime[0];

  const now = new Date().toLocaleString("ar-EG", { dateStyle: "long", timeStyle: "short" });

  // Calculate class statistics
  const totalPoints = rows.reduce((s, r) => s + r.lifetimePoints, 0);
  const totalCorrect = rows.reduce((s, r) => s + r.lifetimeCorrect, 0);
  const totalWrong = rows.reduce((s, r) => s + r.lifetimeWrong, 0);
  const totalActivityPoints = rows.reduce((s, r) => s + r.groupPoints, 0);
  const totalGamePoints = rows.reduce((s, r) => s + r.gamePoints, 0);
  const totalInteractiveCorrect = rows.reduce((s, r) => s + r.interactiveCorrect, 0);
  const homeworkGradeCount = rows.filter((r) => r.homeworkGrade != null).length;
  const avgAccuracy = totalCorrect + totalWrong > 0
    ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
    : 0;

  // 🟢 v3: لوجو بسلاسة الحقيقي — نفس الـ SVG الموجود في BisalasaLogo.tsx
  // (الابتسامة الزرقاء + العيون الحمراء على خلفية بيضاء)
  const logoSvg = `<svg width="38" height="38" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="38" height="38" rx="8" fill="white"/>
    <g transform="translate(3, 3)">
      <circle cx="11.5" cy="11" r="2" fill="#DA151C"/>
      <circle cx="20.5" cy="11" r="2" fill="#DA151C"/>
      <path d="M7 16 Q16 25 25 16" stroke="#0142A0" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    </g>
  </svg>`;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تقرير درجات — ${escapeHtml(className)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Cairo', sans-serif;
    background: #f8fafc;
    color: #0f172a;
    padding: 32px;
    direction: rtl;
    /* 🟢 v2: الحفاظ على الألوان عند الطباعة */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header {
    background: linear-gradient(135deg, #0142A0 0%, #1e40af 100%);
    color: white;
    padding: 28px 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-logo {
    width: 48px; height: 48px;
    display: flex; align-items: center; justify-content: center;
  }
  .brand-text .brand-name { font-size: 22px; font-weight: 800; }
  .brand-text .brand-sub { font-size: 12px; opacity: 0.85; }
  .header-meta { text-align: left; }
  .header-meta .class-name { font-size: 18px; font-weight: 700; }
  .header-meta .session-name { font-size: 12px; opacity: 0.85; }
  .header-meta .date { font-size: 11px; opacity: 0.7; margin-top: 4px; }

  .leaders { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 24px 36px; background: #f1f5f9; }
  .leader-card { background: white; padding: 18px 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 14px; }
  .leader-crown { font-size: 32px; }
  .leader-info { flex: 1; }
  .leader-label { font-size: 11px; color: #64748b; font-weight: 600; }
  .leader-name { font-size: 18px; font-weight: 800; color: #0f172a; }
  .leader-stats { font-size: 12px; color: #475569; }
  .leader-points { background: #fef3c7; color: #92400e; padding: 6px 12px; border-radius: 999px; font-weight: 800; font-size: 14px; }

  .stats-bar { display: flex; gap: 24px; padding: 20px 36px; background: white; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; }
  .stat { text-align: center; }
  .stat-value { font-size: 22px; font-weight: 800; color: #0142A0; }
  .stat-label { font-size: 11px; color: #64748b; font-weight: 600; }

  .table-wrap { padding: 0; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead { background: #0f172a; color: white; }
  th { padding: 14px 10px; text-align: center; font-weight: 700; font-size: 12px; }
  th:first-child { text-align: right; }
  td { padding: 12px 10px; text-align: center; border-bottom: 1px solid #e2e8f0; }
  td:first-child { text-align: right; font-weight: 600; }
  tbody tr:hover { background: #f8fafc; }
  tbody tr:nth-child(even) { background: #fafbfc; }
  .rank { display: inline-block; width: 26px; height: 26px; line-height: 26px; border-radius: 50%; background: #e2e8f0; color: #475569; font-weight: 800; font-size: 11px; }
  .rank-1 { background: #FFD700; color: #78350f; }
  .rank-2 { background: #cbd5e1; color: #1e293b; }
  .rank-3 { background: #fed7aa; color: #9a3412; }
  .points-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; }
  .points-session { background: #dbeafe; color: #1e40af; }
  .points-lifetime { background: #fef3c7; color: #92400e; }
  .points-group { background: #dcfce7; color: #166534; }
  .accuracy { font-weight: 700; }
  .acc-high { color: #10b981; }
  .acc-mid { color: #f59e0b; }
  .acc-low { color: #ef4444; }

  /* 🟢 v2: تبسيط عمود الشارات — أعداد فقط */
  .stats-icons { display: flex; gap: 8px; justify-content: center; align-items: center; }
  .stat-icon { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
  .stat-badge { background: #fef3c7; color: #92400e; }
  .stat-gift { background: #fce7f3; color: #9d174d; }
  .stat-celeb { background: #fef9c3; color: #854d0e; }
  .stat-zero { color: #cbd5e1; }

  .absent-row { opacity: 0.55; }
  .absent-row td:first-child::after { content: " (غائب)"; color: #ef4444; font-size: 11px; font-weight: 600; }

  .footer { padding: 20px 36px; background: #f1f5f9; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }

  .print-bar { position: sticky; top: 0; background: white; padding: 14px 36px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .print-bar h1 { font-size: 16px; font-weight: 800; color: #0142A0; }
  .print-btn { background: #0142A0; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-family: inherit; font-weight: 700; font-size: 13px; cursor: pointer; }
  .print-btn:hover { background: #1e40af; }

  @media print {
    body { background: white; padding: 0; }
    .print-bar { display: none; }
    .container { box-shadow: none; border-radius: 0; }
    @page { margin: 12mm; }
    /* 🟢 v2: الحفاظ على كل الألوان عند الطباعة */
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    thead { background: #0f172a !important; color: white !important; }
    .header { background: linear-gradient(135deg, #0142A0 0%, #1e40af 100%) !important; color: white !important; }
    .rank-1 { background: #FFD700 !important; }
    .rank-2 { background: #cbd5e1 !important; }
    .rank-3 { background: #fed7aa !important; }
    .points-session { background: #dbeafe !important; }
    .points-lifetime { background: #fef3c7 !important; }
    .points-group { background: #dcfce7 !important; }
    .stat-badge { background: #fef3c7 !important; }
    .stat-gift { background: #fce7f3 !important; }
    .stat-celeb { background: #fef9c3 !important; }
  }
</style>
</head>
<body>
  <div class="print-bar">
    <h1>📊 تقرير درجات الطلاب</h1>
    <button class="print-btn" onclick="window.print()">🖨️ اطبع / احفظ PDF</button>
  </div>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="brand-logo">${logoSvg}</div>
        <div class="brand-text">
          <div class="brand-name">بسلاسة مع م.آية</div>
          <div class="brand-sub">تقرير درجات الطلاب</div>
        </div>
      </div>
      <div class="header-meta">
        <div class="class-name">الصف: ${escapeHtml(className)}</div>
        <div class="session-name">الجلسة: ${escapeHtml(sessionName)}</div>
        <div class="date">تاريخ التقرير: ${now}</div>
      </div>
    </div>

    <div class="leaders">
      <div class="leader-card">
        <div class="leader-crown">🏆</div>
        <div class="leader-info">
          <div class="leader-label">متصدر الجلسة الحالية</div>
          <div class="leader-name">${sessionLeader?.name ?? "—"}</div>
          <div class="leader-stats">${sessionLeader ? `${sessionLeader.sessionCorrect} صحيحة · ${sessionLeader.sessionWrong} خطأ · ${sessionLeader.sessionAttempts} محاولة` : ""}</div>
        </div>
        <div class="leader-points">${sessionLeader?.sessionPoints ?? 0} نقطة</div>
      </div>
      <div class="leader-card">
        <div class="leader-crown">👑</div>
        <div class="leader-info">
          <div class="leader-label">متصدر مدى الحياة</div>
          <div class="leader-name">${lifetimeLeader?.name ?? "—"}</div>
          <div class="leader-stats">${lifetimeLeader ? `${lifetimeLeader.lifetimeCorrect} صحيحة · ${lifetimeLeader.lifetimeWrong} خطأ · ${lifetimeLeader.lifetimeAttempts} محاولة` : ""}</div>
        </div>
        <div class="leader-points">${lifetimeLeader?.lifetimePoints ?? 0} نقطة</div>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat"><div class="stat-value">${rows.length}</div><div class="stat-label">عدد الطلاب</div></div>
      <div class="stat"><div class="stat-value">${totalPoints}</div><div class="stat-label">إجمالي النقاط</div></div>
      <div class="stat"><div class="stat-value">${totalCorrect}</div><div class="stat-label">إجمالي الصحيحة</div></div>
      <div class="stat"><div class="stat-value">${totalWrong}</div><div class="stat-label">إجمالي الأخطاء</div></div>
      <div class="stat"><div class="stat-value">${totalGamePoints}</div><div class="stat-label">نقاط الألعاب</div></div>
      <div class="stat"><div class="stat-value">${totalActivityPoints}</div><div class="stat-label">نقاط سجل الأنشطة</div></div>
      <div class="stat"><div class="stat-value">${totalInteractiveCorrect}</div><div class="stat-label">صحيح التفاعل</div></div>
      <div class="stat"><div class="stat-value">${homeworkGradeCount}</div><div class="stat-label">درجات Moodle</div></div>
      <div class="stat"><div class="stat-value">${avgAccuracy}%</div><div class="stat-label">دقة الصف</div></div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الطالب</th>
            <th>نقاط الجلسة</th>
            <th>صحيحة</th>
            <th>خطأ</th>
            <th>محاولات</th>
            <th>الدقة</th>
            <th>تفاعل الحصة</th>
            <th>واجب Moodle</th>
            <th>الألعاب</th>
            <th>كسب الأنشطة</th>
            <th>نقاط مدى الحياة</th>
            <th>الشارات والهدايا</th>
            <th>اللقب</th>
          </tr>
        </thead>
        <tbody>
          ${sortedBySession.map((r, i) => {
            const totalAttempts = r.sessionCorrect + r.sessionWrong;
            const acc = totalAttempts > 0 ? Math.round((r.sessionCorrect / totalAttempts) * 100) : 0;
            const accClass = acc >= 80 ? "acc-high" : acc >= 50 ? "acc-mid" : "acc-low";
            const rankClass = i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "";
            // 🟢 v2: عرض الأعداد فقط للشارات والهدايا والاحتفالات
            const badgesBadge = r.badgesCount > 0
              ? `<span class="stat-icon stat-badge">🏅 ${r.badgesCount}</span>`
              : `<span class="stat-icon stat-badge stat-zero">🏅 0</span>`;
            const giftsBadge = r.giftsCount > 0
              ? `<span class="stat-icon stat-gift">🎁 ${r.giftsCount}</span>`
              : `<span class="stat-icon stat-gift stat-zero">🎁 0</span>`;
            const celebBadge = r.celebrationsCount > 0
              ? `<span class="stat-icon stat-celeb">🎉 ${r.celebrationsCount}</span>`
              : `<span class="stat-icon stat-celeb stat-zero">🎉 0</span>`;
            return `<tr class="${r.isAbsent ? "absent-row" : ""}">
              <td><span class="rank ${rankClass}">${i + 1}</span></td>
              <td>${escapeHtml(r.name)}</td>
              <td><span class="points-badge points-session">${r.sessionPoints}</span></td>
              <td>${r.sessionCorrect}</td>
              <td>${r.sessionWrong}</td>
              <td>${r.sessionAttempts}</td>
              <td class="accuracy ${accClass}">${acc}%</td>
              <td><span class="points-badge points-session">${r.interactiveAnswered ? `${r.interactiveCorrect}/${r.interactiveAnswered} • ${r.interactiveAccuracy ?? "—"}%` : "—"}</span></td>
              <td><span class="points-badge points-session">${r.homeworkGrade == null ? "—" : `${r.homeworkGrade}/${r.homeworkMaxGrade ?? "—"} • ${r.homeworkCompletion ?? 0}%`}</span></td>
              <td><span class="points-badge points-group">${r.gameCount ? `${r.gamePoints} • ${r.gameCount}` : "—"}</span></td>
              <td><span class="points-badge points-group">${r.groupPoints}</span></td>
              <td><span class="points-badge points-lifetime">${r.lifetimePoints}</span></td>
              <td><div class="stats-icons">${badgesBadge}${giftsBadge}${celebBadge}</div></td>
              <td>${r.title ? `<strong>${escapeHtml(r.title)}</strong>` : "—"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    <div class="footer">
      تم توليد هذا التقرير بواسطة بسلاسة مع م.آية — ${now}<br>
      يمكن طباعة هذا التقرير أو حفظه كـ PDF عبر Ctrl+P (أو زر الطباعة أعلاه)
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
