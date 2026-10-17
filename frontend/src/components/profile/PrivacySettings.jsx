import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
export default function PrivacySettings() {
  const [visible, setVisible] = useState(null), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [acknowledged, setAcknowledged] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoadError("");
    api.get("/privacy/settings").then(({ data }) => {
      if (!active) return;
      setVisible(data.discoverable);
      setAcknowledged(Boolean(data.consentAt && data.policyVersion === "2026-10-16"));
    }).catch(() => { if (active) setLoadError("Privacy settings couldn’t load. Please try again."); });
    return () => { active = false; };
  }, [retry]);
  async function run(action, failure) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch { setError(failure); } finally { setBusy(false); }
  }
  return <section><h3>Your privacy choices</h3>
    <p>Hide your profile from new discovery without ending existing matches. Existing matches can still view your profile. Read the <Link to="/privacy">privacy notice</Link> for details.</p>
    {visible === null && !loadError && <p role="status">Loading privacy settings…</p>}
    {loadError && <p role="alert">{loadError}<button type="button" className="outline-button" onClick={() => setRetry(value => value + 1)}>Retry privacy settings</button></p>}
    {error && <p role="alert">{error}</p>}
    {visible !== null && <label><input type="checkbox" checked={visible} disabled={busy} onChange={event => {
      const next = event.target.checked;
      run(async () => { await api.put("/privacy/settings", { discoverable: next }); setVisible(next); setMessage(next ? "Your profile appears in discovery." : "Your profile is hidden from new discovery."); }, "Privacy settings could not be saved. Your previous choice is unchanged.");
    }} /> Show my profile in discovery</label>}
    <button type="button" className="outline-button" disabled={busy} onClick={() => run(async () => {
      const { data } = await api.get("/privacy/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "postdate-my-data.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Your data export is ready. It includes up to 500 recent entries per interaction category.");
    }, "Your export could not be prepared. Please try again.")}>Download my data</button>
    {!acknowledged && <p><button type="button" className="outline-button" disabled={busy} onClick={() => run(async () => {
      await api.post("/privacy/acknowledge", { consent: true }); setAcknowledged(true); setMessage("Privacy notice acknowledged.");
    }, "Your acknowledgment could not be saved. Please try again.")}>I have read the privacy notice</button></p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
