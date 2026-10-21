import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Signup from "../pages/Signup";
import * as api from "../services/postdateApi";
vi.mock("../services/postdateApi", () => ({ submitSignup: vi.fn(), getTasteOptions: vi.fn(), sendVerificationCode: vi.fn(), verifyCode: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:signup-photo");
  URL.revokeObjectURL = vi.fn();
  api.getTasteOptions.mockResolvedValue({ personality: ["Kind", "Curious", "Creative", "Calm"], limits: { minPersonality: 3, maxPersonality: 5 } });
  api.sendVerificationCode.mockResolvedValue({ expiresIn: 300 });
  api.submitSignup.mockResolvedValue({ ok: true });
});
async function completeDetailsAndPhotos(container) {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Rivera" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "PrivatePassword123" } });
  fireEvent.change(screen.getByLabelText("Birthdate"), { target: { value: "2000-01-01" } });
  fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "female" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("heading", { name: "Alex Rivera" })).toBeTruthy();
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(["photo"], "profile.jpg", { type: "image/jpeg" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  for (const tag of ["Kind", "Curious", "Creative"]) fireEvent.click(await screen.findByRole("button", { name: tag }));
  fireEvent.click(screen.getByRole("checkbox", { name: /privacy notice/ }));
}
it("the real signup fields submit details, photos and tastes before sending verification to that email", async () => {
  const { container } = render(<MemoryRouter><Signup /></MemoryRouter>);
  await completeDetailsAndPhotos(container);
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() => expect(api.sendVerificationCode).toHaveBeenCalledWith("alex@example.test"));
  expect(api.submitSignup).toHaveBeenCalledWith(expect.objectContaining({ firstName: "Alex", email: "alex@example.test", photos: [expect.any(File)], tags: ["Kind", "Curious", "Creative"] }));
  expect(screen.getByRole("dialog")).toBeTruthy();
}, 15000); // Full multi-step form traversal can exceed 5s on this Windows host.
it("signup retains the last step and selections when account creation fails", async () => {
  api.submitSignup.mockRejectedValue({ response: { status: 409 } });
  const { container } = render(<MemoryRouter><Signup /></MemoryRouter>);
  await completeDetailsAndPhotos(container);
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Kind" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(api.sendVerificationCode).not.toHaveBeenCalled();
}, 15000);
