/**
 * StepStamp
 * The "how it works" postage stamp on the landing page: perforated cream
 * paper, maroon bands top and bottom, three numbered steps on the left and
 * the decorative dot column on the right.
 *
 * Usage:
 *   <StepStamp />
 *   <StepStamp steps={[{ title: "Step 1:", text: "Sign up" }]} />
 */

/* 🎛️ EDIT THE STEP COPY HERE ----------------------------------------------
   Add or remove entries freely — the stamp grows to fit.                   */
const DEFAULT_STEPS = [
  { title: "Step 1:", text: "Create your profile" },
  { title: "Step 2:", text: "Get matched" },
  { title: "Step 3:", text: "Meet and POST!" },
];

/* 🎛️ EDIT THE DOT PATTERN HERE --------------------------------------------
   One array per row. "maroon" and "pink" are the only two values.
   A row with two entries draws two dots side by side.                      */
const DEFAULT_DOTS = [
  ["maroon", "pink"],
  ["maroon", "maroon"],
  ["maroon"],
  ["pink"],
  ["pink"],
  ["pink"],
  ["maroon"],
];

export default function StepStamp({ steps = DEFAULT_STEPS, dots = DEFAULT_DOTS }) {
  return (
    <div className="stepstamp">
      <style>{`
        .stepstamp {
          /* 🎛️ TUNE THE STAMP ----------------------------------------------
             --sst-width is the main dial; everything else scales off it.   */
          --sst-width: clamp(240px, 26vw, 400px);
          --sst-perf: 22px;    /* diameter of the perforation notches       */
          --sst-band: 18px;    /* height of the maroon bands top and bottom */

          width: var(--sst-width);
          max-width: 100%;
        }

        .stepstamp-paper {
          position: relative;
          background: var(--pd-cream);
          padding: var(--sst-band) 0;
        }

        /* The four perforation strips. Each is a row of pink circles sitting
           exactly on the paper's edge, so they bite semicircular notches out
           of it and leave cream bumps in between — a postage stamp edge. */
        .stepstamp-perf {
          position: absolute;
          pointer-events: none;
          background-image: radial-gradient(circle, var(--pd-pink) 47%, transparent 48%);
          background-size: var(--sst-perf) var(--sst-perf);
          background-repeat: round;
        }
        .stepstamp-perf-t, .stepstamp-perf-b { left: 0; right: 0; height: var(--sst-perf); }
        .stepstamp-perf-t { top: calc(var(--sst-perf) / -2); }
        .stepstamp-perf-b { bottom: calc(var(--sst-perf) / -2); }
        .stepstamp-perf-l, .stepstamp-perf-r { top: 0; bottom: 0; width: var(--sst-perf); }
        .stepstamp-perf-l { left: calc(var(--sst-perf) / -2); }
        .stepstamp-perf-r { right: calc(var(--sst-perf) / -2); }

        /* the solid maroon bands */
        .stepstamp-band {
          height: var(--sst-band);
          background: var(--pd-maroon);
          margin: 0 6%;
        }

        .stepstamp-inner {
          position: relative;
          margin: 10px 6%;
          padding: 16px 14px;
          border: 1px dashed var(--pd-maroon);  /* 🎛️ the dashed inner rule */

          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .stepstamp-steps {
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
          gap: 1.05em;              /* 🎛️ space between steps */
          font-family: var(--pd-display);
          font-size: clamp(11px, 1.15vw, 17px);   /* 🎛️ step text size */
          line-height: 1.32;
          color: var(--pd-ink);
        }
        .stepstamp-steps p { margin: 0; }

        .stepstamp-dots {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          gap: 0.42em;              /* 🎛️ vertical space between dot rows */
          padding-top: 0.15em;
        }
        .stepstamp-dot-row { display: flex; gap: 0.42em; }

        .stepstamp-dot {
          width: 1.08em;            /* 🎛️ dot size (scales with font-size) */
          height: 1.08em;
          border-radius: 50%;
          border: 1px solid rgba(43, 35, 32, 0.55);
          font-size: clamp(11px, 1.15vw, 17px);
        }
        .stepstamp-dot-maroon { background: var(--pd-maroon); }
        .stepstamp-dot-pink   { background: var(--pd-pink); }
      `}</style>

      <div className="stepstamp-paper">
        <span className="stepstamp-perf stepstamp-perf-t" aria-hidden="true" />
        <span className="stepstamp-perf stepstamp-perf-b" aria-hidden="true" />
        <span className="stepstamp-perf stepstamp-perf-l" aria-hidden="true" />
        <span className="stepstamp-perf stepstamp-perf-r" aria-hidden="true" />

        <div className="stepstamp-band" aria-hidden="true" />

        <div className="stepstamp-inner">
          <div className="stepstamp-steps">
            {steps.map(({ title, text }) => (
              <p key={title}>
                {title}
                <br />
                {text}
              </p>
            ))}
          </div>

          <div className="stepstamp-dots" aria-hidden="true">
            {dots.map((row, rowIndex) => (
              <span className="stepstamp-dot-row" key={rowIndex}>
                {row.map((tone, dotIndex) => (
                  <span
                    key={dotIndex}
                    className={`stepstamp-dot stepstamp-dot-${tone}`}
                  />
                ))}
              </span>
            ))}
          </div>
        </div>

        <div className="stepstamp-band" aria-hidden="true" />
      </div>
    </div>
  );
}
