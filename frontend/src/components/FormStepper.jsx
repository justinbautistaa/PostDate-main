/**
 * FormStepper
 * The 1 → 2 → 3 progress bar across the top of the signup page.
 *
 * It is ONE long bar: it fills whatever width its parent gives it (in
 * pages/Signup.jsx that is the full width of the stamp card + "Why we ask"
 * block below it). Step 1 keeps its natural width, steps 2 and 3 split the
 * rest of the row equally, and each arrow stretches to fill the room its step
 * has left. That is why the Figma's two arrows are different lengths
 * (485 / 424) — the arrow into the longer "YOUR TASTE" label gives up room.
 *
 * Sizes are written as `calc(<Figma px> * var(--u))`. --u ("one Figma pixel")
 * is set once in pages/Signup.jsx, so this file never needs touching to
 * rescale the page.
 *
 * Circle states (per step, based on currentStep):
 *   - upcoming (step number > currentStep): cream circle, ink number
 *   - active   (step number === currentStep): maroon circle, cream number
 *   - done     (step number < currentStep): ink circle, cream number
 *
 * Usage:
 *   <FormStepper currentStep={step} />
 */

const DEFAULT_STEPS = ["Who are you?", "Photos", "Your taste"];

export default function FormStepper({ steps = DEFAULT_STEPS, currentStep = 1, ...rest }) {
  return (
    <nav className="stepper-wrapper" aria-label="Signup progress" {...rest}>
      <style>{`
        .stepper-wrapper, .stepper-wrapper *, .stepper-wrapper *::before, .stepper-wrapper *::after {
          box-sizing: border-box;
        }

        .stepper-wrapper {
          width: 100%;
          font-family: var(--pd-mono);
        }

        .stepper-track {
          display: flex;
          align-items: center;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .stepper-item {
          display: flex;
          align-items: center;
          min-width: 0;
        }
        /* Step 1 = natural width. Every later step (arrow + circle + label)
           splits the leftover row width equally, which stretches the arrows. */
        .stepper-item:first-child { flex: none; }
        .stepper-item:not(:first-child) { flex: 1 1 0%; }

        /* Figma: Ellipse 68/69/70 = 80 x 80, number is Fraunces 700 36px */
        .stepper-circle {
          flex: none;
          width: calc(80 * var(--u));   /* 🎛️ circle diameter */
          height: calc(80 * var(--u));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--pd-display);
          font-weight: 700;
          font-size: calc(36 * var(--u));   /* 🎛️ number size */
          line-height: 1;
        }
        .stepper-item-upcoming .stepper-circle { background: var(--pd-cream); color: var(--pd-ink); }
        .stepper-item-active   .stepper-circle { background: var(--pd-maroon); color: var(--pd-cream); }
        .stepper-item-done     .stepper-circle { background: var(--pd-ink);    color: var(--pd-cream); }

        /* Figma: Space Mono 700 24px, ink */
        .stepper-label {
          margin-left: calc(25 * var(--u));
          font-weight: 700;
          font-size: calc(24 * var(--u));   /* 🎛️ step label size */
          line-height: calc(36 * var(--u));
          text-transform: uppercase;
          white-space: nowrap;
          color: var(--pd-ink);
        }

        /* Figma: Arrow 1 / Arrow 2 — 2px ink line with an open arrowhead */
        .stepper-arrow {
          position: relative;
          flex: 1 1 0;
          min-width: 0;
          height: calc(2 * var(--u));
          margin: 0 calc(20 * var(--u));
          background: var(--pd-ink);
        }
        .stepper-arrow::after {
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

      <ol className="stepper-track">
        {steps.map((label, i) => {
          const num = i + 1;
          const state = num < currentStep ? "done" : num === currentStep ? "active" : "upcoming";
          return (
            <li
              key={label}
              className={`stepper-item stepper-item-${state}`}
              aria-current={state === "active" ? "step" : undefined}
            >
              {/* the arrow leads every step except the first, so each step
                  carries its own incoming arrow and can share the row equally */}
              {i > 0 && <span className="stepper-arrow" aria-hidden="true" />}
              <span className="stepper-circle">{num}</span>
              <span className="stepper-label">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
