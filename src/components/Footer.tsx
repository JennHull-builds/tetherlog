import { useRef } from "react";
import { usePublishHeight } from "../lib/usePublishHeight";

const YEAR = 2026;
const SITE = "https://jenniferhull.co.za";
const SOURCE = "https://github.com/JennHull-builds/tetherlog";
const LICENCE = `${SOURCE}/blob/main/LICENSE`;
const KIT = "https://nil-ds.vercel.app";

function Dot() {
  return (
    <span className="tl-footer-dot" aria-hidden="true">
      ·
    </span>
  );
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      className="tl-footer-item tl-footer-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

/**
 * On every screen, last in the content column (D-042). Small, muted, mono. The four
 * parts sit in two groups that never break in the middle: on a narrow phone the
 * groups stack, so no line ends or starts with a separator; from 40rem they share
 * one line with a dot between them. Each link is at least 44px tall to press.
 *
 * It publishes its height as --footer-h, so Capture and Review subtract it and the
 * page still adds up to one screen.
 */
export function Footer() {
  const ref = useRef<HTMLElement>(null);
  usePublishHeight(ref, "--footer-h");

  return (
    <footer ref={ref} className="tl-footer no-print">
      <div className="tl-gutter mx-auto max-w-lg lg:mx-0 lg:max-w-6xl">
        <p className="tl-footer-row">
          <span className="tl-footer-group">
            <span className="tl-footer-item">
              © {YEAR}&nbsp;
              <a className="tl-footer-item tl-footer-link" href={SITE} target="_blank" rel="noopener noreferrer">
                Jennifer Hull
              </a>
            </span>
            <Dot />
            <ExternalLink href={LICENCE}>MIT licence</ExternalLink>
          </span>
          <span className="tl-footer-between">
            <Dot />
          </span>
          <span className="tl-footer-group">
            <ExternalLink href={SOURCE}>Source</ExternalLink>
            <Dot />
            <ExternalLink href={KIT}>Built on nil-ds</ExternalLink>
          </span>
        </p>
      </div>
    </footer>
  );
}
