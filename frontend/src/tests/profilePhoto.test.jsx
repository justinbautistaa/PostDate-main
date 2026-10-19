import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ProfilePhoto from "../components/ProfilePhoto";

it("replaces a failed photo without leaving a broken image and retries a new URL", () => {
  const { rerender } = render(<ProfilePhoto src="/old.webp" name="Alex Rivera" alt="Alex" large />);
  fireEvent.error(screen.getByRole("img", { name: "Alex" }));
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("Photo unavailable")).toBeTruthy();
  expect(screen.getByText("AR")).toBeTruthy();
  rerender(<ProfilePhoto src="/new.webp" name="Alex Rivera" alt="Alex" large />);
  expect(screen.getByRole("img", { name: "Alex" }).getAttribute("src")).toBe("/new.webp");
  expect(screen.queryByText("Photo unavailable")).toBeNull();
});

it("retries transient upload failures twice and then stops", async () => {
  vi.useFakeTimers();
  try {
    render(<ProfilePhoto src="/uploads/photo.webp" name="Alex" alt="Alex" large />);
    fireEvent.error(screen.getByRole("img", { name: "Alex" }));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole("img").getAttribute("src")).toBe("/uploads/photo.webp?photo_retry=1");
    fireEvent.error(screen.getByRole("img"));
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByRole("img").getAttribute("src")).toBe("/uploads/photo.webp?photo_retry=2");
    fireEvent.error(screen.getByRole("img"));
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Photo unavailable")).toBeTruthy();
  } finally { vi.useRealTimers(); }
});

it("cancels pending retries on unmount and preserves signed external URLs", async () => {
  vi.useFakeTimers();
  try {
    const src = "https://photos.example/signed.webp?signature=keep";
    const { unmount } = render(<ProfilePhoto src={src} alt="Alex" />);
    fireEvent.error(screen.getByRole("img"));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole("img").getAttribute("src")).toBe(src);
    fireEvent.error(screen.getByRole("img"));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});
