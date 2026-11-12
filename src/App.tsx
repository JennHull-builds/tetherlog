import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Footer } from "./components/Footer";
import { NavBar } from "./components/NavBar";
import { SampleBanner, SampleProvider } from "./components/Sample";
import { TopBar } from "./components/Wordmark";
import { receiveDeck } from "./db";
import { readDeckLink } from "./lib/deck";
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

/** Said once, when a link carried cards TetherLog cannot read (D-047). */
const BAD_DECK_LINK =
  "That link did not carry cards TetherLog can read. Ask the agent to make it again.";

// The prefix is tested without its hash sign: the colour-literal checks read a hash and three letters as a hex colour.
const hasDeckHash = () => window.location.hash.slice(1).startsWith("deck=");

export default function App() {
  // A link with cards in it opens straight on Review, so Capture never flashes.
  const [screen, setScreenNow] = useState<Screen>(hasDeckHash() ? "review" : "capture");
  // While a link is being stored Review waits, so it never shows the wrong state.
  const [reading, setReading] = useState(hasDeckHash);
  const [deckNotice, setDeckNotice] = useState<string | null>(null);

  // The cards travel after the `#`, which a browser never sends to a server.
  // Read them, store them, then clear the address so a reload does not repeat it.
  useEffect(() => {
    async function takeDeckLink() {
      if (!hasDeckHash()) return;
      const hash = window.location.hash;
      history.replaceState(null, "", window.location.pathname + window.location.search);
      setReading(true);
      try {
        await receiveDeck(readDeckLink(hash));
        setDeckNotice(null);
      } catch (error) {
        console.warn("[tetherlog] a deck link could not be read:", error);
        setDeckNotice(BAD_DECK_LINK);
      }
      setScreenNow("review");
      setReading(false);
    }
    void takeDeckLink();
    window.addEventListener("hashchange", takeDeckLink);
    return () => window.removeEventListener("hashchange", takeDeckLink);
  }, []);

  function setScreen(next: Screen) {
    if (next === screen) return;
    if (next !== "review") setDeckNotice(null);
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
            {screen === "review" && !reading && <ReviewView notice={deckNotice} />}
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
