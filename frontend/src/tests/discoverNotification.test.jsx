import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Discover from "../pages/Discover";
import * as api from "../services/postdateApi";
vi.mock("../components/AppNav", () => ({ default: () => null }));
vi.mock("../services/postdateApi", () => ({ getDiscoverProfiles: vi.fn(), getDiscoverProfile: vi.fn(), likeProfile: vi.fn(), passProfile: vi.fn() }));
it("opens the exact notification profile even outside the feed and opens chat after liking back", async () => {
  api.getDiscoverProfiles.mockResolvedValue({ profiles: [], nextCursor: null });
  api.getDiscoverProfile.mockResolvedValue({ id: "alice", name: "Alice", age: 25, bio: "Hello" });
  api.likeProfile.mockResolvedValue({ matched: true, matchId: "match-1" });
  render(<MemoryRouter initialEntries={["/discover?profile=alice"]}><Routes><Route path="/discover" element={<Discover />} /><Route path="/messages" element={<h1>Matched chat</h1>} /></Routes></MemoryRouter>);
  expect(await screen.findByRole("dialog", { name: "Alice's profile" })).toBeTruthy();
  expect(api.getDiscoverProfile).toHaveBeenCalledWith("alice");
  fireEvent.click(screen.getByRole("button", { name: "Like Alice" }));
  expect(await screen.findByRole("heading", { name: "Matched chat" })).toBeTruthy();
  expect(api.likeProfile).toHaveBeenCalledWith("alice");
});
