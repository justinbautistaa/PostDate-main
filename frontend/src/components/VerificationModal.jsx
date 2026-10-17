import { useCallback, useEffect, useRef, useState } from "react";
import { sendVerificationCode, verifyCode } from "../services/postdateApi";
import "./VerificationModal.css";

/**
 * VerificationModal
 * The "VERIFICATION / ENTER CODE" pop-up shown right after onboarding.
 * Pink shell with the Fraunces title, cream inner panel, a countdown for how
 * long the emailed code stays valid, a tan code field, and the pill button.
 *
 * Flow:
 *   1. Opens  -> asks the backend to email a code (sendVerificationCode)
 *   2. Timer  -> counts down from the `expiresIn` the backend returns
 *   3. Submit -> checks the code (verifyCode); success calls onVerified
 *   4. Timer hits 00:00 -> a "Send a new code" link appears
 *
 * Usage:
 *   <VerificationModal
 *     open={showVerify}
 *     onVerified={() => navigate("/profile")}
 *     onClose={() => setShowVerify(false)}   // optional — omit to make it mandatory
 *   />
 *
 * Props:
 *   open         show / hide the pop-up
 *   onVerified   called with the backend response once the code checks out
 *   onClose      optional. When given, Esc, the backdrop and the ✕ close it.
 *                When omitted the user has to verify to get past it.
 *   codeLength   digits in the code (default 6)
 *   sendOnOpen   set false if your signup route already emailed the code
 *                and you only want the modal to collect it (default true)
 *
 * 🔌 BACKEND: both calls live in services/postdateApi.js —
 *    sendVerificationCode()  POST /api/verify/send
 *    verifyCode(code)        POST /api/verify/confirm
 */
export default function VerificationModal({
  open,
  email,
  onVerified,
  onClose,
  codeLength = 6,
  sendOnOpen = true,
  successMessage,
}) {
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [verifiedResult, setVerifiedResult] = useState(null);
  const continueRef = useRef(null);
  const inputRef = useRef(null);
  const sentRef = useRef(false); // stops StrictMode's double-run from sending two emails
  const expiresAt = useRef(0);

  /* 🔌 BACKEND: ask for a fresh code. Used on open and by "Send a new code". */
  const requestCode = useCallback(async () => {
    setSending(true);
    setError("");
    setCode("");
    try {
      const res = await sendVerificationCode(email);
      setSecondsLeft(res?.expiresIn ?? 300); // 🎛️ fallback lifetime in seconds
      expiresAt.current = Date.now() + (res?.expiresIn ?? 300) * 1000;
      setResendAt(Date.now() + 60000);
      inputRef.current?.focus();
    } catch (err) {
      setError(
        err?.response?.data?.message ??
          "We could not send a code. Wait a moment and try again."
      );
    } finally {
      setSending(false);
    }
  }, [email]);

  /* Send once each time the pop-up opens. */
  useEffect(() => {
    if (!open) {
      sentRef.current = false;
      setCode("");
      setError("");
      setVerifiedResult(null);
      setSecondsLeft(0);
      expiresAt.current = 0;
      setResendAt(0);
      return;
    }
    if (sendOnOpen && !sentRef.current) {
      sentRef.current = true;
      requestCode();
    }
  }, [open, sendOnOpen, requestCode]);

  /* Countdown. Ticks once a second until it reaches zero. */
  useEffect(() => {
    if (!open || verifiedResult || secondsLeft <= 0) return;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((expiresAt.current - Date.now()) / 1000)));
    const id = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", update); };
  }, [open, secondsLeft > 0, verifiedResult]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (verifiedResult) continueRef.current?.focus();
  }, [verifiedResult]);

  /* Esc closes (only if closable), background scroll locks, field gets focus. */
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const expired = secondsLeft === 0 && !sending;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  async function handleSubmit(e) {
    e.preventDefault();
    if (checking || sending || verifiedResult) return;

    if (code.length < codeLength) {
      setError(`Enter the ${codeLength}-digit code from your email.`);
      return;
    }
    if (expired || Date.now() >= expiresAt.current) {
      setError("That code has expired. Send a new one to continue.");
      return;
    }

    setChecking(true);
    setError("");
    try {
      /* 🔌 BACKEND: POST /api/verify/confirm — see services/postdateApi.js */
      const res = await verifyCode(code, email);
      if (res?.verified) {
        if (successMessage) setVerifiedResult(res);
        else onVerified?.(res);
      } else {
        setError("That code does not match. Check your email and try again.");
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ??
          "We could not check that code. Try again in a moment."
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div
      className="vmodal-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <style>{`
        .vmodal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: center;
          padding: 20px;
          overflow-y: auto;

          background: rgba(43, 35, 32, 0.45);
          backdrop-filter: blur(5px);
        }

        .vmodal {
          position: relative;
          width: min(100%, 770px);         /* 🎛️ pop-up width (Figma: 770) */

          background: var(--pd-pink);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 30px 60px -24px rgba(43, 35, 32, 0.55);
        }

        /* ── title band ────────────────────────────────────────────────── */
        .vmodal-head {
          padding: clamp(14px, 3vw, 32px) 16px clamp(14px, 3.4vw, 34px);
          border-bottom: 1px solid var(--pd-white);   /* Figma "Line 80" */
          text-align: center;
        }
        .vmodal-title {
          margin: 0;
          font-family: var(--pd-display);
          font-weight: 700;
          font-size: clamp(30px, 10vw, 96px);   /* 🎛️ VERIFICATION size */
          line-height: 1.1;
          text-transform: uppercase;
          color: var(--pd-maroon);
        }

        .vmodal-close {
          position: absolute;
          top: 10px;
          right: 14px;
          background: none;
          border: none;
          font-size: 22px;
          line-height: 1;
          color: var(--pd-maroon);
          opacity: 0.7;
          cursor: pointer;
        }
        .vmodal-close:hover { opacity: 1; }

        /* ── cream panel ───────────────────────────────────────────────── */
        .vmodal-body {
          margin: clamp(12px, 2.4vw, 36px) clamp(12px, 3.6vw, 50px) clamp(12px, 3.6vw, 50px);
          background: var(--pd-cream);
          border-radius: 25px;
          padding: clamp(24px, 5vw, 60px) clamp(16px, 4vw, 50px) clamp(24px, 4.5vw, 56px);

          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .vmodal-heading {
          margin: 0;
          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(30px, 8.3vw, 64px);   /* 🎛️ ENTER CODE size */
          line-height: 1.1;
          text-transform: uppercase;
          color: var(--pd-ink);
        }

        .vmodal-sub {
          margin: clamp(8px, 1.6vw, 16px) 0 0;
          max-width: 415px;
          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(12px, 2.2vw, 16px);   /* 🎛️ blurb size */
          line-height: 1.5;
          color: var(--pd-salmon);
        }

        .vmodal-timer {
          margin: clamp(6px, 1.2vw, 12px) 0 0;
          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(26px, 5vw, 36px);     /* 🎛️ timer size */
          line-height: 1.3;
          font-variant-numeric: tabular-nums;
          color: var(--pd-maroon);
        }

        .vmodal-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(14px, 2.4vw, 24px);
          margin-top: clamp(16px, 3.4vw, 34px);
        }

        .vmodal-input {
          width: min(100%, 500px);               /* 🎛️ field width (Figma: 500) */
          height: clamp(48px, 7.8vw, 60px);
          border: 2px solid transparent;
          border-radius: 5px;
          background: var(--pd-tan);

          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(20px, 4vw, 30px);
          letter-spacing: 0.45em;
          text-align: center;
          text-indent: 0.45em;   /* balances the trailing letter-space so digits sit centred */
          color: var(--pd-ink);
        }
        .vmodal-input::placeholder { color: var(--pd-pink); }
        .vmodal-input:focus-visible { outline: none; border-color: var(--pd-maroon); }
        .vmodal-input-bad { border-color: var(--pd-maroon); }

        .vmodal-error {
          margin: 0;
          min-height: 1.5em;
          font-family: var(--pd-mono);
          font-size: clamp(11px, 2vw, 14px);
          line-height: 1.5;
          color: var(--pd-maroon);
        }

        /* the pill button from the Figma (Rectangle 296) */
        .vmodal-submit {
          background: var(--pd-cream);
          border: 6px solid var(--pd-maroon);
          border-radius: 30px;
          box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
          padding: clamp(6px, 1.2vw, 10px) clamp(18px, 4vw, 30px);
          cursor: pointer;

          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(16px, 4.6vw, 40px);   /* 🎛️ button text size */
          line-height: 1.3;
          text-transform: uppercase;
          white-space: nowrap;
          color: var(--pd-ink);
          transition: transform 0.15s ease;
        }
        .vmodal-submit:hover { transform: translateY(-2px); }
        .vmodal-submit:disabled { opacity: 0.6; cursor: default; transform: none; }

        .vmodal-resend {
          background: none;
          border: none;
          padding: 0;
          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(11px, 2vw, 14px);
          color: var(--pd-maroon);
          text-decoration: underline;
          cursor: pointer;
        }
        .vmodal-resend:disabled { opacity: 0.5; cursor: default; }

        @media (prefers-reduced-motion: no-preference) {
          .vmodal { animation: vmodal-in 0.22s ease-out; }
          @keyframes vmodal-in {
            from { opacity: 0; transform: translateY(10px) scale(0.98); }
            to   { opacity: 1; transform: none; }
          }
        }
      `}</style>

      <div
        className="vmodal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vmodal-title"
      >
        {onClose && (
          <button
            type="button"
            className="vmodal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        )}

        <div className="vmodal-head">
          <h1 className="vmodal-title" id="vmodal-title">
            {verifiedResult ? "Welcome to PostDate!" : "Verify your email"}
          </h1>
        </div>

        <div className="vmodal-body">
          {verifiedResult ? <div className="vmodal-success" role="status">
            <span className="vmodal-success-mark" aria-hidden="true">✓</span>
            <h2>{successMessage}</h2>
            <p>Your email is verified. You can now log in and start meeting people.</p>
            <button ref={continueRef} type="button" className="vmodal-submit" onClick={() => onVerified?.(verifiedResult)}>Continue to login</button>
          </div> : <>
          <h2 className="vmodal-heading">Enter code</h2>

          <p className="vmodal-sub">
            {sending ? "Sending a verification code…" : "Enter the code sent to"}
            {!sending && <strong className="vmodal-email">{email || "your registered email"}</strong>}
          </p>

          <p
            className="vmodal-timer"
            role="timer"
            aria-label={`Code expires in ${mm} minutes ${ss} seconds`}
          >
            {mm}:{ss}
          </p>

          <form className="vmodal-form" onSubmit={handleSubmit} noValidate>
            <input
              ref={inputRef}
              className={`vmodal-input${error ? " vmodal-input-bad" : ""}`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={codeLength}
              placeholder={"•".repeat(codeLength)}
              aria-label="Verification code"
              aria-invalid={Boolean(error)}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, codeLength));
                if (error) setError("");
              }}
            />

            <p className="vmodal-error" role="alert" aria-live="polite">
              {error}
            </p>

            <button type="submit" className="vmodal-submit" disabled={checking || sending}>
              {checking ? "Verifying…" : "Verify email"}
            </button>

            {(expired || Date.now() >= resendAt) && (
              <button
                type="button"
                className="vmodal-resend"
                onClick={requestCode}
                disabled={sending || checking}
              >
                {sending ? "Sending…" : "Send a new code"}
              </button>
            )}
          </form>
          </>}
        </div>
      </div>
    </div>
  );
}
