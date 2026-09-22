import { useState } from "react";
import { NavBar } from "./components/NavBar";
import type { Screen } from "./types";
import { CaptureView } from "./views/CaptureView";
import { PatternsView } from "./views/PatternsView";
import { ReviewView } from "./views/ReviewView";
import { SettingsView } from "./views/SettingsView";

export default function App() {
  const [screen, setScreen] = useState<Screen>("capture");

  return (
    <div className="flex min-h-dvh flex-col bg-ground text-ink">
      <main className="mx-auto w-full max-w-lg flex-1">
        {screen === "capture" && (
          <CaptureView onParked={() => undefined} />
        )}
        {screen === "review" && <ReviewView />}
        {screen === "patterns" && <PatternsView />}
        {screen === "settings" && <SettingsView />}
      </main>
      <NavBar screen={screen} onNavigate={setScreen} />
    </div>
  );
}
