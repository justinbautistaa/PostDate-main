import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AppNav from "../components/AppNav";
import ProfilePhoto from "../components/ProfilePhoto";
import ReportForm from "../components/ReportForm";
import MatchedProfile from "../components/MatchedProfile";
import ReviewForm from "../components/ReviewForm";
import api from "../api";
import { getConversations, getConversation, getMessages, sendMessage } from "../services/chatApi";
import { toPhotoUrl } from "../services/postdateApi";
import "./Workspace.css";
import "./Messages.css";
import "./RoleDesigns.css";

const time = value => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
function Avatar({ person }) {
  return <span className="chat-avatar"><ProfilePhoto src={toPhotoUrl(person.avatarPath)} name={person.name} /></span>;
}
function Thread({ person, onSent, onBack }) {
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reportMessage, setReportMessage] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [reviewNotice, setReviewNotice] = useState("");
  const pending = useRef(false), scroller = useRef(null), stick = useRef(true);
  useEffect(() => {
    let active = true, initial = true, fetching = false;
    async function load() {
      if (fetching) return;
      fetching = true;
      try {
        const data = await getMessages(person.id);
        if (!active) return;
        setReviewed(previous => previous || Boolean(data.reviewed));
        if (document.visibilityState === "visible" && data.messages.some(message => !message.mine && !message.read)) {
          try {
            await api.post(`/chats/${encodeURIComponent(person.id)}/read`, { before: data.messages[data.messages.length - 1].id });
            window.dispatchEvent(new Event("postdate:messages-read"));
          } catch { /* Retry the read acknowledgement on the next refresh. */ }
        }
        setMessages(previous => {
          const all = new Map(previous.map(m => [m.id, m]));
          data.messages.forEach(m => all.set(m.id, m));
          return [...all.values()].sort((a, b) => a.id.localeCompare(b.id));
        });
        if (initial) setCursor(data.nextCursor);
        setError(""); initial = false;
      } catch (err) { if (active) setError(err?.response?.data?.message || "Your messages couldn’t load. Try again."); }
      finally { if (active) setLoading(false); fetching = false; }
    }
    load(); const timer = setInterval(load, 15000);
    window.addEventListener("postdate:messages-updated", load);
    window.addEventListener("focus", load);
    return () => { active = false; clearInterval(timer); window.removeEventListener("postdate:messages-updated", load); window.removeEventListener("focus", load); };
  }, [person.id, retry]);
  useEffect(() => {
    if (stick.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages]);
  async function loadOlder() {
    if (older || !cursor) return;
    setOlder(true); stick.current = false;
    try {
      const data = await getMessages(person.id, cursor);
      setMessages(previous => [...new Map([...data.messages, ...previous].map(m => [m.id, m])).values()]);
      setCursor(data.nextCursor); setError("");
    } catch { setError("Earlier messages couldn’t load. Please try again."); }
    finally { setOlder(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (!text.trim() || pending.current) return;
    pending.current = true; setSending(true); setSendError("");
    try {
      const message = await sendMessage(person.id, text);
      stick.current = true;
      setMessages(previous => [...new Map([...previous, message].map(m => [m.id, m])).values()]);
      setText(""); onSent();
    } catch (err) { setSendError(err?.response?.data?.message || "Message not sent. Your draft is saved here; please try again."); }
    finally { pending.current = false; setSending(false); }
  }
  return <section className="chat-thread" aria-label={`Chat with ${person.name}`}>
    <header className="chat-thread-head"><button className="chat-back" onClick={onBack} aria-label="Back to conversations">←</button><Avatar person={person} /><div><h2>{person.name}</h2><p>You matched · Say something worth remembering.</p></div><button type="button" className="chat-view-profile" onClick={() => setProfileOpen(true)}>View profile</button></header>
    {reviewNotice && <div className="chat-rating-bar" role="status">{reviewNotice}</div>}
    <div className="chat-messages" ref={scroller} onScroll={event => { const el = event.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {cursor && <button className="chat-earlier" disabled={older} onClick={loadOlder}>{older ? "Loading…" : "Earlier messages ↑"}</button>}
      {loading && <p role="status">Opening your conversation…</p>}
      {error && <div className="chat-error" role="alert">{error} <button onClick={() => setRetry(v => v + 1)}>Try again</button></div>}
      {!loading && !error && messages.length === 0 && <div className="chat-first"><span aria-hidden="true">♡</span><h3>Every connection starts somewhere.</h3><p>Ask about something in their profile, or share a little about your day.</p></div>}
      <ol aria-label="Messages">{messages.map(message => <li key={message.id} className={message.mine ? "chat-message mine" : "chat-message"}><span className="visually-hidden">{message.mine ? "You" : person.name}: </span><p>{message.text}</p><time dateTime={message.sentAt} title={new Date(message.sentAt).toLocaleString()}>{time(message.sentAt)}</time>{!message.mine && <button className="report-link" aria-label={`Report message from ${person.name} at ${time(message.sentAt)}`} onClick={() => setReportMessage(message.id)}>Report</button>}</li>)}</ol>
    </div>
    <form className="chat-compose" onSubmit={submit}>
      {sendError && <p role="alert" className="chat-send-error">{sendError}</p>}
      <label className="visually-hidden" htmlFor="chat-draft">Message to {person.name}</label>
      <textarea id="chat-draft" value={text} onChange={event => setText(event.target.value)} maxLength={5000} rows={2} disabled={sending || loading} placeholder="A little hello goes a long way…" />
      <button type="submit" disabled={!text.trim() || sending || loading}>{sending ? "Sending…" : "Send ↗"}</button>
      <small>Take your time. Keep it kind. <span>{text.length.toLocaleString()} / 5,000</span></small>
    </form>
    {reportMessage && <ReportForm targetType="message" targetId={reportMessage} onClose={() => setReportMessage(null)} />}
    {profileOpen && <MatchedProfile matchId={person.id} reviewed={reviewed} ratingReady={!loading} onRate={() => { setProfileOpen(false); setReviewOpen(true); }} onDisconnect={async action => {
      await api.post(`/chats/${encodeURIComponent(person.id)}/${action}`);
      window.dispatchEvent(new Event("postdate:messages-read"));
      onBack(); onSent();
    }} onClose={() => setProfileOpen(false)} />}
    {reviewOpen && <ReviewForm match={{ id: person.id, partner: { name: person.name } }} onClose={() => setReviewOpen(false)} onSaved={() => { setReviewed(true); setReviewOpen(false); setReviewNotice("Your rating was saved. Thank you for your feedback."); }} />}
  </section>;
}
export default function Messages() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("match");
  const [items, setItems] = useState([]), [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [moreLoading, setMoreLoading] = useState(false);
  const [selectedLoading, setSelectedLoading] = useState(false), [selectedError, setSelectedError] = useState("");
  const [selectedRetry, setSelectedRetry] = useState(0);
  const firstPageIds = useRef(new Set()), paged = useRef(false);
  const person = items.find(item => item.id === selected);
  const personId = person?.id;
  useEffect(() => {
    let active = true;
    setSelectedError("");
    if (!selected || personId || loading) { setSelectedLoading(false); return; }
    setSelectedLoading(true);
    getConversation(selected).then(row => { if (active) setItems(previous => previous.some(item => item.id === row.id) ? previous : [row, ...previous]); })
      .catch(err => { if (active) setSelectedError(err?.response?.status === 404 ? "This conversation is no longer available." : "This conversation couldn’t load. Please try again."); })
      .finally(() => { if (active) setSelectedLoading(false); });
    return () => { active = false; };
  }, [selected, personId, loading, selectedRetry]);
  const refresh = useCallback(async () => {
    try {
      const data = await getConversations();
      const oldFirstPage = firstPageIds.current;
      firstPageIds.current = new Set(data.conversations.map(item => item.id));
      setItems(previous => [...data.conversations, ...previous.filter(item => !oldFirstPage.has(item.id) && !data.conversations.some(c => c.id === item.id))]);
      if (!paged.current) setCursor(data.nextCursor);
      setError("");
    } catch { setError("Your conversations couldn’t load. Please try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 60000); window.addEventListener("postdate:messages-updated", refresh); return () => { clearInterval(timer); window.removeEventListener("postdate:messages-updated", refresh); }; }, [refresh]);
  async function more() {
    if (moreLoading || !cursor) return;
    setMoreLoading(true);
    try {
      const data = await getConversations(cursor);
      paged.current = true;
      setItems(previous => [...new Map([...previous, ...data.conversations].map(c => [c.id, c])).values()]); setCursor(data.nextCursor);
    } catch { setError("More conversations couldn’t load. Please try again."); }
    finally { setMoreLoading(false); }
  }
  return <div className="member-home chats"><AppNav /><main className="member-main">
    <div className="workspace-title"><div><p className="eyebrow">FROM A MATCH TO SOMETHING MORE</p><h1>Your conversations.</h1><p className="muted">A good date can start with a great conversation.</p></div><Link className="outline-button" to="/discover">Find dates ↗</Link></div>
    <div className={`chat-layout${person ? " chat-is-open" : ""}`}>
      <aside className="chat-list"><header><h2>Your matches</h2><span>{items.length}</span></header>
        {selectedLoading && <p className="chat-list-note" role="status">Opening your selected conversation…</p>}
        {selectedError && <div className="chat-error" role="alert">{selectedError}<button onClick={() => setSelectedRetry(v => v + 1)}>Retry selected conversation</button></div>}
        {loading && <p className="chat-list-note" role="status">Finding your conversations…</p>}
        {error && <div className="chat-error" role="alert">{error}<button onClick={refresh}>Try again</button></div>}
        {!loading && !selected && !error && !items.length && <div className="chat-list-note"><span className="chat-empty-symbol" aria-hidden="true">♡</span><h3>Room for a new hello.</h3><p>When you both like each other, your match appears here and you can start chatting.</p><Link className="outline-button" to="/discover">Meet someone new ↗</Link></div>}
        <nav aria-label="Conversations">{items.map(item => <button key={item.id} aria-label={`Chat with ${item.name}`} aria-current={item.id === selected ? "page" : undefined} onClick={() => setParams({ match: item.id })}><Avatar person={item} /><span><b>{item.name}</b><small>{item.lastMessage || "You matched! Say hello."}</small></span><span aria-hidden="true">↗</span></button>)}</nav>
        {cursor && <button className="chat-earlier" disabled={moreLoading} onClick={more}>{moreLoading ? "Loading…" : "More matches ↓"}</button>}
      </aside>
      {person ? <Thread key={person.id} person={person} onSent={refresh} onBack={() => setParams({})} /> : <section className="chat-welcome"><div className="chat-stamp" aria-hidden="true">♡</div><p className="eyebrow">A LETTER TO SOMEONE NEW</p><h2>A match is just<br />the beginning.</h2><p>{selected ? (selectedError || (selectedLoading ? "Opening your selected conversation…" : "Choose a conversation from your matches.")) : "Pick a match to say hello. Be curious, be yourself, and see where the conversation goes."}</p><span className="chat-safety">Your boundaries matter. Share only what feels comfortable.</span></section>}
    </div>
  </main></div>;
}
