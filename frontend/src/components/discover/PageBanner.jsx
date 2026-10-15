/**
 * PageBanner
 * The page title above the search/filter toolbar (the Figma's "HOME"
 * heading). It's plain bold white text straight on the pink page
 * background — there's no card/pill behind it. (An earlier version of this
 * component wrapped it in a maroon rounded box, which doesn't match the
 * Figma: the only maroon rounded box on this row lives behind the search
 * bar, not the title — see DiscoverToolbar.)
 *
 * Usage:
 *   <PageBanner>Home</PageBanner>
 */
export default function PageBanner({ children }) {
  return (
    <h1 className="pbanner">
      <style>{`
        .pbanner {
          margin: 0;
          flex: none;

          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(6px, 4.6vw, 40px);   /* 🎛️ heading text size */
          line-height: 1.15;
          text-transform: uppercase;
          color: var(--pd-white);
        }
      `}</style>
      {children}
    </h1>
  );
}
