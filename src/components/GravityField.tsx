import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  prefersReducedMotion,
  readColour,
  readNumber,
  sampleSpring,
} from "../lib/motion";
import { springs } from "../motion/springs.generated";

/**
 * The grid: a fine field of dots that makes room for the capture field.
 *
 * It replaced the starfield lens in D-027. The dots are pushed back from the
 * field's edge, a little further on focus, and when a thought is parked one
 * wave runs out through them from the field and the grid is still again.
 *
 * One fullscreen fragment shader, no library. Kept under its old name because
 * the job is the same one: the field is the heavy object on this screen, and
 * this is what it does to the space around it.
 *
 * FIVE THINGS THIS FILE MUST KEEP TRUE, none of which a typecheck can catch:
 *
 * 1. NOTHING LOOPS. `frame` schedules its successor only while an arc is
 *    actually running. When both arcs finish it draws the final frame and
 *    returns WITHOUT scheduling, so an idle screen calls requestAnimationFrame
 *    exactly zero times. "It looks still" is not evidence; wrap rAF and watch.
 *
 * 2. CAPTURE NEVER WAITS ON THE GPU. The context is created after first paint,
 *    off the idle callback. The capture field is real DOM and is focusable and
 *    typeable before this component has a context at all.
 *
 * 3. NO WEBGL IS NOT A FAILURE. Roughly 2% of devices land there. They get the
 *    field on the plain ground and lose nothing functional. Nothing else on
 *    the screen depends on this canvas any more: the field draws its own edge.
 *
 * 4. THE GRID KEEPS CLEAR OF TEXT. The dots nearest the field measure 3.19:1
 *    under --tl-ink-muted, so a dot behind a glyph would fail AA. Every run of
 *    text on this screen is passed in through `keepClear` and the dots fade
 *    out around it. A new piece of copy on Capture needs adding there.
 *
 * 5. NO BLACK SHEET ON LOAD. A context made with `alpha: false` starts opaque
 *    black. The canvas is held at zero opacity until its first real frame is
 *    drawn, so the load is the ground and then the grid, never ground, black,
 *    grid.
 */

export interface Well {
  /** Viewport coordinates, CSS pixels, as getBoundingClientRect reports them. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The field's own corner radius, so the room follows its actual shape. */
  radius: number;
}

interface GravityFieldProps {
  well: Well | null;
  focused: boolean;
  /** Changes once per park. The wave runs when it does, and never queues. */
  commitKey: number;
  /**
   * Every run of text on the screen, which the dots keep clear of. Read on
   * each frame, so text that moves or appears is followed.
   */
  keepClear: RefObject<HTMLElement | null>[];
  /**
   * Changes when the copy on screen changes (the confirm word, the chips, the
   * count), so the grid redraws once to keep clear of it. One frame, never an
   * animation: nothing on this screen moves in response to typing.
   */
  contentKey: string;
}

/** The most runs of text the shader keeps clear of. Matches uClear below. */
const MAX_CLEAR = 6;

// ── the shader ─────────────────────────────────────────────────────────────

/**
 * One triangle, oversized to cover the viewport. Cheaper than two and there is
 * nothing here that a quad would give: every pixel is decided by the fragment
 * stage and there is no geometry to speak of.
 */
const VERTEX_SRC = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision highp float;

uniform float uScale;     // device pixels per CSS pixel; everything below is CSS px
uniform vec2 uWell;       // field centre, origin bottom-left
uniform vec2 uHalf;       // field half extents
uniform float uRadius;    // field corner radius
uniform float uFocus;     // 0 at rest, 1 focused, along the focus spring
uniform float uT;         // ms since the park, negative when there is no wave
uniform float uDuration;  // ms the wave lasts
uniform float uLight;     // how far the wave lifts the dots it passes
uniform float uPitch;
uniform float uDotRadius;
uniform float uRoomRest;
uniform float uRoomFocus;
uniform float uSpeed;     // px per ms
uniform vec3 uGround;
uniform vec3 uDot;
uniform vec3 uDotNear;
uniform vec4 uClear[${MAX_CLEAR}]; // centre and half extents of each run of text

float hash21(vec2 p) {
  p = fract(p * vec2(127.11, 311.7));
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

// Signed distance to the field's own round-cornered rectangle.
float sdField(vec2 q) {
  vec2 d = abs(q) - uHalf + uRadius;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - uRadius;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
  vec2 p = gl_FragCoord.xy / uScale;
  vec2 q = p - uWell;
  float d = sdField(q);
  vec3 col = uGround;

  // Inside the field the DOM paints over this, so only compute the outside.
  if (d > -2.0) {
    float dd = max(d, 0.0);
    vec2 a = max(uHalf - vec2(uRadius), vec2(0.0));
    vec2 v = q - clamp(q, -a, a);
    float lv = length(v);
    vec2 n = lv > 0.0001 ? v / lv : vec2(0.0, 1.0);

    // The field makes room: the grid is pushed back from its edge, further
    // on focus, and the push fades out with distance.
    float room = mix(uRoomRest, uRoomFocus, uFocus) * exp(-dd / 42.0);

    // One wave out from the field after a park. It tapers to exactly nothing
    // before the loop stops, so the last frame never jumps.
    float wave = 0.0;
    float lift = 0.0;
    if (uT >= 0.0) {
      float x = dd - uT * uSpeed;
      float fade = exp(-uT / 750.0) * (1.0 - smoothstep(uDuration * 0.7, uDuration, uT));
      wave = 7.0 * exp(-x * x / (2.0 * 24.0 * 24.0)) * sin(x * 0.15) * fade;
      lift = abs(wave) / 7.0 * uLight;
    }

    vec2 s = p - n * (room + wave);
    vec2 g = s / uPitch;
    vec2 o = (g - floor(g + 0.5)) * uPitch;
    float aa = 0.6 / uScale + 0.3;
    float dotA = 1.0 - smoothstep(uDotRadius - aa, uDotRadius + aa, length(o));
    // A clean collar a few pixels wide outside the field's edge. Without it a
    // pushed-back dot can sit right against the focus edge, and that edge is
    // measured against what is next to it (WCAG 1.4.11, docs/BACKLOG.md B-006).
    dotA *= smoothstep(1.0, 5.0, dd);

    float near = exp(-dd / 30.0) * (0.55 + 0.45 * uFocus);
    vec3 dc = mix(uDot, uDotNear, clamp(near, 0.0, 1.0)) + uDotNear * lift;

    // Keep clear of every run of text, with a soft edge rather than a box.
    float keep = 1.0;
    for (int i = 0; i < ${MAX_CLEAR}; i++) {
      vec4 c = uClear[i];
      if (c.z > 0.0) keep *= smoothstep(2.0, 14.0, sdBox(p - c.xy, c.zw));
    }

    col += dc * dotA * keep;
  }

  // Dither, so the dots' falloff never bands.
  col += (hash21(gl_FragCoord.xy) - 0.5) * 0.004;
  gl_FragColor = vec4(col, 1.0);
}
`;

type Uniforms = Record<string, WebGLUniformLocation | null>;

interface Grid {
  gl: WebGLRenderingContext;
  u: Uniforms;
  ground: [number, number, number];
  dot: [number, number, number];
  dotNear: [number, number, number];
  light: number;
  pitch: number;
  dotRadius: number;
  roomRest: number;
  roomFocus: number;
  speed: number;
  durationMs: number;
}

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Grid shader failed to compile:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createGrid(canvas: HTMLCanvasElement): Grid | null {
  let gl: WebGLRenderingContext | null;
  try {
    gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    }) as WebGLRenderingContext | null;
  } catch {
    return null;
  }
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("Grid program failed to link:", gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u: Uniforms = {};
  for (const name of [
    "uScale", "uWell", "uHalf", "uRadius", "uFocus", "uT", "uDuration",
    "uLight", "uPitch", "uDotRadius", "uRoomRest", "uRoomFocus", "uSpeed",
    "uGround", "uDot", "uDotNear", "uClear",
  ]) {
    u[name] = gl.getUniformLocation(program, name);
  }

  // Read once. The palette does not change at runtime: there is one ground.
  const [gr, gg, gb] = readColour("--tl-ground");
  const [dr, dg, db] = readColour("--tl-grid-dot");
  const [nr, ng, nb] = readColour("--tl-grid-dot-near");

  return {
    gl,
    u,
    ground: [gr, gg, gb],
    dot: [dr, dg, db],
    dotNear: [nr, ng, nb],
    light: readNumber("--tl-light-commit-peak", 0),
    pitch: readNumber("--tl-grid-pitch", 16),
    dotRadius: readNumber("--tl-grid-dot-radius", 0.95),
    roomRest: readNumber("--tl-grid-room-rest", 8),
    roomFocus: readNumber("--tl-grid-room-focus", 15),
    speed: readNumber("--tl-grid-wave-speed", 0.34),
    durationMs: readNumber("--tl-grid-wave-duration", 1700),
  };
}

/**
 * The tight box around an element's text, or null when it has none showing.
 * A Range rather than the element's own box, because a line of copy is often
 * far narrower than the block it sits in, and the grid should only step back
 * from the words.
 */
function textBounds(el: HTMLElement | null): DOMRect | null {
  if (!el || !el.textContent?.trim()) return null;
  if (getComputedStyle(el).visibility === "hidden") return null;
  const range = document.createRange();
  range.selectNodeContents(el);
  const r = range.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

export function GravityField({
  well,
  focused,
  commitKey,
  keepClear,
  contentKey,
}: GravityFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<Grid | null>(null);
  const wellRef = useRef<Well | null>(well);
  const frameRef = useRef(0);
  // Latest list, read from inside the frame without being a dependency: an
  // array written in the JSX is new on every render.
  const keepClearRef = useRef(keepClear);
  keepClearRef.current = keepClear;
  // Zero opacity until the first real frame. See rule 5 above.
  const [drawn, setDrawn] = useState(false);
  const drawnRef = useRef(false);

  const arcRef = useRef({
    from: 0,
    to: 0,
    startedAt: 0,
    commitAt: 0,
  });

  const draw = useCallback((focus: number, t: number) => {
    const grid = gridRef.current;
    const canvas = canvasRef.current;
    const w = wellRef.current;
    if (!grid || !canvas || !w) return;

    const { gl, u } = grid;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    // getBoundingClientRect has its origin top-left; gl_FragCoord bottom-left.
    const H = canvas.clientHeight;
    gl.uniform1f(u.uScale, dpr);
    gl.uniform2f(u.uWell, w.x + w.width / 2, H - (w.y + w.height / 2));
    gl.uniform2f(u.uHalf, w.width / 2, w.height / 2);
    gl.uniform1f(u.uRadius, Math.min(w.radius, w.width / 2, w.height / 2));
    gl.uniform1f(u.uFocus, focus);
    gl.uniform1f(u.uT, t);
    gl.uniform1f(u.uDuration, grid.durationMs);
    gl.uniform1f(u.uLight, grid.light);
    gl.uniform1f(u.uPitch, grid.pitch);
    gl.uniform1f(u.uDotRadius, grid.dotRadius);
    gl.uniform1f(u.uRoomRest, grid.roomRest);
    gl.uniform1f(u.uRoomFocus, grid.roomFocus);
    gl.uniform1f(u.uSpeed, grid.speed);
    gl.uniform3fv(u.uGround, grid.ground);
    gl.uniform3fv(u.uDot, grid.dot);
    gl.uniform3fv(u.uDotNear, grid.dotNear);

    const clear = new Float32Array(MAX_CLEAR * 4);
    keepClearRef.current.slice(0, MAX_CLEAR).forEach((ref, i) => {
      const b = textBounds(ref.current);
      if (!b) return;
      clear.set(
        [b.left + b.width / 2, H - (b.top + b.height / 2), b.width / 2, b.height / 2],
        i * 4,
      );
    });
    gl.uniform4fv(u.uClear, clear);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!drawnRef.current) {
      drawnRef.current = true;
      setDrawn(true);
    }
  }, []);

  /**
   * One frame of whichever arcs are live, then a decision: schedule another,
   * or stop. This is the only place a frame is ever requested, and the only
   * exit that leaves frameRef at 0 is the one where nothing is moving.
   */
  const frame = useCallback(function tick() {
    const arc = arcRef.current;
    const now = performance.now();
    let running = false;

    let focus = arc.to;
    if (arc.startedAt !== 0) {
      const t = (now - arc.startedAt) / springs.focus.durationMs;
      if (t >= 1) {
        arc.startedAt = 0;
      } else {
        focus = arc.from + (arc.to - arc.from) * sampleSpring(springs.focus, t);
        running = true;
      }
    }

    let t = -1;
    if (arc.commitAt !== 0) {
      const elapsed = now - arc.commitAt;
      if (elapsed >= (gridRef.current?.durationMs ?? 0)) {
        arc.commitAt = 0;
      } else {
        t = elapsed;
        running = true;
      }
    }

    draw(focus, t);

    // The idle exit. Nothing is scheduled from here and nothing polls.
    frameRef.current = running ? requestAnimationFrame(tick) : 0;
  }, [draw]);

  const schedule = useCallback(() => {
    if (!gridRef.current) return;

    if (prefersReducedMotion()) {
      // No arc at all: the state changes, the screen does not travel, and
      // there is no wave. The light token is already 0 in the reduced query.
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
      const arc = arcRef.current;
      arc.startedAt = 0;
      arc.commitAt = 0;
      draw(arc.to, -1);
      return;
    }

    if (frameRef.current === 0) frameRef.current = requestAnimationFrame(frame);
  }, [draw, frame]);

  // ── context, created after first paint ───────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let idleHandle = 0;
    let timeoutHandle = 0;

    function init() {
      if (cancelled) return;
      gridRef.current = createGrid(canvas!);
      if (gridRef.current) schedule();
    }

    // Capture never waits on the GPU. Context creation costs 10 to 40ms and it
    // happens after the field is already focusable and typeable.
    const idle = window.requestIdleCallback;
    if (typeof idle === "function") {
      idleHandle = idle(init, { timeout: 500 });
    } else {
      timeoutHandle = window.setTimeout(init, 0);
    }

    function onLost(event: Event) {
      event.preventDefault();
      gridRef.current = null;
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
      drawnRef.current = false;
      setDrawn(false);
    }
    function onRestored() {
      init();
    }

    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    return () => {
      cancelled = true;
      if (idleHandle && window.cancelIdleCallback) {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
      gridRef.current = null;
    };
  }, [schedule]);

  // ── focus: the field takes more room ─────────────────────────────────────
  useEffect(() => {
    const arc = arcRef.current;
    const target = focused ? 1 : 0;
    if (arc.to === target) return;

    // Start from where the room actually is, not from the last target, so an
    // interrupted arc continues rather than jumping back.
    const now = performance.now();
    if (arc.startedAt !== 0) {
      const t = (now - arc.startedAt) / springs.focus.durationMs;
      arc.from = arc.from + (arc.to - arc.from) * sampleSpring(springs.focus, Math.min(t, 1));
    } else {
      arc.from = arc.to;
    }
    arc.to = target;
    arc.startedAt = now;
    schedule();
  }, [focused, schedule]);

  // ── commit: one wave out through the grid ────────────────────────────────
  useEffect(() => {
    if (commitKey === 0) return;
    // Restarted, never queued. Two parks in under a second give one wave from
    // the second park's moment, not two waves back to back.
    arcRef.current.commitAt = performance.now();
    schedule();
  }, [commitKey, schedule]);

  // ── the field moved, or the copy around it changed ───────────────────────
  useEffect(() => {
    wellRef.current = well;
    schedule();
  }, [well, schedule]);

  useEffect(() => {
    schedule();
  }, [contentKey, schedule]);

  useEffect(() => {
    function onResize() {
      schedule();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [schedule]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      /*
       * z-0, NOT a negative z-index. A negative one paints the canvas behind
       * the background of an ancestor, and App's wrapper carries bg-ground, so
       * the old starfield rendered perfectly into a canvas nobody could see.
       * The content above it sets z-10 for the same reason.
       */
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      style={{
        opacity: drawn ? 1 : 0,
        transition: "opacity var(--tl-spring-settle-duration) var(--tl-ease-standard)",
      }}
    />
  );
}
