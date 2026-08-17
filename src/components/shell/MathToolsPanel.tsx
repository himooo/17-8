import { useMemo, useState } from "react";
import { BarChart3, Calculator, FileDown, FunctionSquare, GitBranch, Ruler, Sigma, Trophy, X } from "lucide-react";
import { useShellStore } from "@/lib/shell-store";
import {
  addFractions,
  circleGeometry,
  convertLength,
  divideFractions,
  evaluateArithmetic,
  fractionToDecimal,
  fractionToMixed,
  fractionToString,
  mean,
  median,
  mode,
  multiplyFractions,
  pythagoreanHypotenuse,
  rectangularPrismVolume,
  parseFraction,
  rectangleGeometry,
  subtractFractions,
  triangleGeometry,
} from "@/lib/math-engine";
import { cn } from "@/lib/utils";
import { exportCurrentStageToPdf } from "@/lib/pdf-export";

type MathTab = "calculator" | "fractions" | "geometry" | "graph" | "stats" | "units" | "missions";
type MissionMode = "fraction" | "geometry" | "equation";

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-border bg-background/80 px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
      />
    </label>
  );
}

function ResultBox({ value, onInsert }: { value: string; onInsert: () => void }) {
  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
      <div className="text-[10px] font-bold text-primary">الناتج الرياضي</div>
      <div dir="ltr" className="mt-1 break-words text-lg font-bold text-foreground">{value}</div>
      <button onClick={onInsert} className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90">
        إدراج الناتج على السبورة
      </button>
    </div>
  );
}

export function MathToolsPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<MathTab>("calculator");
  const [error, setError] = useState("");
  const [calcInput, setCalcInput] = useState("(3+5)×2");
  const [calcResult, setCalcResult] = useState("");
  const [latexInput, setLatexInput] = useState("\\frac{x}{2} + \\sqrt{4} = 3");
  const [fractionA, setFractionA] = useState("3/4");
  const [fractionB, setFractionB] = useState("1/2");
  const [fractionOp, setFractionOp] = useState<"+" | "-" | "×" | "÷">("+");
  const [fractionResult, setFractionResult] = useState("");
  const [shape, setShape] = useState<"rectangle" | "circle" | "triangle">("rectangle");
  const [a, setA] = useState("8");
  const [b, setB] = useState("5");
  const [c, setC] = useState("6");
  const [geometryResult, setGeometryResult] = useState("");
  const [slope, setSlope] = useState("1");
  const [intercept, setIntercept] = useState("0");
  const [graphResult, setGraphResult] = useState("");
  const [exporting, setExporting] = useState(false);
  const [missionMode, setMissionMode] = useState<MissionMode>("fraction");
  const [missionQuestion, setMissionQuestion] = useState("");
  const [missionAnswer, setMissionAnswer] = useState("");
  const [missionInput, setMissionInput] = useState("");
  const [missionScore, setMissionScore] = useState(0);
  const [missionStatus, setMissionStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [statsInput, setStatsInput] = useState("2, 3, 3, 7, 10");
  const [statsResult, setStatsResult] = useState("");
  const [unitInput, setUnitInput] = useState("150");
  const [unitFrom, setUnitFrom] = useState<"mm" | "cm" | "m" | "km">("cm");
  const [unitTo, setUnitTo] = useState<"mm" | "cm" | "m" | "km">("m");
  const [unitResult, setUnitResult] = useState("");
  const currentStep = useShellStore((store) => store.currentStep);
  const currentIdeaId = useShellStore((store) => store.currentIdeaId);
  const activeLessonId = useShellStore((store) => store.activeLessonId);
  const currentStudent = useShellStore((store) => store.currentlyCalledStudent);
  const awardCorrect = useShellStore((store) => store.awardCorrect);
  const awardWrong = useShellStore((store) => store.awardWrong);
  const setActivePanel = useShellStore((store) => store.setActivePanel);
  const closePanel = onClose ?? (() => setActivePanel(null));

  const createMission = (mode: MissionMode = missionMode) => {
    setMissionMode(mode);
    setMissionStatus("idle");
    setMissionInput("");
    if (mode === "fraction") {
      setMissionQuestion("احسب: 1/2 + 1/4");
      setMissionAnswer("3/4");
    } else if (mode === "geometry") {
      setMissionQuestion("مستطيل عرضه 5 وارتفاعه 3. ما مساحته؟");
      setMissionAnswer("15");
    } else {
      setMissionQuestion("حل: 2x + 3 = 11. ما قيمة x؟");
      setMissionAnswer("4");
    }
  };

  const submitMission = () => {
    const normalizedInput = missionInput.trim().replace(/\s+/g, "");
    const normalizedAnswer = missionAnswer.replace(/\s+/g, "");
    const isCorrect = missionMode === "fraction"
      ? (() => { try { return fractionToString(parseFraction(normalizedInput)) === normalizedAnswer; } catch { return false; } })()
      : Number(normalizedInput) === Number(normalizedAnswer);
    setMissionStatus(isCorrect ? "correct" : "wrong");
    if (isCorrect) {
      setMissionScore((score) => score + 1);
      if (currentStudent) awardCorrect(currentStudent.id, 3);
    } else if (currentStudent) {
      awardWrong(currentStudent.id);
    }
  };

  const saveStagePdf = async () => {
    try {
      setExporting(true);
      setError("");
      await exportCurrentStageToPdf({ filename: `بسلاسة-الشريحة-${currentStep}-${new Date().toISOString().slice(0, 10)}`, orientation: "landscape" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إنشاء ملف PDF");
    } finally {
      setExporting(false);
    }
  };

  const insert = (text: string, latex = false) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("bisalasa:insert-math", {
      detail: { text, latex, step: currentStep, ideaId: currentIdeaId, lessonId: activeLessonId },
    }));
  };

  const run = (action: () => string, setter: (value: string) => void) => {
    try {
      setError("");
      setter(action());
    } catch (caught) {
      setter("");
      setError(caught instanceof Error ? caught.message : "تعذر تنفيذ العملية");
    }
  };

  const graphPath = useMemo(() => {
    const m = Number(slope) || 0;
    const k = Number(intercept) || 0;
    const points = Array.from({ length: 41 }, (_, index) => {
      const x = -5 + index / 4;
      const y = m * x + k;
      const sx = 130 + x * 18;
      const sy = 90 - y * 14;
      return `${index === 0 ? "M" : "L"}${sx.toFixed(1)},${sy.toFixed(1)}`;
    });
    return { path: points.join(" "), label: `y = ${m}x ${k >= 0 ? "+" : "-"} ${Math.abs(k)}` };
  }, [slope, intercept]);

  const tabs: Array<{ id: MathTab; label: string; icon: typeof Calculator }> = [
    { id: "calculator", label: "حاسبة", icon: Calculator },
    { id: "fractions", label: "كسور", icon: GitBranch },
    { id: "geometry", label: "هندسة", icon: Ruler },
    { id: "graph", label: "رسم", icon: FunctionSquare },
    { id: "stats", label: "إحصاء", icon: BarChart3 },
    { id: "units", label: "وحدات", icon: Ruler },
    { id: "missions", label: "مهمات", icon: Trophy },
  ];

  return (
    <section dir="rtl" className="absolute right-3 top-3 z-[60] w-[min(360px,calc(100%-24px))] overflow-hidden rounded-2xl border border-primary/30 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-border bg-primary/10 px-3 py-2">
        <div>
          <div className="text-sm font-black">مختبر الرياضيات</div>
          <div className="text-[10px] text-muted-foreground">مرتبط بالشريحة {currentStep}{currentIdeaId ? ` • ${currentIdeaId}` : ""}</div>
        </div>
        <div className="flex items-center gap-1">
          <button aria-label="حفظ الشريحة والسبورة PDF" onClick={saveStagePdf} disabled={exporting} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50" title="حفظ الشريحة الحالية مع شرح السبورة PDF"><FileDown className="h-4 w-4" /></button>
          <button aria-label="إغلاق أدوات الرياضيات" onClick={closePanel} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="grid grid-cols-4 gap-1 border-b border-border p-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setError(""); }} className={cn("flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px]", tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      <div className="max-h-[min(520px,70vh)] overflow-y-auto p-3">
        {tab === "calculator" && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold"><Calculator className="h-4 w-4 text-primary" /> حساب آمن بلا تنفيذ كود</div>
            <input dir="ltr" value={calcInput} onChange={(event) => setCalcInput(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-lg font-semibold outline-none focus:ring-2 focus:ring-primary/50" aria-label="التعبير الحسابي" />
            <div className="mt-2 grid grid-cols-4 gap-1 text-xs">
              {["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "(", ")"].map((key) => <button key={key} onClick={() => setCalcInput((value) => `${value}${key}`)} className="rounded bg-secondary px-2 py-2 font-bold hover:bg-accent">{key}</button>)}
            </div>
            <button onClick={() => run(() => String(evaluateArithmetic(calcInput)), setCalcResult)} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">احسب</button>
            <div className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/10 p-2"><div className="mb-1 flex items-center gap-1 text-xs font-bold"><Sigma className="h-4 w-4 text-violet-300" /> معادلة LaTeX</div><input dir="ltr" value={latexInput} onChange={(event) => setLatexInput(event.target.value)} aria-label="معادلة LaTeX" className="h-9 w-full rounded border border-border bg-background px-2 text-sm" /><button onClick={() => insert(latexInput, true)} className="mt-2 w-full rounded bg-violet-600 px-2 py-1.5 text-xs font-bold text-white">إدراج المعادلة على السبورة</button></div>
            {calcResult && <ResultBox value={calcResult} onInsert={() => insert(`الحساب: ${calcInput} = ${calcResult}`)} />}
          </div>
        )}
        {tab === "fractions" && (
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold"><GitBranch className="h-4 w-4 text-primary" /> عمليات الكسور مع التبسيط</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Field label="الكسر الأول" value={fractionA} onChange={setFractionA} />
              <select value={fractionOp} onChange={(event) => setFractionOp(event.target.value as typeof fractionOp)} className="h-8 rounded-md border border-border bg-background px-2 text-lg"><option>+</option><option>-</option><option>×</option><option>÷</option></select>
              <Field label="الكسر الثاني" value={fractionB} onChange={setFractionB} />
            </div>
            <button onClick={() => run(() => { const left = parseFraction(fractionA); const right = parseFraction(fractionB); const result = fractionOp === "+" ? addFractions(left, right) : fractionOp === "-" ? subtractFractions(left, right) : fractionOp === "×" ? multiplyFractions(left, right) : divideFractions(left, right); return `${fractionToString(result)} = ${fractionToMixed(result)} ≈ ${fractionToDecimal(result)}`; }, setFractionResult)} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">بسّط واحسب</button>
            {fractionResult && <ResultBox value={fractionResult} onInsert={() => insert(`كسر: ${fractionA} ${fractionOp} ${fractionB} = ${fractionResult}`)} />}
          </div>
        )}
        {tab === "geometry" && (
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold"><Ruler className="h-4 w-4 text-primary" /> مساحة ومحيط وقياسات</div>
            <div className="grid grid-cols-3 gap-1 mb-3">
              {(["rectangle", "circle", "triangle"] as const).map((id) => <button key={id} onClick={() => setShape(id)} className={cn("rounded-md px-2 py-2 text-[11px]", shape === id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent")}>{id === "rectangle" ? "مستطيل" : id === "circle" ? "دائرة" : "مثلث"}</button>)}
            </div>
            <div className="grid grid-cols-2 gap-2"><Field label={shape === "circle" ? "نصف القطر" : shape === "triangle" ? "القاعدة" : "العرض"} value={a} onChange={setA} type="number" /><Field label={shape === "circle" ? "—" : shape === "triangle" ? "الارتفاع" : "الارتفاع"} value={b} onChange={setB} type="number" />{shape === "triangle" && <Field label="الضلع الثالث (اختياري)" value={c} onChange={setC} type="number" />}</div>
            <div className="mt-3 rounded-xl border border-border bg-background p-2"><svg viewBox="0 0 280 130" className="h-32 w-full" role="img" aria-label={`معاينة ${shape}`}>
              {shape === "rectangle" && <rect x="70" y="25" width="140" height="80" rx="3" fill="rgba(37,99,235,.18)" stroke="#2563eb" strokeWidth="3" />}
              {shape === "circle" && <circle cx="140" cy="65" r="45" fill="rgba(16,185,129,.18)" stroke="#10b981" strokeWidth="3" />}
              {shape === "triangle" && <path d="M140 20 L70 105 L210 105 Z" fill="rgba(245,158,11,.18)" stroke="#f59e0b" strokeWidth="3" />}
              <text x="140" y="122" textAnchor="middle" fontSize="11" fill="currentColor">{shape === "rectangle" ? `${a} × ${b}` : shape === "circle" ? `r = ${a}` : `${a} × ${b} ÷ 2`}</text>
            </svg></div>
            <button onClick={() => run(() => { const x = Number(a); const y = Number(b); const result = shape === "circle" ? circleGeometry(x) : shape === "triangle" ? triangleGeometry(x, y, x, y, Number(c)) : rectangleGeometry(x, y); return `${result.label}: المساحة ${result.area} • المحيط ${result.perimeter || "أدخل الأضلاع"}`; }, setGeometryResult)} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">احسب القياسات</button>
            {geometryResult && <ResultBox value={geometryResult} onInsert={() => insert(geometryResult)} />}
          </div>
        )}
        {tab === "stats" && (
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold"><BarChart3 className="h-4 w-4 text-primary" /> تحليل مجموعة بيانات</div>
            <Field label="القيم مفصولة بفواصل" value={statsInput} onChange={setStatsInput} />
            <button onClick={() => run(() => { const values = statsInput.split(",").map((value) => Number(value.trim())); const average = mean(values); const middle = median(values); const common = mode(values); return `المتوسط ${average} • الوسيط ${middle} • المنوال ${common ?? "لا يوجد"}`; }, setStatsResult)} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">حلّل البيانات</button>
            {statsResult && <ResultBox value={statsResult} onInsert={() => insert(`إحصاء: ${statsResult}`)} />}
          </div>
        )}
        {tab === "units" && (
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold"><Ruler className="h-4 w-4 text-primary" /> تحويلات وقياسات</div>
            <Field label="القيمة" value={unitInput} onChange={setUnitInput} type="number" />
            <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[11px] text-muted-foreground">من<select value={unitFrom} onChange={(event) => setUnitFrom(event.target.value as typeof unitFrom)} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"><option value="mm">ملم</option><option value="cm">سم</option><option value="m">متر</option><option value="km">كم</option></select></label><label className="text-[11px] text-muted-foreground">إلى<select value={unitTo} onChange={(event) => setUnitTo(event.target.value as typeof unitTo)} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"><option value="mm">ملم</option><option value="cm">سم</option><option value="m">متر</option><option value="km">كم</option></select></label></div>
            <button onClick={() => run(() => `${convertLength(Number(unitInput), unitFrom, unitTo)} ${unitTo}`, setUnitResult)} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">حوّل</button>
            {unitResult && <ResultBox value={unitResult} onInsert={() => insert(`تحويل: ${unitInput} ${unitFrom} = ${unitResult}`)} />}
            <button onClick={() => run(() => `فيثاغورس: الوتر = ${pythagoreanHypotenuse(Number(a), Number(b))}`, setUnitResult)} className="mt-2 w-full rounded-lg bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent">احسب الوتر من أبعاد الهندسة الحالية</button>
            <button onClick={() => run(() => `حجم متوازي المستطيلات = ${rectangularPrismVolume(Number(a), Number(b), Number(c))}`, setUnitResult)} className="mt-2 w-full rounded-lg bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent">احسب الحجم من الأبعاد الحالية</button>
          </div>
        )}
        {tab === "missions" && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-bold"><Trophy className="h-4 w-4 text-amber-400" /> مهمات رياضية تحت تحكم المدرس</div><span className="rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-bold text-amber-500">النتيجة {missionScore}</span></div>
            <div className="grid grid-cols-3 gap-1 mb-3">{(["fraction", "geometry", "equation"] as const).map((mode) => <button key={mode} onClick={() => createMission(mode)} className={cn("rounded-md px-2 py-2 text-[10px]", missionMode === mode ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent")}>{mode === "fraction" ? "كسور" : mode === "geometry" ? "هندسة" : "معادلات"}</button>)}</div>
            {!missionQuestion ? <button onClick={() => createMission()} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">ابدأ مهمة</button> : <>
              <div className="rounded-xl border border-border bg-background p-4 text-center text-base font-bold">{missionQuestion}</div>
              <input dir="ltr" value={missionInput} onChange={(event) => setMissionInput(event.target.value)} placeholder="إجابة الطالب" className="mt-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-center text-lg outline-none focus:ring-2 focus:ring-primary/50" />
              <button onClick={submitMission} className="mt-2 w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white">تحقق وسجّل</button>
              <div className="mt-2 flex gap-2"><button onClick={() => setMissionAnswer(missionAnswer)} className="flex-1 rounded-md bg-secondary px-2 py-2 text-xs">إظهار الحل للمدرس: {missionAnswer}</button><button onClick={() => createMission()} className="rounded-md bg-secondary px-3 py-2 text-xs">مهمة أخرى</button></div>
              {missionStatus !== "idle" && <div role="status" className={cn("mt-3 rounded-md p-2 text-center text-xs font-bold", missionStatus === "correct" ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600")}>{missionStatus === "correct" ? `إجابة صحيحة${currentStudent ? ` — ${currentStudent.name} +3` : ""}` : `إجابة غير صحيحة — الحل ${missionAnswer}`}</div>}
            </>}
            {!currentStudent && <div className="mt-3 text-center text-[10px] text-muted-foreground">اختر طالباً من غرفة العمليات لتسجيل النقاط. المهمة نفسها تعمل دون تسجيل.</div>}
          </div>
        )}
        {tab === "graph" && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold"><FunctionSquare className="h-4 w-4 text-primary" /> رسم دالة خطية</div>
            <div className="grid grid-cols-2 gap-2"><Field label="الميل m" value={slope} onChange={setSlope} type="number" /><Field label="المقطع b" value={intercept} onChange={setIntercept} type="number" /></div>
            <div className="mt-3 rounded-xl border border-border bg-background p-2"><svg viewBox="0 0 260 180" className="h-44 w-full" role="img" aria-label={`رسم ${graphPath.label}`}><path d="M0 90H260 M130 0V180" stroke="currentColor" opacity=".25" /><path d={graphPath.path} fill="none" stroke="#2563eb" strokeWidth="3" /><text x="8" y="16" fontSize="11" fill="currentColor" direction="ltr">{graphPath.label}</text></svg></div>
            <button onClick={() => { setGraphResult(graphPath.label); insert(`الرسم البياني: ${graphPath.label}`); }} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">إدراج الدالة على السبورة</button>
          </div>
        )}
        {error && <div role="alert" className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-200">{error}</div>}
        {graphResult && tab === "graph" && <div className="mt-2 text-center text-xs font-bold text-primary">تم إدراج {graphResult}</div>}
      </div>
    </section>
  );
}
