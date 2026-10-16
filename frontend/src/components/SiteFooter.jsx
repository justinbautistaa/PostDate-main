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
import { Link } from "react-router-dom";

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
        .sitefooter.sitefooter {
          background: #fcf7f0;
          color: #756159;
          border-top: 1px solid #e8ded4;
          padding: 22px 24px;
          font: 12px/1.6 Arial, sans-serif;
        }
        .sitefooter-inner {
          width: 100%;
          max-width: 1136px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px 24px;
          flex-wrap: wrap;
        }
        .sitefooter .sitefooter-privacy { color: #756159; }
        .sitefooter .sitefooter-privacy:hover { color: #84364d; border-bottom-color: #84364d; }
        .sitefooter .sitefooter-privacy:focus-visible { outline: 2px solid #84364d; outline-offset: 4px; }
        .sitefooter-note { text-align: center; }
        @media (max-width: 560px) {
          .sitefooter-note { order: 1; flex-basis: 100%; text-align: left; }
        }
      `}</style>

      <div className="sitefooter-inner">
        <span className="sitefooter-copyright">© {new Date().getFullYear()} PostDate</span>
        {children && <div className="sitefooter-note">{children}</div>}
        <Link className="sitefooter-privacy" to="/privacy">Privacy</Link>
      </div>
    </footer>
  );
}
