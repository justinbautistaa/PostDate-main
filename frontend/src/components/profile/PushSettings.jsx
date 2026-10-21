import { useEffect, useState } from "react";
import api from "../../api";
async function waitForPush(operation) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Notification setup took too long. Reload the page and try again.")), 15000);
    })]);
  } finally { clearTimeout(timer); }
}
export default function PushSettings() {
  const supported = typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [enabled, setEnabled] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [config, setConfig] = useState(null), [checking, setChecking] = useState(supported);
  useEffect(() => { let active = true; if (supported) api.get("/push/config").then(({data}) => { if (active) setConfig(data); }).catch(() => { if (active) setMessage("Notification settings couldn’t load. Reopen Settings to try again."); }); return () => { active = false; }; }, [supported]);
  useEffect(() => {
    let active = true;
    if (supported) (async () => {
      try {
        const registration = await waitForPush(navigator.serviceWorker.getRegistration("/"));
        const subscription = await waitForPush(registration?.pushManager.getSubscription());
        const status = subscription ? (await api.post("/push/status", { endpoint: subscription.endpoint })).data : null;
        if (active) setEnabled(Boolean(status?.enabled) && Notification.permission === "granted");
      } catch { if (active) setMessage("Notification status couldn’t be checked. Try enabling notifications again."); }
      finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, [supported]);
  return <section><h3>Browser notifications</h3><p>Receive message and report updates outside the website on supported devices. Notification previews never include message text or report details.</p>{!supported ? <p>This browser doesn’t support push notifications here. Use a supported browser on the HTTPS website.</p> : <button type="button" className="outline-button" disabled={busy || checking} onClick={async () => {
    if (busy) return;
    if (!enabled && !config?.enabled) { setMessage(config ? "The server needs notification keys before browser push can be enabled." : "Notification settings are still loading. Try again shortly."); return; }
    setBusy(true); setMessage("");
    try {
      // Keep permission inside the error handler, but before any await so it
      // still belongs to the user's click on browsers that require activation.
      const permission = !enabled ? Notification.requestPermission() : null;
      if (enabled) {
        const registration = await waitForPush(navigator.serviceWorker.getRegistration("/")); const subscription = await waitForPush(registration?.pushManager.getSubscription());
        if (subscription) { await api.post("/push/unsubscribe", { endpoint: subscription.endpoint }); await waitForPush(subscription.unsubscribe()); }
        setEnabled(false); setMessage("Browser notifications disabled.");
      } else {
        const data = config;
        if (await permission !== "granted") throw new Error("Notifications weren’t allowed. You can change this in your browser settings.");
        await waitForPush(navigator.serviceWorker.register("/push-sw.js")); const registration = await waitForPush(navigator.serviceWorker.ready);
        let subscription = await waitForPush(registration.pushManager.getSubscription());
        if (subscription) await waitForPush(subscription.unsubscribe());
        const padded = data.publicKey + "=".repeat((4 - data.publicKey.length % 4) % 4);
        const key = Uint8Array.from(atob(padded.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
        subscription = await waitForPush(registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
        try { await api.post("/push/subscribe", subscription.toJSON()); } catch (error) { await waitForPush(subscription.unsubscribe()).catch(() => {}); throw error; }
        setEnabled(true); setMessage("Browser notifications enabled.");
      }
    } catch (error) { setMessage(error?.response?.data?.message || error.message || "Notifications could not be updated."); }
    finally { setBusy(false); }
  }}>{busy ? "Updating…" : checking ? "Checking notifications…" : enabled ? "Disable browser notifications" : "Enable browser notifications"}</button>}{message && <p role="status">{message}</p>}</section>;
}
