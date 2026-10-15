import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { API_ORIGIN } from "../api";
import "./MessageNotifications.css";

export default function MessageNotifications() {
  const [data, setData] = useState({ total: 0, conversations: [] });
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const previous = useRef(null);
  const signature = useRef("");
  const root = useRef(null);
  useEffect(() => {
    let active = true, fetching = false, again = false;
    async function sync() {
      if (fetching) { again = true; return; }
      fetching = true;
      do {
        again = false;
        try {
          const { data: next } = await api.get("/chats/unread");
          if (!active) return;
          const fresh = next.conversations.find(item => !previous.current?.has(item.latestId));
          if (previous.current && fresh) setNotice(fresh);
          previous.current = new Set(next.conversations.map(item => item.latestId));
          const nextSignature = JSON.stringify(next);
          setData(next);
          if (signature.current !== nextSignature) {
            signature.current = nextSignature;
            window.dispatchEvent(new Event("postdate:messages-updated"));
          }
        } catch { /* Keep the last unread count while reconnecting. */ }
      } while (active && again);
      fetching = false;
    }
    sync();
    const stream = typeof EventSource !== "undefined" ? new EventSource(`${API_ORIGIN}/api/chats/live`, { withCredentials: true }) : null;
    const liveUpdate = () => { sync(); window.dispatchEvent(new Event("postdate:report-update")); };
    stream?.addEventListener("messages", liveUpdate);
    window.addEventListener("postdate:messages-read", sync);
    window.addEventListener("focus", sync);
    const timer = setInterval(sync, 60000);
    return () => { active = false; stream?.close(); clearInterval(timer); window.removeEventListener("postdate:messages-read", sync); window.removeEventListener("focus", sync); };
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
  return <div className="message-notifications" ref={root} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); root.current?.querySelector("button")?.focus(); } }}>
    <button className="message-notification-trigger" aria-label={`Message notifications${data.total ? `, ${data.total} unread` : ""}`} aria-expanded={open} onClick={() => setOpen(value => !value)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z" /></svg>{data.total > 0 && <span>{data.total > 99 ? "99+" : data.total}</span>}</button>
    {open && <section className="message-notification-panel" aria-label="Unread messages"><h2>New messages</h2>{!data.total && <p>You’re all caught up.</p>}{data.conversations.map(item => <Link key={item.id} to={`/messages?match=${encodeURIComponent(item.id)}`} onClick={() => { setOpen(false); setNotice(null); }}><b>{item.name}</b><span>{item.count} unread {item.count === 1 ? "message" : "messages"} ↗</span></Link>)}</section>}
    {notice && <div className="message-notification-toast" role="status"><Link to={`/messages?match=${encodeURIComponent(notice.id)}`} onClick={() => setNotice(null)}><b>{notice.name} sent you a message</b><span>Open conversation ↗</span></Link><button aria-label="Dismiss message notification" onClick={() => setNotice(null)}>×</button></div>}
  </div>;
}
