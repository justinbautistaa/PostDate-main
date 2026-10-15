function asString(value, max = 1000) {
  return typeof value === "string" ? value.slice(0, max) : "";
}
function escapeRegex(value) { return asString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function isObjectIdString(value) { return typeof value === "string" && /^[a-f\d]{24}$/i.test(value); }
function parsePage(query, { defaultLimit = 15 } = {}) {
  const number = (value, fallback, max) => {
    if (typeof value !== "string" || !/^-?\d+$/.test(value)) return fallback;
    return Math.min(max, Math.max(1, Number(value)));
  };
  const page = number(query.page, 1, 10000);
  const limit = number(query.limit, defaultLimit, 50);
  return { page, limit, skip: (page - 1) * limit };
}
function pageInfo(total, { page, limit }) { return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) }; }
function seriesStart(days, now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return start;
}
function buildDaySeries(rows, days, now = new Date()) {
  const counts = new Map(rows.map((row) => [row._id, row.count]));
  const start = seriesStart(days, now);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    return { date, count: counts.get(date) || 0 };
  });
}
function maskEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return "";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}
function fullName(user) { return user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed" : "Unknown"; }
function clip(value, max = 180) {
  const text = asString(value, Number.MAX_SAFE_INTEGER);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
module.exports = { asString, escapeRegex, isObjectIdString, parsePage, pageInfo, seriesStart, buildDaySeries, maskEmail, fullName, clip };
