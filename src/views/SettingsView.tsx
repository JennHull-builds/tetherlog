import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Field } from "../components/ui";
import { exportAllData, getSettings, importAllData, saveSettings } from "../db";
import { downloadFile } from "../lib/hands";
import { readDurationMs } from "../lib/motion";

/**
 * Settings. The quietest screen: nothing here needs character, it needs to be
 * unambiguous.
 *
 * RULES, NOT CARDS. Sections are separated by a 1px --tl-rule, the structural
 * token at 3.22:1. Not the hairline, which measures 1.08:1 on this ground and
 * is not faint but invisible. Review's wrap-up does the same job with space
 * alone; the two should agree and Phase 7 owns that.
 *
 * THE BYOK PARAGRAPH IS FULL-STRENGTH INK, deliberately, while every other
 * body line here is muted. It is a promise about where a key goes, and muted
 * text reads as fine print.
 */
/**
 * A checked native checkbox paints itself in the BROWSER's accent, a blue that
 * belongs to nobody here and put a foreign colour on the one screen
 * docs/LOOK.md calls the quietest. accent-color hands it back to a token.
 *
 * INK, NOT THE ACCENT. Handing it --tl-mark was tried first and it looked
 * good, which is the trap: with two checkboxes and Save, the one colour per
 * screen then appeared three times on Settings, which is the exact finding
 * D-014 paid for when the luminous rim was briefly every field's default. Ink
 * is not a colour, it is unmistakably on, and Save keeps the screen's accent.
 *
 * The control stays native. It is the real thing with the real keyboard
 * behaviour, and a hand-built replacement would be a worse switch.
 */
const CHECKBOX: React.CSSProperties = {
  accentColor: "var(--tl-ink)",
  width: "1rem",
  height: "1rem",
};

export function SettingsView() {
  const settings = useLiveQuery(getSettings, [], null);
  const [apiKey, setApiKey] = useState("");
  const [reminderHour, setReminderHour] = useState(20);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);

  // Settings arrive from Dexie asynchronously and re-emit after every save.
  // Adjusting state during render is React's documented pattern for syncing
  // to a changed source; setState inside an effect costs an extra render pass
  // and is what react-hooks/set-state-in-effect flags.
  const [syncedFrom, setSyncedFrom] = useState(settings);
  if (settings && settings !== syncedFrom) {
    setSyncedFrom(settings);
    setApiKey(settings.geminiApiKey ?? "");
    setReminderHour(settings.reviewReminderHour ?? 20);
    setReminderEnabled(settings.reviewReminderEnabled ?? false);
    setSoundEnabled(settings.soundEnabled ?? true);
  }

  async function handleSave() {
    await saveSettings({
      geminiApiKey: apiKey.trim() || undefined,
      reviewReminderHour: reminderHour,
      reviewReminderEnabled: reminderEnabled,
      soundEnabled,
    });
    setSaved(true);
    // The same token "Parked." uses, so the two confirmations agree, including
    // the longer hold under reduced motion.
    window.setTimeout(() => setSaved(false), readDurationMs("--tl-duration-confirm", 600));

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
    <section
      style={{
        paddingInline: "var(--tl-gutter)",
        paddingBlock: "var(--tl-space-lg)",
      }}
    >
      <h1 className="text-display font-light leading-display tracking-display text-ink">
        Your device only
      </h1>

      <Section first>
        <h2 className="text-body font-medium text-ink">Gemini API key (BYOK)</h2>
        <p className="text-small text-ink">
          Your key stays on this device. We never see it. Without a key, capture,
          patterns, and rule-based review still work. AI triage and digest stay off.
        </p>
        <Field
          type="password"
          value={apiKey}
          onChange={setApiKey}
          placeholder="Paste key from Google AI Studio"
        />
      </Section>

      <Section>
        <h2 className="text-body font-medium text-ink">Evening review reminder</h2>
        <label className="flex items-center gap-3 text-body text-ink">
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(event) => setReminderEnabled(event.target.checked)}
            style={CHECKBOX}
          />
          Remind me to review
        </label>
        <div className="flex items-center gap-3">
          <div className="w-24">
            <Field
              type="number"
              min={0}
              max={23}
              value={String(reminderHour)}
              onChange={(value) => setReminderHour(Number(value))}
            />
          </div>
          <span className="text-small text-muted">Hour (0&ndash;23)</span>
        </div>
      </Section>

      <Section>
        <h2 className="text-body font-medium text-ink">Sound</h2>
        <label className="flex items-center gap-3 text-body text-ink">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(event) => setSoundEnabled(event.target.checked)}
            style={CHECKBOX}
          />
          Play a sound when you park
        </label>
        <p className="text-small text-muted">
          One quiet tone, only when a thought lands. On by default.
        </p>
      </Section>

      <Section>
        <h2 className="text-body font-medium text-ink">Backup</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="py-2" onClick={() => void handleExport()}>
            Export JSON
          </Button>
          {/*
            A real button that opens the picker, not a <label> painted to look
            like one. The old version hand-rolled the Button's border, padding
            and radius on a label and drifted from it the moment either moved.
          */}
          <Button variant="ghost" className="py-2" onClick={() => importRef.current?.click()}>
            Import JSON
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImport}
            tabIndex={-1}
            aria-hidden
          />
        </div>
      </Section>

      <div className="mt-10 space-y-3">
        <Button fullWidth onClick={() => void handleSave()}>
          Save settings
        </Button>
        {/* A reserved line, so confirming never moves the button above it. */}
        <div className="flex h-6 items-center justify-center">
          <p className="text-body text-muted" aria-live="polite" aria-atomic="true">
            {saved ? "Saved." : ""}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * One setting, with a rule above it. The rule is the structural token: a
 * boundary a person needs to see is never the decorative hairline.
 */
function Section({
  first = false,
  children,
}: {
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="space-y-3"
      style={{
        marginTop: "var(--tl-space-lg)",
        paddingTop: first ? 0 : "var(--tl-space-lg)",
        borderTop: first ? undefined : "var(--tl-border-width) solid var(--tl-rule)",
      }}
    >
      {children}
    </div>
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
