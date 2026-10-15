import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Discover from "../pages/Discover";
import Profile from "../pages/Profile";
import * as api from "../services/postdateApi";
vi.mock("../components/AppNav", () => ({ default: () => <nav>Member navigation</nav> }));
vi.mock("../services/postdateApi", () => ({ getDiscoverProfiles: vi.fn(), likeProfile: vi.fn(), passProfile: vi.fn(), getProfile: vi.fn(), getTasteOptions: vi.fn(), toPhotoUrl: p => p, updateProfileDetails: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  api.getTasteOptions.mockResolvedValue({ personality: ["Kind", "Curious", "Creative"], lookingFor: [], limits: { minPersonality: 3, maxPersonality: 5, maxLookingFor: 5 } });
});
const person = (id, name) => ({ id, name, age: 25, gender: "Female", distanceMi: null, photoUrl: null });
it("discovery offers retry on failure without claiming the search was empty", async () => {
  api.getDiscoverProfiles.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ profiles: [person("a", "Alex")], nextCursor: null });
  render(<MemoryRouter><Discover /></MemoryRouter>);
  await screen.findByRole("alert");
  expect(screen.queryByText(/Nobody matches/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("Alex, 25");
});
it("discovery keeps existing profiles while loading another page and passes its cursor", async () => {
  let finish;
  api.getDiscoverProfiles.mockResolvedValueOnce({ profiles: [person("a", "Alex")], nextCursor: "next-page" }).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<MemoryRouter><Discover /></MemoryRouter>);
  await screen.findByText("Alex, 25");
  fireEvent.click(screen.getByRole("button", { name: "Load more profiles" }));
  expect(screen.getByText("Alex, 25")).toBeTruthy();
  await waitFor(() => expect(api.getDiscoverProfiles).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "next-page" })));
  finish({ profiles: [person("b", "Bea")], nextCursor: null });
  await screen.findByText("Bea, 25");
  expect(screen.getByText("Alex, 25")).toBeTruthy();
});
it("profile retries a failed load and exposes real settings links", async () => {
  api.getProfile.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ name: "Alex", tags: [], lookingFor: [], photoPaths: [], reviews: [] });
  render(<MemoryRouter><Profile /></MemoryRouter>);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Alex" });
  fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
  expect(screen.getByRole("link", { name: /password recovery/ }).getAttribute("href")).toBe("/login");
  expect(screen.getByRole("link", { name: /date planner/ }).getAttribute("href")).toBe("/dashboard#date-planner");
  expect(screen.queryByText("stuff")).toBeNull();
});
