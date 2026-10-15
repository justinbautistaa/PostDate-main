import { API_ORIGIN } from "../api";

export function subscribeToNotices(onChange) {
  if (typeof EventSource === "undefined") return () => {};
  const stream = new EventSource(`${API_ORIGIN}/api/workspace/announcements/live`, { withCredentials: true });
  stream.addEventListener("notices", onChange);
  // EventSource reconnects automatically after network interruptions.
  return () => stream.close();
}
