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
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1">
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
