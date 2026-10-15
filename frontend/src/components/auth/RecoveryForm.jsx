import { useEffect, useState } from "react";
import useAuthAction from "./useAuthAction";

/**
 * RecoveryForm
 * View 2 of the log-in page (Figma "RECOVERY"): the person has been emailed
 * a code and types it in here. Lives inside <AuthPanel>.
 *
 * The maroon "00:00" is a live countdown to the moment the code stops
 * working. When it reaches 00:00 the box locks and a "send a new one" link
 * appears on the small line under the button (the Figma doesn't draw that
 * state, so it reuses the same small maroon text).
 *
 * The page passes in:
 *   expiresAt         when the code stops working, as a timestamp in ms
 *                     (Date.now() + expiresInSeconds * 1000)
 *   onVerify(code)    Promise — check the code, then move on to the next view
 *   onResend()        Promise — email a new code and hand back a new expiresAt
 *
 * Usage:
 *   <RecoveryForm expiresAt={expiresAt} onVerify={...} onResend={...} />
 */

/* 75 → "01:15" */
function formatClock(totalSeconds) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/* whole seconds left until `expiresAt`, ticking 4x a second so it never drifts */
function useSecondsLeft(expiresAt) {
  const remaining = () => Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(remaining);

  useEffect(() => {
    setSeconds(remaining());
    const id = setInterval(() => setSeconds(remaining()), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  return seconds;
}

export default function RecoveryForm({ email, expiresAt, resendAt = 0, onVerify, onResend, onBack }) {
  const [code, setCode] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [localError, setLocalError] = useState("");
  /* checking the code and asking for a new one each keep their own busy/error,
     so a wrong guess from earlier never gets mistaken for a failed resend */
  const verify = useAuthAction();
  const resend = useAuthAction();
  const busy = verify.busy || resend.busy;

  const secondsLeft = useSecondsLeft(expiresAt);
  const expired = secondsLeft === 0;
  const resendSeconds = useSecondsLeft(resendAt);

  function handleChange(e) {
    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
    setFlagged(false);
    setLocalError("");
    verify.setError("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (expired || busy) return;
    if (!/^\d{6}$/.test(code)) {
      setFlagged(true);
      setLocalError("Enter the six-digit code from your email.");
      return;
    }
    verify.run(() => onVerify(code), err => err.response?.status === 429
      ? "Too many attempts. Please wait and request a new code."
      : "Invalid or expired code. Check your email or request a new code.");
  }

  function handleResend() {
    if (busy || resendSeconds > 0) return;
    setCode("");
    setFlagged(false);
    setLocalError("");
    verify.setError("");
    resend.run(() => onResend(), "Couldn't send a new code");
  }

  const problem = localError || verify.error;

  return (
    <form className="rf" onSubmit={handleSubmit} noValidate>
      <style>{`
        /* Figma coordinates, measured from the panel's top-left corner */
        .rf-heading, .rf-blurb, .rf-timer, .rf-status {
          position: absolute;
          left: 0;
          width: 100%;
          margin: 0;
          text-align: center;
          text-transform: uppercase;
        }

        /* "ENTER CODE" — Space Mono 700 64px, ink */
        .rf-heading {
          top: calc(222.7 * var(--u));
          font-weight: 700;
          font-size: calc(64 * var(--u));   /* 🎛️ "enter code" size */
          line-height: calc(95 * var(--u));
          color: var(--pd-ink);
        }

        /* the two-line explanation — Space Mono 700 16px, salmon */
        .rf-blurb {
          top: calc(317.9 * var(--u));
          font-weight: 700;
          font-size: calc(16 * var(--u));
          line-height: calc(24 * var(--u));
          color: var(--pd-salmon);
        }

        /* "00:00" — Space Mono 700 36px, maroon */
        .rf-timer {
          top: calc(368.3 * var(--u));
          font-weight: 700;
          font-size: calc(36 * var(--u));   /* 🎛️ countdown size */
          line-height: calc(53 * var(--u));
          color: var(--pd-maroon);
        }

        .rf-code {
          top: calc(426 * var(--u));
          left: calc(135 * var(--u));
          width: calc(500 * var(--u));
          text-align: center;
          letter-spacing: 0.18em;
        }
        .rf-code:disabled { opacity: 0.55; }

        .rf-pill { top: calc(519 * var(--u)); }

        /* the line under the pill: errors, or "code expired · send a new one" */
        .rf-status {
          top: calc(601 * var(--u));
          font-weight: 700;
          font-size: calc(16 * var(--u));
          line-height: calc(24 * var(--u));
          color: var(--pd-maroon);
        }
      `}</style>

      <h2 className="rf-heading">Enter code</h2>

      <p className="rf-blurb">If an account exists for <strong>{email || "this email"}</strong>, a six-digit code will be emailed to it. Check your inbox and spam folder.</p>

      <p className="rf-timer" role="timer" aria-label="Time left to use this code">
        {formatClock(secondsLeft)}
      </p>

      <label className="visually-hidden" htmlFor="auth-code">
        Recovery code
      </label>
      <input
        id="auth-code"
        className="auth-input rf-code"
        type="text"
        inputMode="numeric"
        maxLength={6}
        pattern="[0-9]{6}"
        autoComplete="one-time-code"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus
        value={code}
        onChange={handleChange}
        disabled={expired || busy}
        aria-invalid={flagged}
      />

      <button type="submit" className="auth-pill rf-pill" disabled={busy || expired}>
        {verify.busy ? "Checking…" : "Verify code"}
      </button>

      {(problem || resend.error) && <p className="rf-status" role="alert">{problem || resend.error}</p>}
      {expired && <p className="rf-status" role="status">This code has expired. Request a new one below.</p>}
      <div className="recovery-actions"><button type="button" className="auth-link" onClick={handleResend} disabled={busy || resendSeconds > 0}>{resend.busy ? "Requesting…" : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Send a new code"}</button>{onBack && <button type="button" className="auth-link" disabled={busy} onClick={onBack}>Back to login</button>}</div>
    </form>
  );
}
