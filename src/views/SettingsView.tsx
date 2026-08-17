import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { exportAllData, getSettings, importAllData, saveSettings } from "../db";
import { downloadFile } from "../lib/hands";

export function SettingsView() {
  const settings = useLiveQuery(getSettings, [], null);
  const [apiKey, setApiKey] = useState("");
  const [reminderHour, setReminderHour] = useState(20);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setApiKey(settings.geminiApiKey ?? "");
    setReminderHour(settings.reviewReminderHour ?? 20);
    setReminderEnabled(settings.reviewReminderEnabled ?? false);
  }, [settings]);

  async function handleSave() {
    await saveSettings({
      geminiApiKey: apiKey.trim() || undefined,
      reviewReminderHour: reminderHour,
      reviewReminderEnabled: reminderEnabled,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);

    if (reminderEnabled && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        scheduleReminder(reminderHour);
      }
    }
  }

  async function handleExport() {
    const data = await exportAllData();
    downloadFile(
      `tetherlog-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const payload = JSON.parse(text) as Parameters<typeof importAllData>[0];
    await importAllData(payload);
    event.target.value = "";
  }

  return (
    <section className="space-y-6 px-4 py-8">
      <div>
        <p className="text-sm text-[var(--muted)]">Settings</p>
        <h1 className="mt-1 text-2xl font-medium">Your device only</h1>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 space-y-3">
        <h2 className="font-medium">Gemini API key (BYOK)</h2>
        <p className="text-sm text-[var(--muted)]">
          Your key stays in this browser. We never store it on a server. Uses your free tier.
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Paste key from Google AI Studio"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 outline-none"
        />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 space-y-3">
        <h2 className="font-medium">Evening review reminder</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(event) => setReminderEnabled(event.target.checked)}
          />
          Remind me to review
        </label>
        <input
          type="number"
          min={0}
          max={23}
          value={reminderHour}
          onChange={(event) => setReminderHour(Number(event.target.value))}
          className="w-24 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 outline-none"
        />
        <span className="text-sm text-[var(--muted)]">Hour (0–23)</span>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 space-y-3">
        <h2 className="font-medium">Backup</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          >
            Export JSON
          </button>
          <label className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm cursor-pointer">
            Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-[#0f0f14]"
      >
        Save settings
      </button>

      {saved && <p className="text-center text-sm text-[var(--do)]">Saved.</p>}
    </section>
  );
}

function scheduleReminder(hour: number) {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const delay = next.getTime() - now.getTime();
  window.setTimeout(() => {
    new Notification("TetherLog", {
      body: "Time for evening review?",
    });
  }, delay);
}
