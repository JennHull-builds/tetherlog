import { useLayoutEffect, type RefObject } from "react";

/**
 * Publishes an element's height as a custom property on the page root, and keeps
 * it current as the element wraps or resizes. The screens that fill the viewport
 * subtract these (the banner, the footer), so the page adds up to exactly one
 * screen and never scrolls by the width of a wrapped line. When the element is
 * not there, the value is 0px.
 */
export function usePublishHeight(
  ref: RefObject<HTMLElement | null>,
  name: string,
  active = true,
) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!el || !active) {
      root.style.setProperty(name, "0px");
      return;
    }
    const publish = () => root.style.setProperty(name, `${el.getBoundingClientRect().height}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty(name, "0px");
    };
  }, [ref, name, active]);
}
