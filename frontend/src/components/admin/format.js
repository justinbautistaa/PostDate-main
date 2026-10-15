/**
 * format
 * Small display helpers for the staff dashboard. Pure functions: no React, no
 * network, so they're easy to check on their own.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatNumber(n) {
  return Number(n ?? 0).toLocaleString("en-US");
}

/** "2026-09-03" (a day key from the API) -> "Sep 3". Parsed by hand so the time zone can't shift it. */
export function shortDate(dayKey) {
  const [, m, d] = String(dayKey).split("-").map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : String(dayKey);
}

/** ISO timestamp -> "12 Sep 2026" in the viewer's own time zone. */
export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO timestamp -> "just now", "5 min ago", "3 h ago", "2 d ago", then a date. */
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(iso);
}

export function initials(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/**
 * "This week against last week" as a short phrase for under a stamp's numeral.
 * Returns { text, direction } where direction is "up" | "down" | "flat".
 */
export function trendText(current, previous) {
  if (!current && !previous) return { text: "Quiet this week", direction: "flat" };
  if (!previous) return { text: `${formatNumber(current)} new this week`, direction: "up" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: "Same as last week", direction: "flat" };
  return { text: `${pct > 0 ? "+" : "\u2212"}${Math.abs(pct)}% vs last week`, direction: pct > 0 ? "up" : "down" };
}

/** "user" -> "Member", so the UI never shows the internal role name. */
export function roleLabel(role) {
  return { user: "Member", moderator: "Moderator", admin: "Admin" }[role] ?? "—";
}
