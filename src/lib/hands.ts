import type { Capture, TriageBucket } from "../types";
import { BUCKET_LABELS } from "../types";

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function formatDoList(captures: Capture[]): string {
  const doItems = captures.filter((c) => c.bucket === "do");

  if (doItems.length === 0) {
    return "No do items tonight.";
  }

  return doItems
    .map((item) => {
      const action = item.suggestedAction ? ` — ${item.suggestedAction}` : "";
      return `- ${item.text}${action}`;
    })
    .join("\n");
}

export function formatReviewMarkdown(
  dayKey: string,
  captures: Capture[],
  wins: string[],
): string {
  const lines = [`# Review — ${dayKey}`, ""];

  if (wins.length) {
    lines.push("## Wins", "");
    for (const win of wins) lines.push(`- ${win}`);
    lines.push("");
  }

  lines.push("## Triage", "");

  for (const capture of captures) {
    const bucket = capture.bucket ?? "later";
    lines.push(
      `- **${BUCKET_LABELS[bucket]}** ${capture.text}${capture.reason ? ` — ${capture.reason}` : ""}`,
    );
  }

  return lines.join("\n");
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcsForDoItems(captures: Capture[], dayOffset = 1): string {
  const doItems = captures.filter((c) => c.bucket === "do");
  const start = new Date();
  start.setDate(start.getDate() + dayOffset);
  start.setHours(9, 0, 0, 0);

  const events = doItems.map((item, index) => {
    const eventStart = new Date(start);
    eventStart.setMinutes(eventStart.getMinutes() + index * 30);
    const eventEnd = new Date(eventStart);
    eventEnd.setMinutes(eventEnd.getMinutes() + 15);

    const format = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    return [
      "BEGIN:VEVENT",
      `UID:${item.id}@tetherlog`,
      `DTSTAMP:${format(new Date())}`,
      `DTSTART:${format(eventStart)}`,
      `DTEND:${format(eventEnd)}`,
      `SUMMARY:${escapeIcs(item.text)}`,
      item.suggestedAction
        ? `DESCRIPTION:${escapeIcs(item.suggestedAction)}`
        : "",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TetherLog//EN", ...events, "END:VCALENDAR"].join("\r\n");
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function shareText(title: string, text: string): Promise<boolean> {
  if (!navigator.share) return false;

  await navigator.share({ title, text });
  return true;
}

export function mailtoDoList(captures: Capture[]): void {
  const body = encodeURIComponent(formatDoList(captures));
  window.location.href = `mailto:?subject=${encodeURIComponent("TetherLog — do list")}&body=${body}`;
}

export function bucketColour(bucket: TriageBucket): string {
  const map: Record<TriageBucket, string> = {
    do: "#6a9e6a",
    later: "#d4a574",
    drop: "#8a8378",
    wonder: "#9b8fb8",
  };
  return map[bucket];
}
