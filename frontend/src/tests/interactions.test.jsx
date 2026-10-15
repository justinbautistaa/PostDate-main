import React, { StrictMode, useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TasteTab from "../components/profile/TasteTab";
import PhotosForm from "../components/PhotosForm";
import WhoAreYouForm from "../components/WhoAreYouForm";
import VerificationModal from "../components/VerificationModal";
import RequireAuth from "../components/RequireAuth";
import Discover from "../pages/Discover";
import Signup from "../pages/Signup";
import useAuthAction from "../components/auth/useAuthAction";
import { validPassword, ageFromBirthdate } from "../utils/validation";
import * as api from "../services/postdateApi";
import { setSession } from "../auth";
vi.mock("../services/postdateApi", () => ({ saveProfileTags: vi.fn(), sendVerificationCode: vi.fn(), verifyCode: vi.fn(), getSession: vi.fn(), getDiscoverProfiles: vi.fn(), likeProfile: vi.fn(), passProfile: vi.fn(), getTasteOptions: vi.fn(), submitSignup: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); api.getTasteOptions.mockResolvedValue({ personality: ["Hiking"], lookingFor: [], limits: { minPersonality: 1, maxPersonality: 5, maxLookingFor: 5 } }); });

describe("profile interests", () => {
  it("Cancel restores saved selections", async () => {
    const user = userEvent.setup();
    render(<TasteTab tags={[]} />);
    await user.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    await user.click(screen.getByRole("button", { name: "Hiking" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Hiking").classList.contains("taste-chip-on")).toBe(false);
    expect(api.saveProfileTags).not.toHaveBeenCalled();
  });
  it("saved selections survive leaving and returning to the tab", async () => {
    api.saveProfileTags.mockResolvedValue(["Hiking"]);
    function Harness() {
      const [tags, setTags] = useState([]);
      const [shown, setShown] = useState(true);
      return <><button onClick={() => setShown(v => !v)}>Switch tab</button>{shown && <TasteTab tags={tags} onTagsSaved={setTags} />}</>;
    }
    const user = userEvent.setup(); render(<Harness />);
    await user.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    await user.click(screen.getByRole("button", { name: "Hiking" }));
    await user.click(screen.getByRole("button", { name: /Save Your personality/ }));
    await waitFor(() => expect(api.saveProfileTags).toHaveBeenCalledWith(["Hiking"]));
    await user.click(screen.getByText("Switch tab")); await user.click(screen.getByText("Switch tab"));
    expect((await screen.findByText("Hiking")).classList.contains("taste-chip-on")).toBe(true);
  });
});

it("signup rejects a missing gender before proceeding", () => {
  const onContinue = vi.fn(); render(<WhoAreYouForm onContinue={onContinue} />);
  for (const [placeholder, value] of [["First name", "Test"], ["Last name", "User"], ["you@email.com", "test@example.com"], ["12+ characters", "Password123!"]])
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "1997-01-01" } });
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  expect(onContinue).not.toHaveBeenCalled();
  fireEvent.change(document.querySelector("select"), { target: { value: "female" } });
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  expect(onContinue).toHaveBeenCalledOnce();
});

it("photo previews are released on unmount", () => {
  URL.createObjectURL = vi.fn(() => "blob:test-photo"); URL.revokeObjectURL = vi.fn();
  const { container, unmount } = render(<PhotosForm />);
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(["data"], "photo.png", { type: "image/png" })] } });
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-photo");
});

it("saved signup photo previews are restored and released on unmount", () => {
  URL.createObjectURL = vi.fn(() => "blob:restored"); URL.revokeObjectURL = vi.fn();
  const file = new File(["data"], "photo.png", { type: "image/png" });
  const onChange = vi.fn();
  const { container, unmount } = render(<PhotosForm initialFiles={[file]} onChange={onChange} />);
  expect(container.querySelector('img').getAttribute('src')).toBe("blob:restored");
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:restored");
});

it("going back in signup preserves the entered account details", async () => {
  api.getTasteOptions.mockResolvedValue(["Hiking", "Film", "Music"]);
  render(<MemoryRouter><Signup /></MemoryRouter>);
  for (const [placeholder, value] of [["First name", "Test"], ["Last name", "User"], ["you@email.com", "test@example.com"], ["12+ characters", "Password123!"]])
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "1997-01-01" } });
  fireEvent.change(document.querySelector("select"), { target: { value: "female" } });
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Back" }));
  expect(screen.getByPlaceholderText("First name").value).toBe("Test");
  expect(screen.getByPlaceholderText("you@email.com").value).toBe("test@example.com");
});

it("an expired session returns to login", async () => {
  setSession({ userId: "abc", role: "user" });
  render(<MemoryRouter initialEntries={["/profile"]}><Routes><Route path="/profile" element={<RequireAuth>Private profile</RequireAuth>} /><Route path="/login" element={<p>Login page</p>} /></Routes></MemoryRouter>);
  await screen.findByText("Private profile");
  act(() => window.dispatchEvent(new Event("postdate:session-expired")));
  await screen.findByText("Login page");
});

it("verification sends once in StrictMode and blocks checking during sending", async () => {
  let resolve;
  api.sendVerificationCode.mockReturnValue(new Promise(r => { resolve = r; }));
  render(<StrictMode><VerificationModal open onVerified={vi.fn()} /></StrictMode>);
  expect(api.sendVerificationCode).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Verify email" }).disabled).toBe(true);
  await act(async () => resolve({ expiresIn: 300 }));
  expect(screen.getByRole("button", { name: "Verify email" }).disabled).toBe(false);
});

it("auth actions cannot submit twice while a request is pending", async () => {
  let resolve;
  const action = vi.fn(() => new Promise(r => { resolve = r; }));
  function Form() { const { run } = useAuthAction(); return <button onClick={() => { run(action); run(action); }}>Submit</button>; }
  render(<Form />); fireEvent.click(screen.getByText("Submit"));
  expect(action).toHaveBeenCalledOnce();
  await act(async () => resolve());
});

it("discovery loads the next page using the returned cursor", async () => {
  const person = (id, name) => ({ id, name, age: 25, gender: "Woman", distanceMi: null, photoUrl: null, bio: "" });
  api.getDiscoverProfiles.mockResolvedValueOnce({ profiles: [person("a", "Alice")], nextCursor: "cursor-one" })
    .mockResolvedValueOnce({ profiles: [person("b", "Bea")], nextCursor: null });
  render(<MemoryRouter><Discover /></MemoryRouter>);
  await screen.findByText("Alice, 25"); fireEvent.click(screen.getByRole("button", { name: "Load more profiles" }));
  await screen.findByText("Bea, 25");
  expect(api.getDiscoverProfiles.mock.calls[1][0].cursor).toBe("cursor-one");
  expect(screen.queryByRole("button", { name: "Load more profiles" })).toBeNull();
});

it("discovery errors are not displayed as an empty successful search", async () => {
  api.getDiscoverProfiles.mockRejectedValueOnce(new Error("offline"));
  render(<MemoryRouter><Discover /></MemoryRouter>);
  await screen.findByRole("alert");
  expect(screen.queryByText(/Nobody matches/)).toBeNull();
});

it("password validation matches the backend byte limit", () => {
  expect(validPassword("a".repeat(72))).toBe(true);
  expect(validPassword("a".repeat(73))).toBe(false);
  expect(validPassword("😀".repeat(19))).toBe(false);
  expect(validPassword(" ".repeat(10))).toBe(false);
});

it("birthdate validation uses UTC and rejects impossible dates", () => {
  expect(ageFromBirthdate("2008-09-27", new Date("2026-09-27T00:00:00Z"))).toBe(18);
  expect(ageFromBirthdate("2008-09-28", new Date("2026-09-27T00:00:00Z"))).toBe(17);
  expect(Number.isNaN(ageFromBirthdate("2008-02-30"))).toBe(true);
});
