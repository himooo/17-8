"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Check, Eye, EyeOff, KeyRound, Loader2, Plus, RefreshCw, RotateCw, Save, Sparkles, Trash2, Wifi } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { aiClient, localDb, type AiDiscoveredModel, type AiKeySummary, type AiProvider } from "@/lib/local-db";
import { useShellStore } from "@/lib/shell-store";
import type { LessonQuestion } from "@/lib/slide-schema";
import { buildSmartContext } from "@/lib/smart-context";
import { AI_PROVIDER_PRESETS } from "@/lib/settings-ai-v10";

type PromptMode = "chat" | "lesson" | "questions" | "analysis" | "activity";
type StructuredAction = "analyzeLesson" | "generateQuestions" | "whiteboardAssist";

const PRESETS: Array<{ id: Exclude<PromptMode, "chat">; label: string; prompt: string }> = [
  { id: "lesson", label: "فكرة درس", prompt: "اقترح فكرة درس تفاعلي مناسبة للعمر والمادة التي سأذكرها، مع هدف تعلم واضح، تمهيد قصير، نشاط عملي، وسؤال ختامي." },
  { id: "questions", label: "أسئلة", prompt: "أنشئ 5 أسئلة تعليمية متنوعة عن الموضوع المذكور، مع إجابة نموذجية ومستوى صعوبة وبديل مبسط لكل سؤال." },
  { id: "analysis", label: "تحليل", prompt: "حلّل الفكرة أو الخطوة الحالية تربوياً، واذكر ما الذي يعمل جيداً، وما التحسينات العملية القصيرة التي تحافظ على تفاعل الفصل." },
  { id: "activity", label: "نشاط جماعي", prompt: "صمّم نشاطاً صفياً جماعياً مدته 10 دقائق، سهل التنفيذ، لا يحتاج تجهيزاً معقداً، ويستخدم الاختيار والاحتفال والتغذية الراجعة بطريقة متوازنة." },
];

export function AiPanel() {
  const settings = useShellStore((s) => s.settings);
  const updateSettings = useShellStore((s) => s.updateSettings);
  const manifest = useShellStore((s) => s.manifest);
  const currentStep = useShellStore((s) => s.currentStep);
  const setAiQuestionPool = useShellStore((s) => s.setAiQuestionPool);
  const activeLessonId = useShellStore((s) => s.activeLessonId);
  const lessons = useShellStore((s) => s.lessons);
  const [mode, setMode] = useState<PromptMode>("chat");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<AiKeySummary[]>([]);
  const [envConfigured, setEnvConfigured] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [label, setLabel] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [model, setModel] = useState(settings.aiModel || "gemini-2.5-flash");
  const [provider, setProvider] = useState<AiProvider>("google");
  const [apiKind, setApiKind] = useState<string>("provider");
  const [specialty, setSpecialty] = useState("general");
  const [scopes, setScopes] = useState("generate");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelsUrl, setModelsUrl] = useState("");
  const [chatUrl, setChatUrl] = useState("");
  const [availableModels, setAvailableModels] = useState<AiDiscoveredModel[]>([]);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [priority, setPriority] = useState("0");
  const [showSecret, setShowSecret] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<string | undefined>();
  const [structuredBusy, setStructuredBusy] = useState(false);
  const [structuredResult, setStructuredResult] = useState<Record<string, unknown> | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<Array<Record<string, unknown>>>([]);
  const [savedLessonContext, setSavedLessonContext] = useState<unknown>(undefined);

  const students = useShellStore((state) => state.students);
  const lessonQuestions = useShellStore((state) => state.lessonQuestions);
  const studentLiveStatuses = useShellStore((state) => state.studentLiveStatuses);
  const sessionStats = useShellStore((state) => state.sessionStats);
  const currentIdeaId = useShellStore((state) => state.currentIdeaId);
  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId);
  const smartContext = useMemo(() => buildSmartContext({
    manifest,
    currentStep: currentStep + 1,
    currentIdeaId,
    lessonQuestions,
    lessonContext: savedLessonContext,
    students,
    liveStatuses: studentLiveStatuses,
    sessionStats: sessionStats as unknown as Record<string, unknown>,
    teacherNotesAllowed: settings.aiIncludeLessonContext === true,
    studentDataAllowed: false,
    maxChars: 16000,
  }), [currentIdeaId, currentStep, lessonQuestions, manifest, savedLessonContext, settings.aiIncludeLessonContext, sessionStats, studentLiveStatuses, students]);
  const lessonContext = activeLesson?.title ? `عنوان الدرس: ${activeLesson.title}\n${smartContext.text}` : smartContext.text;
  const structuredContext = smartContext.text;

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(async () => {
      try {
        const result = await aiClient.listKeys();
        if (alive) {
          setKeys(result.keys);
          setEnvConfigured(result.envConfigured);
          const settingsResult = await localDb.settings.get();
          if (alive && settingsResult.lessonContext !== undefined) setSavedLessonContext(settingsResult.lessonContext);
        }
      } catch (loadError) {
        if (alive) setError(loadError instanceof Error ? loadError.message : "تعذر تحميل مفاتيح AI");
      }
    });
    return () => { alive = false; };
  }, []);

  const runPrompt = async (nextMode: PromptMode = mode) => {
    const base = prompt.trim() || PRESETS.find((item) => item.id === nextMode)?.prompt || "ساعدني في تحسين هذا الدرس بطريقة عملية.";
    const context = settings.aiIncludeLessonContext ? `\n\n${lessonContext}` : "";
    setBusy(true);
    setError(null);
    setAnswer("");
    try {
      const result = await aiClient.generate({
        input: `${base}${context}`,
        model: settings.aiModel,
        keyId: selectedKeyId,
        temperature: settings.aiTemperature,
        maxOutputTokens: settings.aiMaxOutputTokens,
        operation: nextMode,
        systemInstruction: "أنت مساعد تربوي داخل تطبيق بسلاسة. حافظ على بساطة المعلم وملكية القرار بيده. لا تخترع بيانات عن الطلاب، ولا تطلب أسماء أو معلومات شخصية. اكتب بالعربية الواضحة، واجعل الاقتراحات قابلة للتنفيذ داخل الفصل.",
      });
      setAnswer(result.text);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "تعذر تنفيذ طلب AI");
    } finally {
      setBusy(false);
    }
  };

  const runStructured = async (action: StructuredAction) => {
    if (!settings.aiEnabled) return;
    setStructuredBusy(true);
    setStructuredResult(null);
    setGeneratedQuestions([]);
    setError(null);
    try {
      if (action === "analyzeLesson") {
        const result = await aiClient.analyzeLesson({
          input: structuredContext,
          model: settings.aiModel,
          keyId: selectedKeyId,
          temperature: settings.aiTemperature,
          maxOutputTokens: settings.aiMaxOutputTokens,
        });
        setStructuredResult(result.result);
      } else if (action === "generateQuestions") {
        const result = await aiClient.generateQuestions({
          input: structuredContext,
          lessonId: manifest?.lessonId,
          count: 8,
          model: settings.aiModel,
          keyId: selectedKeyId,
          temperature: settings.aiTemperature,
          maxOutputTokens: settings.aiMaxOutputTokens,
        });
        setGeneratedQuestions(result.questions);
        setStructuredResult({ generated: result.questions.length, rejected: result.rejected.length, rejectedDetails: result.rejected });
      } else {
        const result = await aiClient.whiteboardAssist({
          input: `${structuredContext}\n\nالمطلوب: اقترح شرحاً رياضياً قصيراً مناسباً للكتابة على السبورة، بخطوات واضحة ورموز نصية بسيطة.`,
          model: settings.aiModel,
          keyId: selectedKeyId,
          temperature: settings.aiTemperature,
          maxOutputTokens: settings.aiMaxOutputTokens,
        });
        setStructuredResult(result.result);
      }
    } catch (structuredError) {
      setError(structuredError instanceof Error ? structuredError.message : "تعذر تنفيذ العملية المنظمة");
    } finally {
      setStructuredBusy(false);
    }
  };

  const normalizeGeneratedQuestion = (raw: Record<string, unknown>, index: number): LessonQuestion | null => {
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!text) return null;
    const options = Array.isArray(raw.options) ? raw.options.filter((option): option is string => typeof option === "string" && option.trim().length > 0).map((option) => option.trim()) : undefined;
    const difficulty = raw.difficulty === "easy" || raw.difficulty === "medium" || raw.difficulty === "hard" ? raw.difficulty : "medium";
    const correctAnswer = typeof raw.correctAnswer === "string" || typeof raw.correctAnswer === "number" ? raw.correctAnswer : undefined;
    const tags = Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === "string") : ["ai-generated"];
    return {
      text,
      options: options && options.length > 0 ? options : undefined,
      correctAnswer,
      rewardPoints: typeof raw.rewardPoints === "number" && raw.rewardPoints >= 0 ? Math.round(raw.rewardPoints) : 5,
      lessonId: manifest?.lessonId,
      ideaId: "ai-generated",
      ideaTitle: "أسئلة مولدة بالذكاء الاصطناعي",
      step: index + 1,
      stepNumber: index + 1,
      difficulty,
      tags: Array.from(new Set([...tags, "ai-generated"])),
      gameReady: true,
    };
  };

  const approveGeneratedQuestions = () => {
    const normalized = generatedQuestions.map(normalizeGeneratedQuestion).filter((question): question is LessonQuestion => Boolean(question));
    if (normalized.length === 0) {
      setError("لا توجد أسئلة صالحة للاعتماد بعد المراجعة.");
      return;
    }
    setAiQuestionPool(normalized);
    setStructuredResult({ approvedForGames: normalized.length, message: "اعتمدها المدرس كمصدر مستقل للألعاب." });
  };

  const insertWhiteboardDraft = () => {
    if (!structuredResult) return;
    const result = structuredResult as Record<string, unknown>;
    const directCandidate = result.boardText ?? result.explanation ?? result.solution ?? result.content ?? result.summary;
    let text = typeof directCandidate === "string" ? directCandidate.trim() : "";

    // Keep AI output teacher-friendly when a structured math response has no boardText.
    // Sending JSON.stringify directly makes implementation keys visible on the lesson canvas.
    if (!text && result.kind === "equation") {
      const lines: string[] = [];
      if (typeof result.title === "string" && result.title.trim()) lines.push(result.title.trim());
      if (typeof result.text === "string" && result.text.trim()) lines.push(result.text.trim());
      if (typeof result.latex === "string" && result.latex.trim()) lines.push(result.latex.trim());
      if (Array.isArray(result.steps)) {
        const steps = result.steps.filter((step): step is string => typeof step === "string" && step.trim().length > 0);
        if (steps.length) lines.push(`الخطوات:\n${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`);
      }
      text = lines.join("\n\n");
    }

    if (!text && typeof result.text === "string") text = result.text.trim();
    if (!text && Array.isArray(result.steps)) {
      const steps = result.steps.filter((step): step is string => typeof step === "string" && step.trim().length > 0);
      text = steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
    }
    if (!text) text = "مسودة السبورة من مساعد AI — راجعها قبل العرض.";
    window.dispatchEvent(new CustomEvent("bisalasa:whiteboard-ai-text", { detail: { text } }));
  };

  const refreshKeys = async () => {
    try {
      const result = await aiClient.listKeys();
      setKeys(result.keys);
      setEnvConfigured(result.envConfigured);
    } catch (loadError) {
      setKeyStatus(loadError instanceof Error ? loadError.message : "تعذر تحديث المفاتيح");
    }
  };

  const fetchModels = async () => {
    setModelsBusy(true);
    setKeyStatus(null);
    try {
      const models = keyValue.trim()
        ? await aiClient.previewModels({ provider, key: keyValue.trim(), baseUrl: baseUrl.trim() || undefined, modelsUrl: modelsUrl.trim() || undefined, chatUrl: chatUrl.trim() || undefined })
        : selectedKeyId
          ? await aiClient.listModels({ provider, keyId: selectedKeyId })
          : [];
      if (!models.length) throw new Error("لم يُرجع المزود موديلات قابلة للاستخدام");
      setAvailableModels(models);
      setModel(models[0].id);
      setKeyStatus(`تم تحميل ${models.length} موديل. اختر الموديل ثم احفظ المفتاح.`);
    } catch (modelError) {
      setKeyStatus(modelError instanceof Error ? modelError.message : "تعذر تحميل الموديلات");
    } finally {
      setModelsBusy(false);
    }
  };

  const providerOptions = Object.entries(AI_PROVIDER_PRESETS);

  const handleProviderChange = (next: AiProvider) => {
    setProvider(next);
    const preset = AI_PROVIDER_PRESETS[next as keyof typeof AI_PROVIDER_PRESETS];
    setApiKind(preset?.kind || (next === "google" ? "provider" : "openai-compatible"));
    setBaseUrl(preset?.baseUrl || "");
    setModel(preset?.defaultModel || model);
    setAvailableModels([]);
  };

  const addKey = async () => {
    if (!label.trim() || !keyValue.trim()) return setKeyStatus("اكتب اسم المفتاح وقيمته أولاً");
    setKeyBusy(true);
    setKeyStatus(null);
    try {
      await aiClient.createKey({ label, key: keyValue, provider, apiKind, specialty, scopesJson: JSON.stringify(scopes.split(",").map((value) => value.trim()).filter(Boolean)), capabilitiesJson: JSON.stringify(AI_PROVIDER_PRESETS[provider as keyof typeof AI_PROVIDER_PRESETS]?.capabilities || ["text"]), baseUrl: baseUrl.trim() || undefined, modelsUrl: modelsUrl.trim() || undefined, chatUrl: chatUrl.trim() || undefined, model, priority: Number(priority) || 0 });
      setLabel("");
      setKeyValue("");
      setShowKeyForm(false);
      setAvailableModels([]);
      setBaseUrl("");
      setModelsUrl("");
      setChatUrl("");
      setKeyStatus("تمت إضافة المفتاح بشكل مشفر. لن تظهر قيمته مرة أخرى.");
      await refreshKeys();
    } catch (addError) {
      setKeyStatus(addError instanceof Error ? addError.message : "تعذر إضافة المفتاح");
    } finally {
      setKeyBusy(false);
    }
  };

  const changePriority = async (key: AiKeySummary, delta: number) => {
    setKeyBusy(true);
    try {
      await aiClient.updateKey({ id: key.id, priority: Math.max(0, key.priority + delta) });
      await refreshKeys();
    } catch (priorityError) {
      setKeyStatus(priorityError instanceof Error ? priorityError.message : "تعذر تغيير الأولوية");
    } finally {
      setKeyBusy(false);
    }
  };

  const reactivateKey = async (key: AiKeySummary) => {
    setKeyBusy(true);
    try {
      await aiClient.reactivateKey(key.id);
      setKeyStatus("تمت إعادة تفعيل المفتاح؛ سيعود للتجربة حسب الأولوية.");
      await refreshKeys();
    } catch (reactivateError) {
      setKeyStatus(reactivateError instanceof Error ? reactivateError.message : "تعذر إعادة تفعيل المفتاح");
    } finally {
      setKeyBusy(false);
    }
  };

  const toggleKey = async (key: AiKeySummary) => {
    setKeyBusy(true);
    try {
      await aiClient.updateKey({ id: key.id, isActive: !key.isActive });
      await refreshKeys();
    } catch (toggleError) {
      setKeyStatus(toggleError instanceof Error ? toggleError.message : "تعذر تحديث المفتاح");
    } finally {
      setKeyBusy(false);
    }
  };

  const testKey = async (id: string) => {
    setKeyBusy(true);
    setKeyStatus("جاري اختبار الاتصال...");
    try {
      const result = await aiClient.testKey(id);
      setKeyStatus(`✓ الاتصال ناجح عبر ${result.model}`);
      await refreshKeys();
    } catch (testError) {
      setKeyStatus(testError instanceof Error ? testError.message : "فشل اختبار الاتصال");
      await refreshKeys();
    } finally {
      setKeyBusy(false);
    }
  };

  const deleteKey = async (id: string) => {
    setKeyBusy(true);
    try {
      await aiClient.deleteKey(id);
      if (selectedKeyId === id) setSelectedKeyId(undefined);
      setKeyStatus("تم حذف المفتاح");
      await refreshKeys();
    } catch (deleteError) {
      setKeyStatus(deleteError instanceof Error ? deleteError.message : "تعذر حذف المفتاح");
    } finally {
      setKeyBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto" style={{ maxHeight: "calc(100vh - 100px)" }}>
      <div className="p-3 space-y-3 pb-20" dir="rtl">
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-primary" />
              <div>
                <div className="text-xs font-bold">مساعد بسلاسة</div>
                <div className="text-[9px] text-muted-foreground">اقتراحات للمعلم، والقرار دائماً بيدك</div>
              </div>
            </div>
            <Switch checked={settings.aiEnabled ?? false} onCheckedChange={(value) => updateSettings({ aiEnabled: value })} />
          </div>
          <div className="text-[9px] text-muted-foreground bg-background/50 rounded p-1.5">
            الذكاء الاصطناعي اختياري ومغلق افتراضياً. لا تُرسل أسماء الطلاب أو سجلهم؛ لا يُرسل سياق الدرس إلا عند تفعيل الخيار أدناه.
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span>إرسال سياق الدرس الحالي</span>
            <Switch checked={settings.aiIncludeLessonContext ?? false} onCheckedChange={(value) => updateSettings({ aiIncludeLessonContext: value })} disabled={!settings.aiEnabled} />
          </div>
        </section>

        <section className={cn("rounded-lg border p-2.5 space-y-2", !settings.aiEnabled && "opacity-60") }>
          <div className="flex gap-1 overflow-x-auto pb-1">
            <Button size="sm" variant={mode === "chat" ? "default" : "outline"} className="h-7 text-[10px] shrink-0" onClick={() => setMode("chat")} disabled={!settings.aiEnabled}>محادثة</Button>
            {PRESETS.map((item) => <Button key={item.id} size="sm" variant={mode === item.id ? "default" : "outline"} className="h-7 text-[10px] shrink-0" onClick={() => { setMode(item.id); setPrompt(item.prompt); }} disabled={!settings.aiEnabled}>{item.label}</Button>)}
          </div>
          <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="اكتب ما تريد من المساعد... مثال: أريد نشاطاً عن الكسور للصف الرابع" className="min-h-24 text-xs resize-y" disabled={!settings.aiEnabled || busy} />
          <div className="flex gap-1">
            <Button className="flex-1 h-8 text-xs" onClick={() => void runPrompt()} disabled={!settings.aiEnabled || busy || !prompt.trim()}>{busy ? <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 ml-1" />} اسأل المساعد</Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => { setPrompt(""); setAnswer(""); setError(null); }} disabled={busy}>مسح</Button>
          </div>
          {answer && <div className="prose prose-sm max-w-none dark:prose-invert bg-secondary/30 rounded-lg p-2 text-xs leading-relaxed"><ReactMarkdown>{answer}</ReactMarkdown></div>}
          {error && <div className="text-[10px] text-red-500 bg-red-500/10 border border-red-500/20 rounded p-2">{error}</div>}
        </section>

        <section className={cn("rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2", !settings.aiEnabled && "opacity-60")}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold"><Sparkles className="w-3.5 h-3.5 text-primary" /> أدوات الدرس المنظمة</div>
            <span className="text-[9px] text-muted-foreground">مراجعة المدرس إلزامية</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <Button size="sm" variant="outline" className="h-9 text-[10px]" onClick={() => void runStructured("analyzeLesson")} disabled={!settings.aiEnabled || structuredBusy}><Bot className="w-3 h-3 ml-1" /> تحليل الدرس</Button>
            <Button size="sm" variant="outline" className="h-9 text-[10px]" onClick={() => void runStructured("generateQuestions")} disabled={!settings.aiEnabled || structuredBusy}><Sparkles className="w-3 h-3 ml-1" /> توليد أسئلة</Button>
            <Button size="sm" variant="outline" className="h-9 text-[10px]" onClick={() => void runStructured("whiteboardAssist")} disabled={!settings.aiEnabled || structuredBusy}><RotateCw className="w-3 h-3 ml-1" /> مساعدة السبورة</Button>
          </div>
          {structuredBusy && <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> جارٍ تجهيز اقتراح لا يغيّر الدرس تلقائياً...</div>}
          {generatedQuestions.length > 0 && <div className="space-y-1.5 rounded bg-background/70 p-2">
            <div className="text-[10px] font-bold">معاينة الأسئلة ({generatedQuestions.length})</div>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {generatedQuestions.map((question, index) => <div key={`${index}-${String(question.text ?? "")}`} className="rounded border border-border p-1.5 text-[10px]"><span className="font-bold">{index + 1}. </span>{typeof question.text === "string" ? question.text : "سؤال غير مقروء"}<span className="mr-1 text-muted-foreground">({typeof question.difficulty === "string" ? question.difficulty : "medium"})</span></div>)}
            </div>
            <Button size="sm" className="h-8 w-full text-[10px]" onClick={approveGeneratedQuestions} disabled={structuredBusy}>اعتماد الأسئلة كمصدر مستقل للألعاب</Button>
            <div className="text-[9px] text-muted-foreground">لن تختلط بالمنهج تلقائياً؛ يظهر مصدر AI في إعداد اللعبة بعد الاعتماد.</div>
          </div>}
          {structuredResult && <div className="space-y-1.5 rounded bg-background/70 p-2">
            <div className="text-[10px] font-bold">نتيجة قابلة للمراجعة</div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-relaxed">{JSON.stringify(structuredResult, null, 2)}</pre>
            {generatedQuestions.length === 0 && <Button size="sm" variant="outline" className="h-8 w-full text-[10px]" onClick={insertWhiteboardDraft} disabled={!settings.aiEnabled}>إرسال المسودة إلى محرر نص السبورة</Button>}
          </div>}
        </section>

        <section className="rounded-lg border border-border p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold"><KeyRound className="w-3.5 h-3.5 text-primary" /> مفاتيح AI والمزودات الخارجية</div>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setShowKeyForm((value) => !value)}><Plus className="w-3 h-3 ml-1" /> مفتاح</Button>
          </div>
              <div className="text-[9px] text-muted-foreground">يمكنك إضافة أي عدد من المفاتيح. الرقم الأقل يعني أولوية أعلى؛ عند الحصة أو الفشل ينتقل التطبيق للمفتاح التالي. يُحفظ كل مفتاح مشفراً في الخادم.</div>
          {envConfigured && <div className="text-[9px] text-emerald-600 bg-emerald-500/10 rounded p-1.5">يوجد مفتاح بيئي مفعّل كخيار احتياطي.</div>}
          {showKeyForm && <div className="space-y-1.5 bg-secondary/30 rounded p-2">
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="اسم واضح للمفتاح مثل: Google الرئيسي" className="w-full h-8 rounded border border-border bg-background px-2 text-xs" />
            <div className="relative"><input type={showSecret ? "text" : "password"} value={keyValue} onChange={(event) => setKeyValue(event.target.value)} placeholder="AIza..." className="w-full h-8 rounded border border-border bg-background px-2 pl-8 text-xs font-mono" /><button type="button" onClick={() => setShowSecret((value) => !value)} className="absolute left-1 top-1.5 text-muted-foreground" aria-label={showSecret ? "إخفاء المفتاح" : "إظهار المفتاح"}>{showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
            <select value={provider} onChange={(event) => handleProviderChange(event.target.value as AiProvider)} className="w-full h-8 rounded border border-border bg-background px-2 text-xs">{providerOptions.map(([id, preset]) => <option key={id} value={id}>{id} — {preset.kind}</option>)}<option value="custom">custom — OpenAI-compatible</option></select>
            {(provider === "custom" || (apiKind === "openai-compatible" && !AI_PROVIDER_PRESETS[provider as keyof typeof AI_PROVIDER_PRESETS])) && <>
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="رابط API الأساسي، مثل https://openrouter.ai/api/v1" className="w-full h-8 rounded border border-border bg-background px-2 text-xs font-mono" />
              <input value={modelsUrl} onChange={(event) => setModelsUrl(event.target.value)} placeholder="رابط الموديلات اختياري، افتراضياً /models" className="w-full h-8 rounded border border-border bg-background px-2 text-xs font-mono" />
              <input value={chatUrl} onChange={(event) => setChatUrl(event.target.value)} placeholder="رابط الدردشة اختياري، افتراضياً /chat/completions" className="w-full h-8 rounded border border-border bg-background px-2 text-xs font-mono" />
              <div className="text-[9px] text-muted-foreground">يدعم OpenAI-compatible افتراضياً، ويمكن تحديد رابط الموديلات والدردشة بشكل منفصل.</div>
            </>}
            {availableModels.length > 0 ? <select value={model} onChange={(event) => setModel(event.target.value)} className="w-full h-8 rounded border border-border bg-background px-2 text-xs font-mono">{availableModels.map((item) => <option key={item.id} value={item.id}>{item.displayName} — {item.id}</option>)}</select> : <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="اسم النموذج أو اضغط تحميل الموديلات" className="w-full h-8 rounded border border-border bg-background px-2 text-xs font-mono" />}
            <div className="flex gap-1"><Button type="button" variant="outline" className="h-7 flex-1 text-[10px]" onClick={() => void fetchModels()} disabled={modelsBusy || (!keyValue.trim() && !selectedKeyId)}>{modelsBusy ? <Loader2 className="w-3 h-3 ml-1 animate-spin" /> : <RefreshCw className="w-3 h-3 ml-1" />} تحميل الموديلات المتاحة</Button></div>
            <div className="grid grid-cols-2 gap-1"><label className="text-[10px] block">التخصص<select value={specialty} onChange={(event) => setSpecialty(event.target.value)} className="mt-1 w-full h-8 rounded border border-border bg-background px-2 text-xs"><option value="general">عام</option><option value="math">رياضيات</option><option value="arabic">عربي وتقارير</option><option value="science">علوم</option><option value="images">صور ورؤية</option><option value="audio">صوت</option></select></label><label className="text-[10px] block">الأولوية<input value={priority} onChange={(event) => setPriority(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="mt-1 w-full h-8 rounded border border-border bg-background px-2 text-xs" /></label></div><label className="text-[10px] block">الصلاحيات (فاصلة): generate, math, reports<input value={scopes} onChange={(event) => setScopes(event.target.value)} className="mt-1 w-full h-8 rounded border border-border bg-background px-2 text-xs font-mono" /></label>
            <div className="flex gap-1"><Button className="flex-1 h-7 text-[10px]" onClick={() => void addKey()} disabled={keyBusy}><Save className="w-3 h-3 ml-1" /> حفظ مشفر</Button><Button variant="outline" className="h-7 text-[10px]" onClick={() => setShowKeyForm(false)}>إلغاء</Button></div>
          </div>}
          {keys.length === 0 && <div className="text-[10px] text-muted-foreground text-center py-2">لا توجد مفاتيح مدارة داخل التطبيق.</div>}
          <div className="space-y-1.5">{keys.map((key) => <div key={key.id} className={cn("rounded border p-2 space-y-1.5", selectedKeyId === key.id ? "border-primary bg-primary/5" : "border-border")}>
            <div className="flex items-center justify-between gap-2"><button type="button" className="text-right flex-1 min-w-0" onClick={() => setSelectedKeyId(selectedKeyId === key.id ? undefined : key.id)}><div className="text-xs font-bold truncate">{key.label} <span className="font-normal text-primary">({key.provider})</span></div><div className="text-[9px] text-muted-foreground font-mono">{key.keyHint} · {key.model} · أولوية {key.priority} · {key.specialty || "general"}</div></button><Switch checked={key.isActive} onCheckedChange={() => void toggleKey(key)} disabled={keyBusy} /></div>
            <div className="flex items-center justify-between text-[9px] text-muted-foreground"><span>نجاح {key.successCount} · فشل {key.failureCount} · تشغيل {key.inFlight}/{key.maxConcurrency}</span><span>{key.status === "cooldown" ? <span className="text-amber-600">تبريد مؤقت</span> : key.status === "needs-check" ? <span className="text-red-500">يحتاج فحصاً</span> : key.lastError ? <span className="text-red-500" title={key.lastError}>آخر خطأ</span> : <span className="text-emerald-600">سليم</span>}</span></div>
            {selectedKeyId === key.id && <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void changePriority(key, -1)} disabled={keyBusy || key.priority <= 0}>أعلى أولوية</Button><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void changePriority(key, 1)} disabled={keyBusy}>أقل أولوية</Button><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void testKey(key.id)} disabled={keyBusy}><Wifi className="w-3 h-3 ml-1" /> اختبار</Button>{key.status !== "active" || !key.isActive ? <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void reactivateKey(key)} disabled={keyBusy}><RefreshCw className="w-3 h-3 ml-1" /> إعادة تفعيل</Button> : null}<Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void refreshKeys()} disabled={keyBusy}><RefreshCw className="w-3 h-3 ml-1" /> تحديث</Button><Button size="sm" variant="outline" className="h-7 text-[10px] text-red-500" onClick={() => void deleteKey(key.id)} disabled={keyBusy}><Trash2 className="w-3 h-3 ml-1" /> حذف</Button></div>}
          </div>)}</div>
          {keyStatus && <div className="text-[10px] text-muted-foreground bg-secondary/30 rounded p-1.5">{keyStatus}</div>}
        </section>

        <section className="rounded-lg border border-border p-2.5 space-y-2">
          <div className="flex items-center gap-1 text-xs font-bold"><RotateCw className="w-3.5 h-3.5 text-primary" /> إعدادات النموذج</div>
          <label className="text-[10px] block">النموذج<input value={settings.aiModel || "gemini-2.5-flash"} onChange={(event) => { setModel(event.target.value); updateSettings({ aiModel: event.target.value }); }} className="mt-1 w-full h-8 rounded border border-border bg-background px-2 text-xs font-mono" /></label>
          <label className="text-[10px] block">درجة التنوع: {(settings.aiTemperature ?? 0.35).toFixed(2)}<input type="range" min="0" max="1.5" step="0.05" value={settings.aiTemperature ?? 0.35} onChange={(event) => updateSettings({ aiTemperature: Number(event.target.value) })} className="w-full" /></label>
          <label className="text-[10px] block">الحد الأقصى للإخراج: {settings.aiMaxOutputTokens ?? 1200}<input type="range" min="256" max="4096" step="128" value={settings.aiMaxOutputTokens ?? 1200} onChange={(event) => updateSettings({ aiMaxOutputTokens: Number(event.target.value) })} className="w-full" /></label>
        </section>

        <div className="text-[9px] text-muted-foreground leading-relaxed">
          <strong>أمان Google:</strong> لا تضع المفتاح في ملفات الواجهة أو Git. يفضّل استخدام مفتاح مقيد لخدمة Gemini فقط، وتدويره عند الشك بتسريبه. راجع <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-primary underline">Google AI Studio</a>.
        </div>
      </div>
    </div>
  );
}
