import { Link } from "react-router-dom";

/**
 * AuthPanel
 * The shell shared by the three log-in views (LOG-IN, RECOVERY, PASSWORD):
 * the pink 770 x 711 panel, the big Fraunces title, the white hairline under
 * it, the cream card, and the "Don't have an account? Register!" line at the
 * bottom. The form for the current view goes in as children.
 *
 * 🎛️ IT IS A FIXED-SIZE PICTURE OF THE FIGMA. Every element is placed at the
 * Figma's own coordinates (measured from the panel's top-left corner), and
 * every size is `calc(<Figma px> * var(--u))` — --u ("one Figma pixel") lives
 * in src/theme.css and is shared with the sign-up page.
 *
 * The pink of the panel is the same pink as the page, so on the log-in page
 * you see the title, the hairline and the cream card. Drop the panel on a
 * different background (e.g. inside a modal) and it shows up as a rounded
 * pink card, exactly like the Figma frame.
 *
 * Shared classes the forms use (all defined below):
 *   .auth-label      a big field label          .auth-input   a tan text box
 *   .auth-hint-row   the small maroon line      .auth-link    a text button
 *   .auth-pill       the cream pill button
 * The forms only add the position of each element, in their own <style>.
 *
 * Usage:
 *   <AuthPanel title="Log-in">
 *     <LoginForm ... />
 *   </AuthPanel>
 */
export default function AuthPanel({ title, children }) {
  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <style>{`
        .auth-panel, .auth-panel *, .auth-panel *::before, .auth-panel *::after {
          box-sizing: border-box;
        }

        /* Figma: Rectangle 245 / 283 / 288 — 770 x 711, #E8B4B8, radius 20 */
        .auth-panel {
          position: relative;
          width: calc(770 * var(--u));
          height: calc(711 * var(--u));
          background: var(--pd-pink);
          border-radius: calc(20 * var(--u));
          font-family: var(--pd-mono);
          color: var(--pd-ink);
        }

        /* Figma: Fraunces 700 128px, maroon, line-height 158 */
        .auth-title {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          margin: 0;
          font-family: var(--pd-display);
          font-weight: 700;
          font-size: calc(128 * var(--u));   /* 🎛️ title size */
          line-height: calc(158 * var(--u));
          text-align: center;
          text-transform: uppercase;
          white-space: nowrap;
          color: var(--pd-maroon);
        }

        /* Figma: Line 69 — 770 wide, 1px white, 154px down */
        .auth-rule {
          position: absolute;
          top: calc(154 * var(--u));
          left: 0;
          width: 100%;
          height: 1px;
          background: var(--pd-white);
        }

        /* Figma: Rectangle 246 — 720 x 505, cream, radius 25, at (25, 171) */
        .auth-card {
          position: absolute;
          top: calc(171 * var(--u));
          left: calc(25 * var(--u));
          width: calc(720 * var(--u));
          height: calc(505 * var(--u));
          background: var(--pd-cream);
          border-radius: calc(25 * var(--u));
        }

        /* ── shared form pieces ────────────────────────────────────────────── */

        /* Figma: Space Mono 700 40px, line-height 59, ink */
        .auth-label {
          position: absolute;
          left: calc(58 * var(--u));
          margin: 0;
          font-weight: 700;
          font-size: calc(40 * var(--u));   /* 🎛️ label size */
          line-height: calc(59 * var(--u));
          text-transform: uppercase;
          white-space: nowrap;
          color: var(--pd-ink);
        }

        /* Figma: Rectangle 247 etc. — 60 tall, tan, radius 5. The text typed
           in them isn't drawn in the Figma, so it is 32px bold. */
        .auth-input {
          position: absolute;
          height: calc(60 * var(--u));
          padding: 0 calc(16 * var(--u));
          background: var(--pd-tan);
          color: var(--pd-ink);
          border: calc(3 * var(--u)) solid transparent;
          border-radius: calc(5 * var(--u));
          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: calc(32 * var(--u));   /* 🎛️ typed text size */
        }
        .auth-input:focus-visible { outline: none; border-color: var(--pd-maroon); }
        .auth-input[aria-invalid="true"] { border-color: var(--pd-maroon); }

        /* Figma: FORGOT PASSWORD? / PASSWORDS MUST MATCH — Space Mono 700 16px,
           maroon. Messages (errors, notices) share this line. */
        .auth-hint-row {
          position: absolute;
          top: calc(487.9 * var(--u));
          left: calc(58 * var(--u));
          width: calc(500 * var(--u));
          height: calc(24 * var(--u));
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: calc(16 * var(--u));
          font-weight: 700;
          font-size: calc(16 * var(--u));   /* 🎛️ small text size */
          line-height: calc(24 * var(--u));
          text-transform: uppercase;
          color: var(--pd-maroon);
        }
        .auth-hint-text { margin: 0; text-align: right; }
        .auth-hint-row > .auth-hint-text:only-child { text-align: left; }
        .auth-hint-notice { color: var(--pd-ink); }

        .auth-link {
          padding: 0;
          background: none;
          border: none;
          font: inherit;
          text-transform: inherit;
          color: inherit;
          cursor: pointer;
        }
        .auth-link:hover:not(:disabled),
        .auth-link:focus-visible { text-decoration: underline; }
        .auth-link:disabled { opacity: 0.55; cursor: default; }

        /* Figma: Rectangle 249 — the cream pill. 336 x 65 inside a 6px maroon
           border = 348 x 77 outside, radius 30, soft drop shadow. The label is
           Space Mono 700 40px. */
        .auth-pill {
          position: absolute;
          left: calc(211 * var(--u));
          width: calc(348 * var(--u));
          height: calc(77 * var(--u));
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: calc(0.6 * var(--u));
          background: var(--pd-cream);
          color: var(--pd-ink);
          border: calc(6 * var(--u)) solid var(--pd-maroon);
          border-radius: calc(30 * var(--u));
          box-shadow: 0 calc(4 * var(--u)) calc(4 * var(--u)) rgba(0, 0, 0, 0.25);
          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: calc(40 * var(--u));   /* 🎛️ pill label size */
          line-height: calc(59 * var(--u));
          text-transform: uppercase;
          white-space: nowrap;
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .auth-pill:hover:not(:disabled) { transform: translateY(-2px); }
        .auth-pill:disabled { opacity: 0.6; cursor: default; }

        /* Figma: DON'T HAVE AN ACCOUNT? REGISTER! — 16px salmon, same spot in
           all three panels (baseline 647) */
        .auth-register {
          position: absolute;
          top: calc(628.9 * var(--u));
          left: 0;
          width: 100%;
          margin: 0;
          font-weight: 700;
          font-size: calc(16 * var(--u));
          line-height: calc(24 * var(--u));
          text-align: center;
          text-transform: uppercase;
          color: var(--pd-salmon);
        }
        .auth-register a { color: inherit; text-decoration: none; }
        .auth-register a:hover,
        .auth-register a:focus-visible { text-decoration: underline; }
      `}</style>

      <h1 className="auth-title" id="auth-title">
        {title}
      </h1>
      <span className="auth-rule" aria-hidden="true" />
      <span className="auth-card" aria-hidden="true" />

      {children}

      <p className="auth-register">
        Don’t have an account? <Link to="/signup">Register!</Link>
      </p>
    </section>
  );
}
