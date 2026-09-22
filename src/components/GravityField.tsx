import { useCallback, useEffect, useRef } from "react";
import {
  prefersReducedMotion,
  readColour,
  readNumber,
  sampleSpring,
} from "../lib/motion";
import { springs } from "../motion/springs.generated";

/**
 * The gravity well: a starfield that bends around the capture field.
 *
 * One fullscreen fragment shader, no library. Three.js is about 170 KB
 * gzipped, regl about 30 and OGL about 13, and a scene with no geometry, no
 * textures and no loader needs none of them. See docs/LOOK.md.
 *
 * FOUR THINGS THIS FILE MUST KEEP TRUE, none of which a typecheck can catch:
 *
 * 1. NOTHING LOOPS. `frame` schedules its successor only while an arc is
 *    actually running. When both arcs finish it draws the final frame and
 *    returns WITHOUT scheduling, so an idle screen calls requestAnimationFrame
 *    exactly zero times. A drifting starfield is an ambient loop and breaks
 *    PRODUCT.md. "It looks still" is not evidence; wrap rAF and watch.
 *
 * 2. CAPTURE NEVER WAITS ON THE GPU. The context is created after first paint,
 *    off the idle callback. The capture field is real DOM and is focusable and
 *    typeable before this component has a context at all.
 *
 * 3. NO WEBGL IS NOT A FAILURE. Roughly 2% of devices land there. They get the
 *    field on the plain ground and lose nothing functional.
 *
 * 4. DEPTH IS WHAT THE OBJECT DOES TO ITS SURROUNDINGS. There is no shadow
 *    here and there must never be one. The field is not raised and not
 *    recessed. It is heavy.
 */

export interface Well {
  /** Viewport coordinates, CSS pixels, as getBoundingClientRect reports them. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The field's own corner radius, so the warp follows its actual shape. */
  radius: number;
}

interface GravityFieldProps {
  well: Well | null;
  focused: boolean;
  /** Changes once per park. The commit pulse runs when it does, and never queues. */
  commitKey: number;
  /**
   * Fires once after WebGL either succeeds or fails, and again on context loss
   * and restore. Field reads this to decide whether to paint its own opaque
   * fallback (no lens) or go transparent and let the shader's glass body show
   * through (D-016). Never drives layout: it only changes a background.
   */
  onReady?: (ready: boolean) => void;
}

// ── the arc ────────────────────────────────────────────────────────────────

/** Mass at rest. The field is already heavy before anyone touches it. */
const MASS_REST = 1;
/** "It gains mass." Focus is a deeper bend, plus the rim, which is DOM. */
const MASS_FOCUS = 1.55;
/** How much more mass the collapse adds at the peak of the commit envelope. */
const MASS_COMMIT = 1.1;
/**
 * The top of the arc the mass value can ever reach (focused + a full commit
 * pulse). Used only to remap mass into lens thickness (D-016) — the focus
 * spring is critically damped (no overshoot), so mass never exceeds this.
 */
const MASS_PEAK = MASS_FOCUS + MASS_COMMIT;

/**
 * The settle spring starts before the commit spring has finished, so the well
 * is already relaxing as the thought lands rather than stopping dead. The
 * overlap is what makes it read as one movement instead of two.
 */
const SETTLE_DELAY_MS = 120;
const COMMIT_TOTAL_MS = Math.max(
  springs.commit.durationMs,
  SETTLE_DELAY_MS + springs.settle.durationMs,
);

/** Rise on `commit`, fall on `settle`, overlapping. 0 at both ends. */
function rawEnvelope(ms: number): number {
  const rise = sampleSpring(springs.commit, ms / springs.commit.durationMs);
  const fall = sampleSpring(
    springs.settle,
    (ms - SETTLE_DELAY_MS) / springs.settle.durationMs,
  );
  return Math.max(rise - fall, 0);
}

/**
 * The overlap means the raw envelope never reaches 1, and its peak depends on
 * two spring solves that can change in tokens.json. Measuring it once here is
 * what lets MASS_COMMIT and the light peak be stated as the values they are,
 * rather than as whatever a moving denominator happens to produce.
 */
const ENVELOPE_PEAK = (() => {
  let peak = 0;
  for (let ms = 0; ms <= COMMIT_TOTAL_MS; ms += 2) {
    peak = Math.max(peak, rawEnvelope(ms));
  }
  return peak || 1;
})();

function envelope(ms: number): number {
  if (ms < 0 || ms > COMMIT_TOTAL_MS) return 0;
  return rawEnvelope(ms) / ENVELOPE_PEAK;
}

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

uniform vec2 uWell;       // well centre, drawing-buffer px, origin bottom-left
uniform vec2 uHalf;       // well half extents
uniform float uRadius;    // well corner radius
uniform float uInfluence; // how far the mass reaches; derived from the field
uniform float uMass;
uniform float uLight;
uniform float uScale;     // device pixel ratio: stars stay a constant CSS size
uniform vec3 uGround;
uniform vec3 uStarCool;   // the two ends of the starfield's colour temperature
uniform vec3 uStarWarm;
uniform vec3 uRim;        // the field's own boundary. NOT a star: see below.
uniform vec3 uGlow;

// Tier 1 (docs/DECISIONS.md D-016): the field's own body as a lit, refractive
// surface, ported from the approved reference artifact. All five are tokens
// (src/tokens/tokens.json, group "lens"), never hand-tuned constants.
uniform float uThick;         // 0..1, lens thickness. Derived from uMass, not a second arc.
uniform float uDispersion;    // chromatic fringe amount at the rim
uniform float uSpecular;      // strength of the one fixed-direction highlight
uniform float uRimStrength;   // brightness of the shader-drawn boundary
uniform float uBloomStrength; // soft glow behind the field, so refraction has something to bend

float hash21(vec2 p) {
  p = fract(p * vec2(127.11, 311.7));
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

/**
 * One star per grid cell, positioned by hash, kept clear of the cell edge so a
 * single lookup never clips it.
 *
 * The arc is made HERE, not by smearing the sample. The offset from the star
 * is measured in a squashed space whose long axis follows the bend, so the
 * star is drawn as an ellipse stretched along the tangent. One sample, a
 * continuous arc. Multi-tapping the starfield instead needs a tap every pixel
 * or so to avoid drawing three separate dots, which is roughly twenty samples
 * per pixel at full stretch.
 */
vec3 starLayer(
  vec2 p, vec2 tangent, float stretch,
  float cell, float size, float seed, float gain, float density
) {
  vec2 g = p / cell + seed;
  float h = hash21(floor(g));
  if (h < density) return vec3(0.0);

  vec2 pos = vec2(fract(h * 71.3), fract(h * 197.1)) * 0.6 + 0.2;
  vec2 o = (fract(g) - pos) * cell;
  vec2 across = vec2(-tangent.y, tangent.x);
  vec2 elliptical = vec2(dot(o, tangent) / (1.0 + stretch), dot(o, across));

  float bright = 0.30 + 0.70 * fract(h * 43.7);
  float amount = gain * bright * (1.0 - smoothstep(0.0, size, length(elliptical)));

  // Colour TEMPERATURE per cell, not one tint for the whole sky. Cool
  // blue-white and warm cream, mixed by a second hash of the same cell so a
  // star's colour is stable and uncorrelated with its brightness. This is the
  // approved reference artifact's move, and it is what makes the field read as
  // stars rather than as grey noise.
  vec3 tint = mix(uStarCool, uStarWarm, fract(h * 21.7));
  return tint * amount;
}

/**
 * Two layers, and the gains are a CONTRAST decision as much as a visual one.
 * Capture's copy sits on this field with no surface under it, so the brightest
 * star IS its background wherever one lands behind a glyph.
 *
 * THESE GAINS ARE CURRENTLY OVER BUDGET AND IT IS A KNOWN, ACCEPTED STATE.
 * Since the starfield was re-tinted (D-019) the worst case is the headline at
 * 2.97:1 against a 3.0 floor and the 11px parked count at 1.43:1 against 4.5,
 * measured over nine viewports and four states. docs/BACKLOG.md B-001 carries
 * the numbers and every option with its cost. Do not quietly "fix" it here:
 * dimming the sky is one of five candidates and the choice is the owner's.
 *
 * Whatever changes, measure it the same way and SWEEP VIEWPORT SIZES. A single
 * viewport measures a single star placement, which is how a live failure sat
 * unnoticed from Phase 4 until 2026-09-22.
 */
vec3 sky(vec2 p, vec2 tangent, float stretch) {
  return starLayer(p, tangent, stretch, 31.0 * uScale, 1.5 * uScale, 0.0, 0.42, 0.52)
       + starLayer(p, tangent, stretch, 67.0 * uScale, 2.4 * uScale, 11.3, 0.64, 0.58);
}

/**
 * Everything behind the field, at an arbitrary screen position. Factored out
 * of main() so refraction (below) can sample it at an offset per colour
 * channel — that offset sampling IS the chromatic dispersion. Unchanged from
 * the original single-pass version when called at the pixel's own position.
 */
vec3 background(vec2 p) {
  vec2 q = p - uWell;

  // Signed distance to the field's own rounded rectangle, so the warp follows
  // the shape of the object rather than a circle imagined inside it.
  vec2 inner = max(uHalf - vec2(uRadius), vec2(0.0));
  vec2 qq = q - clamp(q, -inner, inner);
  float len = length(qq);
  float dist = max(len - uRadius, 0.0);
  vec2 dir = len > 0.001 ? qq / len : vec2(0.0, 1.0);
  vec2 tangent = vec2(-dir.y, dir.x);

  // Inverse-square falloff. g is the local strength of the well.
  float reach = uInfluence * 1.6;
  float g = uMass / (1.0 + (dist * dist) / (reach * reach));

  // Sample farther out than we are, so space reads as drawn inward, and swing
  // it around the well so the field near the object is turning rather than
  // only compressing. The stretch asymptotes rather than growing with mass:
  // past about 3.5 the ellipse outgrows its own cell and the star clips into a
  // hard edge instead of fading out.
  vec2 base = p + dir * (g * uInfluence * 0.50) + tangent * (g * uInfluence * 0.22);
  float stretch = 3.5 * g / (g + 1.0);

  vec3 acc = sky(base, tangent, stretch);

  // Space closest to the mass has been swept clear. This is a falloff in the
  // SURROUNDINGS, not a shadow attached to the field's edge: take it away and
  // the field is still unmistakably there, which is the test in docs/LOOK.md.
  //
  // A TIGHT collar, and the tightness is the point. The first tuning cleared
  // stars out to three quarters of the influence radius, which is precisely
  // the band where the stretch is strongest, so the two effects cancelled and
  // the still looked like a plain field on a plain ground. The sweep now ends
  // where the arcs begin.
  acc *= 1.0 - 0.82 * exp(-dist / (uInfluence * 0.28));

  vec3 col = uGround + acc;

  // A soft glow behind the field so refraction (below) has something worth
  // bending. Small and tight to the well on purpose: this is a token
  // (uBloomStrength), and raising it re-opens the same contrast measurement
  // the sky() gains above went through — see CLAUDE.md on star brightness as
  // a contrast constraint, not a taste knob.
  float nebula = exp(-(dist * dist) / (uInfluence * uInfluence * 1.1));
  col += uGlow * nebula * uBloomStrength;

  return col;
}

// ── the lens body (D-016) ───────────────────────────────────────────────────
// Signed distance to a rounded box, and the thickness profile built on it.
// Ported from the approved reference artifact. sdBox is a standard SDF, not
// tuned; prof()'s only job is to be finite-differenced into a surface normal
// below, so its absolute value outside the box does not need to mean anything.

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float lensProfile(vec2 q, float bev) {
  float d = sdBox(q, uHalf, uRadius);
  return 1.0 - clamp(-d / bev, 0.0, 1.0);
}

void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 q = p - uWell;

  vec3 col = background(p);

  float d = sdBox(q, uHalf, uRadius);
  // A 2px antialiased mask, true at the field's real edge (not the swept
  // collar above, which is a falloff in the surroundings and a different
  // thing).
  float inside = smoothstep(1.0, -1.0, d);

  if (inside > 0.001) {
    float bev = mix(10.0, 22.0, uThick);
    float e = 1.25;
    float hx = lensProfile(q + vec2(e, 0.0), bev) - lensProfile(q - vec2(e, 0.0), bev);
    float hy = lensProfile(q + vec2(0.0, e), bev) - lensProfile(q - vec2(0.0, e), bev);
    vec2 n2 = vec2(hx, hy) * 0.5;
    vec3 N = normalize(vec3(n2 * mix(7.0, 20.0, uThick), 1.0));

    // Refract: push the sample along the surface normal, per channel. The
    // per-channel offset difference IS the chromatic dispersion.
    float amt = mix(5.0, 18.0, uThick) * length(n2) * 20.0;
    vec2 dir2 = normalize(n2 + 1e-6);
    float k = uDispersion * 0.075;
    vec2 o = dir2 * amt;
    vec3 refr;
    refr.r = background(p - o * (1.0 + k)).r;
    refr.g = background(p - o).g;
    refr.b = background(p - o * (1.0 - k)).b;

    // Glass body: a touch of the ground mixed in so it reads as a lit solid,
    // never a hole cut in the scene.
    float core = smoothstep(0.0, -14.0, d);
    vec3 body = mix(refr * 0.94, refr * 0.5, core * 0.7);
    body += uGround * (0.10 + uThick * 0.10);

    // One fixed light, upper-left. docs/LOOK.md rule 2: one source, one
    // direction, everywhere — this is the only place this shader lights from.
    //
    // +y here is UP: this file inherits gl_FragCoord's native bottom-left
    // origin (see uWell's own conversion in draw() below), unlike the
    // approved reference artifact, which flipped to a top-left-origin uv
    // before doing any of this math. Its L was (-0.42, -0.72, 0.55) in that
    // flipped space; ported verbatim here it lit the BOTTOM-left instead,
    // caught rendering it and comparing against the reference screenshots.
    vec3 L = normalize(vec3(-0.42, 0.72, 0.55));
    float sp = pow(max(dot(N, L), 0.0), 20.0);
    body += vec3(1.0) * sp * uSpecular * (0.4 + uThick * 0.6);

    // The rim: the field's visible boundary now that its CSS border is gone
    // in glass mode (Field.tsx, prop glass). Carries the same WCAG-1.4.11
    // boundary duty the CSS rim token carried before.
    // It reads --tl-ink-faint and it is deliberately NOT tied to the star
    // colour, although one uniform served both until 2026-09-22. They are
    // different jobs: the stars are decoration whose brightness is capped by
    // the contrast of the copy in front of them, and this is a boundary a user
    // has to be able to see. Re-tinting the sky must never move this line.
    float rim = smoothstep(2.2, 0.0, abs(d));
    body += uRim * rim * uRimStrength * (0.5 + uThick * 0.7);

    col = mix(col, body, inside);
  }

  // The one light event in the application, and it lives at the handover.
  // uLight is 0 under reduced motion because the token is, so this line costs
  // nothing and fires nothing: a flash with no travel is a strobe.
  // Tight to the well. At 2.2 this lifted the whole screen, which reads as the
  // page flashing rather than as the object flaring, and a full-screen flash is
  // the thing reduced motion exists to prevent.
  //
  // distOut, not the signed d: this term is unchanged from before the lens
  // body existed, and it must stay 0 (full strength) everywhere inside the
  // field the way the old unsigned distance was, not decay with depth.
  float distOut = max(d, 0.0);
  float bloom = exp(-(distOut * distOut) / (uInfluence * uInfluence * 0.9));
  col += uGlow * bloom * uLight;

  // Dither, to kill banding in the ground gradient the bloom terms introduce.
  col += (hash21(p) - 0.5) * 0.006;

  gl_FragColor = vec4(col, 1.0);
}
`;

type Uniforms = Record<string, WebGLUniformLocation | null>;

interface Lens {
  gl: WebGLRenderingContext;
  u: Uniforms;
  ground: [number, number, number];
  starCool: [number, number, number];
  starWarm: [number, number, number];
  rim: [number, number, number];
  glow: [number, number, number];
  lightPeak: number;
  /** Tier 1 (D-016), all read once from tokens.json's "lens" group. */
  thicknessRest: number;
  thicknessCommitPeak: number;
  dispersion: number;
  specular: number;
  rimStrength: number;
  bloomStrength: number;
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
    console.warn("Lens shader failed to compile:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createLens(canvas: HTMLCanvasElement): Lens | null {
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
    console.warn("Lens program failed to link:", gl.getProgramInfoLog(program));
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
    "uWell", "uHalf", "uRadius", "uInfluence",
    "uMass", "uLight", "uScale", "uGround",
    "uStarCool", "uStarWarm", "uRim", "uGlow",
    "uThick", "uDispersion", "uSpecular", "uRimStrength", "uBloomStrength",
  ]) {
    u[name] = gl.getUniformLocation(program, name);
  }

  // Read once. The palette does not change at runtime: there is one ground.
  const [gr, gg, gb] = readColour("--tl-ground");
  const [cr, cg, cb] = readColour("--tl-star-cool");
  const [wr, wg, wb] = readColour("--tl-star-warm");
  const [rr, rg, rb] = readColour("--tl-ink-faint");
  const [lr, lg, lb] = readColour("--tl-mark-high");

  return {
    gl,
    u,
    ground: [gr, gg, gb],
    starCool: [cr, cg, cb],
    starWarm: [wr, wg, wb],
    rim: [rr, rg, rb],
    glow: [lr, lg, lb],
    lightPeak: readNumber("--tl-light-commit-peak", 0),
    thicknessRest: readNumber("--tl-lens-thickness-rest", 0.42),
    thicknessCommitPeak: readNumber("--tl-lens-thickness-commit-peak", 1),
    dispersion: readNumber("--tl-lens-dispersion", 0.35),
    specular: readNumber("--tl-lens-specular-strength", 0.5),
    rimStrength: readNumber("--tl-lens-rim-strength", 0.32),
    bloomStrength: readNumber("--tl-lens-bloom-strength", 0.09),
  };
}

export function GravityField({ well, focused, commitKey, onReady }: GravityFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lensRef = useRef<Lens | null>(null);
  const wellRef = useRef<Well | null>(well);
  const frameRef = useRef(0);
  // Latest callback, read from inside the context effect below without being
  // one of its dependencies — an inline arrow prop must not re-run WebGL
  // context creation on every render.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const arcRef = useRef({
    from: MASS_REST,
    to: MASS_REST,
    startedAt: 0,
    commitAt: 0,
  });

  const draw = useCallback((mass: number, light: number) => {
    const lens = lensRef.current;
    const canvas = canvasRef.current;
    const w = wellRef.current;
    if (!lens || !canvas || !w) return;

    const { gl, u } = lens;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    // getBoundingClientRect has its origin top-left; gl_FragCoord bottom-left.
    const centreX = (w.x + w.width / 2) * dpr;
    const centreY = height - (w.y + w.height / 2) * dpr;
    const halfW = (w.width / 2) * dpr;
    const halfH = (w.height / 2) * dpr;

    gl.uniform2f(u.uWell, centreX, centreY);
    gl.uniform2f(u.uHalf, halfW, halfH);
    gl.uniform1f(u.uRadius, Math.min(w.radius * dpr, Math.min(halfW, halfH)));
    // A bigger field is a heavier one: the reach comes from the object's size.
    // The geometric mean rather than the height alone, so a wide, shallow pill
    // reaches roughly as far as it is big rather than as far as it is thick.
    gl.uniform1f(u.uInfluence, Math.max(Math.sqrt(halfW * halfH), 1));
    gl.uniform1f(u.uMass, mass);
    gl.uniform1f(u.uLight, light);
    gl.uniform1f(u.uScale, dpr);
    gl.uniform3fv(u.uGround, lens.ground);
    gl.uniform3fv(u.uStarCool, lens.starCool);
    gl.uniform3fv(u.uStarWarm, lens.starWarm);
    gl.uniform3fv(u.uRim, lens.rim);
    gl.uniform3fv(u.uGlow, lens.glow);

    // Thickness rides the existing mass arc rather than a second timer, so
    // every invariant that arc already keeps (idle at rest, one pulse per
    // park, interrupt-safe) applies to the lens body for free.
    const t = Math.min(Math.max((mass - MASS_REST) / (MASS_PEAK - MASS_REST), 0), 1);
    const thickness = lens.thicknessRest + (lens.thicknessCommitPeak - lens.thicknessRest) * t;
    gl.uniform1f(u.uThick, thickness);
    gl.uniform1f(u.uDispersion, lens.dispersion);
    gl.uniform1f(u.uSpecular, lens.specular);
    gl.uniform1f(u.uRimStrength, lens.rimStrength);
    gl.uniform1f(u.uBloomStrength, lens.bloomStrength);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
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

    let mass = arc.to;
    if (arc.startedAt !== 0) {
      const t = (now - arc.startedAt) / springs.focus.durationMs;
      if (t >= 1) {
        arc.startedAt = 0;
      } else {
        mass = arc.from + (arc.to - arc.from) * sampleSpring(springs.focus, t);
        running = true;
      }
    }

    let light = 0;
    if (arc.commitAt !== 0) {
      const elapsed = now - arc.commitAt;
      if (elapsed > COMMIT_TOTAL_MS) {
        arc.commitAt = 0;
      } else {
        const e = envelope(elapsed);
        mass += MASS_COMMIT * e;
        light = (lensRef.current?.lightPeak ?? 0) * e;
        running = true;
      }
    }

    draw(mass, light);

    // The idle exit. Nothing is scheduled from here and nothing polls.
    frameRef.current = running ? requestAnimationFrame(tick) : 0;
  }, [draw]);

  const schedule = useCallback(() => {
    if (!lensRef.current) return;

    if (prefersReducedMotion()) {
      // No arc at all: the state changes, the screen does not travel. The
      // light peak token is already 0 in the reduced media query.
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
      const arc = arcRef.current;
      arc.startedAt = 0;
      arc.commitAt = 0;
      draw(arc.to, 0);
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
      lensRef.current = createLens(canvas!);
      if (lensRef.current) schedule();
      onReadyRef.current?.(lensRef.current !== null);
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
      lensRef.current = null;
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
      onReadyRef.current?.(false);
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
      lensRef.current = null;
    };
  }, [schedule]);

  // ── focus: it gains mass ─────────────────────────────────────────────────
  useEffect(() => {
    const arc = arcRef.current;
    const target = focused ? MASS_FOCUS : MASS_REST;
    if (arc.to === target) return;

    // Start from where the bend actually is, not from the last target, so an
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

  // ── commit: the well collapses inward and the thought falls in ───────────
  useEffect(() => {
    if (commitKey === 0) return;
    // Restarted, never queued. Two parks in under a second give one pulse from
    // the second park's moment, not two pulses back to back.
    arcRef.current.commitAt = performance.now();
    schedule();
  }, [commitKey, schedule]);

  // ── the well moved: resize, rotation, or the phone keyboard opening ──────
  useEffect(() => {
    wellRef.current = well;
    schedule();
  }, [well, schedule]);

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
       * the starfield rendered perfectly into a canvas nobody could see. The
       * content above it sets z-10 for the same reason.
       */
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
