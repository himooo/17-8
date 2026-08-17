const fs = require("node:fs");
const path = require("node:path");

const outDir = path.resolve(process.argv[2] || "/home/ubuntu/bisalasa-demo-import-pack");
const lessonsDir = path.join(outDir, "lessons");
const assetsDir = path.join(outDir, "assets");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(lessonsDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

const iso = (day, hour = 9, minute = 0) => `2026-08-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
const classId = "demo_grade4_math_a";
const curriculumKey = "grade4-math-demo-2026";
const sessionId = "demo_session_grade4_001";
const lessonSpecs = [
  {
    key: "fractions-meaning",
    title: "الكسور وأجزاؤها",
    subtitle: "رابعة ابتدائي رياضيات — الوحدة الأولى",
    ideas: [
      { id: "meaning", title: "معنى الكسر", color: "blue", description: "البسط والمقام وتمثيل الجزء من الكل.", questions: [
        ["في الكسر 3/4، ما البسط؟", "3", ["3", "4", "7", "1"], "easy"],
        ["في الكسر 5/8، ما المقام؟", "8", ["5", "8", "13", "3"], "easy"],
        ["أي كسر يمثل ثلاثة أجزاء من خمسة؟", "3/5", ["5/3", "3/5", "2/5", "3/3"], "easy"],
        ["كم جزءاً متساوياً يقسم إليه الواحد في 7/10؟", "10", ["7", "10", "17", "3"], "easy"],
      ] },
      { id: "models", title: "نماذج الكسور", color: "green", description: "قراءة الكسور من النماذج والأشكال.", questions: [
        ["إذا ظللنا 2 من 6 أجزاء متساوية، فما الكسر؟", "2/6", ["6/2", "2/6", "4/6", "2/4"], "easy"],
        ["أي كسر يساوي نصف الشكل؟", "1/2", ["1/3", "1/2", "2/3", "3/4"], "easy"],
        ["ما الكسر الذي يصف 4 أجزاء مظللة من 9؟", "4/9", ["9/4", "4/9", "5/9", "4/5"], "medium"],
        ["في 8/8، كم كلّاً لدينا؟", "1", ["0", "1", "8", "16"], "easy"],
      ] },
      { id: "types", title: "أنواع الكسور", color: "amber", description: "التمييز بين الكسر الصحيح وغير الصحيح.", questions: [
        ["أي كسر صحيح؟", "3/7", ["7/3", "3/7", "8/5", "9/4"], "easy"],
        ["أي كسر غير صحيح؟", "9/4", ["1/5", "2/7", "9/4", "3/8"], "medium"],
        ["ما قيمة 6/6؟", "1", ["0", "1", "6", "12"], "easy"],
        ["أي كسر يساوي أكثر من واحد؟", "5/3", ["2/5", "3/5", "5/3", "1/5"], "medium"],
      ] },
    ],
  },
  {
    key: "equivalent-fractions",
    title: "الكسور المتكافئة",
    subtitle: "رابعة ابتدائي رياضيات — الوحدة الثانية",
    ideas: [
      { id: "equivalent", title: "اكتشاف التكافؤ", color: "purple", description: "كسور مختلفة في الشكل ومتساوية في القيمة.", questions: [
        ["أي كسر يكافئ 1/2؟", "2/4", ["1/3", "2/4", "3/5", "4/6"], "easy"],
        ["ما الكسر المكافئ لـ 2/3 بضرب البسط والمقام في 2؟", "4/6", ["3/5", "4/6", "2/5", "6/4"], "easy"],
        ["أي زوج متكافئ؟", "3/4 = 6/8", ["1/2 = 2/3", "3/4 = 6/8", "2/5 = 3/5", "4/7 = 4/9"], "medium"],
        ["ما الكسر المكافئ لـ 3/5 بضرب الطرفين في 3؟", "9/15", ["6/10", "9/15", "8/12", "12/20"], "medium"],
      ] },
      { id: "simplify", title: "تبسيط الكسور", color: "cyan", description: "القسمة على عامل مشترك للوصول إلى أبسط صورة.", questions: [
        ["أبسط صورة للكسر 4/8 هي؟", "1/2", ["1/2", "2/3", "4/4", "8/4"], "easy"],
        ["أبسط صورة للكسر 6/9 هي؟", "2/3", ["3/4", "2/3", "1/3", "6/3"], "medium"],
        ["أبسط صورة للكسر 10/15 هي؟", "2/3", ["1/2", "2/3", "3/5", "5/10"], "medium"],
        ["هل 5/10 في أبسط صورة؟", "لا", ["نعم", "لا", "أحياناً", "لا يمكن"], "easy"],
      ] },
      { id: "complete", title: "إكمال الكسر", color: "red", description: "إيجاد العدد الناقص في كسور متكافئة.", questions: [
        ["3/4 = ؟/8، العدد الناقص هو؟", "6", ["4", "5", "6", "7"], "medium"],
        ["2/5 = 8/؟، المقام الناقص هو؟", "20", ["10", "15", "20", "25"], "medium"],
        ["1/3 = 5/؟، المقام الناقص هو؟", "15", ["8", "12", "15", "18"], "medium"],
        ["4/6 = ؟/3، البسط الناقص هو؟", "2", ["1", "2", "3", "4"], "easy"],
      ] },
    ],
  },
  {
    key: "compare-fractions",
    title: "مقارنة الكسور وترتيبها",
    subtitle: "رابعة ابتدائي رياضيات — الوحدة الثالثة",
    ideas: [
      { id: "same-denominator", title: "مقارنة المقامات المتساوية", color: "blue", description: "عند تساوي المقام نقارن البسطين.", questions: [
        ["أيهما أكبر: 3/7 أم 5/7؟", "5/7", ["3/7", "5/7", "متساويان", "لا يمكن"], "easy"],
        ["أيهما أصغر: 2/9 أم 6/9؟", "2/9", ["2/9", "6/9", "متساويان", "1/9"], "easy"],
        ["رتب تصاعدياً: 1/8، 4/8، 2/8", "1/8، 2/8، 4/8", ["4/8، 2/8، 1/8", "1/8، 2/8، 4/8", "2/8، 1/8، 4/8", "متساوية"], "medium"],
        ["هل 7/10 أكبر من 3/10؟", "نعم", ["نعم", "لا", "متساويان", "غير معروف"], "easy"],
      ] },
      { id: "same-numerator", title: "مقارنة البسط المتساوي", color: "green", description: "عند تساوي البسط يكون الكسر ذو المقام الأصغر أكبر.", questions: [
        ["أيهما أكبر: 3/4 أم 3/8؟", "3/4", ["3/4", "3/8", "متساويان", "1/2"], "medium"],
        ["أيهما أصغر: 2/5 أم 2/3؟", "2/5", ["2/5", "2/3", "متساويان", "1/5"], "medium"],
        ["أيهما أكبر: 5/6 أم 5/9؟", "5/6", ["5/6", "5/9", "متساويان", "1/6"], "medium"],
        ["لماذا 1/3 أكبر من 1/7؟", "المقام الأصغر يعني أجزاء أكبر", ["المقام الأصغر يعني أجزاء أكبر", "لأن 7 أصغر", "لأن البسط مختلف", "لا يوجد سبب"], "hard"],
      ] },
      { id: "order", title: "ترتيب الكسور", color: "purple", description: "توحيد المقامات أو استخدام خط الأعداد.", questions: [
        ["أي كسر يقع أقرب إلى الواحد؟", "7/8", ["1/8", "3/8", "7/8", "1/4"], "easy"],
        ["رتب تنازلياً: 2/6، 5/6، 1/6", "5/6، 2/6، 1/6", ["1/6، 2/6، 5/6", "5/6، 2/6، 1/6", "2/6، 5/6، 1/6", "5/6، 1/6، 2/6"], "medium"],
        ["أي كسر يساوي 1/2؟", "4/8", ["3/8", "4/8", "5/8", "6/8"], "easy"],
        ["إذا كان 4/5 من الشكل مظللاً، هل هو أكبر من النصف؟", "نعم", ["نعم", "لا", "متساوٍ", "لا يمكن"], "easy"],
      ] },
    ],
  },
  {
    key: "fraction-operations",
    title: "جمع وطرح الكسور المتشابهة",
    subtitle: "رابعة ابتدائي رياضيات — الوحدة الرابعة",
    ideas: [
      { id: "add-like", title: "جمع المقامات المتساوية", color: "cyan", description: "نجمع البسطين ونبقي المقام كما هو.", questions: [
        ["1/7 + 3/7 = ؟", "4/7", ["4/7", "4/14", "3/7", "1/7"], "easy"],
        ["2/9 + 5/9 = ؟", "7/9", ["7/9", "7/18", "3/9", "10/9"], "easy"],
        ["3/8 + 2/8 = ؟", "5/8", ["5/8", "6/8", "5/16", "1/8"], "easy"],
        ["4/10 + 4/10 = ؟", "8/10", ["8/10", "4/20", "1/10", "8/20"], "easy"],
      ] },
      { id: "subtract-like", title: "طرح المقامات المتساوية", color: "amber", description: "نطرح البسطين ونبقي المقام كما هو.", questions: [
        ["6/7 - 2/7 = ؟", "4/7", ["4/7", "4/0", "8/7", "2/7"], "easy"],
        ["8/9 - 3/9 = ؟", "5/9", ["5/9", "5/18", "11/9", "3/9"], "easy"],
        ["7/10 - 4/10 = ؟", "3/10", ["3/10", "3/20", "11/10", "4/10"], "easy"],
        ["5/6 - 1/6 = ؟", "2/3", ["4/6", "2/3", "1/6", "5/5"], "medium"],
      ] },
      { id: "word-problems", title: "مسائل لفظية", color: "red", description: "اختيار العملية المناسبة من موقف حياتي.", questions: [
        ["أكلت سارة 2/8 من البيتزا ثم 3/8. كم أكلت؟", "5/8", ["1/8", "5/8", "6/8", "5/16"], "medium"],
        ["مع أحمد 7/10 لتر وشرب 2/10. كم تبقى؟", "5/10", ["5/10", "9/10", "5/20", "2/10"], "medium"],
        ["قرأ خالد 1/6 صباحاً و2/6 مساءً. كم قرأ؟", "3/6", ["1/6", "2/6", "3/6", "3/12"], "easy"],
        ["في صندوق 9/12 من الكرات، أخرجنا 4/12. الباقي؟", "5/12", ["5/12", "13/12", "4/12", "5/24"], "medium"],
      ] },
    ],
  },
];

function htmlEscape(value) {
  return String(value).replace(/[&<>\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch] || ch));
}

function makeManifest(spec, lessonIndex) {
  const ideas = spec.ideas.map((idea, ideaIndex) => ({
    id: `${spec.key}-${idea.id}`,
    title: idea.title,
    description: idea.description,
    color: idea.color,
    steps: [
      { step: 1, title: `تمهيد: ${idea.title}`, type: "content", script: `نبدأ بفكرة ${idea.title}. راجع الرسم أو المثال ثم اطلب من الطلاب وصف ما يرونه.`, notes: "اسأل سؤالاً شفهياً قبل بدء التفاعل.", effect: "none" },
      ...idea.questions.map((q, qIndex) => ({
        step: qIndex + 2,
        title: q[0],
        type: "question",
        script: `سؤال ${qIndex + 1}: ${q[0]}`,
        notes: `ركز على ${idea.description} واطلب تفسير الإجابة من طالب واحد على الأقل.`,
        question: { text: q[0], correctAnswer: q[1], options: q[2], rewardPoints: q[3] === "hard" ? 5 : q[3] === "medium" ? 4 : 3, difficulty: q[3], tags: ["grade4", "math", "fractions", idea.id], gameReady: true },
        sound: { onSuccess: "success", onError: "error" },
        effect: qIndex === idea.questions.length - 1 ? "confetti" : "none",
      })),
    ],
  }));
  return {
    lessonId: `demo-${spec.key}`,
    title: spec.title,
    subtitle: spec.subtitle,
    contentType: "html",
    totalSteps: ideas.reduce((sum, idea) => sum + idea.steps.length, 0),
    currentStep: 1,
    currentIdeaId: ideas[0].id,
    ideas,
    aspectRatio: "16:9",
    targetAge: "primary-upper",
    assets: [{ id: `${spec.key}-shape`, description: "شكل هندسي توضيحي للكسور", type: "geometric-figure", status: "ready", src: "assets/fraction-parts.svg", alt: "دائرة مقسمة إلى أربعة أجزاء مع تظليل جزأين" }],
    virtualComments: [
      { step: 2, ideaId: ideas[0].id, text: "أنا فاهم الفكرة!", tone: "confident", studentHint: { gender: "female" } },
      { step: 3, ideaId: ideas[0].id, text: "ممكن مثال آخر؟", tone: "curious", studentHint: { gender: "male" } },
    ],
  };
}

function makeLessonHtml(manifest) {
  const manifestText = JSON.stringify(manifest).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${manifest.title}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:Tahoma,Arial,sans-serif;background:linear-gradient(135deg,#07152e,#122b50);color:#f8fafc;overflow:hidden}body{display:flex;align-items:center;justify-content:center}.wrap{width:92%;height:88%;display:flex;flex-direction:column;gap:18px}.badge{font-size:14px;color:#93c5fd}.title{font-size:clamp(24px,4vw,52px);font-weight:800;color:#fff}.subtitle{font-size:clamp(14px,2vw,22px);color:#cbd5e1}.idea{border:1px solid rgba(147,197,253,.35);background:rgba(15,23,42,.75);border-radius:20px;padding:22px;min-height:220px;box-shadow:0 14px 40px rgba(0,0,0,.22)}.idea h2{margin:0 0 10px;color:#bfdbfe;font-size:clamp(20px,3vw,34px)}.step{font-size:clamp(18px,3vw,34px);line-height:1.5;font-weight:700}.script{margin-top:12px;color:#cbd5e1;font-size:clamp(13px,1.8vw,20px);line-height:1.6}.option{display:inline-block;padding:7px 13px;margin:14px 5px 0 0;border-radius:999px;background:#1e40af;color:#dbeafe;font-size:clamp(12px,1.4vw,17px)}.progress{color:#94a3b8;font-size:13px}.hint{margin-top:auto;color:#93c5fd;font-size:13px}
</style></head><body><main class="wrap"><div class="badge">بسالسة • تجربة الفصل • رياضيات رابعة ابتدائي</div><div class="title" id="lesson-title"></div><div class="subtitle" id="lesson-subtitle"></div><section class="idea"><h2 id="idea-title"></h2><div class="step" id="step-title"></div><div class="script" id="script"></div><div id="options"></div></section><div class="progress" id="progress"></div><div class="hint">استخدم أزرار الخطوة من المنصة للانتقال، ويمكنك تشغيل الألعاب على فكرة محددة.</div></main>
<script id="slide-manifest" type="application/json">${manifestText}</script>
<script>
(function(){
  const manifest=JSON.parse(document.getElementById('slide-manifest').textContent);
  let ideaId=manifest.currentIdeaId||manifest.ideas[0].id; let step=manifest.currentStep||1;
  const $=id=>document.getElementById(id);
  function current(){const idea=manifest.ideas.find(i=>i.id===ideaId)||manifest.ideas[0];const st=idea.steps.find(s=>s.step===step)||idea.steps[0];return {idea,st};}
  function render(){const c=current();$('lesson-title').textContent=manifest.title;$('lesson-subtitle').textContent=manifest.subtitle||'';$('idea-title').textContent=c.idea.title;$('step-title').textContent=c.st.title||('خطوة '+step);$('script').textContent=Array.isArray(c.st.script)?c.st.script.join(' '):(c.st.script||'');$('progress').textContent='الفكرة: '+c.idea.title+' • الخطوة '+step+' من '+c.idea.steps.length;const options=c.st.question&&c.st.question.options||[];$('options').innerHTML=options.map(o=>'<span class="option">'+String(o).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</span>').join('');}
  function announce(){parent.postMessage({type:'STEP_CHANGED',step,ideaId},'*');parent.postMessage({type:'IDEA_CHANGED',ideaId,step,title:current().idea.title},'*');}
  window.addEventListener('message',e=>{const m=e.data||{};if(m.type==='REQUEST_MANIFEST'){parent.postMessage({type:'MANIFEST',payload:manifest},'*');render();announce();}if(m.type==='GOTO_STEP'){if(m.ideaId)ideaId=m.ideaId;step=Number(m.step)||1;render();announce();}if(m.type==='GOTO_IDEA'){ideaId=m.ideaId||ideaId;step=Number(m.step)||1;render();announce();}if(m.type==='NEXT'){const c=current();if(step<c.idea.steps.length)step++;else{const i=manifest.ideas.findIndex(x=>x.id===ideaId);if(i<manifest.ideas.length-1){ideaId=manifest.ideas[i+1].id;step=1;}}render();announce();}if(m.type==='PREV'){if(step>1)step--;render();announce();}});
  render(); parent.postMessage({type:'READY'},'*'); parent.postMessage({type:'MANIFEST',payload:manifest},'*');
})();
</script></body></html>`;
}

const students = [
  ["01", "أحمد محمد", 4101, "ahmed"], ["02", "سلمى علي", 4102, "salma"], ["03", "يوسف حسن", 4103, "youssef"], ["04", "مريم خالد", 4104, "maryam"],
  ["05", "عمر محمود", 4105, "omar"], ["06", "نور إيهاب", 4106, "nour"], ["07", "زياد طارق", 4107, "ziad"], ["08", "ليان سامح", 4108, "layan"],
  ["09", "كريم وائل", 4109, "karim"], ["10", "جنى أشرف", 4110, "jana"], ["11", "عبدالله فؤاد", 4111, "abdullah"], ["12", "ملك رامي", 4112, "malak"],
].map(([code, name, moodleUserId, slug], index) => ({
  id: `demo_student_${code}`, classId, name, studentCode: `G4-${code}`, parentTelegramChatId: `demo-parent-${code}`, parentTelegramUsername: `parent_${slug}`, parentPhone: `0100000${String(index + 1).padStart(3, "0")}`,
  points: 35 + ((index * 7) % 31), correctAnswers: 10 + (index % 7), wrongAnswers: index % 4, attempts: 12 + (index % 8), title: index < 3 ? "نجم الكسور" : null, isAbsent: index === 11, moodleUserId, moodleUsername: slug, moodleCourseId: 9404, lastCalled: index < 6 ? iso(14, 10, index) : null, createdAt: iso(1), updatedAt: iso(14, 11, index),
}));

const classes = [{ id: classId, name: "رابعة ابتدائي — رياضيات — فصل التجربة", description: "بيانات تجريبية كاملة لاختبار الدروس والتفاعل والألعاب والتقارير.", color: "#2563eb", createdAt: iso(1), updatedAt: iso(14, 11) }];
const groups = ["مجموعة الكسور", "مجموعة النجوم", "مجموعة المحللين"].map((name, index) => ({ id: `demo_group_${index + 1}`, classId, name, color: ["#2563eb", "#16a34a", "#f59e0b"][index], groupPoints: 24 + index * 11, studentIds: JSON.stringify(students.filter((_, i) => i % 3 === index).map((s) => s.id)), createdAt: iso(1), updatedAt: iso(14) }));
const manifests = lessonSpecs.map((spec, i) => makeManifest(spec, i));
const lessons = manifests.map((manifest, i) => ({ id: `demo_lesson_${String(i + 1).padStart(2, "0")}`, lessonId: manifest.lessonId, fileName: `${manifest.lessonId}.html`, title: manifest.title, subtitle: manifest.subtitle, content: makeLessonHtml(manifest), manifestJson: JSON.stringify(manifest), importedAt: iso(1 + i), updatedAt: iso(14, 11, i) }));
const questions = [];
for (const lesson of lessons) {
  const manifest = JSON.parse(lesson.manifestJson);
  for (const idea of manifest.ideas) for (const step of idea.steps) if (step.type === "question" && step.question) questions.push({ id: `demo_q_${lesson.lessonId}_${idea.id}_${step.step}`, lessonId: lesson.id, externalRefId: `moodle-q-${lesson.lessonId}-${idea.id}-${step.step}`, ideaId: idea.id, ideaTitle: idea.title, stepNumber: step.step, text: step.question.text, correctAnswer: String(step.question.correctAnswer), optionsJson: JSON.stringify(step.question.options), rewardPoints: step.question.rewardPoints, difficulty: step.question.difficulty, tags: JSON.stringify(step.question.tags), gameReady: true, createdAt: iso(1) });
}
const session = [{ id: sessionId, classId, name: "حصة تجريبية — الكسور من البداية إلى العمليات", startedAt: iso(14, 9), endedAt: null, notes: "جلسة مجهزة لاختبار التفاعل والألعاب والتقارير.", statsJson: JSON.stringify({ totalQuestions: 48, correctAnswers: 37, participationCount: 12 }) }];
const snapshots = students.map((s) => ({ id: `demo_snapshot_${s.id}`, sessionId, studentId: s.id, pointsStart: 20, correctStart: 5, wrongStart: 1, attemptsStart: 6, badgesCountStart: 0 }));
const badges = students.slice(0, 6).map((s, i) => ({ id: `demo_badge_${i + 1}`, studentId: s.id, type: ["star", "correct", "fast", "creative", "helper", "good-try"][i], note: "شهادة تجربة من درس الكسور", awardedAt: iso(14, 10, i) }));
const demoGiftImages = ["/gifts/star.webp", "/gifts/medal.webp", "/gifts/heart-encouragement.webp"];
const gifts = students.slice(0, 3).map((s, i) => ({ id: `demo_gift_award_${i + 1}`, studentId: s.id, giftId: `demo_gift_${i + 1}`, giftName: ["نجمة ذهبية", "وسام الكسور", "بطاقة تشجيع"][i], giftImage: demoGiftImages[i], awardedAt: iso(14, 10, i + 10) }));
const prizes = ["نجم اليوم", "خبير الكسور", "بطل المحاولة"].map((name, i) => ({ id: `demo_prize_${i + 1}`, name, color: ["#f59e0b", "#8b5cf6", "#16a34a"][i], points: [10, 15, 5][i], type: "title", icon: ["⭐", "🧠", "🏅"][i], createdAt: iso(1), updatedAt: iso(1) }));
const giftCatalog = ["نجمة ذهبية", "وسام الكسور", "بطاقة تشجيع"].map((name, i) => ({ id: `demo_gift_${i + 1}`, name, category: "demo", image: demoGiftImages[i], description: "عنصر تجريبي للحوافز", createdAt: iso(1), updatedAt: iso(1) }));
const celebrationCatalog = [
  ["demo-confetti", "كونفتي النجاح", "🎉", "#f59e0b", "#fb923c", "أحسنت!", "إجابة صحيحة", "celebrate-tada", "confetti"],
  ["demo-particles", "جزيئات النجم", "⭐", "#8b5cf6", "#ec4899", "نجم اليوم", "تقدم رائع", "celebrate-sparkle", "particles"],
  ["demo-both", "الانتصار الكبير", "🏆", "#16a34a", "#22c55e", "فوز مستحق", "استمر", "celebrate-fanfare", "both"],
].map(([id, label, icon, color, color2, tagline, hype, sound, renderMode], i) => ({ id, label, icon, color, color2, tagline, hype, sound, renderMode, isDefault: false, isCustom: true, sortOrder: i, createdAt: iso(1), updatedAt: iso(1) }));
const gameResults = manifests.map((manifest, lessonIndex) => ({ id: `demo_game_${lessonIndex + 1}`, sessionId, gameType: ["quiz-show", "memory", "wheel", "question-challenge"][lessonIndex], gameMode: lessonIndex === 2 ? "group" : "individual", startedAt: iso(14, 9 + lessonIndex, 10), endedAt: iso(14, 9 + lessonIndex, 25), durationMs: 900000, ideaId: manifest.ideas[lessonIndex % manifest.ideas.length].id, questionCount: 4, configJson: JSON.stringify({ source: "lesson", curriculumKey, lessonKey: manifest.lessonId, demo: true }) }));
const gameParticipants = [];
for (const [gameIndex, game] of gameResults.entries()) for (const student of students) gameParticipants.push({ id: `demo_participant_${gameIndex + 1}_${student.studentCode}`, gameResultId: game.id, studentId: student.id, studentName: student.name, pointsEarned: (gameIndex + 1) * 2 + (Number(student.studentCode.slice(-2)) % 5), correctCount: 2 + (Number(student.studentCode.slice(-2)) % 3), wrongCount: 1, isWinner: Number(student.studentCode.slice(-2)) === gameIndex + 1 });
const gameQuestions = [];
for (const [gameIndex, game] of gameResults.entries()) for (const q of questions.filter((x) => x.lessonId === lessons[gameIndex].id).slice(0, 2)) gameQuestions.push({ id: `demo_game_question_${gameIndex + 1}_${q.id}`, gameResultId: game.id, questionId: q.id, questionText: q.text, studentId: students[gameIndex].id, studentAnswer: gameIndex % 2 === 0 ? q.correctAnswer : (JSON.parse(q.optionsJson)[1] || q.correctAnswer), isCorrect: gameIndex % 2 === 0, pointsEarned: gameIndex % 2 === 0 ? q.rewardPoints : 0, answeredAt: iso(14, 9 + gameIndex, 20) });
const celebrationEvents = students.slice(0, 8).map((student, i) => ({ id: `demo_celebration_event_${i + 1}`, studentId: student.id, sessionId, celebrationId: celebrationCatalog[i % celebrationCatalog.length].id, celebrationLabel: celebrationCatalog[i % celebrationCatalog.length].label, celebrationIcon: celebrationCatalog[i % celebrationCatalog.length].icon, firedAt: iso(14, 10, i), note: "احتفال تجريبي" }));
const studentNotes = students.slice(0, 6).map((student, i) => ({ id: `demo_note_${i + 1}`, studentId: student.id, sessionId, text: ["يحتاج مثالاً إضافياً على المقام.", "شرح الفكرة لزملائه بصورة ممتازة.", "تحسن بعد السؤال الثاني.", "يحتاج وقتاً أطول في المقارنة.", "إجابة دقيقة وسريعة.", "شارك في لعبة الذاكرة."][i], isShared: i % 2 === 0, createdAt: iso(14, 10, i) }));
const studentActivities = [];
for (const student of students) {
  studentActivities.push({ id: `demo_activity_correct_${student.studentCode}`, studentId: student.id, sessionId, type: "correct", pointsDelta: 3, description: "إجابة صحيحة في فكرة الكسور", metadataJson: JSON.stringify({ curriculumKey, lessonKey: "demo-fractions-meaning", ideaKey: "meaning" }), createdAt: iso(14, 9, 30) });
  studentActivities.push({ id: `demo_activity_game_${student.studentCode}`, studentId: student.id, sessionId, type: "game", pointsDelta: 4, description: "نتيجة لعبة أسئلة الكسور", metadataJson: JSON.stringify({ gameType: "quiz-show", ideaId: "demo-fractions-meaning-meaning" }), createdAt: iso(14, 10, 30) });
}
const attendance = [{ id: "demo_attendance_001", classId, date: "2026-08-14", absentStudentIds: JSON.stringify([students[11].id]), createdAt: iso(14, 8) }];
const settings = [{ id: "singleton", settingsJson: JSON.stringify({ aiEnabled: true, liveSyncEnabled: false, workspaceMode: "landscape", iframeOrientation: "landscape", studentViewMode: "clean", activeClassId: classId, lessonContext: { curriculumKey, grade: "رابعة ابتدائي", subject: "رياضيات", demo: true } }), updatedAt: iso(14, 8) }];

const fractionSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-labelledby="title desc"><title id="title">تمثيل الكسر</title><desc id="desc">دائرة مقسمة إلى أربعة أجزاء مع تظليل جزأين</desc><rect width="640" height="360" rx="28" fill="#0b1d3a"/><circle cx="320" cy="180" r="112" fill="#1e3a8a" stroke="#bfdbfe" stroke-width="8"/><path d="M320 68a112 112 0 0 1 112 112H320Z" fill="#f59e0b"/><path d="M320 180h112a112 112 0 0 1-112 112Z" fill="#f59e0b"/><path d="M320 180V68M320 180h112M320 180v112" stroke="#dbeafe" stroke-width="5"/><text x="320" y="338" text-anchor="middle" font-family="Tahoma,Arial" font-size="22" fill="#e0f2fe">2/4 = 1/2</text></svg>`;
fs.writeFileSync(path.join(assetsDir, "fraction-parts.svg"), fractionSvg);

const backup = {
  __version: "6.0-demo",
  __exportedAt: new Date().toISOString(),
  tables: { classes, students, badges, studentGifts: gifts, groups, attendance, lessons, questions, sessions: session, sessionSnapshots: snapshots, gameResults, gameParticipants, gameQuestions, prizes, giftCatalog, customSounds: [], settings, backupHistory: [], celebrationCatalog, celebrationEvents, studentNotes, studentActivities },
};
fs.writeFileSync(path.join(outDir, "bisalasa-demo-backup.json"), JSON.stringify(backup, null, 2));
fs.writeFileSync(path.join(outDir, "students.csv"), `name,studentCode,moodleUserId,moodleUsername\n${students.map((s) => `${s.name},${s.studentCode},${s.moodleUserId},${s.moodleUsername}`).join("\n")}\n`);
for (const lesson of lessons) fs.writeFileSync(path.join(lessonsDir, lesson.fileName), lesson.content);
const summary = { className: classes[0].name, students: students.length, groups: groups.length, lessons: lessons.length, ideas: manifests.reduce((n, m) => n + m.ideas.length, 0), questions: questions.length, sessions: session.length, games: gameResults.length, gameParticipants: gameParticipants.length, activities: studentActivities.length, notes: studentNotes.length, celebrations: celebrationEvents.length, importMethods: ["Settings > نسخة JSON > استعادة", "Curriculum > استيراد شرائح HTML"] };
fs.writeFileSync(path.join(outDir, "demo-summary.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(outDir, "README_AR.md"), `# حزمة تجربة بسالسة — فصل رابعة ابتدائي رياضيات\n\nهذه الحزمة تحتوي على **فصل تجريبي كامل**: ${summary.students} طالباً، ${summary.groups} مجموعات، ${summary.lessons} دروس، ${summary.ideas} أفكار، ${summary.questions} سؤالاً، جلسة حصة، ${summary.games} ألعاب، أنشطة ونقاط وشارات واحتفالات وملاحظات.\n\n## الطريقة الأسرع: استعادة كل البيانات مرة واحدة\n\n1. افتح المنصة بوضع المدرس.\n2. افتح لوحة **الإعدادات**.\n3. اختر **نسخة JSON > استعادة**.\n4. اختر الملف \`bisalasa-demo-backup.json\`.\n5. وافق على رسالة الاستبدال.\n6. افتح **الفصول** واختر فصل \`${classes[0].name}\`.\n7. افتح **المنهج** واختر أحد الدروس، ثم جرّب الألعاب والتقارير والطلاب والدرجات.\n\n> الاستعادة تستبدل البيانات الموجودة؛ خذ نسخة JSON من الإعدادات أولاً إذا لديك بيانات مهمة.\n\n## استيراد الدروس كملفات HTML\n\nإذا أردت تجربة زر استيراد المنهج نفسه، افتح لوحة **المنهج** واختر كل الملفات داخل مجلد \`lessons\` معاً. كل ملف يحتوي على \`slide-manifest\`، وأربع أسئلة تفاعلية داخل كل فكرة.\n\n## بيانات التجربة\n\nالطلاب موزعون على ${summary.groups} مجموعات. يوجد طالب غائب، جلسة حصة، نتائج ألعاب، نقاط محلية، شارات، ملاحظات، واحتفالات. تتضمن الحزمة أصلاً تعليمياً SVG جاهزاً للعرض وصور هدايا WebP محلية. أسماء الطلاب وبيانات Moodle تجريبية وليست بيانات حقيقية.
\n\n## ملاحظة Moodle\n\nحقول Moodle التجريبية موجودة على الطلاب لاختبار المطابقة والواجهة. لا يتم الاتصال بـMoodle الحقيقي من الملف؛ استخدم mock Moodle أو إعداد التكامل من لوحة الإعدادات إذا أردت اختبار السحب الحي.\n`);
console.log(JSON.stringify(summary));
