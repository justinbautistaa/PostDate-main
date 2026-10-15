import { useEffect, useRef, useState } from "react";
import { getMatchedProfile } from "../services/chatApi";
import { toPhotoUrl } from "../services/postdateApi";
import ReportForm from "./ReportForm";
import "./MatchedProfile.css";
export default function MatchedProfile({ matchId, onClose, onRate, onDisconnect, reviewed = false, ratingReady = true }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const actionPending = useRef(false);
  const dialog = useRef(null);
  useEffect(() => {
    let active = true;
    setError(""); setProfile(null);
    getMatchedProfile(matchId).then(data => { if (active) setProfile(data); })
      .catch(() => { if (active) setError("This profile couldn’t load. It may be unavailable, or your connection was interrupted."); });
    return () => { active = false; };
  }, [matchId, retry]);
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector("button")?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  function keyDown(event) {
    if (event.key === "Escape" && !reporting && !actionPending.current) { event.stopPropagation(); onClose(); }
    if (event.key !== "Tab" || reporting) return;
    const items = [...dialog.current.querySelectorAll("button:not(:disabled), a[href]")];
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <div className="matched-profile-backdrop"><section ref={dialog} onKeyDown={keyDown} className="matched-profile" role="dialog" aria-modal="true" aria-labelledby="matched-profile-title">
    <header><span>Your match’s profile</span><button type="button" disabled={busy} onClick={onClose} aria-label="Close profile">×</button></header>
    <div className="matched-profile-intro"><span className="matched-profile-eyebrow">A LITTLE MORE ABOUT YOUR MATCH</span>
    <h2 id="matched-profile-title">{profile?.name || "View profile"}{Number.isFinite(profile?.age) ? `, ${profile.age}` : ""}</h2>
    {profile?.gender && <p className="matched-profile-gender">{profile.gender.replaceAll("-", " ")}</p>}</div>
    <div className="matched-profile-content">
    {!profile && !error && <p role="status">Loading profile…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(v => v + 1)}>Try again</button></div>}
    {profile && <>
      <div className="matched-profile-layout"><div className="matched-profile-photos">{[...new Set([profile.avatarPath, ...(profile.photoPaths || [])].filter(Boolean))].map((photo, i) => <img key={photo} src={toPhotoUrl(photo)} alt={`${profile.name} — photo ${i + 1}`} />)}{!profile.avatarPath && !profile.photoPaths?.length && <div className="matched-profile-photo-empty"><span aria-hidden="true">♡</span><p>No photos shared yet.</p></div>}</div>
      <div className="matched-profile-details">
      <h3>About {profile.name}</h3><p className="matched-profile-bio">{profile.bio || "No bio shared yet."}</p>
      <h3>Interests</h3><div className="matched-profile-tags">{profile.tags?.length ? profile.tags.map(tag => <span key={tag}>{tag}</span>) : <p>No interests shared yet.</p>}</div>
      <h3>Looking for</h3><div className="matched-profile-tags">{profile.lookingFor?.length ? profile.lookingFor.map(tag => <span key={tag}>{tag}</span>) : <p>Not shared yet.</p>}</div>
      </div></div>
      {onRate && <div className="matched-profile-rating"><h3>Your experience</h3><p>Chatted or been on a date? Share your experience with {profile.name}.</p><button type="button" disabled={reviewed || !ratingReady} onClick={onRate}>{reviewed ? "Rated ✓" : "Rate your experience"}</button></div>}
      <footer className="matched-profile-footer"><span>Your comfort comes first.</span><button type="button" className="report-link" onClick={() => setReporting(true)}>Report this profile</button></footer>
      {onDisconnect && <div className="matched-profile-boundaries">
        {!action ? <><button type="button" onClick={() => setAction("unmatch")}>Unmatch</button><button type="button" onClick={() => setAction("block")}>Block person</button></> : <><h3>{action === "block" ? "Block this person?" : "End this match?"}</h3><p>This removes the conversation for both of you and stops further messages. You won’t appear in each other’s discovery results. This cannot be undone here.</p><button type="button" disabled={busy} onClick={() => { setAction(null); setActionError(""); }}>Keep match</button><button type="button" disabled={busy} onClick={async () => {
          if (actionPending.current) return;
          actionPending.current = true; setBusy(true); setActionError("");
          try { await onDisconnect(action); } catch (err) { setActionError(err?.response?.data?.message || "Could not update this match. Please try again."); }
          finally { actionPending.current = false; setBusy(false); }
        }}>{busy ? "Saving…" : action === "block" ? "Confirm block" : "Confirm unmatch"}</button>{actionError && <p role="alert">{actionError}</p>}</>}
      </div>}
    </>}
    </div>
    {reporting && profile && <ReportForm targetType="user" targetId={profile.id} name={profile.name} onClose={() => setReporting(false)} />}
  </section></div>;
}
