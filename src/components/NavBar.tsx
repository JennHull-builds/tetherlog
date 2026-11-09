import { Button } from "nil-ds";
import type { IconName } from "nil-ds";
import type { Screen } from "../types";

const NAV: { id: Screen; label: string; icon: IconName }[] = [
  { id: "capture", label: "Capture", icon: "capture" },
  { id: "review", label: "Review", icon: "review" },
  { id: "patterns", label: "Patterns", icon: "patterns" },
  { id: "settings", label: "Settings", icon: "settings" },
];

interface NavBarProps {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}

/**
 * Four kit Buttons, each an icon beside its word: the current screen is the secondary variant and carries
 * aria-current, the others are ghost, and the current one reads in the kit's accent text
 * colour (D-034). D-031.
 *
 * Below 1024px it is the bottom bar. From 1024px up it is a side rail on the left (D-039): the same
 * buttons stacked, full height, stuck to the top of the viewport. The kit's Sidebar was read and not
 * used: it renders anchors with an href and a word each (no icon), under a section heading and a
 * collapse toggle, and this nav switches a screen in state rather than navigating. Two navs would be
 * two landmarks with one name, so exactly one is displayed at a time and the other leaves the page.
 */
export function NavBar({ screen, onNavigate }: NavBarProps) {
  function buttons(size: "sm" | "md") {
    return NAV.map((item) => (
      <Button
        key={item.id}
        size={size}
        icon={item.icon}
        variant={screen === item.id ? "secondary" : "ghost"}
        aria-current={screen === item.id ? "page" : undefined}
        // Blue marks where you are (D-034). Accent text on the kit's own
        // secondary frame, so Park stays the only filled blue.
        style={screen === item.id ? { color: "var(--nil-color-text-accent)" } : undefined}
        className={size === "md" ? "w-full justify-start" : undefined}
        onClick={() => onNavigate(item.id)}
      >
        {item.label}
      </Button>
    ));
  }

  return (
    <>
      <nav
        aria-label="Screens"
        className="no-print sticky bottom-0 lg:hidden"
        style={{
          background: "var(--nil-color-bg)",
          borderTop: "var(--nil-border-width) solid var(--nil-color-border)",
        }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {buttons("sm")}
        </div>
      </nav>

      <nav
        aria-label="Screens"
        className="no-print sticky top-0 hidden h-dvh w-56 lg:order-first shrink-0 flex-col gap-3 self-start lg:flex"
        style={{
          background: "var(--nil-color-surface)",
          borderRight: "var(--nil-border-width) solid var(--nil-color-border)",
          padding: "var(--nil-spacing-lg) var(--nil-spacing-md)",
        }}
      >
        {buttons("md")}
      </nav>
    </>
  );
}
