import { useEffect, useRef, useState } from "react";
import api from "../api";
import "./Safety.css";
const REASONS = ["Fake profile", "Harassment", "Inappropriate photos", "Spam or scam", "Underage", "Threats or violence", "Other"];
export default function ReportForm({ targetType, targetId, name, onClose }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const dialogRef = useRef(null);
  const pending = useRef(false);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("select")?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  useEffect(() => { if (sent) dialogRef.current?.querySelector("button")?.focus(); }, [sent]);
  function onKeyDown(event) {
    if (event.key === "Escape") { event.stopPropagation(); if (!pending.current) onClose?.(); }
    if (event.key !== "Tab") return;
    const items = [...dialogRef.current.querySelectorAll("*")].filter(element => ["SELECT", "TEXTAREA", "BUTTON"].includes(element.tagName) && !element.disabled);
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  async function submit(event) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await api.post("/reports", { targetType, targetId, reason, description }); setSent(true); }
    catch (err) { setError(err?.response?.data?.message || "Your report could not be sent. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="safety-backdrop"><section ref={dialogRef} onKeyDown={onKeyDown} className="safety-card" role="dialog" aria-modal="true" aria-labelledby="report-title">
    <h2 id="report-title">{sent ? "Report submitted" : `Report ${name || (targetType === "message" ? "this message" : "this profile")}`}</h2>
    {sent ? <><p role="status">Your report was sent to the admin and staff team for review. Thank you for helping keep the community safe.</p><p>You can track its status in My reports in the member menu.</p><button onClick={onClose}>Done</button></> : <form onSubmit={submit}>
      <p>Choose a reason and share any details that will help the team investigate.</p>
      <label>Reason<select required disabled={busy} value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose a reason</option>{REASONS.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Details (optional)<textarea disabled={busy} maxLength={2000} rows={4} value={description} onChange={e => setDescription(e.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="safety-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button disabled={busy}>{busy ? "Sending…" : "Submit report"}</button></div>
    </form>}
  </section></div>;
}
