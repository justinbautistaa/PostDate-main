import { useEffect, useState } from "react";
import StampCardShell from "./StampCardShell";
import { getTasteOptions } from "../services/postdateApi";
import { Link } from "react-router-dom";

/**
 * YourTasteForm
 * Step 3 of the signup flow: pick between min and max personality chips.
 * The chip list and the min/max come from GET /api/tags (getTasteOptions)
 * rather than being hard-coded here, so sign-up can never accept a
 * selection the profile page's "Your taste" tab would later reject — see
 * backend/utils/tasteOptions.js, the one place both sides read from.
 *
 * 🎛️ The stamp card is a fixed size (see StampCardShell), and the chip list
 * is now 20 long, so the grid scrolls inside the card rather than pushing
 * the footer/button off the bottom.
 *
 * Usage:
 *   <YourTasteForm onConfirm={(tags) => console.log(tags)} />
 *   <YourTasteForm step={3} totalSteps={3} onConfirm={handleFinish} />
 */

// 🎛️ Used only for the brief moment before GET /api/tags resolves, so the
// "select N–N" label doesn't flash a wrong number.
const FALLBACK_LIMITS = { minPersonality: 3, maxPersonality: 5 };

export default function YourTasteForm({
  step = 3,
  totalSteps = 3,
  onConfirm,
  buttonLabel,
  disabled = false,
  onBack,
}) {
  const [options, setOptions] = useState(null); // string[] once loaded
  const [limits, setLimits] = useState(FALLBACK_LIMITS);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState([]);
  const [touched, setTouched] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTasteOptions()
      .then((data) => {
        if (cancelled) return;
        setOptions(data.personality);
        setLimits(data.limits);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const { minPersonality: minSelected, maxPersonality: maxSelected } = limits;
  const isValid = selected.length >= minSelected;

  const toggle = (tag) => {
    setSelected((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= maxSelected) return prev; // the count line below explains the cap
      return [...prev, tag];
    });
  };

  const handleConfirm = () => {
    setTouched(true);
    if (!isValid || !privacyConsent) return;
    onConfirm?.(selected);
  };

  const errorText = loadError
    ? "Could not load the taste options. Refresh the page to try again."
    : touched && !isValid
    ? `Pick at least ${minSelected} to continue.`
    : null;

  return (
    <StampCardShell
      title="Your taste"
      step={step}
      totalSteps={totalSteps}
      buttonLabel={buttonLabel ?? "Confirm!"}
      onButtonClick={handleConfirm}
      disabled={disabled}
      onBack={onBack}
      error={errorText}
    >
      <style>{`
        .taste-field-group {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: calc(8 * var(--u));
        }
        .taste-field-label {
          flex: none;
          font-weight: 700;
          font-size: calc(24 * var(--u));
          line-height: calc(36 * var(--u));
          text-transform: uppercase;
          color: var(--pd-ink);
        }

        .taste-grid {
          flex: 1;
          min-height: 0;
          overflow-y: auto;   /* 🎛️ 20 chips won't all fit at once — this scrolls instead of blowing out the fixed stamp */
          display: flex;
          flex-wrap: wrap;
          align-content: flex-start;
          gap: calc(10 * var(--u));
          padding-right: calc(4 * var(--u));   /* keeps the last column clear of the scrollbar */
        }
        .taste-chip {
          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: calc(15 * var(--u));
          line-height: 1;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--pd-ink);
          background: var(--pd-tan);
          border: calc(2 * var(--u)) solid transparent;
          border-radius: calc(5 * var(--u));
          padding: calc(13 * var(--u)) calc(16 * var(--u));
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .taste-chip:hover { background: #E7D6C8; }
        .taste-chip:focus-visible {
          outline: 2px solid var(--pd-maroon);
          outline-offset: 2px;
        }
        .taste-chip-active {
          background: var(--pd-maroon);
          color: var(--pd-cream);
        }
        .taste-chip:disabled { opacity: 0.4; cursor: default; }

        .taste-count {
          flex: none;
          font-size: calc(14 * var(--u));
          letter-spacing: 0.02em;
          color: var(--pd-ink);
          opacity: 0.6;
        }
      `}</style>

      <div className="taste-field-group">
        <span className="taste-field-label">
          Select {minSelected}–{maxSelected}
        </span>

        {!options && !loadError && <span className="taste-count">Loading…</span>}

        {options && (
          <div className="taste-grid" role="group" aria-label="Your taste">
            {options.map((tag) => {
              const active = selected.includes(tag);
              const atCap = !active && selected.length >= maxSelected;
              return (
                <button
                  type="button"
                  key={tag}
                  className={`taste-chip ${active ? "taste-chip-active" : ""}`}
                  aria-pressed={active}
                  disabled={atCap}
                  onClick={() => toggle(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        <span className="taste-count">
          {selected.length} selected (min {minSelected}, max {maxSelected})
        </span>
        <label className="signup-consent"><input type="checkbox" checked={privacyConsent} onChange={event => setPrivacyConsent(event.target.checked)} /> <span>I have read the <Link to="/privacy" target="_blank" rel="noreferrer">privacy notice</Link> and understand how PostDate uses my information to provide profiles, matching and moderation.</span></label>
        {touched && !privacyConsent && <p role="alert">Read and acknowledge the privacy notice to continue.</p>}
      </div>
    </StampCardShell>
  );
}
