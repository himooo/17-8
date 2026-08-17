"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { localDb } from "@/lib/local-db";
import { normalizeAudioMixer, playCelebrationSequence, type AudioMixerState, type CelebrationSequence } from "@/lib/rewards-audio-v10";
import { announce } from "@/lib/tts-announcer";
import { aggregateGameAnalytics, buildGameShareText } from "@/lib/game-v10";
import { useShellStore } from "@/lib/shell-store";

 type Tab = "badges" | "achievements" | "combos" | "sequences" | "audio" | "analytics";

export function RewardsV10Panel() {
  const [tab, setTab] = useState<Tab>("badges");
  const [badges, setBadges] = useState<Array<Record<string, unknown>>>([]);
  const [achievements, setAchievements] = useState<Array<Record<string, unknown>>>([]);
  const [combos, setCombos] = useState<Array<Record<string, unknown>>>([]);
  const [sequences, setSequences] = useState<Array<Record<string, unknown>>>([]);
  const [gameResults, setGameResults] = useState<Array<Record<string, unknown>>>([]);
  const [gifts, setGifts] = useState<Array<Record<string, unknown>>>([]);
  const [celebrations, setCelebrations] = useState<Array<Record<string, unknown>>>([]);
  const [mixer, setMixer] = useState<AudioMixerState>(() => normalizeAudioMixer());
  const [message, setMessage] = useState("");
  const students = useShellStore((state) => state.students);
  const currentSessionId = useShellStore((state) => state.currentSessionId);
  const presentStudents = useMemo(() => students.filter((student) => !student.isAbsent), [students]);

  const load = useCallback(async () => {
    try {
      const [badgeRows, achievementRows, comboRows, sequenceRows, giftRows, celebrationRows, audioProfile, gameRows] = await Promise.all([
        localDb.rewardsV10.listCustomBadges(),
        localDb.rewardsV10.listAchievements(),
        localDb.rewardsV10.listGiftCombos(),
        localDb.rewardsV10.listSequences(),
        localDb.gifts.list(),
        localDb.celebration.list(),
        localDb.rewardsV10.getAudioProfile(),
        localDb.gameResults.listRecent(100),
      ]);
      setBadges(badgeRows);
      setAchievements(achievementRows);
      setCombos(comboRows);
      setSequences(sequenceRows);
      setGameResults(gameRows);
      setGifts(giftRows);
      setCelebrations(celebrationRows.map((row) => row as unknown as Record<string, unknown>));
      if (audioProfile) setMixer(normalizeAudioMixer({
        enabled: Boolean(audioProfile.enabled),
        masterVolume: Number(audioProfile.masterVolume),
        channels: typeof audioProfile.channelsJson === "string" ? JSON.parse(audioProfile.channelsJson) : undefined,
        ambiance: String(audioProfile.ambiance || "none") as AudioMixerState["ambiance"],
        haptics: Boolean(audioProfile.haptics),
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل إعدادات V10");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const saveBadge = async () => {
    await localDb.rewardsV10.saveCustomBadge({ name: "مبدع", icon: "creative", color: "#8b5cf6", description: "حل بطريقة مبتكرة", condition: "manual", isActive: true });
    setMessage("تم حفظ الشارة المخصصة");
    await load();
  };

  const saveAchievement = async () => {
    await localDb.rewardsV10.saveAchievement({ name: "سيد السلسلة", description: "10 إجابات صحيحة متتالية", icon: "streak", metric: "correctStreak", threshold: 10, rewardPoints: 10, isActive: true });
    setMessage("تم حفظ الإنجاز");
    await load();
  };

  const saveCombo = async () => {
    const gift = gifts[0];
    const celebration = celebrations[0];
    if (!gift || !celebration) {
      setMessage("أضف هدية واحتفالاً أولاً");
      return;
    }
    await localDb.rewardsV10.saveGiftCombo({ name: "حزمة البطل", giftId: gift.id, celebrationId: celebration.id, points: 10, enabled: true });
    setMessage("تم حفظ حزمة البطل");
    await load();
  };

  const awardCombo = async (combo: Record<string, unknown>) => {
    const student = presentStudents[0];
    if (!student || !combo.id) {
      setMessage("أضف طالباً حاضراً واختر حزمة");
      return;
    }
    await localDb.rewardsV10.awardGiftCombo(student.id, String(combo.id), currentSessionId);
    setMessage(`تم منح الحزمة إلى ${student.name} مرة واحدة بأمان`);
  };

  const runSequence = (row: Record<string, unknown>) => {
    const steps = typeof row.stepsJson === "string" ? JSON.parse(row.stepsJson) : row.steps;
    const cancel = playCelebrationSequence({ id: String(row.id), name: String(row.name), enabled: row.enabled !== false, durationMs: Number(row.durationMs || 3000), steps: Array.isArray(steps) ? steps : [] } as CelebrationSequence, {
      sound: (payload) => useShellStore.getState().playSound(String(payload.sound || "celebrate-fanfare")),
      banner: (payload) => useShellStore.getState().triggerCelebration(String(payload.celebrationId || "champion")),
      particles: (payload) => useShellStore.getState().triggerCelebration(String(payload.celebrationId || "champion")),
      tts: (payload) => announce("celebration-fired", { celebrationLabel: String(payload.text || "أحسنت") }),
      gift: () => setMessage("تسلسل الاحتفال وصل إلى خطوة الهدية — المنح يحتاج تأكيد المدرس"),
      badge: () => setMessage("تسلسل الاحتفال وصل إلى خطوة الشارة — المنح يحتاج تأكيد المدرس"),
    });
    window.setTimeout(cancel, Math.min(30_000, Math.max(1000, Number(row.durationMs || 3000) + 500)));
  };

  const saveAudio = async () => {
    await localDb.rewardsV10.saveAudioProfile({ id: "audio-profile-default", name: "إعداد غرفة العمليات", ...mixer, channelsJson: JSON.stringify(mixer.channels) });
    useShellStore.getState().updateSettings({ volume: mixer.masterVolume, muted: !mixer.enabled });
    setMessage("تم حفظ مكسر الصوت محلياً");
  };

  return (
    <div className="p-3 space-y-3 text-sm" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div><h2 className="font-bold">V10 المكافآت والصوت</h2><p className="text-[11px] text-muted-foreground">إدارة مدرسية محلية — AI لا يمنح شيئاً تلقائياً.</p></div>
        <button type="button" onClick={() => void load()} className="rounded bg-secondary px-2 py-1 text-xs">تحديث</button>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {([['badges','شارات'],['achievements','إنجازات'],['combos','حزم'],['sequences','تسلسلات'],['audio','صوت'],['analytics','تحليلات الألعاب']] as Array<[Tab,string]>).map(([id,label]) => <button type="button" key={id} onClick={() => setTab(id)} className={`rounded px-2 py-1 text-xs ${tab === id ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>{label}</button>)}
      </div>
      {message && <div className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-500">{message}</div>}
      {tab === "badges" && <section className="space-y-2"><button type="button" onClick={() => void saveBadge()} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">إنشاء شارة مبدع</button>{badges.map((badge) => <div key={String(badge.id)} className="flex items-center justify-between rounded border border-border p-2"><span>{String(badge.icon)} {String(badge.name)}</span><span className="text-[10px] text-muted-foreground">{String(badge.condition || "manual")}</span></div>)}</section>}
      {tab === "achievements" && <section className="space-y-2"><button type="button" onClick={() => void saveAchievement()} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">إنشاء سيد السلسلة</button>{achievements.map((item) => <div key={String(item.id)} className="rounded border border-border p-2"><div className="font-semibold">{String(item.icon)} {String(item.name)}</div><div className="text-[11px] text-muted-foreground">{String(item.description)} — {String(item.metric)} ≥ {String(item.threshold)}</div></div>)}</section>}
      {tab === "combos" && <section className="space-y-2"><button type="button" onClick={() => void saveCombo()} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">إنشاء حزمة البطل</button>{combos.map((combo) => <div key={String(combo.id)} className="flex items-center justify-between rounded border border-border p-2"><span>{String(combo.name)} — {String(combo.points)} نقطة</span><button type="button" onClick={() => void awardCombo(combo)} className="rounded bg-amber-500/20 px-2 py-1 text-[11px]">منح للحاضر</button></div>)}</section>}
      {tab === "sequences" && <section className="space-y-2"><button type="button" onClick={async () => { await localDb.rewardsV10.saveSequence({ name: "احتفال البطل", durationMs: 3000, steps: [{ id: "sound", delayMs: 0, type: "sound", payload: { sound: "celebrate-fanfare" } }, { id: "banner", delayMs: 500, type: "banner", payload: { text: "أحسنت" } }, { id: "particles", delayMs: 1000, type: "particles", payload: { preset: "gold" } }] }); setMessage("تم حفظ تسلسل الاحتفال"); await load(); }} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">إنشاء تسلسل البطل</button>{sequences.map((sequence) => <div key={String(sequence.id)} className="flex items-center justify-between rounded border border-border p-2"><span>{String(sequence.name)} — {String(sequence.durationMs)}ms</span><button type="button" onClick={() => runSequence(sequence)} className="rounded bg-violet-500/20 px-2 py-1 text-[11px]">تشغيل</button></div>)}</section>}
      {tab === "analytics" && <section className="space-y-2"><div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded border border-border p-2"><b>{aggregateGameAnalytics(gameResults as never).totalGames}</b><div className="text-muted-foreground">لعبة</div></div><div className="rounded border border-border p-2"><b>{aggregateGameAnalytics(gameResults as never).totalPoints}</b><div className="text-muted-foreground">نقطة</div></div><div className="rounded border border-border p-2"><b>{aggregateGameAnalytics(gameResults as never).totalParticipants}</b><div className="text-muted-foreground">مشاركة</div></div></div>{Object.entries(aggregateGameAnalytics(gameResults as never).byGame).map(([game, summary]) => <div key={game} className="flex items-center justify-between rounded border border-border p-2 text-xs"><span>{game}</span><span>{summary.games} ألعاب · {summary.points} نقطة · {summary.wins} فوز</span></div>)}{gameResults[0] && <button type="button" onClick={async () => { const text = buildGameShareText({ gameType: String(gameResults[0].gameType || "لعبة"), winnerName: String(gameResults[0].winnerName || "الفصل"), points: Number(gameResults[0].points || 0), correctAnswers: Number(gameResults[0].correctAnswers || 0), durationMs: Number(gameResults[0].durationMs || 0) }); if (navigator.share) await navigator.share({ title: "نتيجة بسلاسة", text }); else await navigator.clipboard.writeText(text); setMessage("تم تجهيز مشاركة آخر نتيجة"); }} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">مشاركة آخر نتيجة</button>}</section>}
      {tab === "audio" && <section className="space-y-3"><label className="flex items-center justify-between rounded border border-border p-2 text-xs"><span>تفعيل المكسر</span><input type="checkbox" checked={mixer.enabled} onChange={(event) => setMixer((current) => ({ ...current, enabled: event.target.checked }))} /></label><label className="block text-xs">الصوت العام<input type="range" min={0} max={1} step={0.05} value={mixer.masterVolume} onChange={(event) => setMixer((current) => ({ ...current, masterVolume: Number(event.target.value) }))} className="w-full" /></label><label className="flex items-center justify-between rounded border border-border p-2 text-xs"><span>اهتزاز اختياري على الجهاز</span><input type="checkbox" checked={mixer.haptics} onChange={(event) => setMixer((current) => ({ ...current, haptics: event.target.checked }))} /></label><label className="block text-xs">الأجواء<select value={mixer.ambiance} onChange={(event) => setMixer((current) => ({ ...current, ambiance: event.target.value as AudioMixerState["ambiance"] }))} className="mt-1 w-full rounded bg-secondary p-1"><option value="none">بدون</option><option value="calm">هادئة</option><option value="focus">تركيز</option><option value="energetic">نشاط</option><option value="celebration">احتفال</option></select></label><button type="button" onClick={() => void saveAudio()} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">حفظ إعدادات الصوت</button></section>}
    </div>
  );
}
