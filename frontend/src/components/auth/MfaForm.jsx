import { useState } from "react";
import api from "../../api";
export default function MfaForm({ pending, onComplete, onCancel }) {
  const [code, setCode] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [result, setResult] = useState(null);
  if (result) return <div className="mfa-form"><h3>Save your recovery codes</h3><p>Store these somewhere private. Each works once if you lose your authenticator. These codes are shown only now.</p><pre>{result.recoveryCodes.join("\n")}</pre><button type="button" className="public-primary" onClick={() => onComplete(result)}>I saved my codes — continue</button></div>;
  return <form className="mfa-form" onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { const { data } = await api.post("/auth/mfa/verify", { challenge: pending.challenge, code: code.trim() }); if (data.recoveryCodes) setResult(data); else onComplete(data); }
    catch (err) { setError(err?.response?.data?.message || "Authentication could not be completed. Please try again."); }
    finally { setBusy(false); }
  }}>
    <h3>{pending.mfaSetupRequired ? "Set up your authenticator" : "Verify it’s you"}</h3>
    {pending.mfaSetupRequired ? <><p>In your authenticator app, add a time-based account named PostDate and enter this setup key. Then enter its six-digit code below.</p><code className="mfa-secret">{pending.secret}</code></> : <p>Enter the six-digit code from your authenticator, or one unused recovery code.</p>}
    <label htmlFor="mfa-code">Authentication code</label><input id="mfa-code" autoComplete="one-time-code" autoFocus maxLength={24} value={code} onChange={event => setCode(event.target.value)} required />
    {error && <p role="alert">{error}</p>}
    <div className="mfa-actions"><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="public-primary" disabled={busy}>{busy ? "Verifying…" : "Verify"}</button></div>
  </form>;
}
