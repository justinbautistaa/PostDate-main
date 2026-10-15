/**
 * adminUi
 * The small pieces every dashboard section is built from. Styles are in
 * admin.css (classes start with `ad-`).
 *
 *   <SectionHead title sub>…controls…</SectionHead>   the heading row of a section
 *   <Sheet title sub actions>…</Sheet>                a cream sheet that holds a chart or list
 *   <Badge tone>text</Badge>                          status label (always text, never colour alone)
 *   <Segmented options value onChange />              filter tabs with counts
 *   <SearchBox />  <Pager />  <Avatar />  <EmptyState />  <QueryError />
 *   <ActionDialog config onClose />                   one dialog for every "are you sure / why?" step
 *   <ToastProvider> + useToast()                      the little confirmation that slides in
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toPhotoUrl } from "../../services/postdateApi";
import { errorMessage } from "../../services/adminApi";
import { formatNumber, initials } from "./format";

/* ── layout ──────────────────────────────────────────────────────────────── */

export function SectionHead({ title, sub, children }) {
  return (
    <header className="ad-head">
      <div>
        <h1 className="ad-title">{title}</h1>
        {sub && <p className="ad-sub">{sub}</p>}
      </div>
      {children && <div className="ad-head-actions">{children}</div>}
    </header>
  );
}

export function Sheet({ title, sub, actions, className = "", children }) {
  return (
    <section className={`ad-sheet ${className}`}>
      {(title || actions) && (
        <div className="ad-sheet-head">
          <div>
            {title && <h2 className="ad-sheet-title">{title}</h2>}
            {sub && <p className="ad-sheet-sub">{sub}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/* ── small controls ──────────────────────────────────────────────────────── */

/** tone: pending | ok | danger | muted | staff | neutral */
export function Badge({ tone = "neutral", children }) {
  return <span className={`ad-badge ad-badge-${tone}`}>{children}</span>;
}

/** Filter tabs. `options` = [{ value, label, count? }]. */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="ad-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="ad-seg-btn"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="ad-seg-count">{formatNumber(o.count)}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search", label = "Search" }) {
  return (
    <label className="ad-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.2" y2="16.2" />
      </svg>
      <span className="visually-hidden">{label}</span>
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Pager({ page, pages, total, limit, onPage, noun = "results" }) {
  if (!total) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <nav className="ad-pager" aria-label="Pages">
      <p>
        Showing {formatNumber(from)} to {formatNumber(to)} of {formatNumber(total)} {noun}
      </p>
      <div>
        <button type="button" className="ad-btn ad-btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span className="ad-pager-page">
          {page} / {pages}
        </span>
        <button type="button" className="ad-btn ad-btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}

export function Avatar({ name, src, size = 38 }) {
  const url = toPhotoUrl(src);
  return url ? (
    <img className="ad-avatar" src={url} alt="" style={{ width: size, height: size }} />
  ) : (
    <span className="ad-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="ad-empty">
      <p className="ad-empty-title">{title}</p>
      {children && <p className="ad-empty-body">{children}</p>}
    </div>
  );
}

/** Shows a failed load with a retry button. Renders nothing when there's no error. */
export function QueryError({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="ad-error" role="alert">
      <span>{error}</span>
      {onRetry && (
        <button type="button" className="ad-btn ad-btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/* ── toasts ──────────────────────────────────────────────────────────────── */

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  /** tone: "ok" | "error" */
  const notify = useCallback((message, tone = "ok") => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((list) => [...list, { id, message, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="ad-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className={`ad-toast ad-toast-${t.tone}`}>
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ── the one dialog ──────────────────────────────────────────────────────── */

/**
 * config (or null to hide it):
 *   title, body            what's being asked
 *   confirmLabel, tone     "ok" (default) | "danger"
 *   input?                 { label, placeholder, required, minLength, initial }  -> shows a text box
 *   run(text)              async; throw to show the error inside the dialog
 *
 * The dialog closes itself when run() resolves. While it's working, Esc and the
 * backdrop are ignored so a half-finished request can't be abandoned by accident.
 */
export function ActionDialog({ config, onClose }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fieldRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    setText(config?.input?.initial ?? "");
    setError("");
    setBusy(false);
  }, [config]);

  useEffect(() => {
    if (!config) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (fieldRef.current ?? confirmRef.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [config, busy, onClose]);

  if (!config) return null;
  const { title, body, input, confirmLabel = "Confirm", tone = "ok" } = config;

  async function submit(e) {
    e.preventDefault();
    const value = text.trim();
    const min = input?.minLength ?? 3;
    if (input?.required && value.length < min) {
      setError(`Write at least ${min} characters.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await config.run(value);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "That didn't work. Try again."));
      setBusy(false);
    }
  }

  return (
    <div className="ad-dialog-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="ad-dialog" role="dialog" aria-modal="true" aria-labelledby="ad-dialog-title" onSubmit={submit} noValidate>
        <h2 id="ad-dialog-title" className="ad-dialog-title">
          {title}
        </h2>
        {body && <p className="ad-dialog-body">{body}</p>}

        {input && (
          <label className="ad-dialog-field">
            <span>
              {input.label}
              {!input.required && <em> (optional)</em>}
            </span>
            <textarea
              ref={fieldRef}
              rows={3}
              maxLength={500}
              value={text}
              placeholder={input.placeholder}
              onChange={(e) => {
                setText(e.target.value);
                setError("");
              }}
            />
          </label>
        )}

        <p className="ad-dialog-error" role="alert">
          {error}
        </p>

        <div className="ad-dialog-actions">
          <button type="button" className="ad-btn ad-btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button ref={confirmRef} type="submit" className={`ad-btn ${tone === "danger" ? "ad-btn-danger" : "ad-btn-primary"}`} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
