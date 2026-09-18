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

function linearEasing(cfg, ms) {
  const n = Math.max(2, Math.round(ms / SAMPLE_MS));
  const points = [];
  for (let i = 0; i <= n; i++) {
    points.push(Number(springAt((i / n) * (ms / 1000), cfg).toFixed(4)));
  }
  // The last stop defines where the property lands, so it must be exactly 1.
  // The error this introduces is bounded by REST_DELTA by construction: at most
  // a 1% correction over the final 10ms, which is not perceptible.
  points[n] = 1;
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

/** Semantics get --tl-<role>. Everything else gets --tl-ref-<path>. */
const cssName = (path) =>
  path.startsWith("semantic.")
    ? `--tl-${path.slice("semantic.".length).replace(/\./g, "-")}`
    : `--tl-ref-${path.replace(/\./g, "-")}`;

const quoteFamily = (f) => (/[\s]/.test(f) ? `'${f}'` : f);

// ─── emit ──────────────────────────────────────────────────────────────────

const root = [];
const reduced = [];

for (const [path, token] of flat) {
  if (path.startsWith("motion.spring.")) {
    const name = path.split(".")[2];
    const cfg = token.$value;
    const ms = springDurationMs(cfg);
    // Duration and curve come from the same solve, so they cannot drift apart.
    root.push(`  --tl-spring-${name}-duration: ${ms}ms;`);
    root.push(`  --tl-spring-${name}-ease: ${linearEasing(cfg, ms)};`);

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

const confirmReduced = flat.get("motion.duration.confirm-reduced");
if (confirmReduced) {
  reduced.push(`    --tl-ref-motion-duration-confirm: ${confirmReduced.$value};`);
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
console.log(`✓ ${OUT} — ${flat.size} tokens, ${root.length} custom properties`);
