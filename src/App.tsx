import { useState } from "react";
import { NavBar } from "./components/NavBar";
import { SampleBanner, SampleProvider } from "./components/Sample";
import type { Screen } from "./types";
import { CaptureView } from "./views/CaptureView";
import { PatternsView } from "./views/PatternsView";
import { ReviewView } from "./views/ReviewView";
import { SettingsView } from "./views/SettingsView";

export default function App() {
  const [screen, setScreen] = useState<Screen>("capture");

  return (
    <SampleProvider>
      {/* Below 1024px: banner, screen, then the bottom bar. From 1024px up the
          same nav is a rail on the left and the rest is one column beside it
          (D-039). */}
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col">
          <SampleBanner />
          <main className="mx-auto w-full max-w-lg flex-1 lg:mx-0 lg:max-w-6xl">
            {screen === "capture" && (
              <CaptureView
                onParked={() => undefined}
                onOpenReview={() => setScreen("review")}
              />
            )}
            {screen === "review" && <ReviewView />}
            {screen === "patterns" && <PatternsView />}
            {screen === "settings" && <SettingsView />}
          </main>
        </div>
        <NavBar screen={screen} onNavigate={setScreen} />
      </div>
    </SampleProvider>
  );
}
