import { useCallback, useEffect, useRef, useState } from "react";
import AppNav from "../components/AppNav";
import api from "../api";
import "./Workspace.css";
import "./MyReports.css";

const statuses = {
  pending: ["Pending", "Your report is waiting for the moderation team to review."],
  reviewed: ["Reviewed", "The team has reviewed your report. A final decision may still be pending."],
  resolved: ["Resolved", "The team has finished handling your report. Account actions are managed separately."],
  dismissed: ["Dismissed", "The team has closed this report without further action on the report."],
};
export default function MyReports() {
  const [rows, setRows] = useState([]), [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const statusesSeen = useRef(new Map());
  const rowsRef = useRef([]);
  rowsRef.current = rows;
  const mounted = useRef(false), pending = useRef(false);
  const load = useCallback(async (before, background = false) => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try {
      const ids = background && rowsRef.current.length ? rowsRef.current.slice(0, 100).map(row => row.id).join(",") : undefined;
      const { data } = await api.get("/reports/mine", { params: { before, ...(ids ? { ids } : {}) } });
      if (!mounted.current) return;
      if (!before) {
        const changed = data.reports.some(row => statusesSeen.current.has(row.id) && statusesSeen.current.get(row.id) !== row.status);
        if (changed) setNotice("Your report status has been updated.");
        data.reports.forEach(row => statusesSeen.current.set(row.id, row.status));
      }
      setRows(previous => before || ids ? [...new Map([...previous, ...data.reports].map(row => [row.id, row])).values()] : data.reports);
      if (!ids) setCursor(data.nextCursor); setError("");
      if (document.visibilityState === "visible") {
        const updates = data.reports.filter(row => row.status !== "pending" && row.updatedAt).map(({id, updatedAt}) => ({id, updatedAt}));
        if (updates.length) { try { await api.post("/reports/seen", { reports: updates }); window.dispatchEvent(new Event("postdate:report-update")); } catch { /* Keep the visible reports and retry acknowledgement on refresh. */ } }
      }
    } catch (err) { if (mounted.current) setError(err?.response?.data?.message || "Your reports couldn’t load. Please try again."); }
    finally { pending.current = false; if (mounted.current) { setLoading(false); setBusy(false); } }
  }, []);
  useEffect(() => {
    mounted.current = true; load();
    const refresh = () => { if (document.visibilityState === "visible") load(undefined, true); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("postdate:report-update", refresh); window.addEventListener("focus", refresh);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener("postdate:report-update", refresh); window.removeEventListener("focus", refresh); };
  }, [load]);
  return <div className="member-home my-reports"><AppNav /><main className="member-main">
    <div className="workspace-title"><div><p className="eyebrow">YOUR VOICE MATTERS</p><h1>My reports.</h1><p className="muted">Track the concerns you’ve shared with the PostDate team.</p></div><button className="outline-button" disabled={busy} onClick={() => load()}>{busy ? "Refreshing…" : "Refresh status"}</button></div>
    <p className="my-reports-privacy">Only you and the moderation team can access your submissions. Internal staff notes and other members’ account details stay private.</p>
    {notice && <p role="status">{notice}</p>}
    {loading && <p role="status">Loading your reports…</p>}
    {error && <p role="alert" className="my-reports-error">{error}</p>}
    {!loading && !error && !rows.length && <div className="my-reports-empty"><span aria-hidden="true">♡</span><h2>No reports submitted.</h2><p>You can report a profile from Find dates or View profile, or report a received chat message.</p></div>}
    <ul className="my-report-list">{rows.map(row => { const [label, explanation] = statuses[row.status] || [row.status, ""]; return <li key={row.id}>
      <div className="my-report-heading"><h2>{row.reason}</h2><span className={`my-report-status status-${row.status}`}>{label}</span></div>
      <p className="my-report-meta">{row.targetType === "user" ? "Profile" : row.targetType.charAt(0).toUpperCase() + row.targetType.slice(1)} report · Submitted <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString()}</time></p>
      {row.description && <p className="my-report-description">{row.description}</p>}
      <p className="my-report-outcome">{explanation}</p>
      {row.resolvedAt && <small>Closed {new Date(row.resolvedAt).toLocaleDateString()}</small>}
      <small className="my-report-reference">Reference: {row.id}</small>
    </li>; })}</ul>
    {cursor && <button className="outline-button" disabled={busy} onClick={() => load(cursor)}>{busy ? "Loading…" : "Load older reports"}</button>}
  </main></div>;
}
