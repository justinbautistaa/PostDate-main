import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Wordmark from "../components/Wordmark";
import MessageNotifications from "../components/MessageNotifications";
import StaffMfaReminder from "../components/StaffMfaReminder";
import WorkspaceFeatures from "../components/WorkspaceFeatures";
import StatisticsSection from "../components/admin/StatisticsSection";
import UsersSection from "../components/admin/UsersSection";
import ReportsSection from "../components/admin/ReportsSection";
import RatingsSection from "../components/admin/RatingsSection";
import AppealsSection from "../components/admin/AppealsSection";
import ActivitySection from "../components/admin/ActivitySection";
import { ToastProvider } from "../components/admin/adminUi";
import { getAdminOverview } from "../services/adminApi";
import { clearToken, logout } from "../auth";
import { formatNumber } from "../components/admin/format";
import "../components/admin/admin.css";
import "./Workspace.css";
import "./Dashboard.css";
import "./RoleDesigns.css";
import "./WorkspaceLayout.css";

const TOOLS = [
  { id: "overview", label: "Overview", icon: "◈" },
  { id: "users", label: "Users", icon: "♧", description: "Find member accounts and manage community access." },
  { id: "team", label: "Staff management", icon: "♧", adminOnly: true, description: "Manage your team and account roles." },
  { id: "reports", label: "Reports", icon: "⚑", description: "Listen to members. Review reports and take action where it matters." },
  { id: "appeals", label: "Appeals", icon: "↺", description: "Give every member a fair review and a clear decision." },
  { id: "ratings", label: "Ratings", icon: "☆", description: "Keep member feedback respectful and useful." },
  { id: "notes", label: "Member follow-ups", icon: "✎", description: "Share member context and track follow-ups with your team." },
  { id: "announcements", label: "Community notices", icon: "◉", description: "Read community updates and team announcements." },
  { id: "statistics", label: "Statistics", icon: "▥", adminOnly: true },
  { id: "mod-activity", label: "Staff activity", icon: "≋", adminOnly: true },
];

export default function AdminDashboard({ role = "admin" }) {
  const isAdmin = role === "admin";
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedSection = params.get("section") || "overview";
  const section = TOOLS.some(tool => tool.id === requestedSection && (!tool.adminOnly || isAdmin)) ? requestedSection : "overview";
  const [navOpen, setNavOpen] = useState(false);
  const navToggle = useRef(null);
  const setSection = (value) => { setParams(value === "overview" ? {} : { section: value }); setNavOpen(false); };
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const tools = TOOLS.filter(tool => !tool.adminOnly || isAdmin);
  const contentRef = useRef(null);
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [section]);
  const refreshOverview = useCallback(async () => {
    try {
      const data = await getAdminOverview();
      setOverview(data); setError("");
    } catch (err) {
      if (err?.response?.status === 401) {
        clearToken(); navigate("/login", { replace: true });
      } else setError("We couldn’t refresh your overview. Please try again.");
    }
  }, [navigate]);
  useEffect(() => {
    refreshOverview();
    const timer = setInterval(refreshOverview, 30000);
    return () => clearInterval(timer);
  }, [refreshOverview]);
  async function logOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logout(); navigate("/login", { replace: true }); }
    catch { window.alert("Could not log out. Please try again."); }
    finally { setLoggingOut(false); }
  }
  const shared = { role, onChanged: refreshOverview };
  const sections = {
    notes: <WorkspaceFeatures kind="notes" role={role} />,
    announcements: <WorkspaceFeatures kind="announcements" role={role} />,
    statistics: <StatisticsSection {...shared} />, users: <UsersSection {...shared} managedRole="user" />,
    team: <UsersSection {...shared} teamOnly />,
    reports: <ReportsSection {...shared} />, ratings: <RatingsSection {...shared} />,
    appeals: <AppealsSection {...shared} />, "mod-activity": <ActivitySection {...shared} />,
  };
  const badges = { reports: overview?.pendingReports, appeals: overview?.pendingAppeals };
  return <ToastProvider><div className={`workspace dashboard ${isAdmin ? "dashboard-admin" : "dashboard-staff"}`}>
    <a className="dashboard-skip" href="#dashboard-content">Skip to content</a>
    <aside className={`workspace-sidebar${navOpen ? " workspace-menu-open" : ""}`} onKeyDown={event => { if (event.key === "Escape" && navOpen) { setNavOpen(false); navToggle.current?.focus(); } }}>
      <div className="workspace-brand-row">
      <Wordmark width="176px" to={isAdmin ? "/admin" : "/staff"} />
      <button type="button" ref={navToggle} className="workspace-menu-toggle" aria-label={navOpen ? "Close workspace menu" : "Open workspace menu"} aria-expanded={navOpen} aria-controls="workspace-navigation" onClick={() => setNavOpen(value => !value)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">{navOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}</svg></button>
      </div>
      <p className="workspace-role">{isAdmin ? "Administration" : "Community team"}</p>
      <p className="workspace-nav-label">YOUR WORKSPACE</p>
      <nav id="workspace-navigation" aria-label={isAdmin ? "Admin navigation" : "Staff navigation"}>{tools.map(tool => <button key={tool.id} type="button" onClick={() => setSection(tool.id)} aria-current={section === tool.id ? "page" : undefined}>
        <span aria-hidden="true">{tool.icon}</span>{tool.label}{badges[tool.id] > 0 && <small className="dashboard-count">{formatNumber(badges[tool.id])}<span className="visually-hidden"> waiting</span></small>}
      </button>)}</nav>
      <div className="workspace-sidebar-bottom"><span className="workspace-sidebar-caption">POSTDATE COMMUNITY</span><Link to="/dashboard">View member space <span aria-hidden="true">↗</span></Link></div>
    </aside>
    <div className="workspace-body">
      <header className="workspace-topbar"><span className="dashboard-breadcrumb">Workspace <span aria-hidden="true">/</span> <b>{tools.find(tool => tool.id === section)?.label}</b></span><div><MessageNotifications /><span className="dashboard-live"><i aria-hidden="true" />{overview ? formatNumber(overview.activeCount) : "—"} active now</span><span className="role-pill">{isAdmin ? "Admin" : "Staff"}</span><button className="text-button" disabled={loggingOut} onClick={logOut}>{loggingOut ? "Logging out…" : "Log out ↗"}</button></div></header>
      <main className="workspace-main" id="dashboard-content" ref={contentRef} tabIndex={-1}>
        <StaffMfaReminder />
        {section === "overview" ? <div className="role-overview">
          <div className="workspace-title"><div><p className="eyebrow">POSTDATE! / {isAdmin ? "BEHIND THE SCENES" : "PEOPLE FIRST"}</p><h1>{isAdmin ? "A little care goes a long way." : "Let’s look after our community."}</h1><p className="muted">{isAdmin ? "Your community, your team, and everything that needs your attention." : "A thoughtful decision can make someone’s experience better."}</p></div></div>
          <section className="workspace-banner"><div><span className="eyebrow">{isAdmin ? "THE BIG PICTURE" : "YOUR SHIFT STARTS HERE"}</span><h2>{isAdmin ? "Room for connection.\nBuilt on trust." : "Real people.\nA safer place to meet."}</h2><p>{isAdmin ? "Keep an eye on the community and give your team the support they need." : "Start with the reports waiting for a review. Take your time, check the context, and keep it fair."}</p><button className="cream-button" onClick={() => setSection("reports")}>Review reports <span aria-hidden="true">↗</span></button></div><div className="postage-art" aria-hidden="true"><span>HANDLE WITH CARE</span><strong>{isAdmin ? "✦" : "♡"}</strong><small>THE POSTDATE COMMUNITY</small></div></section>
          {error && <div className="dashboard-error" role="alert"><span>{error}</span><button className="outline-button" onClick={refreshOverview}>Try again</button></div>}
          {!overview && !error && <p role="status" className="muted">Loading your community overview…</p>}
          <div className="metric-grid">{[{ label: "Members active now", value: overview?.activeCount, note: "Seen in the last five minutes", icon: "♧" }, { label: "Reports waiting", value: overview?.pendingReports, note: "Ready for a thoughtful review", icon: "⚑", target: "reports" }, { label: "Appeals waiting", value: overview?.pendingAppeals, note: "Every perspective deserves a look", icon: "↺", target: "appeals" }].map(metric => <article className="metric-card" key={metric.label}><div className="dashboard-metric-label"><span>{metric.label}</span><span aria-hidden="true">{metric.icon}</span></div><strong>{metric.value == null ? "—" : formatNumber(metric.value)}</strong><small>{metric.note}</small>{metric.target && <button className="text-button" onClick={() => setSection(metric.target)}>Open queue →</button>}</article>)}</div>
          <div className="dashboard-overview-grid"><section className="workspace-panel"><p className="eyebrow">MAKE A DIFFERENCE</p><h2>Your community toolkit.</h2><div className="dashboard-toolkit">{tools.filter(tool => tool.description).map(tool => <button key={tool.id} className="dashboard-tool" onClick={() => setSection(tool.id)}><span className="dashboard-tool-icon" aria-hidden="true">{tool.icon}</span><span><b>{tool.label}</b><small>{tool.description}</small></span><span aria-hidden="true">↗</span></button>)}</div></section><aside className="dashboard-guidance"><span className="eyebrow">A NOTE FOR THE TEAM</span><span className="dashboard-guidance-star" aria-hidden="true">✳</span><h2>Fair. Thoughtful.<br />Human.</h2><p>Read the whole story before taking action. Keep personal information private, and leave a clear reason for every decision.</p><button className="outline-button" onClick={() => setSection(isAdmin ? "mod-activity" : "appeals")}>{isAdmin ? "View staff activity" : "Review appeals"} ↗</button></aside></div>
        </div> : <div className="admin-panel" key={section}>{sections[section]}</div>}
        <footer className="workspace-footer"><span>POSTDATE! · A little care. A better community.</span><Link to="/dashboard">Member space ↗</Link></footer>
      </main>
    </div>
  </div></ToastProvider>;
}
