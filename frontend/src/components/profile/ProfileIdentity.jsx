/**
 * ProfileIdentity
 * The left column of the profile page: the salmon avatar circle overlapping a
 * cream card that holds the name, the bio, and the meta rows (address / age /
 * birthdate / gender / ratings / date joined / last date).
 *
 * Usage:
 *   <ProfileIdentity profile={profile} onEdit={() => setEditOpen(true)} />
 *
 * `profile` is whatever services/postdateApi.js → getProfile() returns.
 * `onEdit` is optional — pass it and an "Edit profile" link appears under
 * the name, opening components/profile/EditProfileModal.jsx. Leave it off
 * and the card renders exactly as before (e.g. for viewing someone else's
 * profile later, where editing wouldn't make sense).
 */

/* 🎛️ EDIT THE META ROWS HERE ----------------------------------------------
   `key` must match a field name coming back from the backend; `label` is what
   the user sees. Reorder, rename or delete rows freely.                    */
const META_ROWS = [
  { key: "address", label: "Address" },
  { key: "age", label: "Age" },
  { key: "birthdate", label: "Birthdate" },
  { key: "gender", label: "Gender" },
  { key: "ratings", label: "Ratings" },
  { key: "dateJoined", label: "Date joined" },
  { key: "lastDate", label: "Last date" },
];

/* profile.gender is stored as the raw slug WhoAreYouForm/EditProfileModal's
   <select> sends ("nonbinary", "self-describe", ...) so the edit form can
   prefill correctly — this just prettifies it for the read-only row here. */
const GENDER_LABELS = {
  female: "Female",
  male: "Male",
  nonbinary: "Non-binary",
  "self-describe": "Self-described",
  "prefer-not-to-say": "Prefer not to say",
};

export default function ProfileIdentity({ profile = {}, onEdit }) {
  return (
    <div className="pid">
      <style>{`
        .pid {
          /* 🎛️ TUNE THE COLUMN ------------------------------------------ */
          --pid-avatar: clamp(96px, 11vw, 190px);   /* avatar diameter      */
          --pid-overlap: 34%;   /* how far the avatar dips into the card    */

          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }

        .pid-avatar {
          width: var(--pid-avatar);
          height: var(--pid-avatar);
          border-radius: 50%;
          background: var(--pd-salmon);
          object-fit: cover;

          display: grid;
          place-items: center;
          position: relative;
          z-index: 2;

          /* pulls the card up underneath it */
          margin-bottom: calc(var(--pid-avatar) * -1 * 0.34);

          font-family: var(--pd-mono);
          font-size: clamp(9px, 0.75vw, 13px);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--pd-cream);
        }

        .pid-card {
          width: 100%;
          background: var(--pd-cream);
          border-radius: var(--pd-radius);
          padding: calc(var(--pid-avatar) * 0.4) clamp(12px, 1.4vw, 22px)
                   clamp(16px, 2vw, 28px);
          text-align: left;
        }

        .pid-name-row {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25em;
          margin: 0 0 0.35em;
        }

        .pid-name {
          margin: 0;
          font-family: var(--pd-display);
          font-weight: 400;
          font-size: clamp(22px, 2.6vw, 46px);   /* 🎛️ name size */
          line-height: 1.1;
          text-align: center;
          color: var(--pd-maroon);
        }

        /* 🎛️ the "Edit profile" trigger under the name — quiet on purpose,
           a text link rather than another loud pill, since the card already
           has one (the avatar) doing the attention-grabbing work. */
        .pid-edit-btn {
          background: none;
          border: none;
          padding: 0;
          font-family: var(--pd-mono);
          font-size: clamp(10px, 0.85vw, 14px);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          text-decoration: underline;
          text-underline-offset: 3px;
          color: var(--pd-maroon);
          opacity: 0.75;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .pid-edit-btn:hover { opacity: 1; }

        .pid-heading {
          margin: 0 0 0.3em;
          font-family: var(--pd-mono);
          font-weight: 400;
          font-size: clamp(15px, 1.5vw, 28px);   /* 🎛️ "Bio" heading size */
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--pd-maroon);
        }

        .pid-bio {
          margin: 0 0 1.1em;
          font-family: var(--pd-mono);
          font-size: clamp(11px, 0.92vw, 15px);
          line-height: 1.55;
          color: var(--pd-ink);
        }

        /* meta rows: label on the left, value on the right */
        .pid-meta {
          margin: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.35em clamp(8px, 1vw, 16px);

          font-family: var(--pd-mono);
          font-size: clamp(10px, 0.9vw, 15px);   /* 🎛️ meta text size */
          line-height: 1.5;
          color: var(--pd-maroon);
        }
        .pid-meta dt { text-transform: uppercase; letter-spacing: 0.04em; }
        .pid-meta dd { margin: 0; text-align: right; opacity: 0.85; }
      `}</style>

      {/* 🔌 BACKEND: profile.avatarUrl. While it is null the salmon circle
          with the word PHOTO stands in, exactly like the mockup. */}
      {profile.avatarUrl ? (
        <img
          className="pid-avatar"
          src={profile.avatarUrl}
          alt={profile.name ? `${profile.name}'s photo` : "Profile photo"}
        />
      ) : (
        <div className="pid-avatar" aria-hidden="true">
          Photo
        </div>
      )}

      <div className="pid-card">
        <div className="pid-name-row">
          {/* profile.displayName is Profile.profileName — falls back to the
              account's legal name (profile.name) when it hasn't been set. */}
          <h1 className="pid-name">{profile.displayName || profile.name || "Name"}</h1>

          {onEdit && (
            <button type="button" className="pid-edit-btn" onClick={onEdit}>
              Edit profile
            </button>
          )}
        </div>

        <h2 className="pid-heading">Bio</h2>
        <p className="pid-bio">{profile.bio ?? "No bio yet."}</p>

        <dl className="pid-meta">
          {META_ROWS.map(({ key, label }) => (
            <div key={key} style={{ display: "contents" }}>
              <dt>{label}</dt>
              <dd>
                {key === "gender"
                  ? GENDER_LABELS[profile.gender] ?? profile.gender ?? "—"
                  : profile[key] ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
