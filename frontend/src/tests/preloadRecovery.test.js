import { expect, it, vi } from "vitest";
import { installPreloadRecovery } from "../services/preloadRecovery";

it("recovers a failed page import once, including after reload, without looping", () => {
  const target = new EventTarget(), values = new Map();
  const storage = () => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) });
  const reload = vi.fn();
  let time = 100000;
  const emit = () => { const event = new Event("vite:preloadError", { cancelable: true }); target.dispatchEvent(event); return event; };
  let stop = installPreloadRecovery(target, storage, () => time, reload);
  expect(emit().defaultPrevented).toBe(true);
  emit(); expect(reload).toHaveBeenCalledTimes(1);
  stop(); stop = installPreloadRecovery(target, storage, () => time, reload);
  expect(emit().defaultPrevented).toBe(false);
  expect(reload).toHaveBeenCalledTimes(1);
  time += 61000; emit(); expect(reload).toHaveBeenCalledTimes(2);
  stop(); emit(); expect(reload).toHaveBeenCalledTimes(2);
});
it("keeps manual recovery for offline tabs and unavailable browser storage", () => {
  const target = new EventTarget(), reload = vi.fn(), storage = vi.fn(() => { throw new Error("disabled"); });
  target.navigator = { onLine: false };
  const stop = installPreloadRecovery(target, storage, Date.now, reload);
  target.dispatchEvent(new Event("vite:preloadError"));
  expect(storage).not.toHaveBeenCalled();
  target.navigator.onLine = true;
  target.dispatchEvent(new Event("vite:preloadError"));
  expect(reload).not.toHaveBeenCalled(); stop();
});
