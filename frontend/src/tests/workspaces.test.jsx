import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AdminDashboard from "../pages/AdminDashboard";
import UserDashboard from "../pages/UserDashboard";
import RequireAuth from "../components/RequireAuth";
import { setSession } from "../auth";
import * as admin from "../services/adminApi";
import * as api from "../services/postdateApi";
import http from "../api";
vi.mock("../api", () => ({ default: { get: vi.fn() } }));
vi.mock("../services/adminApi", async importOriginal => ({ ...(await importOriginal()), getAdminOverview: vi.fn(), getAdminReports: vi.fn(), getAdminUsers: vi.fn(), suspendUser: vi.fn(), setUserRole: vi.fn() }));
vi.mock("../services/postdateApi", () => ({ getProfile: vi.fn(), toPhotoUrl: p => p }));
beforeEach(() => {
  vi.resetAllMocks(); setSession(null);
  http.get.mockResolvedValue({ data: [] });
  admin.getAdminOverview.mockResolvedValue({ activeCount: 3, pendingReports: 2, pendingAppeals: 1 });
  admin.getAdminReports.mockResolvedValue({ rows: [], page: 1, pages: 1, total: 0, limit: 20 });
  admin.getAdminUsers.mockResolvedValue({ rows: [], page: 1, pages: 1, total: 0, limit: 12 });
});
it.each([false, true])("member home switches to connection ideas only when profile essentials are complete: %s", async complete => {
  setSession({ userId: "alice", role: "user" });
  api.getProfile.mockResolvedValue({ name: "Alice Example", bio: "I love hiking", tags: ["Hiking"], photoPaths: ["photo.webp"], lookingFor: complete ? ["Friendship first"] : [] });
  render(<MemoryRouter><UserDashboard /></MemoryRouter>);
  if (complete) {
    await screen.findByRole("heading", { name: "You’re ready to connect." });
    expect(screen.queryByRole("heading", { name: "Make a first impression." })).toBeNull();
    expect(screen.getByRole("link", { name: /Find your kind of person/ }).getAttribute("href")).toBe("/discover");
    expect(screen.getByRole("link", { name: /Start a conversation/ }).getAttribute("href")).toBe("/messages");
  } else {
    await screen.findByRole("heading", { name: "Make a first impression." });
    expect(screen.queryByRole("heading", { name: "You’re ready to connect." })).toBeNull();
    expect(screen.getByText("3 of 4")).toBeTruthy();
  }
});
it("staff gets moderation tools without administrator activity access", async () => {
  render(<MemoryRouter><AdminDashboard role="moderator" /></MemoryRouter>);
  const nav = screen.getByRole("navigation", { name: "Staff navigation" });
  expect(within(nav).getByRole("button", { name: /Reports/ })).toBeTruthy();
  expect(within(nav).queryByRole("button", { name: /Staff activity/ })).toBeNull();
  expect(within(nav).queryByRole("button", { name: /Staff management|Statistics/ })).toBeNull();
  expect(await screen.findByText("3 active now")).toBeTruthy();
});
it.each(["admin", "moderator"])("%s compact menu closes after selecting a workspace section", async role => {
  render(<MemoryRouter><AdminDashboard role={role} /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Open workspace menu" }));
  expect(screen.getByRole("button", { name: "Close workspace menu" }).getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(within(screen.getByRole("navigation", { name: role === "admin" ? "Admin navigation" : "Staff navigation" })).getByRole("button", { name: "Reports" }));
  expect(screen.getByRole("button", { name: "Open workspace menu" }).getAttribute("aria-expanded")).toBe("false");
  await screen.findByRole("heading", { name: "Reports" });
});
it("admin staff management loads only team accounts", async () => {
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Admin navigation" })).getByRole("button", { name: "Staff management" }));
  await screen.findByRole("heading", { name: "Staff management" });
  expect(admin.getAdminUsers).toHaveBeenCalledWith({ q: "", status: "all", role: "", team: "true", page: 1 });
});
const memberRow = { id: "member-1", name: "Alex Member", email: "alex@example.test", role: "user", status: "active", verified: true, rating: { average: null, count: 0 }, reports: { total: 0, open: 0 }, can: { suspend: true, changeRole: true } };
it("admin confirms a suspension with a reason and refreshes the member list", async () => {
  admin.getAdminUsers.mockResolvedValue({ rows: [memberRow], page: 1, pages: 1, total: 1, limit: 12 });
  admin.suspendUser.mockResolvedValue({});
  render(<MemoryRouter initialEntries={["/admin?section=users"]}><AdminDashboard /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Suspend" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Repeated harassment reports" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Suspend member" }));
  await waitFor(() => expect(admin.suspendUser).toHaveBeenCalledWith("member-1", "Repeated harassment reports"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(admin.getAdminUsers.mock.calls.length).toBeGreaterThan(1);
});
it("admin confirms a role change for the selected member", async () => {
  admin.getAdminUsers.mockResolvedValue({ rows: [memberRow], page: 1, pages: 1, total: 1, limit: 12 });
  admin.setUserRole.mockResolvedValue({});
  render(<MemoryRouter initialEntries={["/admin?section=users"]}><AdminDashboard /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Role for Alex Member"), { target: { value: "moderator" } });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Change role" }));
  await waitFor(() => expect(admin.setUserRole).toHaveBeenCalledWith("member-1", "moderator"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("switching admin sections resets the content scroll position", async () => {
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
  const main = screen.getByRole("main");
  main.scrollTop = 600;
  fireEvent.click(within(screen.getByRole("navigation", { name: "Admin navigation" })).getByRole("button", { name: "Users" }));
  await screen.findByText("No members yet");
  expect(main.scrollTop).toBe(0);
});
it("admin overview opens the live report queue", async () => {
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
  expect(within(screen.getByRole("navigation", { name: "Admin navigation" })).getByRole("button", { name: /Staff activity/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Review reports" }));
  await screen.findByRole("heading", { name: "Reports" });
  expect(admin.getAdminReports).toHaveBeenCalledWith({ status: "pending", page: 1 });
});
it("overview failures expose retry and preserve unknown counters", async () => {
  admin.getAdminOverview.mockRejectedValueOnce(new Error("offline"));
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
  await screen.findByRole("alert");
  expect(screen.queryByText("0 active now")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("3 active now");
  expect(screen.queryByRole("alert")).toBeNull();
});
it("member home calculates completion from the actual profile", async () => {
  api.getProfile.mockResolvedValue({ name: "Alice Example", age: 25, gender: "female", bio: "Hello there", tags: ["Hiking"], lookingFor: [], photoPaths: [], avatarPath: null });
  render(<MemoryRouter><UserDashboard /></MemoryRouter>);
  await screen.findByText("Hello, Alice.");
  expect(screen.getByRole("progressbar").value).toBe(2);
  expect(screen.getByRole("link", { name: /Meet the community/ }).getAttribute("href")).toBe("/discover");
});
it("member home handles missing optional profile details", async () => {
  api.getProfile.mockResolvedValue({});
  render(<MemoryRouter><UserDashboard /></MemoryRouter>);
  await screen.findByText("Hello, You.");
  expect(screen.getByRole("progressbar").value).toBe(0);
});
it("member accounts cannot open a staff workspace", () => {
  setSession({ userId: "member", role: "user" });
  render(<MemoryRouter initialEntries={["/staff"]}><Routes><Route path="/staff" element={<RequireAuth role="moderator">Private staff workspace</RequireAuth>} /><Route path="/" element={<p>Public home</p>} /></Routes></MemoryRouter>);
  expect(screen.getByText("Public home")).toBeTruthy();
  expect(screen.queryByText("Private staff workspace")).toBeNull();
});
it("profile content is rendered as text rather than executable HTML", async () => {
  const payload = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
  api.getProfile.mockResolvedValue({ name: "Alice", bio: payload, tags: [payload] });
  const { container } = render(<MemoryRouter><UserDashboard /></MemoryRouter>);
  await screen.findByText("Hello, Alice.");
  expect(screen.getAllByText(payload).length).toBeGreaterThan(0);
  expect(container.querySelector("script, img[onerror]")).toBeNull();
});
