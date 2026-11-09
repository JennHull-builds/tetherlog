import { useLayoutEffect, useRef, type RefObject } from "react";
import { prefersReducedMotion, readDurationMs, readEasing } from "./motion";

/**
 * Glide items to their new places instead of snapping (D-040).
 *
 * The technique is called FLIP: measure where each item was, let the layout
 * change, measure where it is now, then animate the difference from old to
 * new. Items opt in with a `data-flip-key`. Positions come from the layout
 * (offset values), which a running animation does not disturb.
 *
 * Only the individual `translate` property and `width` are animated, on the
 * kit's slow duration and its ease-out curve. Under reduced motion nothing is
 * animated: the items are simply in their new places.
 *
 * `order` is any string that changes when the items' places can have changed.
 */
interface Box {
  centre: number;
  top: number;
  width: number;
}

export function useFlip(ref: RefObject<HTMLElement | null>, order: string) {
  const before = useRef(new Map<string, Box>());

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const after = new Map<string, Box>();
    const reduced = prefersReducedMotion();
    const duration = readDurationMs("--nil-motion-duration-slow", 360);
    const easing = readEasing("--nil-motion-easing-out-expo", "ease-out");

    for (const el of root.querySelectorAll<HTMLElement>("[data-flip-key]")) {
      const key = el.dataset.flipKey;
      if (!key) continue;
      const box: Box = {
        centre: el.offsetLeft + el.offsetWidth / 2,
        top: el.offsetTop,
        width: el.offsetWidth,
      };
      after.set(key, box);

      const was = before.current.get(key);
      if (!was || reduced || typeof el.animate !== "function") continue;
      const dx = was.centre - box.centre;
      const dy = was.top - box.top;
      const dw = was.width - box.width;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(dw) < 1) continue;

      el.animate(
        [
          { translate: `${dx}px ${dy}px`, width: `${was.width}px` },
          { translate: "0px 0px", width: `${box.width}px` },
        ],
        {
          duration,
          easing,
        },
      );
    }

    before.current = after;
  }, [ref, order]);
}
