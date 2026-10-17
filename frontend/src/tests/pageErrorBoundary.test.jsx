import React, { lazy, Suspense } from "react";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PageErrorBoundary from "../components/PageErrorBoundary";

it("offers recovery when a deployed page chunk is unavailable", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const Page = lazy(() => Promise.reject(new Error("Unable to load page chunk")));
  try {
    render(<PageErrorBoundary><Suspense fallback={<p>Loading</p>}><Page /></Suspense></PageErrorBoundary>);
    expect(await screen.findByRole("button", { name: "Reload page" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("This page could not load");
  } finally { log.mockRestore(); }
});
