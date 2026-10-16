import PasswordInput from "../PasswordInput";
import { useState } from "react";
import { Link } from "react-router-dom";
import useAuthAction from "./useAuthAction";

/**
 * LoginForm
 * View 1 of the log-in page (Figma "LOG-IN"): email, password, the small
 * "Forgot password?" link and the LOG-IN pill. Lives inside <AuthPanel>.
 *
 * This component only checks the boxes and shows messages. What actually
 * happens is up to the page, which passes in two functions that return a
 * Promise (see pages/Login.jsx):
 *
 *   onSubmit({ email, password })   log the person in
 *   onForgot(email)                 send a recovery code to that email
 *
 * If a Promise rejects, this form shows the error line under the password
 * box: "server said no" and "server not reachable" get different messages,
 * and a server-said-no on log-in gets a further split — a 403 (registered
 * but never verified their email) reads differently from anything else.
 *
 * "Forgot password?" reuses the email already typed above it, because the
 * Figma has no separate "what's your email?" step.
 *
 * Usage:
 *   <LoginForm defaultEmail="" notice="" onSubmit={...} onForgot={...} />
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm({ defaultEmail = "", notice = "", onSubmit, onForgot }) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [flagged, setFlagged] = useState({ email: false, password: false });
  const [localError, setLocalError] = useState("");
  const { busy, error, setError, run } = useAuthAction();

  /* typing clears whatever complaint was showing */
  const edit = (setValue, field) => (e) => {
    setValue(e.target.value);
    setFlagged((prev) => ({ ...prev, [field]: false }));
    setLocalError("");
    setError("");
  };

  const emailOk = () => EMAIL_PATTERN.test(email.trim());

  function handleSubmit(e) {
    e.preventDefault();
    const missing = { email: !emailOk(), password: password.length === 0 };
    setFlagged(missing);
    if (missing.email || missing.password) {
      setLocalError("Fill in both fields");
      return;
    }
    run(
      () => onSubmit({ email: email.trim(), password }),
      /* A 403 means the account exists but hasn't verified its email yet
         (see loginUser in postdateApi.js). Everything else — wrong password,
         or no such account — reads the same, so the message still can't be
         used to find out which emails have accounts. */
      (err) => err?.response?.status === 503 ? "Login security is temporarily unavailable. Contact the site administrator."
        : err?.response?.status === 429 ? "Too many login attempts. Please wait before trying again."
        : err?.response?.data?.message === "This account has been deactivated"
        ? "This account has been deactivated. Contact the community team."
        : err?.response?.status === 403 ? "Verify your email before logging in" : "Wrong email or password"
    );
  }

  function handleForgot() {
    if (!emailOk()) {
      setFlagged({ email: true, password: false });
      setLocalError("Enter your email first");
      return;
    }
    run(() => onForgot(email.trim()), err => err.response?.status === 503
      ? "Email recovery is unavailable. Contact the site administrator."
      : err.response?.status === 429 ? "Too many requests. Please wait before trying again."
      : "Couldn't request a code. Try again.");
  }

  /* one line for everything: our own complaints, the server's, or a notice */
  const problem = localError || error;
  const message = problem || notice;

  return (
    <form className="lf" onSubmit={handleSubmit} noValidate>
      <style>{`
        /* Figma coordinates, measured from the panel's top-left corner */
        .lf-email-label    { top: calc(186.6 * var(--u)); }
        .lf-email          { top: calc(262 * var(--u)); left: calc(58 * var(--u)); width: calc(500 * var(--u)); }
        .lf-password-label { top: calc(337.6 * var(--u)); }
        .lf-password       { top: calc(413 * var(--u)); left: calc(58 * var(--u)); width: calc(327 * var(--u)); }
        .lf-pill           { top: calc(535 * var(--u)); }
      `}</style>

      <label className="auth-label lf-email-label" htmlFor="auth-email">
        Email address
      </label>
      <input
        id="auth-email"
        className="auth-input lf-email"
        type="email"
        autoComplete="username"
        autoFocus={!defaultEmail}
        value={email}
        onChange={edit(setEmail, "email")}
        aria-invalid={flagged.email}
      />

      <label className="auth-label lf-password-label" htmlFor="auth-password">
        Password
      </label>
      <PasswordInput
        id="auth-password"
        className="auth-input lf-password"
        
        autoComplete="current-password"
        autoFocus={!!defaultEmail}
        value={password}
        onChange={edit(setPassword, "password")}
        aria-invalid={flagged.password}
      />

      <div className="auth-hint-row">
        <button type="button" className="auth-link" onClick={handleForgot} disabled={busy}>
          Forgot password?
        </button>
        {message && (
          <span
            className={`auth-hint-text${problem ? "" : " auth-hint-notice"}`}
            role={problem ? "alert" : "status"}
          >
            {message}
          </span>
        )}
      </div>

      <button type="submit" className="auth-pill lf-pill" disabled={busy}>
        Log-in
      </button>
      <p className="login-appeal">Account suspended? <Link to="/appeal">Submit an appeal</Link></p>
    </form>
  );
}
