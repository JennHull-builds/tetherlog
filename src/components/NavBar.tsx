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
      style={{ borderTopWidth: "var(--tl-border-width)" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`px-2 py-2 font-mono text-micro tracking-micro ${
              screen === item.id
                ? "bg-field font-medium text-ink"
                : "text-muted"
            }`}
            style={{
              borderRadius: "var(--tl-radius)",
              border:
                screen === item.id
                  ? "var(--tl-border-width) solid var(--tl-rule)"
                  : "var(--tl-border-width) solid transparent",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
