/**
 * HeroBackdrop
 * Purely decorative layer for the landing page: the pale diagonal stripes in
 * the top-left corner, and the two maroon cloud banks that sweep across the
 * middle and bottom-right.
 *
 * Both are inline SVG (no image files), so they stay crisp at any size and
 * recolour instantly when you change --pd-maroon in theme.css.
 *
 * It sits behind everything (z-index: 0) and ignores the mouse, so content
 * on top stays clickable. The parent needs `position: relative`.
 *
 * Usage:
 *   <section style={{ position: "relative" }}>
 *     <HeroBackdrop />
 *     ...your content, each with position: relative and z-index: 1...
 *   </section>
 */
export default function HeroBackdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <style>{`
        .backdrop {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;   /* never blocks clicks on the content above */
          z-index: 0;
        }
        .backdrop svg { position: absolute; display: block; }

        /* 🎛️ STRIPES — the pale streaks in the top-left corner.
           Change the width value to make them cover more or less of the corner. */
        .backdrop-stripes {
          top: 0;
          left: 0;
          width: 45%;
        }

        /* 🎛️ TOP CLOUD — the bank that runs behind the phone card.
           the top value moves it up and down, width makes the puffs bigger.      */
        .backdrop-cloud-top {
          top: 18%;
          right: 0;
          width: 69%;
        }

        /* 🎛️ BOTTOM CLOUD — the bank rising into the bottom-right corner. */
        .backdrop-cloud-bottom {
          bottom: -3%;
          right: 0;
          width: 67%;
        }

        /* On narrow screens the clouds would swallow the text, so shrink
           them and push them further into the corner. */
        /* On a phone the columns stack, so the clouds have to grow (and slide
           off to the right) to stay behind the content instead of cutting
           through the middle of the stats text. */
        @media (max-width: 860px) {
          .backdrop-cloud-top { width: 110%; top: 22%; right: -12%; }
          .backdrop-cloud-bottom { width: 155%; right: -28%; bottom: -2%; }
          .backdrop-stripes { width: 70%; }
        }
      `}</style>

      {/* ── Diagonal stripes ────────────────────────────────────────────────
          Three parallelograms sliding down-left at 45°. The viewBox crops
          whatever runs off the left edge, so the ends stay clean.
          🎛️ Add a fourth stripe by copying a <polygon> and adding 79 to the
             two x values on the top edge.                                   */}
      <svg
        className="backdrop-stripes"
        viewBox="0 0 300 340"
        preserveAspectRatio="xMinYMin meet"
      >
        <g fill="rgba(255, 255, 255, 0.17)">
          <polygon points="67,0 103,0 -237,340 -273,340" />
          <polygon points="146,0 182,0 -158,340 -194,340" />
          <polygon points="227,0 263,0 -77,340 -113,340" />
        </g>
      </svg>

      {/* ── Top cloud ───────────────────────────────────────────────────────
          Built from overlapping circles (the scalloped edge) plus one polygon
          that fills the middle. Same fill colour, so the seams disappear.
          🎛️ To reshape: move a circle's cx/cy or change its r. Keep the
             polygon's points on top of the circle centres and it stays filled. */}
      <svg
        className="backdrop-cloud-top"
        viewBox="0 0 462 290"
        preserveAspectRatio="xMaxYMid meet"
      >
        <g fill="var(--pd-maroon, #B33951)">
          <polygon points="40,213 115,200 172,160 260,135 365,120 480,135 480,207 322,207 227,207 120,200" />
          {/* upper edge, left → right */}
          <circle cx="40" cy="213" r="32" />
          <circle cx="115" cy="200" r="62" />
          <circle cx="172" cy="160" r="84" />
          <circle cx="260" cy="135" r="108" />
          <circle cx="365" cy="120" r="112" />
          <circle cx="480" cy="135" r="128" />
          {/* lower scallops */}
          <circle cx="120" cy="200" r="72" />
          <circle cx="227" cy="207" r="72" />
          <circle cx="322" cy="207" r="72" />
        </g>
      </svg>

      {/* ── Bottom cloud ──────────────────────────────────────────────────── */}
      <svg
        className="backdrop-cloud-bottom"
        viewBox="0 0 447 280"
        preserveAspectRatio="xMaxYMax meet"
      >
        <g fill="var(--pd-maroon, #B33951)">
          <polygon points="40,282 110,258 170,213 260,150 375,115 447,60 447,280 40,280" />
          <circle cx="40" cy="282" r="40" />
          <circle cx="110" cy="258" r="70" />
          <circle cx="170" cy="213" r="65" />
          <circle cx="260" cy="150" r="88" />
          <circle cx="375" cy="115" r="110" />
          <circle cx="475" cy="35" r="115" />
        </g>
      </svg>
    </div>
  );
}
