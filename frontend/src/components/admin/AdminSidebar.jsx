/**
 * AdminSidebar
 * The "DASHBOARD" heading plus the column of maroon pill buttons on the staff
 * dashboard. Admins see ten sections, moderators see six.
 *
 * 🆕 Admins now have a Ratings pill too (the Figma only gave it to
 * moderators). The server lets both roles moderate ratings, so this is purely a
 * sidebar entry — delete the one line below to take it away again.
 *
 * 🆕 `badges` puts a small count on a pill, e.g. { reports: 4, appeals: 1 } —
 * the dashboard feeds it the number of reports and appeals waiting.
 *
 * Usage:
 *   <AdminSidebar role="admin" active={section} onChange={setSection} badges={{ reports: 4 }} />
 */

/* 🎛️ EDIT THE SECTION LISTS HERE ------------------------------------------
   `id` is the section key AdminDashboard switches on, `label` is the text on
   the pill. Keep ids lowercase and hyphenated.                             */
export const SECTIONS = {
  admin: [
    { id: "statistics", label: "Statistics" },
    { id: "mod-activity", label: "Mod activity" },
    { id: "reports", label: "Reports" },
    { id: "users", label: "Users" },
    { id: "appeals", label: "Appeals" },
    { id: "ratings", label: "Ratings" }, // 🆕 added for admins
    { id: "privacy", label: "Privacy" },
    { id: "server-logs", label: "Server logs" },
    { id: "security-logs", label: "Security logs" },
    { id: "settings", label: "Settings" },
  ],
  moderator: [
    { id: "statistics", label: "Statistics" },
    { id: "reports", label: "Reports" },
    { id: "users", label: "Users" },
    { id: "appeals", label: "Appeals" },
    { id: "ratings", label: "Ratings" },
    { id: "settings", label: "Settings" },
  ],
};

export default function AdminSidebar({ role = "admin", active, onChange, badges = {} }) {
  const items = SECTIONS[role] ?? SECTIONS.admin;

  return (
    <nav className="asidebar" aria-label="Dashboard sections">
      <style>{`
        .asidebar {
          display: flex;
          flex-direction: column;
          gap: clamp(7px, 0.9vw, 14px);   /* 🎛️ space between pills */
        }

        .asidebar-title {
          margin: 0 0 clamp(4px, 0.6vw, 10px);
          font-family: var(--pd-mono);
          font-weight: 400;
          font-size: clamp(14px, 1.5vw, 28px);   /* 🎛️ "Dashboard" size */
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--pd-white);
        }

        .asidebar-item {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6em;

          background: var(--pd-maroon);
          border: 2px solid transparent;
          border-radius: 20px;
          padding: clamp(6px, 0.8vw, 13px) clamp(12px, 1.4vw, 22px);   /* 🎛️ pill size */
          cursor: pointer;
          text-align: center;

          font-family: var(--pd-mono);
          font-size: clamp(10px, 1vw, 18px);     /* 🎛️ pill text size */
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--pd-white);
          white-space: nowrap;
          transition: transform 0.15s ease, background-color 0.15s ease;
        }
        .asidebar-item:hover { transform: translateX(3px); }
        .asidebar-item:focus-visible { outline-color: var(--pd-cream); }

        /* the open section gets a pale outline so it reads as selected */
        .asidebar-item[aria-current="page"] {
          border-color: var(--pd-pink);
          background: #c9445e;
        }

        /* count of things waiting — ink on salmon, readable at a glance */
        .asidebar-badge {
          min-width: 1.7em;
          padding: 0.1em 0.5em;
          border-radius: 999px;
          background: var(--pd-salmon);
          color: var(--pd-ink);
          font-weight: 700;
          font-size: 0.9em;
          line-height: 1.5;
          letter-spacing: 0;
        }

        @media (max-width: 760px) {
          .asidebar { flex-direction: row; flex-wrap: wrap; }
          .asidebar-title { width: 100%; }
        }
      `}</style>

      <h2 className="asidebar-title">Dashboard</h2>

      {items.map(({ id, label }) => {
        const count = badges[id];
        return (
          <button
            key={id}
            type="button"
            className="asidebar-item"
            aria-current={active === id ? "page" : undefined}
            onClick={() => onChange?.(id)}
          >
            {label}
            {count > 0 && (
              <span className="asidebar-badge">
                {count}
                <span className="visually-hidden"> waiting</span>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
