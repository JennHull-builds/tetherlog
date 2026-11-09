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
import { clearSampleWeek, hasSampleData, loadSampleWeek } from "../lib/sample";

/**
 * The sample week's one shared state (D-036): is it loaded, is something
 * happening, and what to say about it. A context, so the banner and the three
 * empty-state buttons never disagree.
 *
 * FEEDBACK IS PART OF THE FEATURE. Loading and clearing both say what they did
 * ("Sample week loaded.", "Sample cleared."), for a few seconds, in a live
 * region. The words stay for a fixed time and nothing animates.
 */

const NOTICE_MS = 4000;

interface SampleState {
  loaded: boolean;
  busy: boolean;
  notice: string | null;
  load: () => Promise<void>;
  clear: () => Promise<void>;
}

const SampleContext = createContext<SampleState | null>(null);

export function SampleProvider({ children }: { children: ReactNode }) {
  const loaded = useLiveQuery(hasSampleData, [], false);
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

  const load = useCallback(async () => {
    setBusy(true);
    setNotice("Loading the sample week…");
    try {
      await loadSampleWeek();
      say("Sample week loaded.");
    } catch (error) {
      console.warn("[tetherlog] sample week failed to load", error);
      say("The sample week did not load.");
    } finally {
      setBusy(false);
    }
  }, [say]);

  const clear = useCallback(async () => {
    setBusy(true);
    setNotice("Clearing the sample…");
    try {
      await clearSampleWeek();
      say("Sample cleared.");
    } catch (error) {
      console.warn("[tetherlog] sample week failed to clear", error);
      say("The sample did not clear.");
    } finally {
      setBusy(false);
    }
  }, [say]);

  const value = useMemo(
    () => ({ loaded, busy, notice, load, clear }),
    [loaded, busy, notice, load, clear],
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
 * screen while the sample week is loaded, so nobody mistakes the sample for
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
  const { loaded, busy, notice, clear } = useSample();
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
              This is filled with a sample week so you can see how it works. Clear it to start
              your own.
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

/** The empty-state offer. Hidden while a sample is already loaded. */
export function SampleOffer() {
  const { loaded, busy, load } = useSample();
  if (loaded) return null;

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" disabled={busy} onClick={() => void load()}>
        See a sample week
      </Button>
      <Text size="sm" muted>
        Adds example captures you can explore, then clear in one tap.
      </Text>
    </div>
  );
}
