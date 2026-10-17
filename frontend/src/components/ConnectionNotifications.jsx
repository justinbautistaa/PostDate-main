import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { API_ORIGIN } from "../api";
import "./MessageNotifications.css";

export default function ConnectionNotifications() {
  const [data, setData] = useState({ total: 0, rows: [] });
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState("");
  const previous = useRef(null), root = useRef(null);
  useEffect(() => {
    let active = true, fetching = false, again = false;
    async function sync() {
      if (fetching) { again = true; return; }
      fetching = true;
      try {
        do {
          again = false;
          const { data: next } = await api.get("/chats/connections");
          if (!active) return;
          const fresh = next.rows.find(row => row.unread && !previous.current?.has(row.id));
          if (previous.current && fresh) setNotice(fresh);
          previous.current = new Set(next.rows.map(row => row.id));
          setData(next); setError("");
        } while (active && again);
      } catch { if (active) setError("Couldn’t refresh notifications. Reconnecting…"); }
      finally { fetching = false; }
    }
    sync();
    const stream = typeof EventSource !== "undefined" ? new EventSource(`${API_ORIGIN}/api/chats/live`, { withCredentials: true }) : null;
    stream?.addEventListener("messages", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("postdate:connections-read", sync);
    const timer = setInterval(sync, 30000);
    return () => { active = false; stream?.close(); clearInterval(timer); window.removeEventListener("focus", sync); window.removeEventListener("postdate:connections-read", sync); };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  async function markRead() {
    try {
      await api.post("/chats/connections/read", { through: data.through });
      setNotice(null);
      window.dispatchEvent(new Event("postdate:connections-read"));
    } catch { setError("Couldn’t mark notifications as read. Please try again."); }
  }
  const label = row => row.kind === "match" ? `You and ${row.name} matched!` : `${row.name} liked you`;
  return <div className="message-notifications" ref={root} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
    <button className="message-notification-trigger" aria-label={`Like and match notifications${data.total ? `, ${data.total} unread` : ""}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {data.total > 0 && <span>{data.total > 99 ? "99+" : data.total}</span>}
    </button>
    {open && <section className="message-notification-panel" aria-label="Likes and matches"><h2>Likes and matches</h2>
      {error && <p role="alert">{error}</p>}
      {!data.rows.length && <p>No likes or matches yet.</p>}
      {data.total > 0 && <button className="auth-link" onClick={markRead}>Mark all as read</button>}
      {data.rows.map(row => <Link key={row.id} to={row.href} onClick={() => { setOpen(false); setNotice(null); }}><b>{row.unread ? "• " : ""}{label(row)}</b><span>{row.kind === "match" ? "Start a conversation ↗" : "Find dates to connect ↗"}</span></Link>)}
    </section>}
    {notice && <div className="message-notification-toast" role="status"><Link to={notice.href} onClick={() => setNotice(null)}><b>{label(notice)}</b><span>{notice.kind === "match" ? "Open your match ↗" : "Find dates ↗"}</span></Link><button aria-label="Dismiss connection notification" onClick={() => setNotice(null)}>×</button></div>}
  </div>;
}
