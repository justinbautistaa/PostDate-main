import { useEffect, useState } from "react";
import QRCode from "qrcode";
import api from "../../api";
import "./MfaForm.css";
export default function MfaForm({ pending, onComplete, onCancel }) {
  const [code, setCode] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [result, setResult] = useState(null);
  const [qrCode, setQrCode] = useState("");
  const [qrError, setQrError] = useState(false);
  useEffect(() => {
    let active = true;
    setQrCode("");
    setQrError(false);
    if (pending.mfaSetupRequired && pending.secret) {
      const uri = `otpauth://totp/PostDate?secret=${encodeURIComponent(pending.secret)}&issuer=PostDate&algorithm=SHA1&digits=6&period=30`;
      QRCode.toDataURL(uri, { width: 224, margin: 4, errorCorrectionLevel: "M" })
        .then(value => { if (active) setQrCode(value); })
        .catch(() => { if (active) setQrError(true); });
    }
    return () => { active = false; };
  }, [pending.mfaSetupRequired, pending.secret]);
  if (result) return <div className="mfa-form"><h3>Save your recovery codes</h3><p>Store these somewhere private. Each works once if you lose your authenticator. These codes are shown only now.</p><pre>{result.recoveryCodes.join("\n")}</pre><button type="button" className="public-primary" onClick={() => onComplete(result)}>I saved my codes — continue</button></div>;
  return <form className="mfa-form" onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    const cleanCode = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(cleanCode) && (pending.mfaSetupRequired || !/^[a-f\d]{24}$/i.test(cleanCode))) {
      setError(pending.mfaSetupRequired ? "Enter the six-digit PostDate code from your authenticator app, not the setup key." : "Enter a six-digit authenticator code or a full recovery code.");
      return;
    }
    setBusy(true); setError("");
    try { const { data } = await api.post("/auth/mfa/verify", { challenge: pending.challenge, code: cleanCode }); if (data.recoveryCodes) setResult(data); else onComplete(data); }
    catch (err) { setError(err?.response?.data?.message || "Authentication could not be completed. Please try again."); }
    finally { setBusy(false); }
  }}>
    <h3>{pending.mfaSetupRequired ? "Set up your authenticator" : "Verify it’s you"}</h3>
    {pending.mfaSetupRequired ? <>
      <ol className="mfa-setup-steps">
        <li>Open Google Authenticator on your phone.</li>
        <li>Tap <strong>+</strong>, choose <strong>Scan a QR code</strong>, and scan the code below.</li>
        <li>Enter the six-digit code shown beside <strong>PostDate</strong> in the app, then click Verify.</li>
      </ol>
      <p>Setup expires after five minutes. If you started again, scan this new QR code and use its PostDate entry in your app.</p>
      <div className="mfa-qr">
        {qrCode ? <img src={qrCode} width="224" height="224" alt="Scan with your authenticator app to set up PostDate" /> : <p role="status">{qrError ? "QR code could not load. Use the manual setup key below." : "Preparing your QR code…"}</p>}
      </div>
      <details className="mfa-manual"><summary>Can’t scan? Enter a setup key instead</summary>
        <p>On the same phone? In Google Authenticator, tap + → Enter a setup key. Set Account name to PostDate, paste the full key below into Your key, select Time-based, and tap Add.</p>
        <code className="mfa-secret">{pending.secret}</code>
      </details>
    </> : <p>Enter the six-digit code from your authenticator, or one unused recovery code.</p>}
    <label htmlFor="mfa-code">Authentication code</label><input id="mfa-code" autoComplete="one-time-code" autoFocus maxLength={32} value={code} onChange={event => setCode(event.target.value)} required />
    {error && <p role="alert">{error}</p>}
    <div className="mfa-actions"><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="public-primary" disabled={busy}>{busy ? "Verifying…" : "Verify"}</button></div>
  </form>;
}
