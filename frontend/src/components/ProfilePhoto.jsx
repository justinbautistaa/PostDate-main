import { useState } from "react";
import "./ProfilePhoto.css";

// Remember the failed URL, not just a boolean, so a replacement photo can load.
export default function ProfilePhoto({ src, name = "", alt = "", className = "", large = false, fill = false }) {
  const [failed, setFailed] = useState(null);
  if (src && src !== failed) return <img className={className} src={src} alt={alt} onError={() => setFailed(src)} />;
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "♡";
  return <span className={`profile-photo-fallback ${large ? "profile-photo-fallback-large" : ""} ${fill ? "profile-photo-fallback-fill" : ""} ${className}`}>
    <span aria-hidden="true">{initials}</span>{large && <small>{src ? "Photo unavailable" : "No photo shared"}</small>}
  </span>;
}
