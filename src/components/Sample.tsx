import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Text } from "nil-ds";
import { usePublishHeight } from "../lib/usePublishHeight";
import {
  clearSampleMonth,
  hasSampleData,
  hasSampleDeck,
  loadSampleDeck,
  loadSampleMonth,
} from "../lib/sample";

/**
 * The sample month's one shared state (D-036): is it loaded, is something
 * happening, and what to say about it. A context, so the banner and the three
 * empty-state buttons never disagree.
 *
 * FEEDBACK IS PART OF THE FEATURE. Loading and clearing both say what they did
 * ("Sample month loaded.", "Sample cleared."), for a few seconds, in a live
 * region. The words stay for a fixed time and nothing animates.
 */

const NOTICE_MS = 4000;

interface SampleState {
  /** Either sample is stored. The banner shows while this is true. */
  loaded: boolean;
  /** The sample month, and the sample deck (D-049), each on its own. */
  monthLoaded: boolean;
  deckLoaded: boolean;
  busy: boolean;
  notice: string | null;
  load: () => Promise<void>;
  loadDeck: () => Promise<void>;
  clear: () => Promise<void>;
}

const SampleContext = createContext<SampleState | null>(null);

export function SampleProvider({ children }: { children: ReactNode }) {
  const monthLoaded = useLiveQuery(hasSampleData, [], false);
  const deckLoaded = useLiveQuery(hasSampleDeck, [], false);
  const loaded = monthLoaded || deckLoaded;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const say = useCallback((message: string) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setNotice(message);
    timerRef.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  /** One path for all three actions: say what is happening, do it, say what happened. */
  const run = useCallback(
    async (doing: string, done: string, failed: string, action: () => Promise<void>) => {
      setBusy(true);
      setNotice(doing);
      try {
        await action();
        say(done);
      } catch (error) {
        console.warn("[tetherlog] sample action failed", error);
        say(failed);
      } finally {
        setBusy(false);
      }
    },
    [say],
  );

  const load = useCallback(
    () => run("Loading the sample month…", "Sample month loaded.", "The sample month did not load.", loadSampleMonth),
    [run],
  );
  const loadDeck = useCallback(
    () => run("Loading the sample deck…", "Sample deck loaded.", "The sample deck did not load.", loadSampleDeck),
    [run],
  );
  const clear = useCallback(
    () => run("Clearing the sample…", "Sample cleared.", "The sample did not clear.", clearSampleMonth),
    [run],
  );

  const value = useMemo(
    () => ({ loaded, monthLoaded, deckLoaded, busy, notice, load, loadDeck, clear }),
    [loaded, monthLoaded, deckLoaded, busy, notice, load, loadDeck, clear],
  );

  return <SampleContext.Provider value={value}>{children}</SampleContext.Provider>;
}

function useSample(): SampleState {
  const state = useContext(SampleContext);
  if (!state) throw new Error("Sample components need a SampleProvider.");
  return state;
}

/**
 * The demo banner (D-042): a full-width band in the kit's pale blue, on every
 * screen while the sample month is loaded, so nobody mistakes the sample for
 * their own captures. A "DEMO" label, one plain line and the Clear sample button.
 * It wraps cleanly at 320px, and it is a block in the page, never over the
 * content or the nav.
 *
 * Text is the kit's matching dark ink on that pale blue (12.89:1). The label is
 * white on the kit's accent blue (4.61:1).
 *
 * For a few seconds after the sample is cleared (or while it loads) the band
 * stays, carrying only the plain status line, so "Sample cleared." has somewhere
 * to be said. Its height is published as --sample-banner-h and follows the wrap,
 * so screens that fill the viewport subtract the real figure.
 */
export function SampleBanner() {
  const { loaded, monthLoaded, busy, notice, clear } = useSample();
  const visible = loaded || notice !== null;
  const ref = useRef<HTMLDivElement>(null);
  usePublishHeight(ref, "--sample-banner-h", visible);

  if (!visible) return null;

  return (
    <div ref={ref} className="tl-demo-banner no-print">
      <div className="tl-gutter tl-demo-banner__inner mx-auto max-w-lg lg:mx-0 lg:max-w-6xl">
        {loaded ? (
          <>
            <span className="tl-demo-banner__label">Demo</span>
            <p className="tl-demo-banner__text">
              {monthLoaded
                ? "This is filled with a sample month so you can see how it works. Clear it to start your own."
                : "This is a sample deck so you can see how it works. Clear it to start your own."}
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon="close"
              disabled={busy}
              onClick={() => void clear()}
            >
              Clear sample
            </Button>
          </>
        ) : (
          <p className="tl-demo-banner__text" aria-hidden>
            {notice}
          </p>
        )}
        <p className="nil-sr-only" role="status" aria-live="polite">
          {notice ?? ""}
        </p>
      </div>
    </div>
  );
}

/**
 * The empty-state offer. Each sample is offered only while it is not already
 * loaded. The deck is offered only where `withDeck` is set, which is Review,
 * because that is where a deck lives.
 */
export function SampleOffer({ withDeck = false }: { withDeck?: boolean }) {
  const { monthLoaded, deckLoaded, busy, load, loadDeck } = useSample();
  const offerDeck = withDeck && !deckLoaded;
  if (monthLoaded && !offerDeck) return null;

  return (
    <div className="flex flex-col items-start gap-4">
      {!monthLoaded && (
        <div className="flex flex-col items-start gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => void load()}>
            See a sample month
          </Button>
          <Text size="sm" muted>
            Adds example captures you can explore, then clear in one tap.
          </Text>
        </div>
      )}
      {offerDeck && (
        <div className="flex flex-col items-start gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => void loadDeck()}>
            See a sample deck
          </Button>
          <Text size="sm" muted>
            Adds example questions to answer one tap at a time, then clear in one tap.
          </Text>
        </div>
      )}
    </div>
  );
}
