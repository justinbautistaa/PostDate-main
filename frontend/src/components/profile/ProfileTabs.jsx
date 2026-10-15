/**
 * ProfileTabs
 * The four tabs above the profile panel. Each tab keeps its own fixed colour
 * (cream / maroon / salmon / ink) and the panel underneath takes the colour of
 * whichever one is selected — that colour match is how the design shows which
 * tab is open, so the panel and the tabs share the PANEL_COLOURS map below.
 *
 * Usage:
 *   const [tab, setTab] = useState("taste");
 *   <ProfileTabs active={tab} onChange={setTab} />
 */

/* 🎛️ EDIT THE TABS HERE ----------------------------------------------------
   `id` is what gets passed to onChange, `tone` picks the colour pair.
   Add a tab here and add a matching case in Profile.jsx.                   */
export const PROFILE_TABS = [
  { id: "taste", label: "Your taste", tone: "cream" },
  { id: "reviews", label: "Your reviews", tone: "maroon" },
  { id: "photos", label: "Your photos", tone: "salmon" },
  { id: "settings", label: "Settings", tone: "ink", icon: true },
];

/* The panel background for each tab. Profile.jsx imports this so the panel
   and its tab can never drift apart. */
export const PANEL_COLOURS = {
  taste: "var(--pd-cream)",
  reviews: "var(--pd-maroon)",
  photos: "var(--pd-salmon)",
  settings: "var(--pd-ink)",
};

export default function ProfileTabs({ active = "taste", onChange }) {
  return (
    <div className="ptabs" role="tablist" aria-label="Profile sections">
      <style>{`
        .ptabs {
          display: flex;
          align-items: flex-end;
          gap: clamp(3px, 0.4vw, 7px);   /* 🎛️ gap between tabs */
          padding-top: 6px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .ptabs::-webkit-scrollbar { display: none; }

        .ptabs-tab {
          flex: 0 0 auto;
          border: none;
          cursor: pointer;
          border-radius: 4px 4px 0 0;

          /* 🎛️ tab size */
          padding: clamp(6px, 0.85vw, 14px) clamp(10px, 1.6vw, 30px);

          font-family: var(--pd-mono);
          font-weight: 400;
          font-size: clamp(10px, 1.05vw, 20px);   /* 🎛️ tab text size */
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
          transition: transform 0.15s ease, filter 0.15s ease;
        }

        /* fixed colour per tab, exactly as drawn */
        .ptabs-cream  { background: var(--pd-cream);  color: var(--pd-maroon); }
        .ptabs-maroon { background: var(--pd-maroon); color: var(--pd-white); }
        .ptabs-salmon { background: var(--pd-salmon); color: var(--pd-white); }
        .ptabs-ink    { background: var(--pd-ink);    color: var(--pd-cream); }

        /* the open tab grows a little and sits flush against the panel */
        .ptabs-tab[aria-selected="true"] {
          padding-top: clamp(10px, 1.3vw, 20px);
          margin-bottom: -1px;
        }
        .ptabs-tab[aria-selected="false"]:hover { filter: brightness(1.06); }

        /* the settings tab is an icon, so it stays square-ish */
        .ptabs-icon { padding-left: clamp(10px, 1.3vw, 22px); padding-right: clamp(10px, 1.3vw, 22px); }
        .ptabs-icon svg { display: block; width: clamp(14px, 1.5vw, 26px); height: auto; }
      `}</style>

      {PROFILE_TABS.map(({ id, label, tone, icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`ptab-${id}`}
          aria-controls={`ppanel-${id}`}
          aria-selected={active === id}
          className={`ptabs-tab ptabs-${tone}${icon ? " ptabs-icon" : ""}`}
          onClick={() => onChange?.(id)}
        >
          {icon ? (
            <>
              {/* simple gear, drawn inline so there is no icon library to install */}
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                <path d="m21 13.5-.1-1.5.1-1.5-2-.6-.6-1.4 1-1.8-2.1-2.1-1.8 1-1.4-.6-.6-2H10l-.6 2-1.4.6-1.8-1L4.1 6.6l1 1.8-.6 1.4-2 .6.1 1.5-.1 1.5 2 .6.6 1.4-1 1.8 2.1 2.1 1.8-1 1.4.6.6 2h3l.6-2 1.4-.6 1.8 1 2.1-2.1-1-1.8.6-1.4 2-.6Z" opacity=".55" />
              </svg>
              <span className="visually-hidden">{label}</span>
            </>
          ) : (
            label
          )}
        </button>
      ))}
    </div>
  );
}
