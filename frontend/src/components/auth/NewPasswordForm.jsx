import { useState } from "react";
import useAuthAction from "./useAuthAction";

/**
 * NewPasswordForm
 * View 3 of the log-in page (Figma "PASSWORD"): choose a new password, type
 * it again, hit CONFIRM. Lives inside <AuthPanel>.
 *
 * The maroon "PASSWORDS MUST MATCH" line is on screen all the time, like the
 * Figma. Other messages (too short, or the server saying no) take its place
 * on the same line, and the boxes that need fixing get a maroon outline.
 *
 * The page passes in:
 *   onSubmit(newPassword)   Promise — save it, then move on
 *
 * Usage:
 *   <NewPasswordForm onSubmit={...} />
 */

const MIN_PASSWORD_LENGTH = 12; // 🎛️ keep in sync with WhoAreYouForm.jsx

export default function NewPasswordForm({ onSubmit }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [tried, setTried] = useState(false); // has CONFIRM been pressed yet?
  const { busy, error, setError, run } = useAuthAction();

  const tooShort = password.length < MIN_PASSWORD_LENGTH;
  const mismatch = password !== repeat;

  const edit = (setValue) => (e) => {
    setValue(e.target.value);
    setError("");
  };

  function handleSubmit(e) {
    e.preventDefault();
    setTried(true);
    if (tooShort || mismatch) return;
    run(() => onSubmit(password), "Couldn't save it. Start over from log-in");
  }

  const shortNow = tried && tooShort;
  const text =
    error || (shortNow ? `Use at least ${MIN_PASSWORD_LENGTH} characters` : "Passwords must match");
  const isProblem = Boolean(error) || shortNow || (tried && mismatch);

  return (
    <form className="nf" onSubmit={handleSubmit} noValidate>
      <style>{`
        /* Figma coordinates, measured from the panel's top-left corner */
        .nf-new-label    { top: calc(186.6 * var(--u)); }
        .nf-new          { top: calc(262 * var(--u)); left: calc(58 * var(--u)); width: calc(500 * var(--u)); }
        .nf-repeat-label { top: calc(337.6 * var(--u)); }
        .nf-repeat       { top: calc(413 * var(--u)); left: calc(58 * var(--u)); width: calc(500 * var(--u)); }
        .nf-pill         { top: calc(535 * var(--u)); }
      `}</style>

      <label className="auth-label nf-new-label" htmlFor="auth-new-password">
        New password
      </label>
      <input
        id="auth-new-password"
        className="auth-input nf-new"
        type="password"
        autoComplete="new-password"
        autoFocus
        value={password}
        onChange={edit(setPassword)}
        aria-invalid={shortNow}
        aria-describedby="auth-new-hint"
      />

      <label className="auth-label nf-repeat-label" htmlFor="auth-repeat-password">
        Repeat
      </label>
      <input
        id="auth-repeat-password"
        className="auth-input nf-repeat"
        type="password"
        autoComplete="new-password"
        value={repeat}
        onChange={edit(setRepeat)}
        aria-invalid={tried && mismatch}
        aria-describedby="auth-new-hint"
      />

      <div className="auth-hint-row">
        <span id="auth-new-hint" className="auth-hint-text" role={isProblem ? "alert" : undefined}>
          {text}
        </span>
      </div>

      <button type="submit" className="auth-pill nf-pill" disabled={busy}>
        Confirm
      </button>
    </form>
  );
}
