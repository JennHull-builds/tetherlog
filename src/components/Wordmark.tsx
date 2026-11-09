/**
 * The name, set in Doto at its heaviest weight: TETHER in the text colour, LOG in
 * the accent (D-042). It is text, so it stays sharp at any size and any zoom.
 *
 * The visible letters are hidden from assistive tech and one plain "TetherLog" is
 * read in their place, so the name is announced once and as a word rather than
 * spelled out in capitals.
 */
export function Wordmark({ size }: { size: "bar" | "rail" }) {
  return (
    <p className={`tl-wordmark tl-wordmark--${size}`}>
      <span aria-hidden="true">
        TETHER<span className="tl-wordmark__log">LOG</span>
      </span>
      <span className="nil-sr-only">TetherLog</span>
    </p>
  );
}

/**
 * The phone's top bar: the wordmark and nothing else, on every screen. From 1024px
 * the wordmark lives at the top of the side rail instead, so this bar leaves the
 * page. Its height is a fixed token-like value (--topbar-h in index.css), which is
 * what lets Capture hold its place to the pixel.
 */
export function TopBar() {
  return (
    <header className="tl-topbar no-print lg:hidden">
      <div className="tl-gutter mx-auto flex h-full max-w-lg items-center">
        <Wordmark size="bar" />
      </div>
    </header>
  );
}
