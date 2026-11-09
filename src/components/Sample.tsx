import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Text } from "nil-ds";
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

/** Height of the banner strip. the banner publishes it as --sample-banner-h. */
const SAMPLE_BANNER_HEIGHT = "2.25rem";

/**
 * A slim strip on every screen while the sample is loaded, and for a few
 * seconds after it is cleared so "Sample cleared." has somewhere to be said.
 * Its height is always the same, so screens that fill the viewport subtract it
 * from the same variable.
 */
export function SampleBanner() {
  const { loaded, busy, notice, clear } = useSample();
  const visible = loaded || notice !== null;

  // Screens that fill the viewport subtract this, so the banner never pushes
  // them into a scroll. Set on the root so every screen reads the same value.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sample-banner-h", visible ? SAMPLE_BANNER_HEIGHT : "0px");
    return () => {
      root.style.removeProperty("--sample-banner-h");
    };
  }, [visible]);

  return (
    <div
      className="no-print"
      style={{
        height: visible ? SAMPLE_BANNER_HEIGHT : 0,
        overflow: "hidden",
        background: "var(--nil-color-surface)",
        borderBottom: visible
          ? "var(--nil-border-width) solid var(--nil-color-border)"
          : "none",
      }}
    >
      {visible && (
        <div
          className="mx-auto flex h-full max-w-lg items-center justify-between gap-3"
          style={{ paddingInline: "var(--nil-spacing-md)" }}
        >
          {/* The label doubles as the message: for a few seconds it says what
              just happened ("Sample week loaded."), then goes back to naming
              the mode. One line at every width, so the strip never grows. */}
          <p
            className={`nil-label min-w-0 truncate${loaded ? " nil-label--accent" : ""}`}
            aria-hidden
          >
            {notice ?? "Sample week"}
          </p>
          <p className="nil-sr-only" role="status" aria-live="polite">
            {notice ?? ""}
          </p>
          {loaded && (
            <Button
              variant="ghost"
              size="sm"
              icon="close"
              disabled={busy}
              onClick={() => void clear()}
            >
              Clear sample
            </Button>
          )}
        </div>
      )}
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
