// A tab opened before a deploy can still reference removed page chunks.
// Persist the retry guard across reloads so offline/provider failures cannot loop.
export function installPreloadRecovery(target = window, storage = () => window.sessionStorage, now = Date.now, reload = () => window.location.reload()) {
  let recovering = false;
  const recover = event => {
    if (recovering) { event.preventDefault(); return; }
    if (target.navigator?.onLine === false) return;
    try {
      const current = now();
      const last = Number(storage().getItem("postdate:preload-retry"));
      if (last > 0 && current - last < 60000) return;
      storage().setItem("postdate:preload-retry", String(current));
    } catch { return; } // Keep the manual recovery screen if storage is disabled.
    recovering = true;
    event.preventDefault();
    reload();
  };
  target.addEventListener("vite:preloadError", recover);
  return () => target.removeEventListener("vite:preloadError", recover);
}
