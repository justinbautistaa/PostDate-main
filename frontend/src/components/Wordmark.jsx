/**
 * Wordmark
 * The "POSTDATE!" logo. Uses the exported Figma PNG so the letterforms are
 * pixel-identical on every page, even before Google Fonts finishes loading.
 *
 * Usage:
 *   <Wordmark />                     // links back to the landing page
 *   <Wordmark to={null} />           // plain image, no link (e.g. on the landing page itself)
 *   <Wordmark width="240px" />       // force a size
 */
import { Link } from "react-router-dom";
import logo from "../assets/Header.png";

export default function Wordmark({
  /* 🎛️ Logo size. The clamp means: never smaller than 160px, never bigger
     than 340px, and 20% of the viewport width in between.                  */
  width = "clamp(160px, 20vw, 340px)",
  to = "/",
  className = "",
}) {
  const img = (
    <img
      src={logo}
      alt="POSTDATE!"
      style={{ width, height: "auto", display: "block" }}
    />
  );

  /* 💡 Prefer live text over the PNG? Swap the line below for:
       <span style={{ fontFamily: "var(--pd-display)", fontWeight: 700,
                      color: "var(--pd-maroon)" }}>POSTDATE!</span>          */
  return to ? (
    <Link to={to} className={className} aria-label="POSTDATE! home">
      {img}
    </Link>
  ) : (
    <span className={className}>{img}</span>
  );
}
