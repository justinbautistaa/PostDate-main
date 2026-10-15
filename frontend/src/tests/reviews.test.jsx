import React from "react";
import { expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReviewForm from "../components/ReviewForm";
import MatchHistory from "../components/MatchHistory";
import { MemoryRouter } from "react-router-dom";
import { getMatchHistory } from "../services/postdateApi";
import api from "../api";
vi.mock("../api", () => ({ default: { post: vi.fn() } }));
vi.mock("../services/postdateApi", () => ({ getMatchHistory: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IntersectionObserver", class { constructor(callback) { this.callback = callback; } observe() { queueMicrotask(() => this.callback([{ isIntersecting: true }])); } disconnect() {} });
});
function fillScores() { for (const label of ["Overall", "Spark", "Attentiveness", "Respectfulness", "Chemistry"]) fireEvent.change(screen.getByLabelText(label), { target: { value: "4" } }); }
it("submits the selected match, five ratings and visibility choice", async () => {
  api.post.mockResolvedValue({ data: { reviewed: true } });
  const saved = vi.fn();
  render(<ReviewForm match={{ id: "match-1", partner: { name: "Alex" } }} onSaved={saved} />);
  fillScores();
  fireEvent.change(screen.getByLabelText("Your review"), { target: { value: "A good conversation" } });
  fireEvent.click(screen.getByLabelText("Show on their profile"));
  fireEvent.click(screen.getByRole("button", { name: "Submit review" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(api.post).toHaveBeenCalledWith("/reviews", { matchId: "match-1", comment: "A good conversation", isPublic: false, ratings: { overall: 4, spice: 4, attentiveness: 4, respectfulness: 4, chemistry: 4 } });
});
it("failed reviews retain the draft and never show success", async () => {
  api.post.mockRejectedValue(new Error("offline"));
  const saved = vi.fn();
  render(<ReviewForm match={{ id: "match-1", partner: { name: "Alex" } }} onSaved={saved} />);
  fillScores();
  fireEvent.change(screen.getByLabelText("Your review"), { target: { value: "Keep this draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit review" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Your review").value).toBe("Keep this draft");
  expect(saved).not.toHaveBeenCalled();
});
it("opens review from match history and refreshes the Reviewed state after saving", async () => {
  const match = { id: "match-1", matchedAt: "2026-10-15", reviewed: false, partner: { name: "Alex" } };
  getMatchHistory.mockResolvedValueOnce({ me: { name: "You" }, matches: [match], nextCursor: null })
    .mockResolvedValueOnce({ me: { name: "You" }, matches: [{ ...match, reviewed: true }], nextCursor: null });
  api.post.mockResolvedValue({});
  render(<MemoryRouter><MatchHistory /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Match history" }));
  fireEvent.click(await screen.findByRole("button", { name: "Review your match with Alex" }));
  await screen.findByRole("heading", { name: "Your experience with Alex" });
  fillScores();
  fireEvent.click(screen.getByRole("button", { name: "Submit review" }));
  await screen.findByRole("status");
  fireEvent.click(screen.getByRole("button", { name: "Match history" }));
  await screen.findByText("Reviewed");
  expect(screen.queryByRole("button", { name: "Review your match with Alex" })).toBeNull();
});
