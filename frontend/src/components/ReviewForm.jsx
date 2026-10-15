import { useEffect, useRef, useState } from "react";
import api from "../api";
import "./ReviewForm.css";
const FIELDS = [["overall", "Overall"], ["spice", "Spark"], ["attentiveness", "Attentiveness"], ["respectfulness", "Respectfulness"], ["chemistry", "Chemistry"]];
export default function ReviewForm({ match, onClose, onSaved }) {
  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const pending = useRef(false);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("select")?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  function onKeyDown(event) {
    if (event.key === "Escape" && !pending.current) onClose?.();
    if (event.key !== "Tab") return;
    const items = [...dialogRef.current.querySelectorAll("select, textarea, input, button:not(:disabled)")];
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    if (FIELDS.some(([key]) => !ratings[key])) { setError("Choose a score for each category."); return; }
    pending.current = true; setBusy(true); setError("");
    try { await api.post("/reviews", { matchId: match.id, ratings, comment, isPublic }); onSaved(); }
    catch (err) { setError(err?.response?.data?.message || "Your review could not be saved. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="review-backdrop"><form ref={dialogRef} onKeyDown={onKeyDown} className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title" onSubmit={submit}>
    <div className="review-close-bar"><span>Your review</span><button type="button" className="review-close" aria-label="Close review" disabled={busy} onClick={onClose}>×</button></div>
    <div className="review-scroll"><div className="review-intro"><span className="review-eyebrow">A NOTE ABOUT YOUR CONNECTION</span><h2 id="review-title">Your experience with {match.partner?.name}</h2>
    <p>Share thoughtful feedback about your interaction. One review per match.</p>
    </div><div className="review-body"><div className="review-scores">{FIELDS.map(([key, label]) => <label key={key}>{label}<select required value={ratings[key] || ""} onChange={e => setRatings(prev => ({ ...prev, [key]: Number(e.target.value) }))}><option value="">Choose a score</option>{[1,2,3,4,5].map(n => <option value={n} key={n}>{n} / 5</option>)}</select></label>)}</div>
    <label>Your review<textarea maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="What stood out about your conversation or date?" /></label>
    <label className="review-public"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />Show on their profile</label>
    <small>Private feedback is visible to the moderation team. Reviews cannot be edited after submission.</small>
    {error && <p role="alert">{error}</p>}
    </div></div>
    <div className="review-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button disabled={busy}>{busy ? "Saving…" : "Submit review"}</button></div>
  </form></div>;
}
