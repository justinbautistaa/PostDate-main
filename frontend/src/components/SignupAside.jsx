/**
 * SignupAside
 * The right-hand block next to the stamp card on each signup step: a short
 * "why we ask" blurb plus a static preview of what the resulting profile
 * card / profile page will look like.
 *
 * It is 938 Figma px wide: two cream panels (416 + 450) with a 72px gap.
 * Everything inside the panels is placed at the Figma's own coordinates, so
 * this is a picture of the design rather than a flowing layout. Sizes are
 * `calc(<Figma px> * var(--u))`, see pages/Signup.jsx.
 *
 * The copy differs per step, so pass `step` and it'll pick a sensible
 * default explanation — or override with your own via the `copy` prop.
 * 💡 Keep the copy to about two lines: the Figma leaves room for two, and a
 * third line just pushes the panels down a little.
 *
 * Usage:
 *   <SignupAside step={step} />
 *   <SignupAside copy="Custom explanation for this step..." />
 */

const DEFAULT_COPY = {
  1: "We ask for your name, birthdate, and a short bio so matches know who you are. Email and password keep your account yours.",
  2: "Real photos help people recognize you and build trust — profiles with clear photos get noticeably better responses.",
  3: "Your picks shape which matches you see first, and show up as tags on your profile so people know what you're into.",
};

export default function SignupAside({ step = 1, copy }) {
  const bodyText = copy ?? DEFAULT_COPY[step] ?? DEFAULT_COPY[1];

  return (
    <aside className="aside-wrapper">
      <style>{`
        .aside-wrapper, .aside-wrapper *, .aside-wrapper *::before, .aside-wrapper *::after {
          box-sizing: border-box;
        }

        .aside-wrapper {
          flex: none;
          width: calc(938 * var(--u));   /* 🎛️ 416 + 72 gap + 450 */
          font-family: var(--pd-mono);
        }

        /* Figma: "WHY WE ASK" — Fraunces 700 48px, white */
        .aside-heading {
          margin: 0;
          font-family: var(--pd-display);
          font-weight: 700;
          font-size: calc(48 * var(--u));   /* 🎛️ heading size */
          line-height: calc(59 * var(--u));
          text-transform: uppercase;
          color: var(--pd-white);
        }

        /* Figma: Space Mono 700 24px, ink, two lines */
        .aside-body {
          margin: calc(-3 * var(--u)) 0 0;
          width: calc(960 * var(--u));
          min-height: calc(72 * var(--u));
          font-weight: 700;
          font-size: calc(24 * var(--u));   /* 🎛️ blurb size */
          line-height: calc(36 * var(--u));
          color: var(--pd-ink);
        }

        /* Figma: Line 10 — 960 wide, 1px white */
        .aside-divider {
          width: calc(960 * var(--u));
          height: 1px;
          margin-top: calc(9 * var(--u));
          background: var(--pd-white);
        }

        /* Figma: "Preview" — Fraunces 700 32px, white */
        .aside-preview-label {
          display: block;
          margin-top: calc(14 * var(--u));
          font-family: var(--pd-display);
          font-weight: 700;
          font-size: calc(32 * var(--u));
          line-height: calc(39 * var(--u));
          color: var(--pd-white);
        }

        .aside-preview-row {
          display: flex;
          align-items: flex-start;
          gap: calc(72 * var(--u));
          margin-top: calc(17 * var(--u));
        }

        /* The two panels. Their contents are absolutely placed (Figma coords
           relative to the panel's top-left corner). */
        .aside-profile-card,
        .aside-profile-page {
          position: relative;
          flex: none;
          height: calc(500 * var(--u));
          background: var(--pd-cream);
        }
        .aside-profile-card { width: calc(416 * var(--u)); border-radius: calc(20 * var(--u)); }   /* Rectangle 58 */
        .aside-profile-page { width: calc(450 * var(--u)); border-radius: calc(10 * var(--u));     /* Rectangle 57 */
                              margin-top: var(--u); }

        /* Figma: "PROFILE CARD" / "PROFILE PAGE" — Space Mono 700 32px, ink */
        .aside-card-label {
          position: absolute;
          font-weight: 700;
          font-size: calc(32 * var(--u));   /* 🎛️ panel title size */
          line-height: calc(48 * var(--u));
          text-transform: uppercase;
          white-space: nowrap;
          color: var(--pd-ink);
        }

        /* profile card: salmon photo 350 x 385 + three colour dots */
        .aside-card-photo {
          position: absolute;
          left: calc(33 * var(--u));
          top: calc(19 * var(--u));
          width: calc(350 * var(--u));
          height: calc(385 * var(--u));
          background: var(--pd-salmon);
          border-radius: calc(25 * var(--u));
          box-shadow: 0 calc(4 * var(--u)) calc(4 * var(--u)) rgba(0, 0, 0, 0.25);
        }
        .aside-card-photo .aside-card-label { left: calc(54 * var(--u)); top: calc(19 * var(--u)); }

        .aside-swatch {
          position: absolute;
          top: calc(428 * var(--u));
          width: calc(50 * var(--u));
          height: calc(50 * var(--u));
          border-radius: 50%;
          box-shadow: 0 calc(4 * var(--u)) calc(4 * var(--u)) rgba(0, 0, 0, 0.25);
        }
        .aside-swatch-1 { left: calc(61 * var(--u));  background: var(--pd-ink); }
        .aside-swatch-2 { left: calc(183 * var(--u)); background: var(--pd-pink); }
        .aside-swatch-3 { left: calc(305 * var(--u)); background: var(--pd-maroon); }

        /* profile page: title, tan body 380 x 257, salmon avatar 180 across it */
        .aside-profile-page .aside-card-label { left: calc(23 * var(--u)); top: calc(10 * var(--u)); }

        .aside-page-body {
          position: absolute;
          left: calc(35 * var(--u));
          top: calc(219 * var(--u));
          width: calc(380 * var(--u));
          height: calc(257 * var(--u));
          background: var(--pd-tan);
          border-radius: calc(5 * var(--u));
        }
        .aside-avatar {
          position: absolute;
          left: calc(135 * var(--u));
          top: calc(86 * var(--u));
          width: calc(180 * var(--u));
          height: calc(180 * var(--u));
          border-radius: 50%;
          background: var(--pd-salmon);
        }
      `}</style>

      <h2 className="aside-heading">Why we ask</h2>
      <p className="aside-body">{bodyText}</p>

      <div className="aside-divider" />

      <span className="aside-preview-label">Preview</span>
      <div className="aside-preview-row">
        <div className="aside-profile-card">
          <div className="aside-card-photo">
            <span className="aside-card-label">Profile card</span>
          </div>
          <span className="aside-swatch aside-swatch-1" />
          <span className="aside-swatch aside-swatch-2" />
          <span className="aside-swatch aside-swatch-3" />
        </div>

        <div className="aside-profile-page">
          <span className="aside-card-label">Profile page</span>
          <div className="aside-page-body" />
          <div className="aside-avatar" />
        </div>
      </div>
    </aside>
  );
}
