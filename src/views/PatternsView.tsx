import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Card } from "../components/ui";
import { db, getSettings } from "../db";
import { aiWeeklyDigest, buildWeeklyStats } from "../lib/agent";
import { copyText, downloadFile, shareText } from "../lib/hands";

export function PatternsView() {
  const captures = useLiveQuery(() => db.captures.toArray(), [], []);
  const settings = useLiveQuery(getSettings, [], null);
  const [digest, setDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!captures) {
    return <p className="px-4 py-8 text-muted">Loading patterns…</p>;
  }

  const stats = buildWeeklyStats(captures);
  const maxHeat = Math.max(...stats.heatmap, 1);

  async function runDigest() {
    if (!settings?.geminiApiKey) return;
    setLoading(true);
    try {
      const text = await aiWeeklyDigest(settings.geminiApiKey, stats);
      setDigest(text);
    } finally {
      setLoading(false);
    }
  }

  const digestMarkdown = `# Weekly digest\n\n${digest ?? "Run digest with your Gemini key in Settings."}\n\n## Stats\n- Total captures: ${stats.totalCaptures}\n- Active days: ${stats.activeDays}\n- Busiest hour: ${stats.busiestHour}:00\n- Stuck items: ${stats.stuckCount}`;

  return (
    <section className="space-y-6 px-4 py-8">
      <div>
        <p className="text-sm text-muted">Patterns</p>
        <h1 className="mt-1 text-2xl font-medium text-ink">What keeps showing up</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total captures" value={String(stats.totalCaptures)} />
        <StatCard label="Active days" value={String(stats.activeDays)} />
        <StatCard label="Busiest hour" value={`${stats.busiestHour}:00`} />
        <StatCard label="Stuck items" value={String(stats.stuckCount)} />
      </div>

      <Card>
        <h2 className="font-medium text-ink">Time of day</h2>
        <div className="mt-4 flex h-24 items-end gap-1">
          {stats.heatmap.map((count, hour) => (
            <div
              key={hour}
              title={`${hour}:00 — ${count}`}
              className="flex-1 rounded-t bg-do"
              style={{ height: `${(count / maxHeat) * 100}%`, opacity: count ? 1 : 0.15 }}
            />
          ))}
        </div>
      </Card>

      {stats.topRepeats.length > 0 && (
        <Card>
          <h2 className="font-medium text-ink">Repeats</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            {stats.topRepeats.map((item) => (
              <li key={item.text}>
                {item.text} <span className="text-muted">×{item.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium text-ink">Weekly digest</h2>
          <Button
            onClick={() => void runDigest()}
            disabled={!settings?.geminiApiKey || loading}
            className="py-2"
          >
            {loading ? "Writing…" : "Generate"}
          </Button>
        </div>
        {!settings?.geminiApiKey && (
          <p className="mt-2 text-sm text-muted">
            Add Gemini key in Settings for narrative digest. Stats above always work.
          </p>
        )}
        {digest && <p className="mt-4 text-sm leading-relaxed text-ink">{digest}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" className="py-2" onClick={() => void copyText(digestMarkdown)}>
            Copy digest
          </Button>
          <Button
            variant="ghost"
            className="py-2"
            onClick={() =>
              downloadFile("weekly-digest.md", digestMarkdown, "text/markdown")
            }
          >
            Download markdown
          </Button>
          <Button
            variant="ghost"
            className="py-2"
            onClick={() => void shareText("Weekly digest", digest ?? digestMarkdown)}
          >
            Share
          </Button>
        </div>
      </Card>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-medium text-ink">{value}</p>
    </Card>
  );
}
