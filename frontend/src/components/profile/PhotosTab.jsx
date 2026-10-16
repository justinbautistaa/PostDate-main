import { useRef, useState } from "react";
import "./PhotosTab.css";
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
  const [failed, setFailed] = useState({});
  const locked = uploading || busyId !== null;

  const tiles = toTiles(photoPaths, avatarPath);

  async function handleFiles(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // lets the same file be picked again later
    if (files.length === 0) return;
    if (files.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) { setError("Choose up to 50 MB of photos per upload."); return; }

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


      <p style={{ margin: 0, font: "14px/1.7 Arial, sans-serif", color: "#795b55" }}>Upload your photos, then choose which one appears on your profile.</p>
      {error && (
        <p className="photos-error" role="alert">
          {error}
        </p>
      )}

      <p className="photos-guidance">JPG, PNG or WEBP · Up to 50 MB per upload · Static GIF also supported</p>
      {tiles.length === 0 && <p className="photos-empty">No photos yet. Add your first photo to get started.</p>}
      <div className="photos-grid">
        {tiles.map(({ id, url, span, isAvatar, path }) => (
          <div className={`photos-tile photos-${span}${isAvatar ? " photos-tile-avatar" : ""}`} key={id}>
            <div className="photos-image">
              {url && !failed[path] ? <img src={url} alt={isAvatar ? "Current profile photo" : "Uploaded photo"} onError={() => setFailed(prev => ({ ...prev, [path]: true }))} /> : <div className="photos-missing"><strong>Photo unavailable</strong><span>Try uploading this photo again.</span></div>}
            </div>

            {isAvatar ? (
              <span
                className="photos-tile-badge"
                title="Set a different photo as your profile picture to delete this one"
              >
                ✓ Profile photo
              </span>
            ) : (
              <span className="photos-tile-actions">
                <button
                  type="button"
                  className="photos-tile-btn"
                  onClick={() => handleSetAvatar(path)}
                  disabled={locked || !!failed[path]}
                  aria-label="Make this your profile picture"
                  title="Make profile picture"
                >
                  {busyId === id ? "Updating…" : "Use as profile"}
                </button>
                {tiles.length > 1 && (
                  <button
                    type="button"
                    className="photos-tile-btn photos-tile-btn-delete"
                    onClick={() => handleDelete(id)}
                    disabled={locked}
                    aria-label="Delete this photo"
                    title="Delete photo"
                  >
                    Delete
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
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleFiles}
        className="visually-hidden"
      />
      <button
        type="button"
        className="photos-add"
        onClick={() => fileInput.current?.click()}
        disabled={locked}
      >
        {uploading ? "Uploading…" : "Add photos"}
      </button>
    </div>
  );
}
