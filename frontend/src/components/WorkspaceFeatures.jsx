import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { getAdminUsers, errorMessage } from "../services/adminApi";
import "./WorkspaceFeatures.css";
import { subscribeToNotices } from "../services/noticeLive";

const copy = {
  announcements: { title: "Community notices", sub: "The latest updates from the PostDate team.", action: "Publish notice", empty: "You’re all caught up. New notices will appear here." },
  notes: { title: "Member follow-ups", sub: "A shared notebook for the team. Record context and close follow-ups when resolved.", action: "Add follow-up", empty: "No follow-ups yet. Add a member note to start." },
  plans: { title: "Your date planner", sub: "Keep your plans in one place. These notes are private to you; they don’t send an invitation or reminder.", action: "Save date plan", empty: "Something to look forward to. Add your first date plan." },
};
export default function WorkspaceFeatures({ kind, role = "user" }) {
  const text = copy[kind];
  const canCreate = kind !== "announcements" || role === "admin";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("open");
  const [form, setForm] = useState({ title: "", body: "", audience: "everyone", member: "", when: "" });
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState([]);
  const [memberError, setMemberError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setRows((await api.get(`/workspace/${kind}`)).data); }
    catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }, [kind]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (kind !== "announcements") return;
    let active = true, fetching = false, again = false;
    async function sync() {
      if (fetching) { again = true; return; }
      fetching = true;
      do {
        again = false;
        try {
          const response = await api.get("/workspace/announcements");
          if (active) { setRows(response.data); setError(""); }
        } catch (err) { if (active) setError(errorMessage(err)); }
      } while (active && again);
      fetching = false;
    }
    const unsubscribe = subscribeToNotices(sync);
    return () => { active = false; unsubscribe(); };
  }, [kind]);
  useEffect(() => {
    if (kind !== "notes") return;
    let active = true;
    const timer = setTimeout(() => {
      getAdminUsers({ q: search.trim(), role: "user", page: 1 }).then(data => {
        if (active) { setMembers(data.rows); setMemberError(""); }
      }).catch(err => { if (active) setMemberError(errorMessage(err)); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [kind, search]);
  const field = name => ({ value: form[name], onChange: event => setForm(old => ({ ...old, [name]: event.target.value })) });
  async function create(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = { title: form.title, body: form.body };
      if (kind === "announcements") payload.audience = form.audience;
      if (kind === "notes") payload.member = form.member;
      if (kind === "plans") payload.when = new Date(form.when).toISOString();
      const row = (await (editing ? api.patch(`/workspace/${editing}`, payload) : api.post(`/workspace/${kind}`, payload))).data;
      setRows(old => editing ? old.map(item => item.id === row.id ? row : item) : [row, ...old]);
      setEditing(null);
      setForm(old => ({ ...old, title: "", body: "", when: "" }));
      setFilter("open"); setNotice(kind === "announcements" ? "Notice published." : kind === "notes" ? "Follow-up saved for the team." : "Your date plan is saved.");
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  async function update(row, remove = false) {
    if (busy || (remove && !window.confirm(`Delete “${row.title}”?`))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (remove) { await api.delete(`/workspace/${row.id}`); setRows(old => old.filter(item => item.id !== row.id)); }
      else { const result = (await api.patch(`/workspace/${row.id}`, { done: !row.done })).data; setRows(old => old.map(item => item.id === row.id ? result : item)); }
      setNotice(remove ? "Entry deleted." : row.done ? "Reopened." : "Marked complete.");
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  const visible = rows.filter(row => kind === "announcements" || filter === "all" || (filter === "done" ? row.done : !row.done));
  if (kind === "plans") visible.sort((a, b) => new Date(a.when) - new Date(b.when));
  return <section className={`workspace-panel feature-board feature-board-${kind}`} id={kind === "plans" ? "date-planner" : kind === "announcements" ? "community-notices" : undefined} aria-label={text.title}>
    <header><p className="eyebrow">{kind === "plans" ? "MAKE TIME FOR CONNECTION" : "POSTDATE COMMUNITY"}</p><h2>{text.title}</h2><p className="muted">{text.sub}</p><button type="button" className="text-button" disabled={busy || loading} onClick={refresh}>Refresh</button></header>
    {kind === "notes" && <p className="followup-private"><span aria-hidden="true">◇</span><span><strong>For the team only</strong> Members cannot see these notes. Saving a follow-up does not send a message or notification.</span></p>}
    {canCreate && <form className="feature-form" onSubmit={create}>
      {kind === "notes" && <div className="feature-form-wide followup-form-heading"><h3>New follow-up</h3><p>Choose a member and leave the context your team needs.</p></div>}
      <label className={kind === "notes" ? "feature-form-wide" : undefined}>Title<input required maxLength={120} placeholder={kind === "plans" ? "Coffee and a walk" : kind === "notes" ? "e.g. Check that the login issue is resolved" : "Give this a clear title"} {...field("title")} /></label>
      {kind === "announcements" && <label>Audience<select {...field("audience")}><option value="everyone">Everyone</option><option value="members">Members only</option><option value="staff">Staff only</option></select></label>}
      {kind === "notes" && <><label>Find a member<input value={search} onChange={event => { setSearch(event.target.value); setForm(old => ({ ...old, member: "" })); }} placeholder="Search by name or email" /></label><label>Member<select required {...field("member")}><option value="">Choose a member</option>{members.map(member => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}</select></label>{memberError && <p role="alert">{memberError}</p>}</>}
      {kind === "plans" && <label>Date and time (your local time)<input type="datetime-local" required {...field("when")} /></label>}
      <label className="feature-form-wide">{kind === "plans" ? "Place and details" : kind === "notes" ? "Internal note" : "Message"}<textarea rows={3} maxLength={2000} placeholder={kind === "plans" ? "Where you’re meeting, and anything to remember" : kind === "notes" ? "What happened, what has been checked, and what needs to happen next" : "Add useful context"} {...field("body")} /></label>
      <button className="outline-button" disabled={busy || loading}>{busy ? "Saving…" : editing ? "Update date plan" : text.action}</button>
      {editing && <button type="button" className="text-button" disabled={busy} onClick={() => { setEditing(null); setForm(old => ({ ...old, title: "", body: "", when: "" })); }}>Cancel editing</button>}
    </form>}
    {error && <div role="alert" className="feature-feedback">{error} <button type="button" className="text-button" onClick={refresh} disabled={busy}>Reload entries</button></div>}
    {notice && <p role="status" className="feature-feedback">{notice}</p>}
    {kind !== "announcements" && <div className="feature-filters" aria-label="Filter entries">{[["open", "Open"], ["done", "Completed"], ["all", "All"]].map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>}
    {loading ? <p role="status">Loading…</p> : error && !rows.length ? null : !visible.length ? <p className="muted feature-empty">{rows.length ? "No entries in this view." : text.empty}</p> : <ul className="feature-entries">{visible.map(row => <li key={row.id} className={row.done ? "feature-entry-complete" : ""}>
      <div className="feature-entry-head"><h3>{row.title}</h3><small>{kind === "announcements" ? ({ everyone: "Everyone", members: "Members", staff: "Staff" }[row.audience]) : row.done ? "Completed" : "Open"}</small></div>
      {row.member && <p className="feature-meta">Member: {row.member.name}{row.author ? ` · Added by ${row.author}` : ""}</p>}
      {kind === "notes" && row.createdAt && <p className="followup-date">Added <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString()}</time></p>}
      {row.when && <p className="feature-meta"><time dateTime={row.when}>{new Date(row.when).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>{!row.done && new Date(row.when) < new Date() ? " · Past date" : ""}</p>}
      {row.body && <p className="feature-message">{row.body}</p>}
      {kind === "announcements" && <small className="muted">Published {new Date(row.createdAt).toLocaleDateString()}</small>}
      <div className="feature-actions">{kind !== "announcements" && <button className="text-button" disabled={busy || !!editing} onClick={() => update(row)}>{row.done ? "Reopen" : "Mark complete"}</button>}{kind === "plans" && <button className="text-button" disabled={busy || !!editing} onClick={() => {
        const local = new Date(row.when); local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
        setEditing(row.id); setForm(old => ({ ...old, title: row.title, body: row.body, when: local.toISOString().slice(0, 16) }));
        document.getElementById("date-planner")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }}>Edit</button>}{(kind === "plans" || (kind === "announcements" && role === "admin")) && <button className="text-button" disabled={busy || !!editing} onClick={() => update(row, true)}>Delete</button>}</div>
    </li>)}</ul>}
    <small className="muted">Showing up to {kind === "announcements" ? "50 recent notices" : "100 most recently added entries"}.</small>
  </section>;
}
