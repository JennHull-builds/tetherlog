/**
 * Reading the motion and colour contract from CSS, at runtime.
 *
 * The gravity lens is a canvas, so it cannot use a CSS easing or a CSS colour.
 * It reads both from the same custom properties every DOM element reads, which
 * is what keeps one source of truth: change a token, and the lens changes with
 * the rest of the app. Nothing here may hold a colour literal.
 *
 * `prefers-reduced-motion` needs no special case in this file. The generated
 * stylesheet already overrides the tokens inside the media query, so a reduced
 * reader gets a 1ms duration and a 0 light peak from the same read.
 */

import type { SpringCurve } from "../motion/springs.generated";

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Position on a spring curve at `t` of its duration, 0 to 1.
 *
 * The curve is the array the build solved, sampled every 10ms, so this is a
 * lookup and a lerp rather than a second implementation of the spring. Values
 * past 1 are the deliberate overshoot on `commit` and are not clamped: that
 * overshoot is the whole point of the token.
 */
export function sampleSpring(curve: SpringCurve, t: number): number {
  const { points } = curve;
  if (t <= 0) return points[0];
  if (t >= 1) return points[points.length - 1];

  const scaled = t * (points.length - 1);
  const i = Math.floor(scaled);
  const frac = scaled - i;
  return points[i] + (points[i + 1] - points[i]) * frac;
}

function readToken(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** A duration token as a number of milliseconds. `600ms` and `0.6s` both work. */
export function readDurationMs(name: string, fallback: number): number {
  const raw = readToken(name);
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value)) return fallback;
  return raw.endsWith("ms") ? value : value * 1000;
}

export function readNumber(name: string, fallback: number): number {
  const value = Number.parseFloat(readToken(name));
  return Number.isNaN(value) ? fallback : value;
}

/**
 * A colour token as sRGB 0 to 1, with alpha.
 *
 * Deliberately NOT converted to linear light. The lens paints the ground
 * colour into its own pixels, and the only way a canvas and a CSS background
 * agree exactly is if the canvas writes the same sRGB values the stylesheet
 * declared. A linearising round trip is more correct physics and a visible
 * seam down the edge of the canvas.
 *
 * Custom properties come back from getComputedStyle as the author wrote them,
 * so this parses hex rather than `rgb()`. Three, four, six and eight digits.
 */
export function readColour(
  name: string,
): [r: number, g: number, b: number, a: number] {
  const raw = readToken(name);
  if (!raw.startsWith("#")) return [0, 0, 0, 1];

  let body = raw.slice(1);
  if (body.length === 3 || body.length === 4) {
    body = body
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (body.length !== 6 && body.length !== 8) return [0, 0, 0, 1];

  const channel = (at: number) => Number.parseInt(body.slice(at, at + 2), 16) / 255;
  return [
    channel(0),
    channel(2),
    channel(4),
    body.length === 8 ? channel(6) : 1,
  ];
}
