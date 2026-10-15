import { useState } from "react";

/**
 * DiscoverToolbar
 * The search bar + Filters button above the card grid. Matches the Figma's
 * layered look: a maroon rounded frame sits behind everything (with a bit of
 * padding showing all the way round), holding a wide tan search field on the
 * left and a smaller cream bordered button on the right.
 *
 * 🔍 CONFIDENCE NOTE: the Figma has no filter panel content — just the button.
 * I gave it a dropdown with the three fields the cards themselves show
 * (gender, distance, age), since that's the only evidence of what "filters"
 * would filter by. Swap FILTER_FIELDS below for whatever your team actually
 * wants to filter on.
 *
 * Usage:
 *   <DiscoverToolbar query={query} onQuery={setQuery}
 *                     filters={filters} onFilters={setFilters} />
 */

/* 🎛️ EDIT THE FILTER CONTROLS HERE */
const GENDER_OPTIONS = ["Any", "Woman", "Man", "Non-binary"];

export default function DiscoverToolbar({
  query = "",
  onQuery,
  filters = { gender: "Any", minAge: 18, maxAge: 60 },
  onFilters,
}) {
  const [open, setOpen] = useState(false);

  function update(patch) {
    onFilters?.({ ...filters, ...patch });
  }

  return (
    <div className="dtoolbar">
      <style>{`
        .dtoolbar {
          position: relative;
          flex: none;
          display: flex;
          gap: clamp(10px, 1.4vw, 22px);
          align-items: center;

          /* Figma: Rectangle 90 — the maroon frame behind the search field
             and Filters button, ~10-13px of it showing as padding all round. */
          background: var(--pd-maroon);
          border-radius: var(--pd-radius);
          padding: clamp(6px, 0.9vw, 11px) clamp(8px, 1.1vw, 14px);
        }

        .dtoolbar-search {
          flex: 1 1 auto;
          width: clamp(200px, 32vw, 684px);   /* 🎛️ matches the Figma's search bar width */
          display: flex;
          align-items: center;
          gap: 10px;

          background: var(--pd-tan);
          border-radius: var(--pd-radius);
          padding: 0 clamp(14px, 1.6vw, 24px);
          height: clamp(40px, 4.2vw, 60px);   /* 🎛️ search bar height */
        }
        .dtoolbar-search svg {
          flex: none;
          width: clamp(14px, 1.3vw, 20px);
          height: auto;
          color: var(--pd-maroon);
          opacity: 0.7;
        }
        .dtoolbar-search input {
          flex: 1;
          border: none;
          background: transparent;
          outline: none;

          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(13px, 1.5vw, 26px);  /* 🎛️ search text size */
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--pd-ink);
        }
        .dtoolbar-search input::placeholder { color: var(--pd-pink); }

        .dtoolbar-filters {
          flex: none;
          background: var(--pd-cream);
          border: 1px solid var(--pd-ink);
          border-radius: 20px;
          box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
          padding: 0 clamp(16px, 1.8vw, 28px);
          height: clamp(40px, 4.2vw, 60px);

          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(12px, 1.4vw, 24px);   /* 🎛️ "Filters" text size */
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--pd-ink);
          cursor: pointer;
        }
        .dtoolbar-filters[aria-expanded="true"] { background: var(--pd-tan); }

        .dtoolbar-panel {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          z-index: 5;
          width: min(320px, 90vw);

          background: var(--pd-cream);
          border: 1px solid var(--pd-maroon);
          border-radius: 10px;
          padding: 18px;
          box-shadow: 0 18px 34px -18px rgba(43, 35, 32, 0.5);

          display: flex;
          flex-direction: column;
          gap: 14px;
          font-family: var(--pd-mono);
          font-size: 13px;
          color: var(--pd-ink);
        }
        .dtoolbar-field { display: flex; flex-direction: column; gap: 6px; }
        .dtoolbar-field label {
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-size: 11px;
          color: var(--pd-maroon);
        }
        .dtoolbar-field select,
        .dtoolbar-field input[type="range"] { font-family: inherit; }
        .dtoolbar-range-value { font-size: 11px; opacity: 0.75; }
      `}</style>

      <label className="dtoolbar-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.2" y2="16.2" />
        </svg>
        <span className="visually-hidden">Search profiles</span>
        <input
          type="search"
          placeholder="Search"
          value={query}
          onChange={(e) => onQuery?.(e.target.value)}
        />
      </label>

      <button
        type="button"
        className="dtoolbar-filters"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        Filters
      </button>

      {open && (
        <div className="dtoolbar-panel" role="dialog" aria-label="Filters">
          <div className="dtoolbar-field">
            <label htmlFor="f-gender">Gender</label>
            <select
              id="f-gender"
              value={filters.gender}
              onChange={(e) => update({ gender: e.target.value })}
            >
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="dtoolbar-field">
            <label htmlFor="f-age">
              Age <span className="dtoolbar-range-value">{filters.minAge}–{filters.maxAge}</span>
            </label>
            <input
              id="f-age"
              type="range"
              min="18"
              max="80"
              value={filters.maxAge}
              onChange={(e) => update({ maxAge: Number(e.target.value) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
