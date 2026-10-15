self.addEventListener("push", event => {
  let data;
  try { data = event.data?.json(); } catch { data = null; }
  if (!data) return;
  const url = typeof data.url === "string" && /^\/(?:messages\?match=[a-f\d]{24}|my-reports)$/.test(data.url) ? data.url : "/dashboard";
  event.waitUntil(self.registration.showNotification(data.title || "PostDate update", { body: "Open PostDate to view your update.", tag: url, data: { url } }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(new URL(event.notification.data?.url || "/dashboard", self.location.origin).href));
});
