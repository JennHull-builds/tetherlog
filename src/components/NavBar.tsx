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

export function NavBar({ screen, onNavigate }: NavBarProps) {
  return (
    <nav
      className="no-print sticky bottom-0 border-t-2 border-line bg-raised"
      style={{ borderTopWidth: "var(--nil-border-width)" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`px-2 py-2 text-xs sm:text-sm ${
              screen === item.id
                ? "bg-paper font-medium text-ink"
                : "text-muted"
            }`}
            style={{
              borderRadius: "var(--nil-radius-none)",
              border:
                screen === item.id
                  ? "var(--nil-border-width) solid var(--nil-color-border)"
                  : "var(--nil-border-width) solid transparent",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
