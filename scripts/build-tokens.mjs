#!/usr/bin/env node
/**
 * Reads src/tokens/tokens.json (DTCG) and writes src/styles/tokens.generated.css.
 *
 *   Regenerate:  npm run tokens
 *   Verify:      npm run tokens:check   (runs inside npm run build)
 *
 * Zero dependencies, on purpose. The spring solver below is the analytic
 * damped-harmonic solution, verified against motion@13.4.0's own generator to
 * within 0.025 absolute across the whole curve. Taking the dependency would
 * mean ~756 KB in node_modules to produce four strings at build time, and
 * motion's generateLinearEasing is not headline API, so a minor release could
 * move it. See docs/DECISIONS.md D-003.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SRC = "src/tokens/tokens.json";
const OUT = "src/styles/tokens.generated.css";
/** The same spring solve, for the one animation CSS cannot drive: the lens.
 *  A canvas needs the curve as numbers, and solving it twice is how the CSS
 *  arc and the WebGL arc drift apart. Phase 4. */
const OUT_TS = "src/motion/springs.generated.ts";

/** 1%. Imperceptible on a 3px shadow or a 200px slide, and it bounds the
 *  end-stop clamp below, so the two settings cannot disagree. */
const REST_DELTA = 0.01;
/** One linear() stop per 10ms. */
const SAMPLE_MS = 10;

// ─── spring ────────────────────────────────────────────────────────────────

/** Position of a spring travelling 0 -> 1 at time t seconds, initial velocity 0. */
function springAt(t, { stiffness: k, damping: c, mass: m }) {
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));

  if (z < 1) {
    // Underdamped: oscillates, overshoots.
    const wd = w0 * Math.sqrt(1 - z * z);
    return (
      1 -
      Math.exp(-z * w0 * t) *
        (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t))
    );
  }
  if (Math.abs(z - 1) < 1e-9) {
    // Critically damped: fastest approach with no overshoot.
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  // Overdamped: two exponentials, sluggish.
  const r = w0 * Math.sqrt(z * z - 1);
  const a = -c / (2 * m) + r;
  const b = -c / (2 * m) - r;
  return 1 - (b * Math.exp(a * t) - a * Math.exp(b * t)) / (b - a);
}

/** First time the spring is within REST_DELTA and stays there, in whole 10ms. */
function springDurationMs(cfg) {
  const settled = (ms) => Math.abs(1 - springAt(ms / 1000, cfg)) < REST_DELTA;
  for (let ms = 10; ms <= 4000; ms += 10) {
    // The +30ms lookahead stops a zero crossing being mistaken for rest.
    if (settled(ms) && settled(ms + 30)) return ms;
  }
  throw new Error(`Spring never settles within 4s: ${JSON.stringify(cfg)}`);
}

/** The sampled curve. CSS and the lens both read THIS, never two solves. */
function springPoints(cfg, ms) {
  const n = Math.max(2, Math.round(ms / SAMPLE_MS));
  const points = [];
  for (let i = 0; i <= n; i++) {
    points.push(Number(springAt((i / n) * (ms / 1000), cfg).toFixed(4)));
  }
  // The last stop defines where the property lands, so it must be exactly 1.
  // The error this introduces is bounded by REST_DELTA by construction: at most
  // a 1% correction over the final 10ms, which is not perceptible.
  points[n] = 1;
  return points;
}

function linearEasing(points) {
  return `linear(${points.join(", ")})`;
}

// ─── DTCG ──────────────────────────────────────────────────────────────────

const doc = JSON.parse(readFileSync(SRC, "utf8"));

/** "color.ink.base" -> token node. Group-level $type is inherited on the way down. */
const flat = new Map();
(function walk(node, path, inheritedType) {
  const type = node.$type ?? inheritedType;
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    if (!child || typeof child !== "object") continue;
    const next = path ? `${path}.${key}` : key;
    if ("$value" in child) {
      flat.set(next, { ...child, $type: child.$type ?? type });
    } else {
      walk(child, next, type);
    }
  }
})(doc, "", undefined);

const isAlias = (v) =>
  typeof v === "string" && v.startsWith("{") && v.endsWith("}");

function resolve(value, seen = new Set()) {
  if (!isAlias(value)) return value;
  const ref = value.slice(1, -1);
  if (seen.has(ref)) throw new Error(`Circular alias: ${ref}`);
  const target = flat.get(ref);
  if (!target) throw new Error(`Unknown alias: ${value}`);
  return resolve(target.$value, new Set(seen).add(ref));
}

/** The terminal token path an alias chain points at, or null if not an alias. */
function aliasPath(value) {
  let v = value;
  let path = null;
  const seen = new Set();
  while (isAlias(v)) {
    const ref = v.slice(1, -1);
    if (seen.has(ref)) throw new Error(`Circular alias: ${ref}`);
    seen.add(ref);
    path = ref;
    const target = flat.get(ref);
    if (!target) throw new Error(`Unknown alias: ${value}`);
    v = target.$value;
  }
  return path;
}

/** Semantics get --tl-<role>. Everything else gets --tl-ref-<path>. */
const cssName = (path) =>
  path.startsWith("semantic.")
    ? `--tl-${path.slice("semantic.".length).replace(/\./g, "-")}`
    : `--tl-ref-${path.replace(/\./g, "-")}`;

const quoteFamily = (f) => (/[\s]/.test(f) ? `'${f}'` : f);

// ─── emit ──────────────────────────────────────────────────────────────────

const root = [];
const reduced = [];
const springCurves = [];

/**
 * Pre-pass: every token carrying a plain reduced-motion value, by path.
 * Built before emitting because a SEMANTIC that aliases one of these needs the
 * override too, and the semantic layer is the only layer a component may read.
 * Without this the override lands on --tl-ref-* and reaches nothing.
 */
const reducedValueByPath = new Map();
for (const [path, token] of flat) {
  const rm = token.$extensions?.["tetherlog.reducedMotion"];
  if (rm && "value" in rm) reducedValueByPath.set(path, rm.value);
}

for (const [path, token] of flat) {
  if (path.startsWith("motion.spring.")) {
    const name = path.split(".")[2];
    const cfg = token.$value;
    const ms = springDurationMs(cfg);
    const points = springPoints(cfg, ms);
    // Duration and curve come from the same solve, so they cannot drift apart.
    root.push(`  --tl-spring-${name}-duration: ${ms}ms;`);
    root.push(`  --tl-spring-${name}-ease: ${linearEasing(points)};`);
    springCurves.push({ name, ms, points, description: token.$description ?? "" });

    const rm = token.$extensions?.["tetherlog.reducedMotion"];
    if (!rm) {
      throw new Error(
        `Spring "${path}" has no tetherlog.reducedMotion counterpart. ` +
          `Reduced motion is a contract, not a fallback. See CLAUDE.md.`,
      );
    }
    reduced.push(`    --tl-spring-${name}-duration: ${rm.duration};`);
    reduced.push(`    --tl-spring-${name}-ease: ${rm.easing};`);
    continue;
  }

  const value = resolve(token.$value);

  // A reduced-motion counterpart on this token, or on the token it aliases.
  const reducedValue = reducedValueByPath.has(path)
    ? reducedValueByPath.get(path)
    : reducedValueByPath.get(aliasPath(token.$value));
  if (reducedValue !== undefined) {
    reduced.push(`    ${cssName(path)}: ${reducedValue};`);
  }

  if (token.$type === "fontFamily" && Array.isArray(value)) {
    root.push(`  ${cssName(path)}: ${value.map(quoteFamily).join(", ")};`);
    continue;
  }
  if (token.$type === "cubicBezier" && Array.isArray(value)) {
    root.push(`  ${cssName(path)}: cubic-bezier(${value.join(", ")});`);
    continue;
  }
  if (token.$type === "shadow") {
    const list = (Array.isArray(value) ? value : [value]).map((s) =>
      [
        s.inset ? "inset" : "",
        s.offsetX,
        s.offsetY,
        s.blur,
        s.spread,
        resolve(s.color),
      ]
        .filter(Boolean)
        .join(" "),
    );
    root.push(`  ${cssName(path)}: ${list.length ? list.join(", ") : "none"};`);
    continue;
  }
  if (value && typeof value === "object") {
    throw new Error(
      `Token "${path}" has an object $value but $type "${token.$type}" has no emitter.`,
    );
  }
  root.push(`  ${cssName(path)}: ${value};`);
}

const css = `/**
 * GENERATED FROM src/tokens/tokens.json. DO NOT EDIT BY HAND.
 *
 *   Regenerate:  npm run tokens
 *   Verify:      npm run tokens:check   (runs inside npm run build)
 *
 * This is the ONLY file in the repo that may contain a colour literal.
 * Components read --tl-<role>. Never --tl-ref-*. Never hex. See CLAUDE.md.
 *
 * ${flat.size} tokens.
 */

:root {
${root.join("\n")}
}

@media (prefers-reduced-motion: reduce) {
  :root {
${reduced.join("\n")}
  }
}
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, css);

// ─── the same curves, as numbers ───────────────────────────────────────────
// CSS linear() drives every DOM transition. The gravity lens is a canvas and
// cannot read an easing function, so it samples this array instead. Both come
// from one solve above: there is no second implementation to drift.
const ts = `/**
 * GENERATED FROM src/tokens/tokens.json. DO NOT EDIT BY HAND.
 *
 *   Regenerate:  npm run tokens
 *   Verify:      npm run tokens:check
 *
 * The same sampled spring curves that become the CSS linear() easings in
 * tokens.generated.css, as numbers, for the one animation CSS cannot drive:
 * the gravity lens is a canvas. Solving the springs twice is how a DOM arc and
 * a WebGL arc drift apart, so this file exists instead. See CLAUDE.md.
 */

export interface SpringCurve {
  /** Full duration of the arc in milliseconds, from the same solve as the CSS. */
  readonly durationMs: number;
  /** Position 0 -> 1, sampled every ${SAMPLE_MS}ms. The last point is exactly 1. */
  readonly points: readonly number[];
}

export const springs = {
${springCurves
  .map(
    (s) =>
      `  /** ${s.description} */\n  ${s.name}: {\n    durationMs: ${s.ms},\n    points: [${s.points.join(", ")}],\n  },`,
  )
  .join("\n")}
} as const satisfies Record<string, SpringCurve>;

export type SpringName = keyof typeof springs;
`;

mkdirSync(dirname(OUT_TS), { recursive: true });
writeFileSync(OUT_TS, ts);

console.log(
  `✓ ${OUT} — ${flat.size} tokens, ${root.length} custom properties\n` +
    `✓ ${OUT_TS} — ${springCurves.length} spring curves`,
);
