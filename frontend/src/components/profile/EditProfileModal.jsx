import { useEffect, useState } from "react";

/**
 * EditProfileModal
 * The "Edit profile" pop-up opened from the profile page's identity card.
 * Maroon frame, cream inner card, tan field panel — the same three-layer
 * chrome the Figma "Account information" pop-up uses, re-themed with the
 * site's own tokens (they already match) and reworked so it fits this
 * project's actual data.
 *
 * 🔍 SCOPE NOTE: this only edits fields that live on the Mongoose Profile
 * document — display name, bio, gender, birthdate, and location. It leaves
 * out email and password on purpose: those belong to the User (account)
 * document, and already have their own flows (sign-up sets them; "Forgot
 * password?" on the log-in page resets them). Keeping this pop-up scoped to
 * Profile fields means it can never touch login credentials.
 *
 * "Display name" maps to Profile.profileName — a name shown on the dating
 * profile that can differ from the legal name on the account. Leave it
 * blank and the page falls back to the legal name, same as it does today.
 *
 * Usage:
 *   <EditProfileModal
 *     open={editOpen}
 *     profile={{ displayName, bio, gender, birthdate, city, country }}
 *     onClose={() => setEditOpen(false)}
 *     onSave={async (updates) => {
 *       const saved = await updateProfileDetails(updates);
 *       setProfile((p) => ({ ...p, ...saved }));
 *     }}
 *   />
 */

/* 🎛️ keep in sync with GENDER_OPTIONS in ../WhoAreYouForm.jsx — same values
   go to the same Profile.gender field, just from two different forms. */
const GENDER_OPTIONS = [
  { value: "", label: "Select one" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "nonbinary", label: "Non-binary" },
  { value: "self-describe", label: "Prefer to self-describe" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const MIN_AGE = 18; // 🎛️ keep in sync with MIN_SIGNUP_AGE in backend/controllers/authController.js
const MAX_BIRTHDATE = new Date().toISOString().slice(0, 10); // no future birthdates
const MIN_BIRTHDATE = "1900-01-01";
const BIO_MAX = 1000; // 🎛️ keep in sync with Profile.bio maxlength in backend/models/Profile.js
const NAME_MAX = 50; // 🎛️ keep in sync with Profile.profileName maxlength

/** "YYYY-MM-DD" -> whole years old, for the same 18+ check WhoAreYouForm does at sign-up. */
function calculateAge(isoDate) {
  if (!isoDate) return 0;
  const dob = new Date(isoDate);
  if (Number.isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

const emptyForm = { displayName: "", bio: "", gender: "", birthdate: "", city: "", country: "" };

export default function EditProfileModal({ open, profile = {}, onClose, onSave }) {
  const [values, setValues] = useState(emptyForm);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reload the form from the current profile every time the pop-up opens, so
  // a cancelled edit never leaves stale text behind the next time it opens.
  useEffect(() => {
    if (!open) return;
    setValues({
      displayName: profile.displayName ?? "",
      bio: profile.bio ?? "",
      gender: profile.gender ?? "",
      birthdate: profile.birthdate ?? "",
      city: profile.city ?? "",
      country: profile.country ?? "",
    });
    setTouched(false);
    setError("");
  }, [open, profile]);

  // Esc closes it (unless a save is in flight), background scroll locks.
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape" && !saving) onClose?.();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const update = (field) => (e) =>
    setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const problems = {
    gender: !values.gender,
    birthdate: !values.birthdate.trim() || calculateAge(values.birthdate) < MIN_AGE,
  };
  const isValid = !Object.values(problems).some(Boolean);
  const invalid = (field) => (touched && problems[field] ? "epmodal-invalid" : "");

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) {
      setError("Fill in the highlighted fields to continue.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave?.({
        displayName: values.displayName.trim(),
        bio: values.bio.trim(),
        gender: values.gender,
        birthdate: values.birthdate,
        city: values.city.trim(),
        country: values.country.trim(),
      });
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message ?? "Could not save your changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="epmodal-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose?.()}
    >
      <style>{`
        .epmodal-backdrop {
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

        .epmodal {
          position: relative;
          width: min(100%, 720px);   /* 🎛️ modal width */

          background: var(--pd-maroon);
          border: clamp(5px, 0.9vw, 9px) solid var(--pd-pink);   /* 🎛️ frame thickness */
          border-radius: clamp(16px, 2vw, 24px);
          padding: clamp(14px, 2vw, 22px);
          box-shadow: 0 30px 60px -24px rgba(43, 35, 32, 0.55);
        }

        .epmodal-head {
          position: relative;
          padding: clamp(2px, 0.6vw, 6px) clamp(36px, 5vw, 48px) clamp(14px, 2vw, 20px) clamp(4px, 0.8vw, 10px);
        }

        .epmodal-title {
          margin: 0;
          font-family: var(--pd-display);
          font-weight: 700;
          font-size: clamp(24px, 3.6vw, 40px);   /* 🎛️ title size */
          line-height: 1.15;
          text-transform: uppercase;
          color: var(--pd-cream);
        }

        .epmodal-close {
          position: absolute;
          top: 0;
          right: 0;
          background: none;
          border: none;
          font-size: clamp(20px, 2.6vw, 26px);
          line-height: 1;
          color: var(--pd-cream);
          opacity: 0.75;
          cursor: pointer;
        }
        .epmodal-close:hover:not(:disabled) { opacity: 1; }
        .epmodal-close:disabled { opacity: 0.4; cursor: default; }

        .epmodal-body {
          background: var(--pd-cream);
          border-radius: clamp(14px, 1.8vw, 20px);
          padding: clamp(14px, 2.2vw, 26px);

          display: flex;
          flex-direction: column;
          gap: clamp(14px, 2vw, 22px);
        }

        .epmodal-fields {
          background: var(--pd-tan);
          border-radius: clamp(10px, 1.2vw, 14px);
          padding: clamp(14px, 2vw, 22px);

          display: flex;
          flex-direction: column;
          gap: clamp(12px, 1.6vw, 18px);
        }

        .epmodal-group {
          display: flex;
          flex-direction: column;
          gap: clamp(4px, 0.6vw, 7px);
          min-width: 0;
        }

        .epmodal-pair {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(10px, 1.4vw, 18px);
        }

        .epmodal-label-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }

        .epmodal-label {
          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(11px, 1.05vw, 15px);   /* 🎛️ field label size */
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--pd-maroon);
        }

        .epmodal-counter {
          font-family: var(--pd-mono);
          font-size: clamp(9px, 0.85vw, 12px);
          color: var(--pd-ink);
          opacity: 0.6;
          white-space: nowrap;
        }

        /* every field sits as a cream cutout on the tan panel — a small
           inversion of the tan-on-cream inputs used at sign-up, so this
           pop-up reads as its own moment rather than a re-skin. */
        .epmodal input[type="text"],
        .epmodal input[type="date"],
        .epmodal select,
        .epmodal textarea {
          width: 100%;
          background: var(--pd-cream);
          border: 2px solid transparent;
          border-radius: 6px;
          padding: clamp(8px, 1vw, 12px) clamp(10px, 1.2vw, 14px);

          font-family: var(--pd-mono);
          font-size: clamp(12px, 1.1vw, 16px);   /* 🎛️ typed text size */
          color: var(--pd-ink);
        }
        .epmodal input::placeholder,
        .epmodal textarea::placeholder { color: var(--pd-pink); opacity: 1; }
        .epmodal input:focus-visible,
        .epmodal select:focus-visible,
        .epmodal textarea:focus-visible { outline: none; border-color: var(--pd-maroon); }
        .epmodal .epmodal-invalid { border-color: var(--pd-maroon); }

        .epmodal textarea {
          min-height: clamp(70px, 9vw, 100px);
          resize: vertical;
          line-height: 1.45;
        }

        .epmodal-select-wrap { position: relative; }
        .epmodal select {
          appearance: none;
          -webkit-appearance: none;
          padding-right: clamp(28px, 3vw, 34px);
          cursor: pointer;
        }
        .epmodal-select-empty { color: var(--pd-pink); }
        .epmodal select option { color: var(--pd-ink); background: var(--pd-white); }
        .epmodal-select-wrap::after {
          content: "";
          position: absolute;
          right: clamp(10px, 1.2vw, 14px);
          top: 50%;
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid var(--pd-maroon);
          transform: translateY(-40%);
          pointer-events: none;
        }

        .epmodal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: clamp(10px, 1.6vw, 18px);
        }

        .epmodal-status {
          flex: 1 1 auto;
          min-width: 160px;
          margin: 0;
          font-family: var(--pd-mono);
          font-size: clamp(11px, 1vw, 14px);
          color: var(--pd-maroon);
        }

        .epmodal-buttons {
          display: flex;
          gap: clamp(10px, 1.4vw, 16px);
        }

        .epmodal-btn {
          border: none;
          border-radius: 30px;
          padding: clamp(9px, 1.1vw, 13px) clamp(22px, 2.8vw, 34px);
          cursor: pointer;

          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: clamp(12px, 1.2vw, 17px);   /* 🎛️ button text size */
          letter-spacing: 0.05em;
          text-transform: uppercase;
          white-space: nowrap;
          transition: transform 0.15s ease;
        }
        .epmodal-btn:hover:not(:disabled) { transform: translateY(-2px); }
        .epmodal-btn:disabled { opacity: 0.6; cursor: default; transform: none; }

        /* dark "back" pill from the reference, re-cast as Cancel */
        .epmodal-btn-cancel {
          background: var(--pd-ink);
          color: var(--pd-cream);
        }

        /* the reference's green-outlined "confirm" pill — matches the same
           green TasteTab already uses for its own ✔ save button. */
        .epmodal-btn-save {
          background: var(--pd-cream);
          color: var(--pd-green);
          border: clamp(3px, 0.5vw, 5px) solid var(--pd-green);
          box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
        }

        @media (max-width: 560px) {
          .epmodal-pair { grid-template-columns: minmax(0, 1fr); }
          .epmodal-actions { justify-content: stretch; }
          .epmodal-buttons { width: 100%; }
          .epmodal-btn { flex: 1; }
        }

        @media (prefers-reduced-motion: no-preference) {
          .epmodal { animation: epmodal-in 0.2s ease-out; }
          @keyframes epmodal-in {
            from { opacity: 0; transform: translateY(10px) scale(0.98); }
            to   { opacity: 1; transform: none; }
          }
        }
      `}</style>

      <div className="epmodal" role="dialog" aria-modal="true" aria-labelledby="epmodal-title">
        <div className="epmodal-head">
          <h2 className="epmodal-title" id="epmodal-title">
            Edit profile
          </h2>
          <button
            type="button"
            className="epmodal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form className="epmodal-body" onSubmit={handleSubmit} noValidate>
          <div className="epmodal-fields">
            <div className="epmodal-group">
              <label className="epmodal-label" htmlFor="ep-displayname">
                Display name
              </label>
              <input
                id="ep-displayname"
                type="text"
                maxLength={NAME_MAX}
                placeholder="Shown on your profile instead of your name"
                autoComplete="off"
                autoFocus
                value={values.displayName}
                onChange={update("displayName")}
              />
            </div>

            <div className="epmodal-group">
              <div className="epmodal-label-row">
                <label className="epmodal-label" htmlFor="ep-bio">
                  Bio
                </label>
                <span className="epmodal-counter">
                  {values.bio.length}/{BIO_MAX}
                </span>
              </div>
              <textarea
                id="ep-bio"
                maxLength={BIO_MAX}
                placeholder="A couple sentences about you..."
                value={values.bio}
                onChange={update("bio")}
              />
            </div>

            <div className="epmodal-pair">
              <div className="epmodal-group">
                <label className="epmodal-label" htmlFor="ep-gender">
                  Gender
                </label>
                <div className="epmodal-select-wrap">
                  <select
                    id="ep-gender"
                    value={values.gender}
                    onChange={update("gender")}
                    aria-invalid={touched && problems.gender}
                    className={`${values.gender === "" ? "epmodal-select-empty" : ""} ${invalid("gender")}`}
                  >
                    {GENDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="epmodal-group">
                <label className="epmodal-label" htmlFor="ep-birthdate">
                  Birthdate
                </label>
                <input
                  id="ep-birthdate"
                  type="date"
                  min={MIN_BIRTHDATE}
                  max={MAX_BIRTHDATE}
                  value={values.birthdate}
                  onChange={update("birthdate")}
                  aria-invalid={touched && problems.birthdate}
                  className={invalid("birthdate")}
                />
              </div>
            </div>

            <div className="epmodal-pair">
              <div className="epmodal-group">
                <label className="epmodal-label" htmlFor="ep-city">
                  City
                </label>
                <input
                  id="ep-city"
                  type="text"
                  autoComplete="address-level2"
                  value={values.city}
                  onChange={update("city")}
                />
              </div>
              <div className="epmodal-group">
                <label className="epmodal-label" htmlFor="ep-country">
                  Country
                </label>
                <input
                  id="ep-country"
                  type="text"
                  autoComplete="country-name"
                  value={values.country}
                  onChange={update("country")}
                />
              </div>
            </div>
          </div>

          <div className="epmodal-actions">
            <p className="epmodal-status" role={error ? "alert" : undefined}>
              {error}
            </p>

            <div className="epmodal-buttons">
              <button
                type="button"
                className="epmodal-btn epmodal-btn-cancel"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="epmodal-btn epmodal-btn-save" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
