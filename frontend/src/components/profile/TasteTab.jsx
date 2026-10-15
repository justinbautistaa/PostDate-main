import { useEffect, useState } from "react";
import { getTasteOptions, saveProfileTags, saveLookingFor } from "../../services/postdateApi";

/**
 * TasteTab — the "Your taste" panel, now two independent sections:
 *   "Your personality"  — who you are, capped at 5, saved via saveProfileTags
 *   "Looking for"        — what you want from dating, capped at 5, saved via
 *                          saveLookingFor
 *
 * Each section has its own EDIT / ✔ pair, so changing one never touches or
 * re-saves the other. With 20 chips a side the panel can run long, so the
 * whole tab scrolls internally (same pattern as ReviewsTab's `.reviews`)
 * rather than growing the page to fit every chip.
 *
 * The chip lists and pick limits come from GET /api/tags (getTasteOptions)
 * rather than being hard-coded here, so this can never drift from what the
 * server actually accepts — see backend/utils/tasteOptions.js.
 *
 * Usage:
 *   <TasteTab
 *     tags={profile.tags}                 // selected personality labels
 *     lookingFor={profile.lookingFor}      // selected looking-for labels
 *     onTagsSaved={(tags) => ...}          // keep the parent's cache in step
 *     onLookingForSaved={(lookingFor) => ...}
 *   />
 */

// 🎛️ Fallback limits used only while GET /api/tags is still loading, so the
// UI doesn't briefly allow an unlimited pick before the real limits arrive.
const FALLBACK_LIMITS = { minPersonality: 3, maxPersonality: 5, maxLookingFor: 5 };

function buildChips(allLabels = [], selectedLabels = []) {
  const selected = new Set(selectedLabels);
  return allLabels.map((label) => ({ label, selected: selected.has(label) }));
}

function TasteSection({ title, allOptions, selectedLabels, minSelected = 0, maxSelected, onSave, emptyHint }) {
  const [chips, setChips] = useState(() => buildChips(allOptions, selectedLabels));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // keep in step when the parent finishes loading, or after a save round-trips
  useEffect(() => setChips(buildChips(allOptions, selectedLabels)), [allOptions, selectedLabels]);

  function toggle(label) {
    if (saving) return;
    setEditing(true);
    setChips((prev) => {
      const pickedCount = prev.filter((c) => c.selected).length;
      const isPicking = !prev.find((c) => c.label === label)?.selected;
      if (isPicking && pickedCount >= maxSelected) {
        setMessage(`You can pick up to ${maxSelected}`);
        return prev;
      }
      setMessage("");
      return prev.map((c) => (c.label === label ? { ...c, selected: !c.selected } : c));
    });
  }

  async function handleSave() {
    const picked = chips.filter((c) => c.selected).map((c) => c.label);
    if (picked.length < minSelected) {
      setMessage(`Pick at least ${minSelected}`);
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await onSave(picked);
      setEditing(false);
      setMessage("Saved");
    } catch {
      setMessage("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="taste-section">
      <h3 className="taste-section-title">{title}</h3>
      <p className="taste-help">Choose up to {maxSelected} options, then save your changes.</p>

      <div className="taste-chips">
        {chips.length === 0 && <p className="taste-note">{emptyHint}</p>}

        {chips.map((chip) =>
          (
            <button
              key={chip.label}
              type="button"
              aria-pressed={chip.selected}
              disabled={saving}
              onClick={() => toggle(chip.label)}
              className={`taste-chip taste-chip-editable${chip.selected ? " taste-chip-on" : ""}`}
            >
              {chip.label}
            </button>
          )
        )}
      </div>

      <div className="taste-actions">
        {message && <span className="taste-note" role="status">{message}</span>}

        <button
          type="button"
          className="taste-btn taste-btn-save"
          onClick={handleSave}
          disabled={!editing || saving}
          title={editing ? "Save" : "Choose options to make changes"}
        >
          {saving ? "Saving…" : "Save"}
          <span className="visually-hidden">Save {title}</span>
        </button>

        <button type="button" className="taste-btn" disabled={saving} onClick={() => {
          setChips(buildChips(allOptions, selectedLabels));
          setMessage("");
          setEditing((v) => !v);
        }}>
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
    </section>
  );
}

export default function TasteTab({ tags = [], lookingFor = [], onTagsSaved, onLookingForSaved }) {
  const [options, setOptions] = useState(null); // { personality, lookingFor, limits }
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTasteOptions()
      .then((data) => !cancelled && setOptions(data))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const limits = options?.limits ?? FALLBACK_LIMITS;

  return (
    <div className="taste">
      <style>{`
        .taste {
          height: 100%;
          overflow-y: auto;

          display: flex;
          flex-direction: column;
          gap: clamp(20px, 3vw, 36px);
        }

        .taste-section:not(:first-child) {
          padding-top: clamp(16px, 2.4vw, 28px);
          border-top: 1px solid rgba(43, 35, 32, 0.16);
        }
        .taste-section { flex-shrink: 0; }
        .taste-help { margin: -4px 0 16px; font: 13px/1.6 Arial,sans-serif; color: #806b62; }

        .taste-section-title {
          margin: 0 0 clamp(10px, 1.4vw, 18px);
          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(13px, 1.3vw, 22px);   /* 🎛️ section heading size */
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--pd-maroon);
        }

        .taste-chips {
          display: flex;
          flex-wrap: wrap;
          gap: clamp(8px, 1.1vw, 18px);   /* 🎛️ space between chips */
          align-content: flex-start;
        }

        .taste-chip {
          background: var(--pd-tan);
          border: 4px solid transparent;   /* transparent keeps the size stable */
          border-radius: 5px;
          padding: clamp(9px, 1.2vw, 20px) clamp(12px, 1.6vw, 26px);  /* 🎛️ chip size */

          font-family: var(--pd-mono);
          font-size: clamp(10px, 1vw, 17px);   /* 🎛️ chip text size */
          letter-spacing: 0.03em;
          color: var(--pd-ink);
          text-align: left;
        }
        /* a picked chip gets the maroon outline from the mockup */
        .taste-chip-on { border-color: var(--pd-maroon); }

        .taste-chip-editable { cursor: pointer; }
        .taste-chip-editable:hover { border-color: rgba(179, 57, 81, 0.45); }

        .taste-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: clamp(8px, 1.1vw, 18px);
          margin-top: clamp(10px, 1.4vw, 18px);
        }

        .taste-note {
          margin-right: auto;
          font-family: var(--pd-mono);
          font-size: clamp(10px, 0.9vw, 14px);
          color: var(--pd-ink);
          opacity: 0.75;
        }

        /* the two pill buttons: green ✔ to save, salmon EDIT to start editing */
        .taste-btn {
          background: var(--pd-cream);
          border-radius: 30px;
          border: 5px solid var(--pd-salmon);
          padding: clamp(6px, 0.8vw, 12px) clamp(18px, 3vw, 54px);
          cursor: pointer;

          font-family: var(--pd-mono);
          font-size: clamp(12px, 1.3vw, 24px);   /* 🎛️ button text size */
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--pd-maroon);
          transition: transform 0.15s ease;
        }
        .taste-btn:hover { transform: translateY(-2px); }
        .taste-btn:disabled { opacity: 0.55; cursor: default; transform: none; }

        .taste-btn-save {
          border-color: var(--pd-green);
          color: var(--pd-ink);
          padding-left: clamp(14px, 1.8vw, 26px);
          padding-right: clamp(14px, 1.8vw, 26px);
        }
      `}</style>

      {loadError && (
        <p className="taste-note">
          Could not load the taste options right now. Refresh the page to try again.
        </p>
      )}

      {!loadError && !options && <p className="taste-note">Loading…</p>}

      {options && (
        <>
          <TasteSection
            title="Your personality"
            allOptions={options.personality}
            selectedLabels={tags}
            minSelected={limits.minPersonality}
            maxSelected={limits.maxPersonality}
            onSave={async (picked) => {
              const saved = await saveProfileTags(picked);
              onTagsSaved?.(saved);
            }}
            emptyHint="No interests picked yet. Hit edit to add some."
          />

          <TasteSection
            title="Looking for"
            allOptions={options.lookingFor}
            selectedLabels={lookingFor}
            minSelected={0}
            maxSelected={limits.maxLookingFor}
            onSave={async (picked) => {
              const saved = await saveLookingFor(picked);
              onLookingForSaved?.(saved);
            }}
            emptyHint="Not set yet. Hit edit to say what you're looking for."
          />
        </>
      )}
    </div>
  );
}
