import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import PushSettings from "../components/profile/PushSettings";
import api from "../api";
vi.mock("../api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const original = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); if (original) Object.defineProperty(navigator, "serviceWorker", original); else delete navigator.serviceWorker; vi.resetAllMocks(); });
it("asks permission only after a click and does not subscribe when permission is denied", async () => {
  const permission = vi.fn().mockResolvedValue("denied"), register = vi.fn();
  vi.stubGlobal("isSecureContext", true); vi.stubGlobal("PushManager", class {}); vi.stubGlobal("Notification", { requestPermission: permission });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: vi.fn().mockResolvedValue(undefined), register } });
  api.get.mockResolvedValue({ data: { enabled: true, publicKey: "test-public-key" } });
  render(<PushSettings />);
  await act(async () => {});
  expect(permission).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Enable browser notifications" }));
  expect(permission).toHaveBeenCalledOnce();
  await screen.findByText(/Notifications weren’t allowed/);
  expect(register).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});

function supportedBrowser({ serverEnabled = false, permission = "granted", requestPermission = vi.fn().mockResolvedValue("granted") } = {}) {
  const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/test", unsubscribe: vi.fn().mockResolvedValue(true), toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/new", keys: {} }) };
  const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription), subscribe: vi.fn().mockResolvedValue(subscription) } };
  vi.stubGlobal("isSecureContext", true); vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission, requestPermission });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: vi.fn().mockResolvedValue(registration), register: vi.fn().mockResolvedValue(registration), ready: Promise.resolve(registration) } });
  api.get.mockResolvedValue({ data: { enabled: true, publicKey: "a".repeat(87) } });
  api.post.mockImplementation(path => Promise.resolve({ data: path === "/push/status" ? { enabled: serverEnabled } : {} }));
  return { registration, subscription, requestPermission };
}
it("repairs a browser subscription that the server no longer recognizes", async () => {
  const { subscription } = supportedBrowser();
  render(<PushSettings />);
  const enable = await screen.findByRole("button", { name: "Enable browser notifications" });
  expect(api.post).toHaveBeenCalledWith("/push/status", { endpoint: subscription.endpoint });
  fireEvent.click(enable);
  await screen.findByText("Browser notifications enabled.");
  expect(api.post).toHaveBeenCalledWith("/push/subscribe", subscription.toJSON());
  expect(screen.getByRole("button", { name: "Disable browser notifications" })).toBeTruthy();
});
it("requires both current server registration and browser permission before reporting enabled", async () => {
  supportedBrowser({ serverEnabled: true, permission: "denied" });
  render(<PushSettings />);
  await screen.findByRole("button", { name: "Enable browser notifications" });
});
it("allows disabling a confirmed subscription without asking permission", async () => {
  const { subscription, requestPermission } = supportedBrowser({ serverEnabled: true });
  render(<PushSettings />);
  fireEvent.click(await screen.findByRole("button", { name: "Disable browser notifications" }));
  await screen.findByText("Browser notifications disabled.");
  expect(requestPermission).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledWith("/push/unsubscribe", { endpoint: subscription.endpoint });
});
it("recovers the button when a browser throws synchronously while requesting permission", async () => {
  supportedBrowser({ requestPermission: vi.fn(() => { throw new Error("Browser permission unavailable"); }) });
  render(<PushSettings />);
  fireEvent.click(await screen.findByRole("button", { name: "Enable browser notifications" }));
  await screen.findByText("Browser permission unavailable");
  expect(screen.getByRole("button", { name: "Enable browser notifications" }).disabled).toBe(false);
});
it("stops loading when service worker activation never finishes", async () => {
  supportedBrowser();
  navigator.serviceWorker.ready = new Promise(() => {});
  render(<PushSettings />);
  const button = await screen.findByRole("button", { name: "Enable browser notifications" });
  vi.useFakeTimers();
  fireEvent.click(button);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(15001); });
  expect(screen.getByText(/Notification setup took too long/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Enable browser notifications" }).disabled).toBe(false);
});
