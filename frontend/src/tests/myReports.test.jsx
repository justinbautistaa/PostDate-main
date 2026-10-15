import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyReports from "../pages/MyReports";
import api from "../api";
vi.mock("../api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("../components/AppNav", () => ({ default: () => <nav>Member menu</nav> }));
const report = { id: "r1", reason: "Harassment", description: "My concern", targetType: "message", status: "pending", createdAt: "2026-10-16T00:00:00Z" };
beforeEach(() => vi.resetAllMocks());
it("shows reports and refreshes the admin decision", async () => {
  api.get.mockResolvedValue({ data: { reports: [report], nextCursor: null } });
  render(<MemoryRouter><MyReports /></MemoryRouter>);
  await screen.findByText("Pending");
  expect(screen.getByText("My concern")).toBeTruthy();
  api.get.mockResolvedValue({ data: { reports: [{ ...report, status: "resolved", resolvedAt: "2026-10-16T01:00:00Z" }], nextCursor: null } });
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
  await screen.findByText("Resolved");
  expect(screen.getByText(/finished handling/)).toBeTruthy();
});
it("distinguishes an empty list from a failed request and supports retry", async () => {
  api.get.mockRejectedValue(new Error("offline"));
  render(<MemoryRouter><MyReports /></MemoryRouter>);
  await screen.findByRole("alert");
  expect(screen.queryByText("No reports submitted.")).toBeNull();
  api.get.mockResolvedValue({ data: { reports: [], nextCursor: null } });
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
  await screen.findByText("No reports submitted.");
});
it("automatically refreshes report status after a live update", async () => {
  api.get.mockResolvedValue({ data: { reports: [report], nextCursor: null } });
  render(<MemoryRouter><MyReports /></MemoryRouter>);
  await screen.findByText("Pending");
  api.post.mockResolvedValue({});
  api.get.mockResolvedValue({ data: { reports: [{ ...report, status: "resolved", updatedAt: "2026-10-16T01:00:00Z" }], nextCursor: null } });
  window.dispatchEvent(new Event("postdate:report-update"));
  await screen.findByText("Resolved");
  expect(screen.getByText("Your report status has been updated.")).toBeTruthy();
});
