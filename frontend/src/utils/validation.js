export function validPassword(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length >= 8 && new TextEncoder().encode(value).length <= 72;
}
export function ageFromBirthdate(value, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const dob = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(dob.getTime()) || dob.toISOString().slice(0, 10) !== value) return NaN;
  return now.getUTCFullYear() - dob.getUTCFullYear() - Number(now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate()));
}
