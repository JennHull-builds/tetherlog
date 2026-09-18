/**
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
  /** Position 0 -> 1, sampled every 10ms. The last point is exactly 1. */
  readonly points: readonly number[];
}

export const springs = {
  /** Is it listening? Zeta 1.000, ~230ms, no overshoot. Certainty, not personality. */
  focus: {
    durationMs: 230,
    points: [0, 0.0369, 0.1219, 0.2275, 0.3374, 0.4422, 0.5372, 0.6204, 0.6916, 0.7513, 0.8009, 0.8414, 0.8743, 0.9008, 0.922, 0.9389, 0.9523, 0.9628, 0.9711, 0.9776, 0.9826, 0.9866, 0.9897, 1],
  },
  /** Did it take it? Zeta 0.740, ~320ms, 3.2% overshoot. The ONLY token allowed to overshoot. Mass above 1 on purpose: a thought handed over should have weight. */
  commit: {
    durationMs: 320,
    points: [0, 0.0197, 0.0708, 0.143, 0.2281, 0.3195, 0.412, 0.5019, 0.5865, 0.6641, 0.7336, 0.7946, 0.8471, 0.8913, 0.9279, 0.9574, 0.9807, 0.9985, 1.0116, 1.0208, 1.0268, 1.0302, 1.0315, 1.0313, 1.03, 1.0279, 1.0254, 1.0225, 1.0196, 1.0167, 1.014, 1.0115, 1],
  },
  /** Can I go now? Zeta 1.004, ~270ms. Starts at +120ms so it overlaps commit; total arc 420ms. */
  settle: {
    durationMs: 270,
    points: [0, 0.0263, 0.0895, 0.172, 0.2623, 0.3528, 0.4392, 0.5187, 0.5904, 0.6537, 0.7089, 0.7565, 0.7972, 0.8318, 0.8609, 0.8853, 0.9057, 0.9226, 0.9366, 0.9482, 0.9578, 0.9656, 0.972, 0.9773, 0.9816, 0.9851, 0.9879, 1],
  },
  /** Leaving without ceremony: chip deselect, error clear, triage card exit. Zeta 1.010, ~200ms. */
  dismiss: {
    durationMs: 200,
    points: [0, 0.0477, 0.1527, 0.2773, 0.4009, 0.5135, 0.611, 0.6926, 0.7594, 0.8131, 0.8558, 0.8893, 0.9154, 0.9356, 0.9511, 0.963, 0.9721, 0.979, 0.9842, 0.9881, 1],
  },
} as const satisfies Record<string, SpringCurve>;

export type SpringName = keyof typeof springs;
