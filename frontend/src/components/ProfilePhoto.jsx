import { useEffect, useState } from "react";
import "./ProfilePhoto.css";

// Remember the failed URL, not just a boolean, so a replacement photo can load.
export default function ProfilePhoto({ src, name = "", alt = "", className = "", large = false, fill = false }) {
  return <PhotoWithRetry key={src || "empty"} {...{ src, name, alt, className, large, fill }} />;
}

function PhotoWithRetry({ src, name, alt, className, large, fill }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!failed || !src || attempt >= 2) return;
    const timer = setTimeout(() => { setAttempt(value => value + 1); setFailed(false); }, attempt === 0 ? 1000 : 3000);
    return () => clearTimeout(timer);
  }, [failed, src, attempt]);
  // A cold host or transient storage error must not leave the fallback stuck
  // forever. Retry twice, preserving normal cookie-based photo authorization.
  // Bust failed-response caches only for our own upload paths, never signed URLs.
  const retrySrc = attempt && src?.startsWith("/uploads/") ? `${src}${src.includes("?") ? "&" : "?"}photo_retry=${attempt}` : src;
  if (src && !failed) return <img key={attempt} className={className} src={retrySrc} alt={alt} onError={() => setFailed(true)} />;
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "♡";
  return <span className={`profile-photo-fallback ${large ? "profile-photo-fallback-large" : ""} ${fill ? "profile-photo-fallback-fill" : ""} ${className}`}>
    <span aria-hidden="true">{initials}</span>{large && <small>{src ? "Photo unavailable" : "No photo shared"}</small>}
  </span>;
}
