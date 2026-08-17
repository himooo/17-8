"use client";

import { useShellStore, dbStudentToStoreStudent } from "@/lib/shell-store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Volume2,
  VolumeX,
  Pen,
  Keyboard,
  RotateCcw,
  Sparkles,
  Database,
  Download,
  Upload,
  Trash2,
  History,
  RefreshCw,
  Clock,
  MessageSquare,
  MessageSquareOff,
  AudioLines,
  Mic2,
  PartyPopper,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { exportSettingsPayload, SETTINGS_SECTIONS, settingsSectionMatches, validateSettingsImport } from "@/lib/settings-ai-v10";
import { migrateFromLocalStorage, hasLegacyData, isMigrated, type MigrationResult } from "@/lib/migrate-from-localStorage";
import { localDb, type StatsSummary, type BackupHistoryEntry, type Session } from "@/lib/local-db";
import { hydrateFromDb } from "@/lib/db-sync";
import { testTts, updateTtsSetting } from "@/lib/tts-announcer";
import { TelegramPanel } from "./TelegramPanel";

const SHORTCUTS = [
  { key: "→ / Space", description: "الخطوة التالية" },
  { key: "←", description: "الخطوة السابقة" },
  { key: "P", description: "تفعيل القلم" },
  { key: "H", description: "قلم التظليل" },
  { key: "L", description: "تفعيل الليزر" },
  { key: "E", description: "الممحاة" },
  { key: "T", description: "أداة النص" },
  { key: "S", description: "أداة الأشكال (دائرة/مستطيل/مثلث)" },
  { key: "A", description: "أداة السهم" },
  { key: "R", description: "اختيار طالب عشوائي" },
  { key: "V", description: "صوت نجاح + وميض أخضر" },
  { key: "B", description: "صوت خطأ + وميض أحمر" },
  { key: "G", description: "🎉 احتفال + كونفيتي" },
  { key: "C", description: "مسح السبورة" },
  { key: "Ctrl+Z", description: "تراجع عن آخر رسم" },
  { key: "M", description: "كتم/تشغيل الصوت" },
  { key: "W", description: "تفعيل/إيقاف السبورة" },
  { key: "N", description: "عرض النوتس overlay" },
  { key: "+", description: "نقطة للطالب المختار" },
  { key: "F", description: "ملء الشاشة" },
  { key: "1-6", description: "ألوان القلم (أزرق/أحمر/أخضر/أصفر/أبيض/أسود)" },
];

/**
 * SettingsPanel - لوحة الإعدادات والاختصارات
 */
export function SettingsPanel() {
  const settings = useShellStore((s) => s.settings);
  const updateSettings = useShellStore((s) => s.updateSettings);
  const resetSettings = useShellStore((s) => s.resetSettings);
  const requestConfirm = useShellStore((s) => s.requestConfirm);
  const setWhiteboardColor = useShellStore((s) => s.setWhiteboardColor);
  const setWhiteboardThickness = useShellStore((s) => s.setWhiteboardThickness);
  const whiteboardColor = useShellStore((s) => s.whiteboardColor);
  const whiteboardThickness = useShellStore((s) => s.whiteboardThickness);
  const safeVolume = Number.isFinite(settings.volume) ? Math.min(1, Math.max(0, settings.volume)) : 0.7;

  // ===== DB management state =====
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [legacyExists, setLegacyExists] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [fileInputEl, setFileInputEl] = useState<HTMLInputElement | null>(null);
  const [settingsFileInputEl, setSettingsFileInputEl] = useState<HTMLInputElement | null>(null);
  const [settingsTab, setSettingsTab] = useState<"general" | "ai" | "integrations" | "advanced">("general");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [settingsProfiles, setSettingsProfiles] = useState<Array<Record<string, unknown>>>([]);
  const [settingsRevision, setSettingsRevision] = useState(1);

  // Load DB stats + history on mount
  useEffect(() => {
    const legacy = hasLegacyData();
    const migrationState = isMigrated();
    const timer = window.setTimeout(() => {
      setLegacyExists(legacy);
      setMigrated(migrationState);
      void loadDbInfo();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function loadDbInfo() {
    try {
      const [s, h, sess, profiles] = await Promise.all([
        localDb.stats.summary(useShellStore.getState().activeClassId || undefined),
        localDb.backup.list(),
        localDb.sessions.list(useShellStore.getState().activeClassId || undefined),
        localDb.settings.profilesList(useShellStore.getState().activeClassId),
      ]);
      setStats(s);
      setBackupHistory(h);
      setSessions(sess);
      setSettingsProfiles(profiles);
    } catch (err) {
      console.error("[SettingsPanel] failed to load DB info:", err);
    }
  }

  async function handleStartNewSession() {
    if (!(await requestConfirm("بدء جلسة جديدة؟ سيتم حفظ لقطة من نقاط الطلاب الحالية لتتبع إنجازات الجلسة."))) return;
    setIsStartingSession(true);
    setStatusMessage("جاري بدء الجلسة...");
    try {
      const cls = useShellStore.getState().activeClassId;
      const session = await localDb.sessions.start(cls, `جلسة ${new Date().toLocaleDateString("ar-EG")}`);
      setStatusMessage(`✓ تم بدء الجلسة: ${session.name}`);
      await loadDbInfo();
    } catch (err: any) {
      setStatusMessage(`فشل بدء الجلسة: ${err.message}`);
    } finally {
      setIsStartingSession(false);
    }
  }

  async function handleEndSession(sessionId: string) {
    if (!(await requestConfirm("إنهاء الجلسة الحالية؟"))) return;
    try {
      await localDb.sessions.end(sessionId);
      setStatusMessage("✓ تم إنهاء الجلسة");
      await loadDbInfo();
    } catch (err: any) {
      setStatusMessage(`فشل الإنهاء: ${err.message}`);
    }
  }

  async function handleMigrate() {
    if (!(await requestConfirm("بدء الترحيل من localStorage إلى قاعدة البيانات المحلية؟ سيتم دمج البيانات."))) return;
    setIsMigrating(true);
    setStatusMessage("جاري الترحيل...");
    try {
      const result = await migrateFromLocalStorage();
      setMigrationResult(result);
      setStatusMessage(result.message);
      await loadDbInfo();
      // Re-hydrate the store so UI reflects the new data
      await hydrateFromDb(
        (students) => useShellStore.setState({ students: students.map(dbStudentToStoreStudent) }),
        (lessons) => useShellStore.setState({ lessons }),
        () => {},
        (id) => useShellStore.setState({ activeClassId: id }),
        useShellStore.getState().activeClassId
      );
      setLegacyExists(hasLegacyData());
      setMigrated(isMigrated());
    } catch (err: any) {
      setStatusMessage(`فشل الترحيل: ${err.message}`);
    } finally {
      setIsMigrating(false);
    }
  }

  async function handleBackupJson() {
    setIsBackingUp(true);
    setStatusMessage("جاري إنشاء نسخة احتياطية JSON...");
    try {
      const res = await fetch("/api/backup?format=json&reason=manual");
      if (!res.ok) throw new Error("Backup failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Local timestamp (Cairo time) instead of UTC ISO
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      a.download = `bisalasa-backup-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage("✓ تم تنزيل النسخة الاحتياطية");
      await loadDbInfo();
    } catch (err: any) {
      setStatusMessage(`فشل النسخ الاحتياطي: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  }

  async function handleBackupDb() {
    setIsBackingUp(true);
    setStatusMessage("جاري تنزيل ملف قاعدة البيانات...");
    try {
      const res = await fetch("/api/backup?format=sql&reason=manual");
      if (!res.ok) throw new Error("DB backup failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bisalasa-${Date.now()}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage("✓ تم تنزيل ملف .db");
      await loadDbInfo();
    } catch (err: any) {
      setStatusMessage(`فشل التنزيل: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  }

  async function handleRestoreClick() {
    fileInputEl?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(await requestConfirm(`استعادة البيانات من "${file.name}"؟ سيتم استبدال كل البيانات الحالية!`, { danger: true }))) {
      e.target.value = "";
      return;
    }
    setIsRestoring(true);
    setStatusMessage("جاري الاستعادة...");
    try {
      const text = await file.text();
      const dump = JSON.parse(text);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dump),
      });
      const result = await res.json();
      if (!result.ok) throw new Error(result.error || "Restore failed");
      setStatusMessage(`✓ تمت الاستعادة: ${result.data.restored.students} طالب، ${result.data.restored.lessons} درس`);
      await loadDbInfo();
      // Re-hydrate the store
      await hydrateFromDb(
        (students) => useShellStore.setState({ students: students.map(dbStudentToStoreStudent) }),
        (lessons) => useShellStore.setState({ lessons }),
        (settings) => useShellStore.setState({ settings }),
        (id) => useShellStore.setState({ activeClassId: id }),
        useShellStore.getState().activeClassId
      );
    } catch (err: any) {
      setStatusMessage(`فشل الاستعادة: ${err.message}`);
    } finally {
      setIsRestoring(false);
      e.target.value = "";
    }
  }

  function settingsSectionVisible(section: "general" | "ai" | "integrations" | "advanced", keywords: string) {
    if (settingsSearch.trim()) {
      const definition = SETTINGS_SECTIONS.find((item) => item.id === section) ?? { id: section, label: section, keywords: [] };
      return settingsSectionMatches(definition, settingsSearch) || keywords.toLocaleLowerCase("ar").includes(settingsSearch.trim().toLocaleLowerCase("ar"));
    }
    return settingsTab === section;
  }

  function handleExportSettings() {
    const payload = exportSettingsPayload(settings, settingsRevision);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bisalasa-settings-v${payload.version}-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatusMessage("✓ تم تصدير إعدادات المدرس فقط؛ لم يتم تضمين الطلاب أو المفاتيح أو الأسرار");
  }

  async function handleSettingsImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = validateSettingsImport(JSON.parse(await file.text()));
      if (!parsed.ok) throw new Error(parsed.errors.join("، "));
      const result = await localDb.settings.set(parsed.settings as Record<string, unknown>);
      updateSettings(parsed.settings as Partial<typeof settings>);
      setSettingsRevision(Math.max(settingsRevision + 1, parsed.revision));
      setStatusMessage(`✓ تم استيراد ${Object.keys(parsed.settings).length} إعداد بأمان`);
      void result;
    } catch (error) {
      setStatusMessage(`فشل استيراد الإعدادات: ${error instanceof Error ? error.message : "ملف غير صالح"}`);
    }
  }

  async function handleSaveProfile() {
    const name = window.prompt("اسم profile، مثل: الصف الرابع ابتدائي");
    if (!name?.trim()) return;
    const result = await localDb.settings.saveProfile({ name: name.trim(), classId: useShellStore.getState().activeClassId, settingsJson: JSON.stringify(settings), revision: settingsRevision });
    if ("conflict" in result && result.conflict) {
      setStatusMessage("تعذر الحفظ: profile تغير في نافذة أخرى. أعد تحميله قبل الكتابة.");
      return;
    }
    if (!result || typeof result !== "object" || !("id" in result)) {
      setStatusMessage("تعذر حفظ profile");
      return;
    }
    setSettingsProfiles((current) => [result as Record<string, unknown>, ...current.filter((profile) => profile.id !== (result as Record<string, unknown>).id)]);
    setStatusMessage(`✓ تم حفظ profile: ${name.trim()}`);
  }

  function handleApplyProfile(profile: Record<string, unknown>) {
    try {
      const next = JSON.parse(String(profile.settingsJson || "{}"));
      if (!next || typeof next !== "object" || Array.isArray(next)) throw new Error("profile غير صالح");
      updateSettings(next as Partial<typeof settings>);
      setSettingsRevision(Number(profile.revision) || settingsRevision);
      setStatusMessage(`✓ تم تطبيق profile: ${String(profile.name || "بدون اسم")}`);
    } catch (error) {
      setStatusMessage(`فشل تطبيق profile: ${error instanceof Error ? error.message : "بيانات غير صالحة"}`);
    }
  }

  async function handleDeleteProfile(id: string) {
    if (!(await requestConfirm("حذف profile؟"))) return;
    await localDb.settings.deleteProfile(id);
    setSettingsProfiles((current) => current.filter((profile) => profile.id !== id));
    setStatusMessage("✓ تم حذف profile");
  }

  async function handleFactoryReset() {
    if (!(await requestConfirm("⚠️ تحذير: سيتم مسح جميع البيانات نهائياً (طلاب، دروس، نقاط، شارات). تأكد من عمل نسخة احتياطية أولاً. هل أنت متأكد؟", { title: "مسح كل البيانات", danger: true }))) return;
    if (!(await requestConfirm("تأكيد أخير: مسح كل البيانات؟ لا يمكن التراجع.", { title: "تأكيد أخير", danger: true }))) return;
    setIsResetting(true);
    setStatusMessage("جاري المسح...");
    try {
      const res = await fetch("/api/backup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPhrase: "WIPE-ALL-DATA" }),
      });
      const result = await res.json();
      if (!result.ok) throw new Error(result.error || "Reset failed");
      setStatusMessage("✓ تم مسح كل البيانات");
      await loadDbInfo();
      // Clear hydration flags so next refresh re-seeds from the empty DB
      try {
        window.localStorage.removeItem("bisalasa-db-hydrated");
        window.localStorage.removeItem("bisalasa-migrated-to-sqlite");
        delete (window as { __BISALASA_HYDRATED__?: boolean }).__BISALASA_HYDRATED__;
      } catch {}
      // Clear the store too
      useShellStore.setState({ students: [], lessons: [], activeClassId: null, manifest: null });
    } catch (err: any) {
      setStatusMessage(`فشل المسح: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ maxHeight: "calc(100vh - 100px)" }}>
      <div className="p-3 space-y-3 pb-20">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 space-y-2">
          <div className="flex items-center gap-2">
            <input value={settingsSearch} onChange={(event) => setSettingsSearch(event.target.value)} placeholder="بحث في الإعدادات: TTS، AI، نسخ، سبورة..." className="min-w-0 flex-1 h-8 rounded-md border border-border bg-card px-2 text-[11px] outline-none focus:ring-2 focus:ring-primary/40" aria-label="بحث في الإعدادات" />
            <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={handleExportSettings}><Download className="w-3 h-3 ml-1" />تصدير</Button>
            <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={() => settingsFileInputEl?.click()}><Upload className="w-3 h-3 ml-1" />استيراد</Button>
            <input type="file" accept="application/json,.json" ref={(element) => setSettingsFileInputEl(element)} onChange={handleSettingsImport} className="hidden" />
          </div>
          <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="أقسام الإعدادات">
            {SETTINGS_SECTIONS.map((section) => <button key={section.id} type="button" role="tab" aria-selected={settingsTab === section.id} onClick={() => setSettingsTab(section.id)} className={cn("rounded-md border px-1 py-1.5 text-[10px] transition-colors", settingsTab === section.id && !settingsSearch ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent/10")}>{section.label}</button>)}
          </div>
          {settingsSearch && <div className="text-[10px] text-muted-foreground">نتائج البحث تظهر من جميع الأقسام. امسح البحث للعودة إلى التبويب الحالي.</div>}
        </div>
        {settingsSectionVisible("integrations", "Telegram Moodle Custom App webhook REST") && <TelegramPanel />}
        {/* ===== Database Management (v6.0 new) */}
        <section data-settings-section="advanced" style={{ display: settingsSectionVisible("advanced", "SQLite backup restore database") ? undefined : "none" }}>
          <div className="flex items-center gap-1 text-[11px] font-bold text-primary mb-2">
            <Database className="w-3.5 h-3.5" />
            إدارة البيانات (SQLite)
          </div>
          <div className="bg-secondary/30 rounded-lg p-2 space-y-2 border border-border">
            {/* Stats summary */}
            {stats && (
              <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                <div className="bg-card rounded p-1">
                  <div className="font-bold text-primary text-sm">{stats.students}</div>
                  <div className="text-muted-foreground">طالب</div>
                </div>
                <div className="bg-card rounded p-1">
                  <div className="font-bold text-primary text-sm">{stats.lessons}</div>
                  <div className="text-muted-foreground">درس</div>
                </div>
                <div className="bg-card rounded p-1">
                  <div className="font-bold text-primary text-sm">{stats.sessions}</div>
                  <div className="text-muted-foreground">جلسة</div>
                </div>
                <div className="bg-card rounded p-1">
                  <div className="font-bold text-primary text-sm">{stats.gameResults}</div>
                  <div className="text-muted-foreground">لعبة</div>
                </div>
              </div>
            )}

            {/* Legacy migration warning */}
            {legacyExists && !migrated && (
              <div className="bg-amber-500/10 border border-amber-500/40 rounded p-2 space-y-1.5">
                <div className="text-[10px] text-amber-500 font-bold">
                  ⚠️ يوجد بيانات قديمة في localStorage لم يتم ترحيلها بعد
                </div>
                <Button
                  size="sm"
                  className="w-full h-7 text-[10px] bg-amber-500 hover:bg-amber-600 text-white"
                  disabled={isMigrating}
                  onClick={handleMigrate}
                >
                  {isMigrating ? (
                    <><RefreshCw className="w-3 h-3 ml-1 animate-spin" /> جاري الترحيل...</>
                  ) : (
                    <><Database className="w-3 h-3 ml-1" /> ترحيل البيانات القديمة</>
                  )}
                </Button>
              </div>
            )}

            {migrationResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded p-1.5 text-[10px] text-emerald-500">
                ✓ {migrationResult.message}
              </div>
            )}

            {/* Backup / Restore buttons */}
            <div className="grid grid-cols-2 gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] border-border"
                disabled={isBackingUp}
                onClick={handleBackupJson}
              >
                {isBackingUp ? <RefreshCw className="w-3 h-3 ml-1 animate-spin" /> : <Download className="w-3 h-3 ml-1" />}
                نسخة JSON
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] border-border"
                disabled={isBackingUp}
                onClick={handleBackupDb}
              >
                <Download className="w-3 h-3 ml-1" />
                نسخة .db
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] border-border"
                disabled={isRestoring}
                onClick={handleRestoreClick}
              >
                {isRestoring ? <RefreshCw className="w-3 h-3 ml-1 animate-spin" /> : <Upload className="w-3 h-3 ml-1" />}
                استعادة
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] border-red-500/40 text-red-500 hover:bg-red-500/10"
                disabled={isResetting}
                onClick={handleFactoryReset}
              >
                {isResetting ? <RefreshCw className="w-3 h-3 ml-1 animate-spin" /> : <Trash2 className="w-3 h-3 ml-1" />}
                مسح الكل
              </Button>
            </div>
            <input
              type="file"
              accept=".json"
              ref={(el) => setFileInputEl(el)}
              onChange={handleFileSelected}
              className="hidden"
            />

            {statusMessage && (
              <div className="bg-card rounded p-1.5 text-[10px] text-foreground border border-border">
                {statusMessage}
              </div>
            )}

            {/* Backup history */}
            {backupHistory.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold">
                  <History className="w-3 h-3" />
                  آخر النسخ الاحتياطية
                </div>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {backupHistory.slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-[9px] bg-card rounded px-1.5 py-0.5">
                      <span className="truncate flex-1 ml-1" title={b.filename}>{b.filename}</span>
                      <span className="text-muted-foreground">
                        {(b.fileSize / 1024).toFixed(1)}KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section data-settings-section="advanced" style={{ display: settingsSectionVisible("advanced", "profiles صف إعدادات") ? undefined : "none" }}>
          <div className="flex items-center gap-1 text-[11px] font-bold text-primary mb-2"><Sparkles className="w-3.5 h-3.5" />ملفات إعدادات الصفوف</div>
          <div className="bg-secondary/30 rounded-lg p-2 space-y-2 border border-border">
            <div className="flex gap-1"><Button size="sm" className="h-7 flex-1 text-[10px]" onClick={() => void handleSaveProfile()}>حفظ الإعدادات كـ Profile</Button><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void loadDbInfo()}>تحديث</Button></div>
            {settingsProfiles.length === 0 ? <div className="text-[10px] text-muted-foreground">لا توجد profiles بعد. احفظ إعداداً منفصلاً لكل صف أو فصل.</div> : settingsProfiles.slice(0, 12).map((profile) => <div key={String(profile.id)} className="flex items-center gap-1 rounded bg-card border border-border px-1.5 py-1"><div className="min-w-0 flex-1"><div className="truncate text-[10px] font-bold">{String(profile.name || "بدون اسم")}</div><div className="text-[9px] text-muted-foreground">revision {String(profile.revision || 1)}{profile.classId ? ` • ${String(profile.classId)}` : ""}</div></div><Button size="sm" variant="outline" className="h-6 text-[9px]" onClick={() => handleApplyProfile(profile)}>تطبيق</Button><Button size="sm" variant="ghost" className="h-6 px-1 text-[9px] text-red-500" onClick={() => void handleDeleteProfile(String(profile.id))}>حذف</Button></div>)}
          </div>
        </section>

        {/* ===== Session Management (v6.0 new) */}
        <section data-settings-section="advanced" style={{ display: settingsSectionVisible("advanced", "session جلسة") ? undefined : "none" }}>
          <div className="flex items-center gap-1 text-[11px] font-bold text-primary mb-2">
            <Clock className="w-3.5 h-3.5" />
            إدارة الجلسات
          </div>
          <div className="bg-secondary/30 rounded-lg p-2 space-y-2 border border-border">
            <Button
              size="sm"
              className="w-full h-7 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white"
              disabled={isStartingSession}
              onClick={handleStartNewSession}
            >
              {isStartingSession ? (
                <><RefreshCw className="w-3 h-3 ml-1 animate-spin" /> جاري بدء الجلسة...</>
              ) : (
                <><Clock className="w-3 h-3 ml-1" /> بدء جلسة جديدة</>
              )}
            </Button>
            <div className="text-[9px] text-muted-foreground">
              الجلسة = حصة دراسية. عند بدء الجلسة، يتم حفظ لقطة من نقاط كل طالب، ويمكنك بعدها رؤية إنجازات &quot;الجلسة الحالية&quot; منفصلة عن &quot;مدى الحياة&quot; في كارت الطالب.
            </div>

            {/* Sessions list */}
            {sessions.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {sessions.slice(0, 5).map((sess) => (
                  <div key={sess.id} className="flex items-center justify-between text-[10px] bg-card rounded px-1.5 py-1 border border-border">
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate font-bold text-foreground">{sess.name}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(sess.startedAt).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {sess.endedAt ? (
                      <span className="text-[9px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">منتهية</span>
                    ) : (
                      <button
                        onClick={() => handleEndSession(sess.id)}
                        className="text-[9px] text-red-500 hover:bg-red-500/10 px-1.5 py-0.5 rounded font-bold"
                      >
                        إنهاء
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Fairness settings */}
        <section data-settings-section="general" style={{ display: settingsSectionVisible("general", "fairness عدالة") ? undefined : "none" }}>
          <div className="flex items-center gap-1 text-[11px] font-bold text-primary mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            عدالة اختيار الطلاب
          </div>
          <div className="bg-secondary/30 rounded-lg p-2 space-y-2 border border-border">
            <div className="grid grid-cols-3 gap-1">
              {([
                { value: "off", label: "متوقف" },
                { value: "soft", label: "لطيف" },
                { value: "strict", label: "صارم" },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateSettings({ fairnessMode: option.value })}
                  className={cn("rounded border p-1.5 text-[10px] transition-colors", (settings.fairnessMode || "soft") === option.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent/10")}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-[9px] leading-relaxed text-muted-foreground">الوضع اللطيف ينبه عند التكرار، والوضع الصارم يؤجل الاختيار غير المتوازن عندما توجد بدائل. يظل اختيار المدرس مسجلاً وقابلاً للتفسير.</p>
          </div>
        </section>

        {/* Teleprompter settings */}
        <section data-settings-section="general" style={{ display: settingsSectionVisible("general", "teleprompter تليبرومبتر") ? undefined : "none" }}>
          <div className="flex items-center gap-1 text-[11px] font-bold text-primary mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            التليبرومبتر
          </div>
          <div className="bg-secondary/30 rounded-lg p-2 space-y-2 border border-border">
            <div>
              <div className="text-[11px] mb-1">حجم العرض</div>
              <div className="grid grid-cols-5 gap-1">
                {([
                  { v: "collapsed", l: "رفيع" },
                  { v: "small", l: "صغير" },
                  { v: "medium", l: "متوسط" },
                  { v: "large", l: "كبير" },
                  { v: "xlarge", l: "ضخم" },
                ] as const).map((s) => (
                  <button
                    key={s.v}
                    onClick={() => updateSettings({ teleprompterSize: s.v })}
                    className={cn(
                      "p-1.5 rounded text-[10px] border transition-colors",
                      settings.teleprompterSize === s.v
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-accent/10"
                    )}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">حجم الخط الحالي</span>
              <span className="text-xs font-bold text-primary">
                {settings.teleprompterFontSize}px
              </span>
            </div>
          </div>
        </section>

        {/* Sound settings */}
        <section data-settings-section="general" style={{ display: settingsSectionVisible("general", "sound audio صوت") ? undefined : "none" }}>
          <div className="flex items-center gap-1 text-[11px] font-bold text-primary mb-2">
            {settings.muted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            الصوت
          </div>
          <div className="bg-secondary/30 rounded-lg p-2 space-y-2 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs">كتم الصوت</span>
              <Switch
                checked={settings.muted}
                onCheckedChange={(v) => updateSettings({ muted: v })}
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span>مستوى الصوت</span>
                <span className="text-muted-foreground">
                  {Math.round(safeVolume * 100)}%
                </span>
              </div>
              <Slider
                value={[safeVolume * 100]}
                onValueChange={(v) => updateSettings({ volume: v[0] / 100 })}
                min={0}
                max={100}
                step={5}
                className="h-1"
              />
            </div>
          </div>
      </section>

      {/* ===== Virtual Comments — نظام التعليقات الافتراضية ===== */}
      <section data-settings-section="general" style={{ display: settingsSectionVisible("general", "comments تعليقات") ? undefined : "none" }}>
        <div className="flex items-center gap-1 text-[11px] font-bold text-primary mb-2">
          <MessageSquare className="w-3.5 h-3.5" />
          التعليقات الافتراضية (للتصوير والدروس التفاعلية)
        </div>
        <div className="bg-secondary/30 rounded-lg p-2 space-y-2 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium">تفعيل التعليقات</span>
              <p className="text-[10px] text-muted-foreground leading-tight">
                يعرض تعليقات افتراضية من طلاب عند خطوات محددة في المنهج
              </p>
            </div>
            <Switch
              checked={!!useShellStore((s) => s.virtualCommentsEnabled)}
              onCheckedChange={(v) => {
                useShellStore.getState().setVirtualCommentsEnabled(v);
              }}
            />
          </div>

          {/* Auto-hide duration slider */}
          {useShellStore((s) => s.virtualCommentsEnabled) && (
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span>مدة الاختفاء التلقائي</span>
                <span className="text-muted-foreground">
                  {((settings.virtualCommentAutoHideMs ?? 12000) / 1000).toFixed(1)} ث
                </span>
              </div>
              <Slider
                value={[settings.virtualCommentAutoHideMs ?? 12000]}
                onValueChange={(v) => useShellStore.getState().updateSettings({ virtualCommentAutoHideMs: v[0] })}
                min={2000}
                max={15000}
                step={500}
                className="h-1"
              />
              <p className="text-[9px] text-muted-foreground mt-1">
                بعد المدة دي الـ bubble تختفي لوحدها. المدرس يقدر يشيلها بضغطة واحدة.
              </p>
            </div>
          )}

          {/* Status hint */}
          <div className="text-[9px] text-muted-foreground bg-white/5 rounded p-1.5 border border-border/50">
            💡 التعليقات موجودة في الـ <strong>manifest</strong> بتاع الدرس. اعمل درس HTML وضيف <code className="text-[8px] bg-white/10 px-1 py-0.5 rounded">virtualComments</code> جواه عشان تظهر تلقائياً.
          </div>
        </div>
      </section>

      {/* ===== TTS — النظام الصوتي ===== */}
      <section data-settings-section="ai" style={{ display: settingsSectionVisible("ai", "tts صوت نطق") ? undefined : "none" }}>
        <div className="flex items-center gap-1 text-[11px] font-bold text-primary mb-2">
          <AudioLines className="w-3.5 h-3.5" />
          النظام الصوتي (ينطق كل التفاصيل)
        </div>
        <div className="bg-secondary/30 rounded-lg p-2 space-y-2 border border-border">
          {/* تفعيل/تعطيل النظام الصوتي */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium">تفعيل النطق الصوتي</span>
              <p className="text-[10px] text-muted-foreground leading-tight">
                ينطق أسماء الطلاب، النقاط، الاحتفالات، الهدايا، والألقاب
              </p>
            </div>
            <Switch
              checked={settings.ttsEnabled ?? true}
              onCheckedChange={(v) => {
                updateSettings({ ttsEnabled: v });
                updateTtsSetting("ttsEnabled", v);
              }}
            />
          </div>

          {/* الإعدادات الفرعية */}
          {(settings.ttsEnabled ?? true) && (
            <>
              {/* نطق أسماء الطلاب */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Mic2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs">نطق اسم الطالب عند الاختيار</span>
                </div>
                <Switch
                  checked={settings.ttsSpeakStudentName ?? true}
                  onCheckedChange={(v) => {
                    updateSettings({ ttsSpeakStudentName: v });
                    updateTtsSetting("ttsSpeakStudentName", v);
                  }}
                />
              </div>

              {/* نطق النقاط */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs">نطق النقاط (صحيح، خطأ، محاولة)</span>
                </div>
                <Switch
                  checked={settings.ttsSpeakPoints ?? true}
                  onCheckedChange={(v) => {
                    updateSettings({ ttsSpeakPoints: v });
                    updateTtsSetting("ttsSpeakPoints", v);
                  }}
                />
              </div>

              {/* نطق الاحتفالات */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <PartyPopper className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs">نطق الاحتفالات</span>
                </div>
                <Switch
                  checked={settings.ttsSpeakCelebrations ?? true}
                  onCheckedChange={(v) => {
                    updateSettings({ ttsSpeakCelebrations: v });
                    updateTtsSetting("ttsSpeakCelebrations", v);
                  }}
                />
              </div>

              {/* نطق الهدايا */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Gift className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs">نطق منح الهدايا</span>
                </div>
                <Switch
                  checked={settings.ttsSpeakGifts ?? true}
                  onCheckedChange={(v) => {
                    updateSettings({ ttsSpeakGifts: v });
                    updateTtsSetting("ttsSpeakGifts", v);
                  }}
                />
              </div>

              {/* سرعة النطق */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span>سرعة النطق</span>
                  <span className="text-muted-foreground">
                    {(settings.ttsRate ?? 1.0).toFixed(1)}x
                  </span>
                </div>
                <Slider
                  value={[settings.ttsRate ?? 1.0]}
                  onValueChange={(v) => {
                    updateSettings({ ttsRate: v[0] });
                    updateTtsSetting("ttsRate", v[0]);
                  }}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="h-1"
                />
              </div>

              {/* زر اختبار */}
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs"
                onClick={async () => {
                  await testTts();
                }}
              >
                🔊 اختبار النطق الصوتي
              </Button>
            </>
          )}

          <div className="text-[9px] text-muted-foreground bg-white/5 rounded p-1.5 border border-border/50">
            💡 النظام يستخدم Google Translate TTS (جودة عالية في العربي) مع fallback لـ Web Speech API
          </div>
        </div>
      </section>

      {/* Whiteboard settings */}
        <section data-settings-section="general" style={{ display: settingsSectionVisible("general", "whiteboard سبورة قلم") ? undefined : "none" }}>
          <div className="flex items-center gap-1 text-[11px] font-bold text-primary mb-2">
            <Pen className="w-3.5 h-3.5" />
            السبورة الذكية
          </div>
          <div className="bg-secondary/30 rounded-lg p-2 space-y-2 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs">تفعيل السبورة</span>
              <Switch
                checked={settings.whiteboardEnabled}
                onCheckedChange={(v) => updateSettings({ whiteboardEnabled: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">مسح تلقائي عند الخطوة التالية</span>
              <Switch
                checked={settings.autoClearOnStepChange}
                onCheckedChange={(v) => updateSettings({ autoClearOnStepChange: v })}
              />
            </div>
            <div>
              <div className="text-[11px] mb-1">لون القلم</div>
              <div className="flex gap-2">
                {(["blue", "red", "green", "black"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setWhiteboardColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-all",
                      whiteboardColor === c
                        ? "border-primary scale-110 ring-2 ring-primary/50"
                        : "border-border",
                      c === "blue" && "color-blue",
                      c === "red" && "color-red",
                      c === "green" && "color-green",
                      c === "black" && "color-black"
                    )}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px]">سمك القلم</span>
                <span className="text-[11px] font-bold text-primary">{whiteboardThickness}px</span>
              </div>
              {/* Preset buttons */}
              <div className="flex gap-1 mb-2">
                {[1, 2, 4, 6, 10, 15].map((t) => (
                  <button
                    key={t}
                    onClick={() => setWhiteboardThickness(t)}
                    className={cn(
                      "flex-1 h-8 rounded text-[10px] border transition-colors flex items-center justify-center gap-1",
                      whiteboardThickness === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-accent/10"
                    )}
                  >
                    <div className="rounded-full bg-current" style={{ width: Math.min(t + 2, 14), height: Math.min(t + 2, 14) }} />
                  </button>
                ))}
              </div>
              {/* Flexible slider */}
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={whiteboardThickness}
                onChange={(e) => setWhiteboardThickness(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: "#2563eb" }}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                <span>1</span>
                <span>10</span>
                <span>20</span>
              </div>
            </div>
          </div>
        </section>

        {/* Presentation mode */}
        <section data-settings-section="general" style={{ display: settingsSectionVisible("general", "presentation عرض") ? undefined : "none" }}>
          <div className="flex items-center gap-1 text-[11px] font-bold text-primary mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            وضع العرض
          </div>
          <div className="bg-secondary/30 rounded-lg p-2 border border-border">
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => updateSettings({ presentationMode: "manual" })}
                className={cn(
                  "p-2 rounded text-[11px] border transition-colors",
                  settings.presentationMode === "manual"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent/10"
                )}
              >
                يدوي
              </button>
              <button
                onClick={() => updateSettings({ presentationMode: "auto" })}
                className={cn(
                  "p-2 rounded text-[11px] border transition-colors",
                  settings.presentationMode === "auto"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent/10"
                )}
              >
                تلقائي
              </button>
            </div>
          </div>
        </section>

        {/* Keyboard shortcuts */}
        <section data-settings-section="advanced" style={{ display: settingsSectionVisible("advanced", "keyboard shortcuts اختصارات") ? undefined : "none" }}>
          <div className="flex items-center gap-1 text-[11px] font-bold text-primary mb-2">
            <Keyboard className="w-3.5 h-3.5" />
            اختصارات لوحة المفاتيح
          </div>
          <div className="bg-secondary/30 rounded-lg p-2 space-y-1 border border-border">
            {SHORTCUTS.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between text-[11px] py-0.5"
              >
                <span className="text-muted-foreground">{s.description}</span>
                <kbd className="font-mono text-[10px] px-2 py-0.5 bg-background border border-border rounded shadow-sm min-w-[28px] text-center text-primary">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </section>

        {/* Reset */}
        <section data-settings-section="advanced" style={{ display: settingsSectionVisible("advanced", "reset إعادة تعيين") ? undefined : "none" }}>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs border-border hover:bg-accent/10"
            onClick={async () => {
              if (await requestConfirm("إعادة تعيين كل الإعدادات للوضع الافتراضي؟")) {
                resetSettings();
              }
            }}
          >
            <RotateCcw className="w-3 h-3 ml-1" />
            إعادة تعيين الإعدادات
          </Button>
        </section>
      </div>
    </div>
  );
}
