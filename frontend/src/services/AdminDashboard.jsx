/**
 * AdminDashboard — the staff console. One component, two roles:
 *
 *   <AdminDashboard role="admin" />       ten sidebar sections
 *   <AdminDashboard role="moderator" />   six sidebar sections
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ POSTDATE!              ● ACTIVE: 37   ADMIN   [Log out]  │
 *   ├────────────┬─────────────────────────────────────────────┤
 *   │ DASHBOARD  │  Section heading                            │
 *   │ (Statistics)│                                            │
 *   │ (Reports 4) │   pink panel: stamps, charts, lists        │
 *   │ ...        │                                             │
 *   └────────────┴─────────────────────────────────────────────┘
 *
 * Built so far (all live against /api/admin/...):
 *   Statistics · Users · Reports · Ratings · Appeals · Mod activity (admins)
 * Not built yet: Privacy, Server logs, Security logs, Settings — they show a
 * "coming soon" note instead of a broken page.
 *
 * Each section owns its own data loading (see components/admin/*Section.jsx).
 * This page only owns the shell: the sidebar, the live counter, the badges and
 * log-out. `onChanged` is how a section tells the shell "something I did may
 * have changed the waiting counts" so the badges refresh straight away.
 *
 * The role prop only decides what's SHOWN. The server checks the real role on
 * every request, so editing this prop in devtools unlocks nothing.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Wordmark from "../components/Wordmark";
import AdminSidebar, { SECTIONS } from "../components/admin/AdminSidebar";
import StatisticsSection from "../components/admin/StatisticsSection";
import UsersSection from "../components/admin/UsersSection";
import ReportsSection from "../components/admin/ReportsSection";
import RatingsSection from "../components/admin/RatingsSection";
import AppealsSection from "../components/admin/AppealsSection";
import ActivitySection from "../components/admin/ActivitySection";
import { EmptyState, SectionHead, Sheet, ToastProvider } from "../components/admin/adminUi";
import { getAdminOverview } from "../services/adminApi";
import { clearToken, logout } from "../auth";
import { formatNumber } from "../components/admin/format";
import "../components/admin/admin.css";

const OVERVIEW_REFRESH_MS = 30 * 1000; // 🎛️ how often the header counter and badges refresh

/* What each not-yet-built section will hold, so the placeholder says something useful. */
const COMING_SOON = {
  privacy: { title: "Privacy", will: "Requests from members to export or delete their data." },
  "server-logs": { title: "Server logs", will: "Recent server errors, so problems show up without opening a terminal." },
  "security-logs": { title: "Security logs", will: "Failed log-ins, blocked requests and permission denials." },
  settings: { title: "Settings", will: "Your own account options and site-wide switches." },
};

export default function AdminDashboard({ role = "admin" }) {
  const navigate = useNavigate();
  const sections = SECTIONS[role] ?? SECTIONS.admin;

  const [section, setSection] = useState(sections[0].id);
  const [overview, setOverview] = useState(null);

  const logOut = useCallback(async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      if (err?.response?.status === 401) {
        clearToken();
        navigate("/login", { replace: true });
      } else { window.alert("Could not log out. Please try again."); }
    }
  }, [navigate]);

  const refreshOverview = useCallback(() => {
    getAdminOverview()
      .then(setOverview)
      .catch((err) => {
        // The session ended (expired, suspended or demoted): back to log-in.
        if (err?.response?.status === 401) logOut();
        // Any other failure leaves the last numbers up; the next tick tries again.
      });
  }, [logOut]);

  useEffect(() => {
    refreshOverview();
    const id = setInterval(refreshOverview, OVERVIEW_REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshOverview]);

  const badges = { reports: overview?.pendingReports ?? 0, appeals: overview?.pendingAppeals ?? 0 };
  const shared = { role, onChanged: refreshOverview };

  function renderSection() {
    switch (section) {
      case "statistics":
        return <StatisticsSection {...shared} />;
      case "users":
        return <UsersSection {...shared} />;
      case "reports":
        return <ReportsSection {...shared} />;
      case "ratings":
        return <RatingsSection {...shared} />;
      case "appeals":
        return <AppealsSection {...shared} />;
      case "mod-activity":
        return <ActivitySection {...shared} />;
      default: {
        const info = COMING_SOON[section] ?? { title: section, will: "" };
        return (
          <>
            <SectionHead title={info.title} />
            <Sheet>
              <EmptyState title="Not built yet">
                {info.will} Statistics, users, reports, ratings and appeals are all live from the sidebar.
              </EmptyState>
            </Sheet>
          </>
        );
      }
    }
  }

  return (
    <div className="admin">
      <style>{`
        .admin {
          min-height: 100vh;
          background: var(--pd-ink);      /* the dark console background */
          display: flex;
          flex-direction: column;
        }

        .admin-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          padding: clamp(10px, 1.4vw, 22px) var(--pd-gutter);
          border-bottom: 1px solid var(--pd-white);
        }

        .admin-header-right {
          display: flex;
          align-items: center;
          gap: clamp(10px, 1.6vw, 26px);
          flex-wrap: wrap;
        }

        .admin-active {
          display: flex;
          align-items: center;
          gap: clamp(7px, 0.8vw, 13px);
          margin: 0;

          font-family: var(--pd-mono);
          font-size: clamp(11px, 1.05vw, 20px);   /* 🎛️ "active" text size */
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--pd-white);
        }
        .admin-dot {
          width: clamp(12px, 1.3vw, 24px);
          height: clamp(12px, 1.3vw, 24px);
          border-radius: 50%;
          background: var(--pd-pink);
          border: 2px solid var(--pd-ink);
          box-shadow: 0 0 0 1px rgba(232, 180, 184, 0.5);
          animation: admin-pulse 2.6s ease-in-out infinite;   /* a slow "live" heartbeat */
        }
        @keyframes admin-pulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(232, 180, 184, 0.5); }
          50%      { box-shadow: 0 0 0 6px rgba(232, 180, 184, 0.12); }
        }

        .admin-role {
          margin: 0;
          padding: 3px 12px;
          border: 1px solid var(--pd-pink);
          border-radius: 999px;
          font-family: var(--pd-mono);
          font-size: clamp(10px, 0.9vw, 15px);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--pd-pink);
        }

        .admin-logout {
          background: transparent;
          border: 1px solid var(--pd-white);
          border-radius: 999px;
          padding: clamp(5px, 0.6vw, 9px) clamp(14px, 1.4vw, 24px);
          cursor: pointer;
          font-family: var(--pd-mono);
          font-size: clamp(11px, 1vw, 17px);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--pd-white);
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .admin-logout:hover { background: var(--pd-white); color: var(--pd-ink); }
        .admin-logout:focus-visible { outline-color: var(--pd-cream); }

        .admin-body {
          flex: 1;
          width: 100%;
          max-width: var(--pd-max);
          margin: 0 auto;
          padding: clamp(14px, 2vw, 30px) var(--pd-gutter) clamp(20px, 3vw, 44px);

          /* 🎛️ sidebar width is the first value */
          display: grid;
          grid-template-columns: minmax(170px, 15%) minmax(0, 1fr);
          gap: clamp(14px, 2vw, 30px);
          align-items: start;
        }

        /* white hairline between the sidebar and the panel */
        .admin-panel-wrap {
          border-left: 1px solid var(--pd-white);
          padding-left: clamp(14px, 2vw, 30px);
          min-width: 0;
        }

        .admin-panel {
          background: var(--pd-pink);
          border-radius: 20px;
          padding: clamp(14px, 2.2vw, 36px);
          min-height: clamp(280px, 46vw, 780px);   /* 🎛️ panel height */
        }

        @media (max-width: 760px) {
          .admin-body { grid-template-columns: minmax(0, 1fr); }
          .admin-panel-wrap { border-left: none; border-top: 1px solid var(--pd-white);
                              padding-left: 0; padding-top: clamp(14px, 2vw, 24px); }
        }
      `}</style>

      <ToastProvider>
        <header className="admin-header">
          <Wordmark to="/" />

          <div className="admin-header-right">
            <p className="admin-active" aria-live="polite">
              <span className="admin-dot" aria-hidden="true" />
              Active: {overview ? formatNumber(overview.activeCount) : "—"}
            </p>
            <p className="admin-role">{role === "admin" ? "Admin" : "Moderator"}</p>
            <button type="button" className="admin-logout" onClick={logOut}>
              Log out
            </button>
          </div>
        </header>

        <div className="admin-body">
          <AdminSidebar role={role} active={section} onChange={setSection} badges={badges} />

          <div className="admin-panel-wrap">
            <main className="admin-panel">
              {/* key= resets a section's filters and page when you switch away and back */}
              <div key={section}>{renderSection()}</div>
            </main>
          </div>
        </div>
      </ToastProvider>
    </div>
  );
}
