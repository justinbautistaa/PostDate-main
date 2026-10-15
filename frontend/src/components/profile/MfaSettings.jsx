import { useEffect, useState } from "react";
import api from "../../api";
import MfaForm from "../auth/MfaForm";
export default function MfaSettings() {
  const [status, setStatus] = useState(null), [pending, setPending] = useState(null), [password, setPassword] = useState(""), [code, setCode] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/auth/mfa/status").then(({data}) => setStatus(data)).catch(() => setMessage("MFA settings couldn’t load. Reopen Settings to try again.")); }, []);
  return <section><h3>Authenticator security</h3>{pending ? <MfaForm pending={pending} onCancel={() => setPending(null)} onComplete={() => { setPending(null); setStatus({ ...status, enabled: true }); setMessage("Authenticator MFA is enabled. Other sessions were signed out."); }} /> : <><p>{status?.enabled ? "Authenticator MFA is enabled for your account." : "Protect your account with a password and a code from your authenticator app."}</p>{status && !(status.enabled && status.required) && <form onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try { if (!status.enabled) setPending((await api.post("/auth/mfa/enroll", { password })).data); else { await api.post("/auth/mfa/disable", { password, code }); setStatus({ ...status, enabled: false }); setMessage("MFA disabled. Other sessions were signed out."); } setPassword(""); setCode(""); }
    catch (err) { setMessage(err?.response?.data?.message || "MFA settings could not be changed."); } finally { setBusy(false); }
  }}><label>Current password<input type="password" autoComplete="current-password" maxLength={72} value={password} onChange={event => setPassword(event.target.value)} required /></label>{status.enabled && <label>Authenticator or recovery code<input autoComplete="one-time-code" maxLength={24} value={code} onChange={event => setCode(event.target.value)} required /></label>}<button className="outline-button" disabled={busy}>{busy ? "Updating…" : status.enabled ? "Disable MFA" : "Set up MFA"}</button></form>}</>}{message && <p role="status">{message}</p>}</section>;
}
