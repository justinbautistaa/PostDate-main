import { useEffect, useRef, useState } from "react";
import ReportForm from "../ReportForm";
import ProfilePhoto from "../ProfilePhoto";

/**
 * ProfileModal
 * The card-detail overlay: cream shell, big photo panel, name, and a
 * like / pass pair of floating buttons.
 *
 * 🔍 CONFIDENCE NOTE: the Figma draws the pass button as a "+" glyph rotated
 * ~45°, which is a classic trick for faking an × out of a + (two strokes
 * crossing). I used a real × character instead of rotating a plus — same
 * result on screen, one less moving part. The three small stacked dots
 * (maroon / pink / ink) are a decorative flourish reused from elsewhere in
 * your file (the signup preview swatches) rather than anything functional,
 * so I carried that same treatment over here.
 *
 * Usage:
 *   {selected && (
 *     <ProfileModal profile={selected} onClose={...} onLike={...} onPass={...} />
 *   )}
 */
export default function ProfileModal({ profile, onClose, onLike, onPass }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  async function act(callback) {
    if (busy) return;
    setBusy(true); setError("");
    try { await callback?.(profile); }
    catch (err) { setError(err?.response?.data?.message || "Could not save your choice. Please try again."); }
    finally { setBusy(false); }
  }
  // Esc closes it, and background scroll is locked while it's open.
  useEffect(() => {
    function onKey(e) {
      // The report form owns its own keyboard handling while it is open.
      if (reportOpen) return;
      if (e.key === "Escape") { e.preventDefault(); onClose?.(); }
      if (e.key === "Tab") {
        const controls = Array.from(dialogRef.current?.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']") || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, reportOpen]);

  if (!profile) return null;
  const { name, age, distanceMi, gender, bio, photoUrl } = profile;

  return (
    <div
      className="pmodal-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <style>{`
        .pmodal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
          display: grid;
          place-items: center;
          padding: 24px;

          background: rgba(43, 35, 32, 0.45);
          backdrop-filter: blur(5px);   /* the blurred duplicate in the Figma */
        }

        .pmodal {
          position: relative;
          width: min(94vw, 480px);      /* 🎛️ modal width */

          background: var(--pd-cream);
          border-radius: 20px;
          padding: clamp(14px, 2vw, 22px);
          box-shadow: 0 30px 60px -24px rgba(43, 35, 32, 0.55);
        }

        .pmodal-close {
          position: absolute;
          top: 12px;
          right: 14px;
          background: none;
          border: none;
          font-size: 22px;
          line-height: 1;
          color: var(--pd-ink);
          opacity: 0.55;
          cursor: pointer;
        }
        .pmodal-close:hover { opacity: 1; }

        .pmodal-photo {
          position: relative;
          aspect-ratio: 533 / 597;      /* 🎛️ photo panel proportions from Figma */
          background: var(--pd-salmon);
          border-radius: 25px;
          box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }
        .pmodal-photo img {
          width: 100%; height: 100%; object-fit: cover;
        }

        /* the maroon / pink / ink decorative dot cluster, top-left of the photo */
        .pmodal-dots {
          position: absolute;
          top: 14px;
          left: 14px;
          display: flex;
        }
        .pmodal-dots span {
          width: clamp(22px, 4vw, 34px);
          height: clamp(22px, 4vw, 34px);
          border-radius: 50%;
          box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
          margin-left: -8px;
        }
        .pmodal-dots span:first-child { margin-left: 0; }
        .pmodal-dots .d1 { background: var(--pd-maroon); }
        .pmodal-dots .d2 { background: var(--pd-pink); }
        .pmodal-dots .d3 { background: var(--pd-ink); }

        .pmodal-actions {
          position: absolute;
          bottom: 16px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          gap: clamp(18px, 3vw, 30px);
        }

        .pmodal-btn {
          width: clamp(48px, 8vw, 64px);
          height: clamp(48px, 8vw, 64px);
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: grid;
          place-items: center;
          font-size: clamp(20px, 3vw, 28px);
          box-shadow: 0 6px 14px -6px rgba(43, 35, 32, 0.5);
          transition: transform 0.15s ease;
        }
        .pmodal-btn:hover { transform: translateY(-2px) scale(1.04); }

        .pmodal-btn-pass { background: var(--pd-cream); color: var(--pd-ink); }
        .pmodal-btn-like { background: var(--pd-maroon); color: var(--pd-cream); }

        .pmodal-body {
          padding: clamp(14px, 2vw, 22px) clamp(4px, 1vw, 10px) 4px;
        }

        .pmodal-name {
          margin: 0 0 4px;
          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(22px, 4vw, 34px);   /* 🎛️ name size in modal */
          color: var(--pd-ink);
        }

        .pmodal-sub {
          margin: 0 0 10px;
          font-family: var(--pd-mono);
          font-size: clamp(11px, 1.6vw, 15px);
          color: var(--pd-maroon);
        }

        .pmodal-bio {
          margin: 0;
          font-family: var(--pd-mono);
          font-size: clamp(11px, 1.6vw, 15px);
          line-height: 1.55;
          color: var(--pd-ink);
        }
      `}</style>

      <div ref={dialogRef} className="pmodal" role="dialog" aria-modal="true" aria-label={`${name}'s profile`}>
        <button type="button" className="pmodal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="pmodal-photo">
          <ProfilePhoto src={photoUrl} name={name} large fill />

          <span className="pmodal-dots" aria-hidden="true">
            <span className="d1" />
            <span className="d2" />
            <span className="d3" />
          </span>

          <div className="pmodal-actions">
            {/* 🔌 BACKEND: wire these to POST /api/discover/pass and
                POST /api/discover/like — see services/postdateApi.js */}
            <button
              type="button"
              className="pmodal-btn pmodal-btn-pass"
              disabled={busy}
              onClick={() => act(onPass)}
              aria-label={`Pass on ${name}`}
            >
              ✕
            </button>
            <button
              type="button"
              className="pmodal-btn pmodal-btn-like"
              disabled={busy}
              onClick={() => act(onLike)}
              aria-label={`Like ${name}`}
            >
              ♡
            </button>
          </div>
        </div>

        <div className="pmodal-body">
          <h2 className="pmodal-name">{name}, {age}</h2>
          <p className="pmodal-sub">{Number.isFinite(distanceMi) ? `${distanceMi} mi away · ` : ""}{gender}</p>
          {error && <p role="alert">{error}</p>}
          {bio && <p className="pmodal-bio">{bio}</p>}
          <button type="button" className="report-link" onClick={() => setReportOpen(true)}>Report this profile</button>
        </div>
      </div>
      {reportOpen && <ReportForm targetType="user" targetId={profile.id} name={name} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
