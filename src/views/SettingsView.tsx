import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Heading, Input, Message, Text } from "nil-ds";
import { exportAllData, getSettings, importAllData, saveSettings } from "../db";
import { downloadFile } from "../lib/hands";

/**
 * Settings. The quietest screen: nothing here needs character, it needs to be
 * unambiguous.
 *
 * SPACE, NOT RULES, decided 2026-09-22 in Phase 7 (D-026). Sections are
 * separated by a double step of space and nothing else. This screen used a 1px
 * rule and was the only one of the three that did: Patterns and Review's
 * wrap-up both separate on space, with the same heading treatment Settings
 * uses, so the odd one out was here. Every section already opens with a
 * full-ink heading, which is the separator; a line under it is a second signal
 * for a boundary nobody was going to miss.
 *
 * The spacing did not change when the line went, so the grouping did not
 * either: the gap between sections is still double the gap inside one.
 *
 * THE BYOK PARAGRAPH IS FULL-STRENGTH INK, deliberately, while every other
 * body line here is muted. It is a promise about where a key goes, and muted
 * text reads as fine print.
 */
/**
 * A checked native checkbox paints itself in the BROWSER's accent unless it is
 * handed a colour. It gets the kit's text colour: ink is not a hue, it is
 * unmistakably on, and the kit's accent stays on the Save button. The control
 * stays native, with the real keyboard behaviour. The kit's Toggle would add
 * ON and OFF words, and this screen's strings do not change (D-031).
 */
const CHECKBOX: React.CSSProperties = {
  accentColor: "var(--nil-color-text)",
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
  const [showKey, setShowKey] = useState(false);
  const [importNote, setImportNote] = useState<{ text: string; error: boolean } | null>(null);
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
    // Saved stays shown until something changes. It used to vanish after
    // 600ms in muted text, and on 2026-11-08 Jen saved a key and saw nothing
    // at all. Product rule 1: always show that the system has done the thing.
    setSaved(true);

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
    const input = event.target;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const looksLikeBackup =
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        (["captures", "wins", "settings"] as const).some((key) =>
          Array.isArray((parsed as Record<string, unknown>)[key]),
        );
      if (!looksLikeBackup) throw new Error("not a backup");
      await importAllData(parsed as Parameters<typeof importAllData>[0]);
      setImportNote({ text: "Backup imported.", error: false });
    } catch {
      setImportNote({
        text: "That file is not a TetherLog backup. Nothing was changed.",
        error: true,
      });
    } finally {
      // So the same file can be picked again.
      input.value = "";
    }
  }

  return (
    <section className="tl-gutter" style={{ paddingBlock: "var(--nil-spacing-lg)" }}>
      {/* One readable column, about 640px, at the left of the
          content area rather than centred in the window (D-039). */}
      <div className="lg:max-w-[40rem]">
      <Heading level={1} style={{ fontSize: "var(--nil-type-scale-xl)" }}>
        Your device only
      </Heading>

      <Section first>
        <Text className="max-w-[70ch]">
          Your key stays on this device. We never see it. Without a key, capture,
          patterns, and rule-based review still work. AI sorting and digest stay off.
        </Text>
        <Input
          label="Gemini API key (BYOK)"
          type={showKey ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
            setSaved(false);
          }}
          placeholder="Paste key from Google AI Studio"
          // The eye sits inside the field so a pasted key can be checked by eye;
          // it is named for screen readers and aria-pressed carries the state.
          trailing={
            <Button
              size="sm"
              variant="ghost"
              icon={showKey ? "eye-off" : "eye"}
              aria-label={showKey ? "Hide key" : "Show key"}
              aria-pressed={showKey}
              onClick={() => setShowKey((v) => !v)}
            />
          }
        />
        {/* Read from what is stored, not from the field, so it only says
            "saved" once the key really is. */}
        <Text size="sm" muted aria-live="polite">
          {settings?.geminiApiKey
            ? "Key saved on this device. AI sorting is on."
            : "No key saved. Sorting uses simple rules."}
        </Text>
      </Section>

      <Section>
        <SectionTitle>Evening review reminder</SectionTitle>
        <label className="flex min-h-11 items-center gap-3" style={LABEL_TEXT}>
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(event) => {
              setReminderEnabled(event.target.checked);
              setSaved(false);
            }}
            style={CHECKBOX}
          />
          Remind me to review
        </label>
        <div className="w-40">
          <Input
            label="Hour (0–23)"
            type="number"
            min={0}
            max={23}
            value={String(reminderHour)}
            onChange={(event) => {
              const n = Math.round(Number(event.target.value));
              setReminderHour(Number.isFinite(n) ? Math.min(23, Math.max(0, n)) : 0);
              setSaved(false);
            }}
          />
        </div>
      </Section>

      <Section>
        <SectionTitle>Sound</SectionTitle>
        <label className="flex min-h-11 items-center gap-3" style={LABEL_TEXT}>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(event) => {
              setSoundEnabled(event.target.checked);
              setSaved(false);
            }}
            style={CHECKBOX}
          />
          Play a sound when you park
        </label>
        <Text size="sm" muted>
          One quiet tone, only when a thought lands. On by default.
        </Text>
      </Section>

      <Section>
        <SectionTitle>Backup</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" icon="download" onClick={() => void handleExport()}>
            Export JSON
          </Button>
          {/* A real button that opens the picker, not a label painted to look like one. */}
          <Button variant="ghost" icon="upload" onClick={() => importRef.current?.click()}>
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
        {/* A reserved line, so the result never moves what is below it. */}
        <div className="flex min-h-6 items-center">
          <Message tone={importNote?.error ? "danger" : importNote ? "success" : "neutral"}>
            {importNote?.text ?? ""}
          </Message>
        </div>
      </Section>

      <div className="mt-10 flex flex-col items-start gap-3">
        <Button variant="primary" onClick={() => void handleSave()}>
          {saved ? "Saved" : "Save settings"}
        </Button>
        {/* A reserved line, so confirming never moves the button above it. */}
        <div className="flex h-6 items-center">
          <Text muted aria-live="polite" aria-atomic="true">
            {saved ? "Saved on this device." : ""}
          </Text>
        </div>
      </div>
      </div>
    </section>
  );
}

const LABEL_TEXT: React.CSSProperties = {
  fontFamily: "var(--nil-font-body)",
  fontSize: "var(--nil-type-scale-base)",
  color: "var(--nil-color-text)",
};

function SectionTitle({ children }: { children: string }) {
  return (
    <Heading level={2} style={{ fontSize: "var(--nil-type-scale-base)" }}>
      {children}
    </Heading>
  );
}

/** One setting. Sections are separated by space and nothing else (D-026). */
function Section({
  first = false,
  children,
}: {
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-3"
      style={{
        marginTop: "var(--nil-spacing-lg)",
        paddingTop: first ? 0 : "var(--nil-spacing-lg)",
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
