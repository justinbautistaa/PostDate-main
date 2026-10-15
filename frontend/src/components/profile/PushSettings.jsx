import { useEffect, useState } from "react";
import api from "../../api";
export default function PushSettings() {
  const supported = typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [enabled, setEnabled] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [config, setConfig] = useState(null);
  useEffect(() => { let active = true; if (supported) api.get("/push/config").then(({data}) => { if (active) setConfig(data); }).catch(() => { if (active) setMessage("Notification settings couldn’t load. Reopen Settings to try again."); }); return () => { active = false; }; }, [supported]);
  useEffect(() => { if (supported) navigator.serviceWorker.getRegistration("/").then(async registration => setEnabled(Boolean(await registration?.pushManager.getSubscription()))).catch(() => {}); }, [supported]);
  return <section><h3>Browser notifications</h3><p>Receive message and report updates outside the website on supported devices. Notification previews never include message text or report details.</p>{!supported ? <p>This browser doesn’t support push notifications here. Use a supported browser on the HTTPS website.</p> : <button type="button" className="outline-button" disabled={busy} onClick={async () => {
    if (busy) return;
    if (!enabled && !config?.enabled) { setMessage(config ? "The server needs notification keys before browser push can be enabled." : "Notification settings are still loading. Try again shortly."); return; }
    setBusy(true); setMessage("");
    // Request permission directly from the click, before any asynchronous work.
    const permission = !enabled ? Notification.requestPermission() : null;
    try {
      if (enabled) {
        const registration = await navigator.serviceWorker.getRegistration("/"); const subscription = await registration?.pushManager.getSubscription();
        if (subscription) { await api.post("/push/unsubscribe", { endpoint: subscription.endpoint }); await subscription.unsubscribe(); }
        setEnabled(false); setMessage("Browser notifications disabled.");
      } else {
        const data = config;
        if (await permission !== "granted") throw new Error("Notifications weren’t allowed. You can change this in your browser settings.");
        await navigator.serviceWorker.register("/push-sw.js"); const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
        const padded = data.publicKey + "=".repeat((4 - data.publicKey.length % 4) % 4);
        const key = Uint8Array.from(atob(padded.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        try { await api.post("/push/subscribe", subscription.toJSON()); } catch (error) { await subscription.unsubscribe(); throw error; }
        setEnabled(true); setMessage("Browser notifications enabled.");
      }
    } catch (error) { setMessage(error?.response?.data?.message || error.message || "Notifications could not be updated."); }
    finally { setBusy(false); }
  }}>{busy ? "Updating…" : enabled ? "Disable browser notifications" : "Enable browser notifications"}</button>}{message && <p role="status">{message}</p>}</section>;
}
