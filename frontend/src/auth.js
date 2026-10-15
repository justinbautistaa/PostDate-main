import api from "./api";

// Only non-secret session metadata lives in memory. The credential is an
// HttpOnly cookie: browser JavaScript cannot read it.
let session = null;
try { localStorage.removeItem("token"); } catch { /* storage can be disabled */ }
export function setSession(value) { session = value; }
export function clearToken() { session = null; }
export function isAuthenticated() { return Boolean(session?.userId); }
export function getRole() { return session?.role ?? null; }
export async function restoreSession() {
  try {
    const { data } = await api.get("/auth/session");
    setSession(data);
  } catch { clearToken(); }
}
export async function logout() {
  // Wait for server revocation before claiming the user has logged out.
  await api.post("/auth/logout");
  try { const registration = await navigator.serviceWorker?.getRegistration("/"); await (await registration?.pushManager.getSubscription())?.unsubscribe(); } catch { /* Server revocation already stops this account's push delivery. */ }
  clearToken();
}
