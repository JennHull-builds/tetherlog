import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Card, Field } from "../components/ui";
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
        <p className="text-sm text-muted">Settings</p>
        <h1 className="mt-1 text-2xl font-medium text-ink">Your device only</h1>
      </div>

      <Card className="space-y-3">
        <h2 className="font-medium text-ink">Gemini API key (BYOK)</h2>
        <p className="text-sm text-muted">
          Your key stays on this device. We never see it. Without a key, capture,
          patterns, and rule-based review still work — AI triage and digest stay off.
        </p>
        <Field
          type="password"
          value={apiKey}
          onChange={setApiKey}
          placeholder="Paste key from Google AI Studio"
        />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium text-ink">Evening review reminder</h2>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(event) => setReminderEnabled(event.target.checked)}
          />
          Remind me to review
        </label>
        <div className="flex items-center gap-2">
          <div className="w-24">
            <Field
              type="number"
              min={0}
              max={23}
              value={String(reminderHour)}
              onChange={(value) => setReminderHour(Number(value))}
            />
          </div>
          <span className="text-sm text-muted">Hour (0–23)</span>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium text-ink">Backup</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="py-2" onClick={() => void handleExport()}>
            Export JSON
          </Button>
          <label className="cursor-pointer rounded-xl border border-line bg-raised px-4 py-2 text-sm font-medium text-ink">
            Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </Card>

      <Button fullWidth onClick={() => void handleSave()}>
        Save settings
      </Button>

      {saved && (
        <p className="text-center text-sm text-do" aria-live="polite">
          Saved.
        </p>
      )}
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
