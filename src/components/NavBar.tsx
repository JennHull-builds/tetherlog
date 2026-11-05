import { Button } from "nil-ds";
import type { Screen } from "../types";

const NAV: { id: Screen; label: string }[] = [
  { id: "capture", label: "Capture" },
  { id: "review", label: "Review" },
  { id: "patterns", label: "Patterns" },
  { id: "settings", label: "Settings" },
];

interface NavBarProps {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}

/** Four kit Buttons: the current screen is the secondary variant and carries
 *  aria-current, the others are ghost. D-031. */
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
            variant={screen === item.id ? "secondary" : "ghost"}
            aria-current={screen === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </nav>
  );
}
