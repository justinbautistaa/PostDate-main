/**
 * StampCardShell
 * The shared "postage stamp" chrome used by every step of the signup flow:
 * perforated edge, dashed inner border, maroon header/footer bands, and the
 * bottom-right step counter + action button. Each step (WhoAreYouForm,
 * PhotosForm, YourTasteForm, ...) renders its own fields as children inside
 * this shell, so the chrome only has to be maintained in one place.
 *
 * 🎛️ IT IS A FIXED SQUARE. The stamp is exactly 636 x 634 Figma pixels on
 * every step (Figma: "sticky-bg"). Nothing here wraps or reflows — a step's
 * content has to fit inside it. Every size is `calc(<Figma px> * var(--u))`;
 * --u ("one Figma pixel") is set once in pages/Signup.jsx.
 *
 * Measurements, all straight from the Figma export (Figma px):
 *   stamp            636 x 634
 *   dashed border    582 x 582, inset 27 from the left/right and 26 top/bottom
 *   header band      582 x 65      footer band    582 x 70
 *   button           200 x 50, 9 from the right edge
 *   notches          16 per edge, radius 16, corner to corner
 *
 * Usage:
 *   <StampCardShell title="Photos" step={2} totalSteps={3}
 *     buttonLabel="Continue" onButtonClick={handleNext} error={errorMsg}>
 *     ...step-specific fields...
 *   </StampCardShell>
 */
export default function StampCardShell({
  title,
  step = 1,
  totalSteps = 3,
  buttonLabel = "Continue",
  onButtonClick,
  disabled = false,
  onBack,
  error,
  children,
}) {
  return (
    <div className="stamp-wrapper">
      <style>{`
        .stamp-wrapper, .stamp-wrapper *, .stamp-wrapper *::before, .stamp-wrapper *::after {
          box-sizing: border-box;
        }

        .stamp-wrapper {
          --stamp-w: calc(636 * var(--u));   /* 🎛️ stamp width  */
          --stamp-h: calc(634 * var(--u));   /* 🎛️ stamp height */
          --notch-r: calc(16 * var(--u));    /* 🎛️ size of the perforation holes */
          --pitch-x: calc(var(--stamp-w) / 15);   /* 16 holes = 15 gaps, corner to corner */
          --pitch-y: calc(var(--stamp-h) / 15);

          width: var(--stamp-w);
          height: var(--stamp-h);
          font-family: var(--pd-mono);
        }

        .stamp-card {
          position: relative;
          width: 100%;
          height: 100%;
          background: var(--pd-cream);
        }

        /* ── perforated edge ───────────────────────────────────────────────
           Each edge is a strip of pink circles centred on the stamp's edge,
           so they bite semicircular holes out of the cream. The strip is one
           pitch longer than the edge so the first and last circle land
           exactly on the corners, like the Figma. */
        .stamp-perf {
          position: absolute;
          pointer-events: none;
          background-image: radial-gradient(
            circle,
            var(--pd-pink) calc(var(--notch-r) - 0.5px),
            transparent var(--notch-r)
          );
        }
        .stamp-perf-top,
        .stamp-perf-bottom {
          left: calc(var(--pitch-x) / -2);
          width: calc(var(--stamp-w) + var(--pitch-x));
          height: calc(var(--notch-r) * 2);
          background-size: var(--pitch-x) calc(var(--notch-r) * 2);
          background-repeat: repeat-x;
        }
        .stamp-perf-top    { top:    calc(var(--u) - var(--notch-r)); }
        .stamp-perf-bottom { bottom: calc(var(--u) - var(--notch-r)); }

        .stamp-perf-left,
        .stamp-perf-right {
          top: calc(var(--pitch-y) / -2);
          width: calc(var(--notch-r) * 2);
          height: calc(var(--stamp-h) + var(--pitch-y));
          background-size: calc(var(--notch-r) * 2) var(--pitch-y);
          background-repeat: repeat-y;
        }
        .stamp-perf-left  { left:  calc(var(--u) - var(--notch-r)); }
        .stamp-perf-right { right: calc(var(--u) - var(--notch-r)); }

        /* ── inner panel: dashed border + header band + body + footer band ── */
        .stamp-inner {
          position: absolute;
          left: calc(27 * var(--u));
          top: calc(26 * var(--u));
          width: calc(582 * var(--u));
          height: calc(582 * var(--u));
          display: flex;
          flex-direction: column;
        }

        .stamp-border {
          position: absolute;
          inset: 0;
          border: calc(2 * var(--u)) dashed var(--pd-maroon);
          pointer-events: none;
        }

        /* Figma: denom-band 582 x 65, title is Fraunces 700 40px white */
        .stamp-header {
          flex: none;
          height: calc(65 * var(--u));
          padding-left: calc(16 * var(--u));
          display: flex;
          align-items: center;
          background: var(--pd-maroon);
        }
        .stamp-header h1 {
          margin: 0;
          font-family: var(--pd-display);
          font-weight: 700;
          font-size: calc(40 * var(--u));   /* 🎛️ header text size */
          line-height: 1;
          color: var(--pd-white);
          text-transform: uppercase;
          white-space: nowrap;
        }

        /* The middle of the stamp. Steps drop their fields in here. The bottom
           padding reserves the strip where the "1/3" counter is pinned, so a
           step's content can never run underneath it. */
        .stamp-body {
          position: relative;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          row-gap: calc(8 * var(--u));
          padding: calc(7 * var(--u)) calc(16 * var(--u)) calc(37 * var(--u)) calc(18 * var(--u));
        }

        /* Figma: "1/3" sits just above the footer band, right-aligned */
        .stamp-meta-row {
          position: absolute;
          left: calc(18 * var(--u));
          right: calc(16 * var(--u));
          bottom: calc(5 * var(--u));
          height: calc(32 * var(--u));
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: calc(12 * var(--u));
        }
        .stamp-error {
          font-size: calc(14 * var(--u));
          color: var(--pd-maroon);
        }
        .stamp-step {
          margin-left: auto;
          font-weight: 700;
          font-size: calc(24 * var(--u));
          line-height: calc(32 * var(--u));
          color: var(--pd-ink);
        }

        /* Figma: footer-band 582 x 70 */
        .stamp-footer {
          flex: none;
          height: calc(70 * var(--u));
          padding: calc(8 * var(--u)) calc(9 * var(--u)) 0 0;
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          background: var(--pd-maroon);
        }

        /* Figma: Rectangle 50 = 200 x 50, cream, radius 5; label is
           Space Mono 400 24px followed by a 51px arrow */
        .stamp-continue-btn {
          width: calc(200 * var(--u));
          height: calc(50 * var(--u));
          display: flex;
          align-items: center;
          gap: calc(2 * var(--u));
          padding: 0 calc(11 * var(--u)) 0 calc(17 * var(--u));
          background: var(--pd-cream);
          color: var(--pd-ink);
          border: none;
          border-radius: calc(5 * var(--u));
          font-family: var(--pd-mono);
          font-weight: 400;
          font-size: calc(24 * var(--u));   /* 🎛️ button text size */
          line-height: 1;
          text-transform: uppercase;
          white-space: nowrap;
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .stamp-continue-btn:hover { transform: translateX(2px); }
        .stamp-continue-btn:focus-visible {
          outline: 2px solid var(--pd-white);
          outline-offset: 3px;
        }

        .stamp-arrow {
          position: relative;
          flex: none;
          width: calc(51 * var(--u));
          height: calc(2 * var(--u));
          background: var(--pd-ink);
        }
        .stamp-arrow::after {
          content: "";
          position: absolute;
          right: calc(2 * var(--u));
          top: 50%;
          width: calc(10 * var(--u));
          height: calc(10 * var(--u));
          border-top: calc(2 * var(--u)) solid var(--pd-ink);
          border-right: calc(2 * var(--u)) solid var(--pd-ink);
          transform: translateY(-50%) rotate(45deg);
        }
      `}</style>

      <div className="stamp-card">
        <span className="stamp-perf stamp-perf-top" aria-hidden="true" />
        <span className="stamp-perf stamp-perf-bottom" aria-hidden="true" />
        <span className="stamp-perf stamp-perf-left" aria-hidden="true" />
        <span className="stamp-perf stamp-perf-right" aria-hidden="true" />

        <div className="stamp-inner">
          <span className="stamp-border" aria-hidden="true" />

          <header className="stamp-header">
            <h1>{title}</h1>
          </header>

          <div className="stamp-body">
            {children}

            <div className="stamp-meta-row">
              {error && <span className="stamp-error">{error}</span>}
              <span className="stamp-step">
                {step}/{totalSteps}
              </span>
            </div>
          </div>

          <footer className="stamp-footer">
            {onBack && <button type="button" className="stamp-back-btn" onClick={onBack} disabled={disabled}>Back</button>}
            <button type="button" className="stamp-continue-btn" onClick={onButtonClick} disabled={disabled}>
              {buttonLabel}
              <span className="stamp-arrow" aria-hidden="true" />
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
