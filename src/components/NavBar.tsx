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
    <nav className="no-print sticky bottom-0 border-t border-line bg-raised/95 backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`rounded-xl px-2 py-2 text-xs sm:text-sm ${
              screen === item.id ? "bg-paper text-ink" : "text-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
