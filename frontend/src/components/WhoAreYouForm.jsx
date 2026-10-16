import PasswordInput from "./PasswordInput";
import { useState } from "react";
import StampCardShell from "./StampCardShell";

/**
 * WhoAreYouForm
 * Step 1 of the signup flow, laid out exactly like the Figma:
 *
 *   FULL NAME   [first] [middle] [last]
 *   EMAIL [........]    BIRTHDATE [........]
 *   PASSWORD [.....]    GENDER [.......  ▾]
 *   SHORT BIO   [..............................]
 *
 * Chrome (perforations, header/footer, button, 1/3 counter) lives in
 * StampCardShell — this file only owns the fields and their validation.
 * Sizes are `calc(<Figma px> * var(--u))`, see pages/Signup.jsx.
 *
 * 🔌 BACKEND: onContinue receives { firstName, middleName, lastName, email,
 * password, birthdate, gender, bio }. Email + password are new (they are in
 * the Figma, and the User model needs them) — the backend should hash the
 * password and never store it as sent.
 *
 * 🔁 CHANGED: birthdate used to be a free-text "MM/DD/YY" field. It's now a
 * real <input type="date">, so `birthdate` comes out as an ISO string
 * ("YYYY-MM-DD") instead — backend/controllers/authController.js's
 * parseBirthdate() was updated to match. If you're wiring this up against
 * an older backend build, update that function too or signups will 400.
 *
 * Usage:
 *   <WhoAreYouForm onContinue={(data) => console.log(data)} />
 *   <WhoAreYouForm step={1} totalSteps={3} onContinue={handleNext} />
 */

const GENDER_OPTIONS = [
  { value: "", label: "Select one" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "nonbinary", label: "Non-binary" },
  { value: "self-describe", label: "Prefer to self-describe" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const MIN_PASSWORD_LENGTH = 12; // 🎛️ shortest password we accept
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_AGE = 18; // 🎛️ keep in sync with MIN_SIGNUP_AGE in backend/controllers/authController.js
const MAX_BIRTHDATE = new Date().toISOString().slice(0, 10); // no future birthdates
const MIN_BIRTHDATE = "1900-01-01"; // 🎛️ oldest birthdate the date picker allows

/** "YYYY-MM-DD" (what <input type="date"> gives us) -> whole years old. */
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

export default function WhoAreYouForm({ step = 1, totalSteps = 3, onContinue, initialValues = {} }) {
  const [values, setValues] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    password: "",
    birthdate: "",
    gender: "",
    bio: "",
    ...initialValues,
  });
  const [touched, setTouched] = useState(false);

  const update = (field) => (e) =>
    setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const problems = {
    gender: !GENDER_OPTIONS.some(option => option.value && option.value === values.gender),
    firstName: !values.firstName.trim(),
    lastName: !values.lastName.trim(),
    email: !EMAIL_PATTERN.test(values.email.trim()),
    password: values.password.length < MIN_PASSWORD_LENGTH,
    // Empty, or younger than the site's minimum age — the date picker's
    // own min/max stop most bad input before it gets here, but someone
    // typing the date manually on some browsers can still slip past those.
    birthdate: !values.birthdate.trim() || calculateAge(values.birthdate) < MIN_AGE,
  };
  const isValid = !Object.values(problems).some(Boolean);

  const invalid = (field) => (touched && problems[field] ? "wru-invalid" : "");

  const handleContinue = () => {
    setTouched(true);
    if (!isValid) return;
    onContinue?.({ ...values, email: values.email.trim() });
  };

  return (
    <StampCardShell
      title="Who are you?"
      step={step}
      totalSteps={totalSteps}
      buttonLabel="Continue"
      onButtonClick={handleContinue}
      error={touched && !isValid ? "Fill in the highlighted fields to continue." : null}
    >
      <style>{`
        /* a label sitting on top of a field */
        .wru-group {
          display: flex;
          flex-direction: column;
          gap: calc(5 * var(--u));
        }
        .wru-group-first { gap: 0; }   /* Figma: the name inputs touch their label */

        /* Figma: Space Mono 700 24px */
        .wru-label {
          font-weight: 700;
          font-size: calc(24 * var(--u));   /* 🎛️ field label size */
          line-height: calc(36 * var(--u));
          text-transform: uppercase;
          color: var(--pd-ink);
        }

        .wru-name-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          column-gap: calc(11 * var(--u));
        }
        /* two side-by-side fields: email | birthdate, password | gender */
        .wru-pair {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: calc(10 * var(--u));
        }

        /* Figma: Rectangle 51–55 / 241–242 = 40px tall, tan, radius 5 */
        .stamp-wrapper input,
        .stamp-wrapper select,
        .stamp-wrapper textarea {
          display: block;
          width: 100%;
          height: calc(40 * var(--u));
          padding: 0 calc(10.5 * var(--u));
          font-family: var(--pd-mono);
          font-weight: 700;
          font-size: calc(20 * var(--u));   /* 🎛️ input text size */
          text-transform: uppercase;
          color: var(--pd-ink);
          background: var(--pd-tan);
          border: calc(2 * var(--u)) solid transparent;
          border-radius: calc(5 * var(--u));
        }
        .stamp-wrapper input::placeholder,
        .stamp-wrapper textarea::placeholder {
          color: var(--pd-white);
          opacity: 1;
        }
        .stamp-wrapper input:focus-visible,
        .stamp-wrapper select:focus-visible,
        .stamp-wrapper textarea:focus-visible {
          outline: none;
          border-color: var(--pd-maroon);
        }
        .stamp-wrapper .wru-invalid { border-color: var(--pd-maroon); }

        /* the three name boxes use small placeholder text that sits low in
           the box, exactly as drawn (Figma: 14px, ~8px below centre) */
        .stamp-wrapper .wru-name-row input {
          padding: calc(16 * var(--u)) calc(5 * var(--u)) 0 calc(4.5 * var(--u));
          font-size: calc(14 * var(--u));   /* 🎛️ name placeholder size */
        }

        /* email + password are typed as-is, not shouted */
        .stamp-wrapper input[type="email"],
        .stamp-wrapper input[type="password"] { text-transform: none; }

        /* date input: browsers render their own calendar icon here, which
           only partially themes via ::-webkit-calendar-picker-indicator —
           left as the browser default rather than fighting it per-browser */
        .stamp-wrapper input[type="date"] { text-transform: none; }

        /* gender dropdown with the maroon triangle */
        .wru-select-wrap { position: relative; }
        .stamp-wrapper .wru-select-wrap select {
          appearance: none;
          -webkit-appearance: none;
          padding-right: calc(34 * var(--u));
          cursor: pointer;
        }
        .stamp-wrapper .wru-select-empty { color: var(--pd-white); }
        .stamp-wrapper select option {
          color: var(--pd-ink);
          background: var(--pd-white);
        }
        .wru-select-wrap::after {
          content: "";
          position: absolute;
          right: calc(11.5 * var(--u));
          top: calc(50% - 5 * var(--u));
          width: 0;
          height: 0;
          border-left: calc(7.5 * var(--u)) solid transparent;
          border-right: calc(7.5 * var(--u)) solid transparent;
          border-top: calc(13.5 * var(--u)) solid var(--pd-maroon);
          pointer-events: none;
        }

        /* Figma: Rectangle 56 = 98px tall */
        .stamp-wrapper textarea {
          height: calc(98 * var(--u));
          padding: calc(9 * var(--u)) calc(10.5 * var(--u));
          font-size: calc(16 * var(--u));
          line-height: 1.35;
          text-transform: none;
          resize: none;
        }
      `}</style>

      <div className="wru-group wru-group-first">
        <span className="wru-label">Full name</span>
        <div className="wru-name-row">
          <input
            type="text"
            placeholder="First name"
            aria-label="First name"
            autoComplete="given-name"
            value={values.firstName}
            onChange={update("firstName")}
            className={invalid("firstName")}
          />
          <input
            type="text"
            placeholder="Middle name"
            aria-label="Middle name"
            autoComplete="additional-name"
            value={values.middleName}
            onChange={update("middleName")}
          />
          <input
            type="text"
            placeholder="Last name"
            aria-label="Last name"
            autoComplete="family-name"
            value={values.lastName}
            onChange={update("lastName")}
            className={invalid("lastName")}
          />
        </div>
      </div>

      <div className="wru-pair">
        <div className="wru-group">
          <label className="wru-label" htmlFor="stamp-email">Email</label>
          <input
            id="stamp-email"
            type="email"
            placeholder="you@email.com"
            autoComplete="email"
            value={values.email}
            onChange={update("email")}
            className={invalid("email")}
          />
        </div>
        <div className="wru-group">
          <label className="wru-label" htmlFor="stamp-birthdate">Birthdate</label>
          <input
            id="stamp-birthdate"
            type="date"
            autoComplete="bday"
            min={MIN_BIRTHDATE}
            max={MAX_BIRTHDATE}
            value={values.birthdate}
            onChange={update("birthdate")}
            className={invalid("birthdate")}
          />
        </div>
      </div>

      <div className="wru-pair">
        <div className="wru-group">
          <label className="wru-label" htmlFor="stamp-password">Password</label>
          <PasswordInput
            id="stamp-password"
            
            placeholder={`${MIN_PASSWORD_LENGTH}+ characters`}
            autoComplete="new-password"
            value={values.password}
            onChange={update("password")}
            className={invalid("password")}
          />
        </div>
        <div className="wru-group">
          <label className="wru-label" htmlFor="stamp-gender">Gender</label>
          <div className="wru-select-wrap">
            <select
              id="stamp-gender"
              value={values.gender}
              onChange={update("gender")}
              className={values.gender === "" ? "wru-select-empty" : ""}
            >
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="wru-group">
        <label className="wru-label" htmlFor="stamp-bio">Short bio</label>
        <textarea
          id="stamp-bio"
          placeholder="A couple sentences about you..."
          value={values.bio}
          onChange={update("bio")}
        />
      </div>
    </StampCardShell>
  );
}
