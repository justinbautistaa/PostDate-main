import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { clearToken, getRole } from "../../auth";
export default function DeleteAccount() {
  const [open, setOpen] = useState(false), [password, setPassword] = useState(""), [code, setCode] = useState(""), [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState(false);
  if (done) return <section><h3>Your account is closed.</h3><p>Your sessions have been revoked. Permanent cleanup will run automatically and retry if storage is unavailable. Moderation records and historical backups may be retained as described in the privacy notice.</p><Link to="/login">Return to login →</Link></section>;
  if (getRole() !== "user") return <section><h3>Account removal</h3><p>Staff account removal is handled by the administration team so responsibilities can be transferred safely.</p></section>;
  return <section className="account-delete"><h3>Delete my account</h3><p>This permanently removes your account, profile, photos, private plans and messages you sent. It ends your matches. Moderation records, other people’s messages and historical backups may remain. This cannot be undone.</p>{!open ? <button type="button" className="outline-button" onClick={() => setOpen(true)}>Delete my account</button> : <form onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { await api.post("/privacy/delete-account", { password, code: code.trim(), confirmation }); clearToken(); setPassword(""); setCode(""); setDone(true); }
    catch (err) { setError(err?.response?.data?.message || "Your deletion request could not be confirmed. Please try again."); }
    finally { setBusy(false); }
  }}><label>Current password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label><label>Authenticator or recovery code (if MFA is enabled)<input autoComplete="one-time-code" maxLength={24} value={code} onChange={event => setCode(event.target.value)} /></label><label>Type DELETE to confirm<input required pattern="DELETE" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<div className="mfa-actions"><button type="button" disabled={busy} onClick={() => { setOpen(false); setPassword(""); setCode(""); setConfirmation(""); }}>Keep my account</button><button type="submit" className="outline-button" disabled={busy || confirmation !== "DELETE"}>{busy ? "Closing account…" : "Permanently delete account"}</button></div></form>}</section>;
}
