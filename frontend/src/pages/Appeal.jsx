import PasswordInput from "../components/PasswordInput";
import { useState } from "react";
import { Link } from "react-router-dom";
import SiteNav from "../components/SiteNav";
import api from "../api";
import "./PublicPages.css";
import "../components/Safety.css";
export default function Appeal() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try { await api.post("/appeals", { email: email.trim(), password, message }); setPassword(""); setSent(true); }
    catch (err) { setError(err?.response?.data?.message || "Your appeal could not be sent. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="appeal-page public-page"><SiteNav /><main className="safety-card">
    <h1>{sent ? "Appeal submitted" : "Request an account review"}</h1>
    {sent ? <><p role="status">Your appeal was sent to the admin and staff team. They will review your explanation. Submitting an appeal does not immediately restore access.</p><Link to="/login">Return to login</Link></> : <>
      <p>If your account is suspended, explain what happened and ask the team to reconsider. You can submit this form without logging in.</p>
      <form onSubmit={submit}>
        <label>Registered email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Account password<PasswordInput required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Your explanation<textarea required minLength={10} maxLength={1000} rows={5} value={message} onChange={e => setMessage(e.target.value)} /></label>
        <small>10–1,000 characters. One pending appeal per account. Your password confirms account ownership and is not included in the appeal.</small>
        {error && <p role="alert">{error}</p>}
        <div className="safety-actions"><Link to="/login">Back to login</Link><button disabled={busy}>{busy ? "Sending…" : "Submit appeal"}</button></div>
      </form></>}
  </main></div>;
}
