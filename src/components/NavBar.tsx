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

/** Four kit Buttons, each an icon beside its word: the current screen is the secondary variant and carries
 *  aria-current, the others are ghost, and the current one reads in the kit's accent text
 *  colour (D-034). D-031. */
export function NavBar({ screen, onNavigate }: NavBarProps) {
  return (
    <nav
      aria-label="Screens"
      className="no-print sticky bottom-0"
      style={{
        background: "var(--nil-color-bg)",
        borderTop: "var(--nil-border-width) solid var(--nil-color-border)",
      }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {NAV.map((item) => (
          <Button
            key={item.id}
            size="sm"
            icon={item.icon}
            variant={screen === item.id ? "secondary" : "ghost"}
            aria-current={screen === item.id ? "page" : undefined}
            // Blue marks where you are (D-034). Accent text on the kit's own
            // secondary frame, so Park stays the only filled blue.
            style={screen === item.id ? { color: "var(--nil-color-text-accent)" } : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </nav>
  );
}
