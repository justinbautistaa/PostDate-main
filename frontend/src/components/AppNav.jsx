/**
 * AppNav
 * The *logged-in* header: wordmark on the left, then the match-history clock
 * and a maroon rounded pill on the right holding HOME / MESSAGES / PROFILE.
 * Whichever route is open turns salmon. Matches Figma "Rectangle 89".
 *
 * Usage:
 *   <AppNav />
 *   <AppNav links={[{ label: "Home", to: "/discover" }]} />
 */
import { useEffect, useRef, useState } from "react";
import { clearToken, logout, getRole } from "../auth";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import Wordmark from "./Wordmark";
import MatchHistory from "./MatchHistory";
import MessageNotifications from "./MessageNotifications";
import ReportUpdates from "./ReportUpdates";
import "../pages/MemberUI.css";
import "./AppNav.css";

/* 🎛️ EDIT THE MENU HERE --------------------------------------------------- */
const DEFAULT_LINKS = [
  { label: "Home", to: "/dashboard" },
  { label: "Find dates", to: "/discover" },
  { label: "Chats", to: "/messages" },
  { label: "Profile", to: "/profile" },
  { label: "My reports", to: "/my-reports" },
];

export default function AppNav({ links }) {
  const role = getRole();
  const menu = links ?? [...DEFAULT_LINKS, ...(role === "admin" ? [{ label: "Admin", to: "/admin" }] : role === "moderator" ? [{ label: "Staff", to: "/staff" }] : [])];
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportCount, setReportCount] = useState(0);
  const location = useLocation();
  const headerRef = useRef(null), toggleRef = useRef(null);
  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = event => { if (!headerRef.current?.contains(event.target)) setMenuOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menuOpen]);
  async function logOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      if (err?.response?.status === 401) {
        clearToken();
        navigate("/login", { replace: true });
      } else { window.alert("Could not log out. Please try again."); }
    } finally { setLoggingOut(false); }
  }
  return (
    <header ref={headerRef} className={`appnav${menuOpen ? " appnav-menu-open" : ""}`} onKeyDown={event => { if (event.key === "Escape" && menuOpen) { setMenuOpen(false); toggleRef.current?.focus(); } }}>
      <style>{`
        .appnav {
          /* the match-history panel pins itself to this on phones */
          position: relative;

          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          padding: clamp(10px, 1.4vw, 20px) var(--pd-gutter);
          border-bottom: 1px solid var(--pd-white);
        }

        /* clock + pill, side by side */
        .appnav-right {
          display: flex;
          align-items: center;
          gap: clamp(8px, 1vw, 20px);   /* 🎛️ space between the clock and the pill */
        }

        .appnav-pill {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;

          /* 🎛️ THE PILL --------------------------------------------------
             Figma draws this 700x100. These values keep the same look but
             let it shrink on small screens.                               */
          background: var(--pd-maroon);
          border-radius: var(--pd-radius);
          padding: clamp(8px, 1vw, 16px) clamp(10px, 1.4vw, 26px);
          gap: clamp(12px, 2.2vw, 44px);   /* 🎛️ space between links */
        }

        .appnav-pill a, .appnav-pill button {
          background: none; border: 0; padding: 0; cursor: pointer;
          font-family: var(--pd-mono);
          font-weight: 400;
          font-size: clamp(11px, 1vw, 20px);   /* 🎛️ link text size */
          letter-spacing: 0.06em;
          text-transform: uppercase;
          text-decoration: none;
          color: var(--pd-white);
          white-space: nowrap;
          transition: color 0.15s ease;
        }

        /* active route = salmon, exactly like the mockup */
        .appnav-pill a:hover { color: var(--pd-pink); }
        .appnav-pill a.active { color: var(--pd-salmon); }

        @media (max-width: 620px) {
          .appnav { justify-content: center; }
        }
      `}</style>

      <Wordmark to="/dashboard" />

      <div className="appnav-right">
        <div className="appnav-tools">
        <MatchHistory />
        <MessageNotifications />
        </div>
        <button type="button" className="appnav-menu-toggle" ref={toggleRef} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="member-main-menu" onClick={() => setMenuOpen(value => !value)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">{menuOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}</svg></button>

        <nav id="member-main-menu" className="appnav-pill" aria-label="Main">
          {menu.map(({ label, to }) => (
            <NavLink key={to} to={to}>
              {label}{to === "/my-reports" && reportCount > 0 && <span className="report-update-count" aria-label={`${reportCount} report updates`}>{reportCount}</span>}
            </NavLink>
          ))}
          <button type="button" className="appnav-logout" disabled={loggingOut} onClick={logOut}>{loggingOut ? "Logging out…" : "Log out"}</button>
        </nav>
      </div>
      <ReportUpdates onCount={setReportCount} />
    </header>
  );
}
