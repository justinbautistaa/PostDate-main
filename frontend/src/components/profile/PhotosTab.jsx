import { useRef, useState } from "react";
import {
  uploadProfilePhotos,
  deleteProfilePhoto,
  setProfileAvatar,
  toPhotoUrl,
} from "../../services/postdateApi";

/**
 * PhotosTab — the "Your photos" panel: a mosaic of every photo the account
 * has ever uploaded, plus controls to add more, delete one, or make one the
 * profile picture.
 *
 * `photoPaths` and `avatarPath` are the raw paths getProfile() returns
 * ("/uploads/<file>.jpg", or null for no avatar yet) — this component is
 * what turns them into loadable images and filenames-as-ids, via
 * toPhotoUrl(). The current avatar gets a maroon border and a "Profile"
 * badge instead of the usual star/delete buttons: the backend refuses to
 * delete the current avatar (switch first) or the last photo left, so
 * those actions are hidden here rather than offered and then rejected.
 *
 * Usage:
 *   <PhotosTab
 *     photoPaths={profile.photoPaths}
 *     avatarPath={profile.avatarPath}
 *     onChange={({ photoPaths, avatarPath }) => setProfile((p) => ({ ...p, photoPaths, avatarPath }))}
 *   />
 */

// 🎛️ Each photo cycles through these three mosaic shapes — purely visual,
// unrelated to upload order otherwise.
const SPAN_CYCLE = ["tall", "wide", "box"];

function toTiles(photoPaths, avatarPath) {
  return photoPaths.map((path, i) => ({
    id: path.split("/").pop(),
    path,
    url: toPhotoUrl(path),
    span: SPAN_CYCLE[i % SPAN_CYCLE.length],
    isAvatar: path === avatarPath,
  }));
}

export default function PhotosTab({ photoPaths = [], avatarPath = null, onChange }) {
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null); // the one tile mid-delete or mid-avatar-switch
  const [error, setError] = useState("");

  const tiles = toTiles(photoPaths, avatarPath);

  async function handleFiles(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // lets the same file be picked again later
    if (files.length === 0) return;

    setUploading(true);
    setError("");
    try {
      /* 🔌 BACKEND: POST /api/profile/photos — see services/postdateApi.js. */
      const result = await uploadProfilePhotos(files);
      onChange?.(result);
    } catch (err) {
      setError(err?.response?.data?.message ?? "Could not upload those photos. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId) {
    if (!window.confirm("Delete this photo? This can't be undone.")) return;

    setBusyId(photoId);
    setError("");
    try {
      /* 🔌 BACKEND: DELETE /api/profile/photos/:filename */
      const remaining = await deleteProfilePhoto(photoId);
      onChange?.({ photoPaths: remaining, avatarPath });
    } catch (err) {
      setError(err?.response?.data?.message ?? "Could not delete that photo.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetAvatar(path) {
    const photoId = path.split("/").pop();
    setBusyId(photoId);
    setError("");
    try {
      /* 🔌 BACKEND: PUT /api/profile/avatar */
      const newAvatarPath = await setProfileAvatar(path);
      onChange?.({ photoPaths, avatarPath: newAvatarPath });
    } catch (err) {
      setError(err?.response?.data?.message ?? "Could not set that as your profile picture.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="photos">
      <style>{`
        .photos {
          display: flex;
          flex-direction: column;
          gap: clamp(10px, 1.4vw, 20px);
          height: 100%;
        }

        .photos-error {
          margin: 0;
          font-family: var(--pd-mono);
          font-size: clamp(11px, 1vw, 15px);
          color: var(--pd-maroon);
        }

        .photos-grid {
          flex: 1;
          overflow-y: auto;   /* the mosaic scrolls once photos outgrow the panel */
          display: grid;
          /* 🎛️ THE MOSAIC — more columns = smaller tiles */
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-auto-rows: clamp(60px, 8vw, 130px);
          gap: clamp(8px, 1.1vw, 18px);
        }

        .photos-tile {
          position: relative;
          background: var(--pd-grey);
          border: 3px solid transparent;   /* keeps size stable whether or not it's the avatar */
          border-radius: 4px;
          overflow: hidden;
          display: grid;
          place-items: center;

          font-family: var(--pd-mono);
          font-size: clamp(9px, 0.8vw, 13px);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(43, 35, 32, 0.5);
        }
        .photos-tile img { width: 100%; height: 100%; object-fit: cover; }

        .photos-tile-avatar { border-color: var(--pd-maroon); }

        /* the three shapes from the mockup */
        .photos-tall { grid-row: span 2; }
        .photos-wide { grid-column: span 2; }
        .photos-box  { grid-column: span 2; }

        .photos-tile-actions {
          position: absolute;
          top: 6px;
          right: 6px;
          display: flex;
          gap: 4px;
        }
        .photos-tile-btn {
          width: clamp(22px, 2.6vw, 30px);
          height: clamp(22px, 2.6vw, 30px);
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: grid;
          place-items: center;
          background: rgba(43, 35, 32, 0.6);
          color: var(--pd-cream);
          font-size: clamp(11px, 1.3vw, 15px);
          line-height: 1;
          transition: transform 0.15s ease, background-color 0.15s ease;
        }
        .photos-tile-btn:hover { transform: scale(1.08); }
        .photos-tile-btn:disabled { opacity: 0.5; cursor: default; transform: none; }
        .photos-tile-btn-delete:hover { background: var(--pd-maroon); }

        .photos-tile-badge {
          position: absolute;
          left: 6px;
          bottom: 6px;
          background: var(--pd-maroon);
          color: var(--pd-cream);
          border-radius: 999px;
          padding: 3px 10px;
          font-size: clamp(8px, 0.75vw, 11px);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .photos-add {
          align-self: flex-start;
          flex: none;
          background: var(--pd-cream);
          border: 4px solid var(--pd-maroon);
          border-radius: 30px;
          padding: clamp(6px, 0.8vw, 12px) clamp(16px, 2.2vw, 34px);
          cursor: pointer;

          font-family: var(--pd-mono);
          font-size: clamp(11px, 1.05vw, 18px);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--pd-maroon);
          transition: transform 0.15s ease;
        }
        .photos-add:hover { transform: translateY(-2px); }
        .photos-add:disabled { opacity: 0.6; cursor: default; transform: none; }

        @media (max-width: 720px) {
          .photos-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .photos-wide, .photos-box { grid-column: span 2; }
        }
      `}</style>

      {error && (
        <p className="photos-error" role="alert">
          {error}
        </p>
      )}

      <div className="photos-grid">
        {tiles.map(({ id, url, span, isAvatar, path }) => (
          <div className={`photos-tile photos-${span}${isAvatar ? " photos-tile-avatar" : ""}`} key={id}>
            {url ? <img src={url} alt="" /> : <span>Photo</span>}

            {isAvatar ? (
              <span
                className="photos-tile-badge"
                title="Set a different photo as your profile picture to delete this one"
              >
                Profile
              </span>
            ) : (
              <span className="photos-tile-actions">
                <button
                  type="button"
                  className="photos-tile-btn"
                  onClick={() => handleSetAvatar(path)}
                  disabled={busyId === id}
                  aria-label="Make this your profile picture"
                  title="Make profile picture"
                >
                  ★
                </button>
                {tiles.length > 1 && (
                  <button
                    type="button"
                    className="photos-tile-btn photos-tile-btn-delete"
                    onClick={() => handleDelete(id)}
                    disabled={busyId === id}
                    aria-label="Delete this photo"
                    title="Delete photo"
                  >
                    ✕
                  </button>
                )}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* A hidden file input keeps the native picker but lets us style the
          button however we like. */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="visually-hidden"
      />
      <button
        type="button"
        className="photos-add"
        onClick={() => fileInput.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Uploading…" : "Add photos"}
      </button>
    </div>
  );
}
