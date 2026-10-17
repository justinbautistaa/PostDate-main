import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import useAdminQuery from "../components/admin/useAdminQuery";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;
it("refreshes server status without overlapping requests and stops after unmount", async () => {
  vi.useFakeTimers();
  let resolve;
  const fetcher = vi.fn().mockResolvedValueOnce({ status: "active" })
    .mockImplementationOnce(() => new Promise(done => { resolve = done; }))
    .mockResolvedValue({ status: "suspended" });
  const { result, unmount } = renderHook(() => useAdminQuery(fetcher, [], { refreshMs: 10000 }), { wrapper });
  await act(async () => {});
  expect(result.current.data.status).toBe("active");
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(result.current.loading).toBe(false);
  await act(async () => { window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(20000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async () => { resolve({ status: "suspended" }); });
  expect(result.current.data.status).toBe("suspended");
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); window.dispatchEvent(new Event("focus")); });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("refreshes on return to the tab and skips polling while hidden", async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const fetcher = vi.fn().mockResolvedValue({ rows: [] });
  const { unmount } = renderHook(() => useAdminQuery(fetcher, [], { refreshMs: 10000 }), { wrapper });
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue("visible");
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  unmount();
});
