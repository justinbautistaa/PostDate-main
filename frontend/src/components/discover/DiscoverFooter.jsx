/**
 * DiscoverFooter
 * The dark (#1E1E1E) band at the bottom of the discover page.
 *
 * 🔍 LOW CONFIDENCE — READ BEFORE USING: this is the one piece of the whole
 * site I could not pin down. The Figma export shows a 1920×200 dark bar with
 * exactly one leftover text layer in it ("GENDER", 16px). 200px is tall for a
 * plain footer, so it might have been meant to hold more — a second filter
 * row, a promo strip, something else — but one stray label isn't enough
 * evidence to guess what. I shipped it as a simple dark footer so the page
 * doesn't end abruptly. If your Figma frame shows something else here, this
 * is the only file you need to change — everything above it doesn't care
 * what this component renders.
 *
 * Usage:
 *   <DiscoverFooter />
 */
export default function DiscoverFooter() {
  return (
    <footer className="dfooter">
      <style>{`
        .dfooter {
          background: var(--pd-ink-alt);
          padding: clamp(20px, 3.5vw, 44px) var(--pd-gutter);

          display: flex;
          align-items: center;
          justify-content: center;

          font-family: var(--pd-mono);
          font-size: clamp(11px, 1vw, 15px);
          letter-spacing: 0.04em;
          color: var(--pd-cream);
          opacity: 0.75;
          text-align: center;
        }
      `}</style>
      Keep scrolling to see more people near you.
    </footer>
  );
}
