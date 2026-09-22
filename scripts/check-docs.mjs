/**
 * D-009's mechanical half, finally built.
 *
 * The rule: a document that describes a state the code has left is worse than
 * no document, because it reads as current. Most of that rule needs a human.
 * One part of it does not: when a document names a file in backticks, the file
 * either exists or the document is lying, and that is checkable.
 *
 * It is the check D-009 called "cheap and worth keeping" and then nobody wrote,
 * which is how docs/UI-OVERHAUL.md described LogStack as live in four places
 * after it had been deleted. Phase 7 deleted docs/BUILD-SPEC.md and rewrote
 * every reference to it; this is what stops the next one rotting silently.
 *
 * Deliberately narrow. It only reads paths that look like repo paths, so prose
 * about `npm run build` or `--tl-ink` is ignored rather than guessed at. A
 * false pass is fine here; a false failure would get the whole check deleted.
 */
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

const docs = execSync("git ls-files '*.md'", { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

// A backticked token counts as a repo path when it has a known extension, or
// ends in a slash, and carries no spaces, glob or URL punctuation.
const EXT = /\.(md|json|css|tsx?|mjs|js|yml|yaml|html|sh|png|svg|txt)$/;
const looksLikePath = (t) =>
  !/[\s*?<>|"'()@]/.test(t) &&
  !t.startsWith("http") &&
  !t.startsWith("--") &&
  !t.includes("://") &&
  (EXT.test(t) || t.endsWith("/"));

// Named in prose as gone, historical, or hypothetical. Each one is a file the
// docs discuss the absence of, which is the opposite of a stale reference.
const KNOWN_ABSENT = new Set([
  ".cursorrules",
  // Never existed in any form. ROADMAP.md and D-025 both discuss the ghost.
  "CURSORRULES.md",
  // The vendored design system, deleted in D-001. D-005 quotes its reset.
  "src/nil-ds/core/core.css",
  "tailwind.config.js",
  "DESIGN.md",
  "docs/UI-OVERHAUL.md",
  "docs/BUILD-SPEC.md",
  "src/nil-ds/",
  "scripts/sync-nil-ds.sh",
  "src/components/ui/LogStack.tsx",
  "LogStack.tsx",
  "thing.css",
  "core.css",
]);

// Docs refer to a component by its basename constantly — `hands.ts` rather
// than `src/lib/hands.ts` — and that is shorthand, not rot. So a token also
// passes if exactly one tracked file has that basename. Ambiguous or missing
// basenames still fail, which is the case worth catching: a component that has
// been renamed or deleted.
const tracked = execSync("git ls-files", { encoding: "utf8" }).trim().split("\n");
const byBasename = new Map();
for (const f of tracked) {
  const base = f.split("/").pop();
  byBasename.set(base, (byBasename.get(base) ?? []).concat(f));
}

const resolves = (token) => {
  if (existsSync(token)) return true;
  const hits = byBasename.get(token.split("/").pop());
  // A one-file match is the shorthand case. Several means the doc is ambiguous
  // about which file it means, which is worth a failure of its own.
  return hits?.length === 1 && hits[0].endsWith(token);
};

let failures = 0;
let checked = 0;

for (const doc of docs) {
  const lines = readFileSync(doc, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const token = m[1].trim();
      if (!looksLikePath(token)) continue;
      if (KNOWN_ABSENT.has(token)) continue;
      checked++;
      if (!resolves(token)) {
        console.error(`✗ ${doc}:${i + 1} names \`${token}\`, which does not exist`);
        failures++;
      }
    }
  });
}

if (failures > 0) {
  console.error(
    `\n${failures} stale path reference(s). Either the file moved or the document ` +
      `describes a state the code has left. See docs/DECISIONS.md D-009.\n` +
      `A file that is GONE ON PURPOSE and discussed as gone belongs in KNOWN_ABSENT ` +
      `in this script, with a reason.`,
  );
  process.exit(1);
}

console.log(`✓ ${checked} documented paths all exist across ${docs.length} markdown files`);
