/**
 * SiteFooter
 * The maroon band across the bottom of the landing page.
 *
 * The Figma just says "footer", so that word is the default. Pass children to
 * put real content in without touching the styling:
 *
 *   <SiteFooter>
 *     <a href="/privacy">Privacy</a>
 *     <a href="/terms">Terms</a>
 *   </SiteFooter>
 */
export default function SiteFooter({ children }) {
  return (
    <footer className="sitefooter">
      <style>{`
        .sitefooter {
          background: var(--pd-maroon);
          padding: clamp(18px, 3vw, 40px) var(--pd-gutter);  /* 🎛️ band height */

          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(16px, 3vw, 48px);
          flex-wrap: wrap;

          font-family: var(--pd-mono);
          font-size: clamp(12px, 1.1vw, 16px);
          color: var(--pd-cream);
        }

        /* the placeholder word, set in the display face like the mockup */
        .sitefooter-mark {
          font-family: var(--pd-display);
          font-size: clamp(22px, 3.4vw, 48px);   /* 🎛️ "footer" text size */
          line-height: 1;
        }

        .sitefooter a {
          color: var(--pd-cream);
          text-decoration: none;
          border-bottom: 1px solid transparent;
        }
        .sitefooter a:hover { border-bottom-color: var(--pd-cream); }
      `}</style>

      {children ?? <span className="sitefooter-mark">POSTDATE<a>™</a></span>}
    </footer>
  );
}
