import { useState } from "react";
import { flushSync } from "react-dom";
import { Footer } from "./components/Footer";
import { NavBar } from "./components/NavBar";
import { SampleBanner, SampleProvider } from "./components/Sample";
import { TopBar } from "./components/Wordmark";
import { prefersReducedMotion } from "./lib/motion";
import type { Screen } from "./types";
import { CaptureView } from "./views/CaptureView";
import { PatternsView } from "./views/PatternsView";
import { ReviewView } from "./views/ReviewView";
import { SettingsView } from "./views/SettingsView";

/**
 * Change screen. Where the browser has the View Transitions API the old screen
 * cross-fades into the new one and the selected nav button glides to its new
 * place (D-040, the rules are in index.css). Everywhere else, and under
 * reduced motion, the screen just changes. flushSync makes React commit the
 * new screen inside the transition's callback, which is when the browser takes
 * its "after" picture.
 */
type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

export default function App() {
  const [screen, setScreenNow] = useState<Screen>("capture");

  function setScreen(next: Screen) {
    if (next === screen) return;
    const doc = document as ViewTransitionDocument;
    if (!doc.startViewTransition || prefersReducedMotion()) {
      setScreenNow(next);
      return;
    }
    try {
      doc.startViewTransition(() => {
        flushSync(() => setScreenNow(next));
      });
    } catch {
      setScreenNow(next);
    }
  }

  return (
    <SampleProvider>
      {/* Below 1024px: the top bar with the name, the banner, the screen, the
          footer, then the bottom bar. From 1024px up the same nav is a rail on
          the left, carrying the name, and the rest is one column beside it
          (D-039, D-042). The rail comes first in the page and the bar last, so
          the keyboard reaches each where it is drawn; only one is ever shown. */}
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <NavBar part="rail" screen={screen} onNavigate={setScreen} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
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
          <Footer />
        </div>
        <NavBar part="bar" screen={screen} onNavigate={setScreen} />
      </div>
    </SampleProvider>
  );
}
