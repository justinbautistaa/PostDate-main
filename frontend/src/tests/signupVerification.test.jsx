import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Signup from "../pages/Signup";
import VerificationModal from "../components/VerificationModal";
import * as api from "../services/postdateApi";

vi.mock("../services/postdateApi", () => ({
  submitSignup: vi.fn(), sendVerificationCode: vi.fn(), verifyCode: vi.fn(),
}));
// Keep the real signup page and verification dialog; isolate the onboarding fields.
vi.mock("../components/WhoAreYouForm", () => ({ default: ({ onContinue }) =>
  <form onSubmit={(event) => { event.preventDefault(); onContinue({ email: event.currentTarget.elements.namedItem("email").value }); }}>
    <input name="email" aria-label="Signup email" /><button>Continue details</button>
  </form> }));
vi.mock("../components/PhotosForm", () => ({ default: ({ onContinue }) =>
  <button onClick={() => onContinue([])}>Continue photos</button> }));
vi.mock("../components/YourTasteForm", () => ({ default: ({ onConfirm }) =>
  <button onClick={() => onConfirm(["Reading"])}>Confirm signup</button> }));

beforeEach(() => {
  vi.resetAllMocks();
  api.submitSignup.mockResolvedValue({ ok: true });
  api.sendVerificationCode.mockResolvedValue({ expiresIn: 300 });
  api.verifyCode.mockResolvedValue({ verified: true });
});

it("keeps an invalid verification code on the form without showing account success", async () => {
  api.verifyCode.mockRejectedValue({ response: { data: { message: "Invalid verification code" } } });
  const onVerified = vi.fn();
  render(<VerificationModal open email="new@example.test" successMessage="You successfully created an account" onVerified={onVerified} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Verify email" }).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "999999" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
  await screen.findByText("Invalid verification code");
  expect(screen.queryByRole("heading", { name: "You successfully created an account" })).toBeNull();
  expect(onVerified).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Verification code").value).toBe("999999");
});

it.each(["first@example.test", "second@example.test"])("verifies the new signup's own email: %s", async (email) => {
  render(<MemoryRouter initialEntries={["/signup"]}><Routes>
    <Route path="/signup" element={<Signup />} />
    <Route path="/login" element={<p>Ready to log in</p>} />
  </Routes></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Signup email"), { target: { value: email } });
  fireEvent.click(screen.getByText("Continue details"));
  fireEvent.click(screen.getByText("Continue photos"));
  fireEvent.click(screen.getByText("Confirm signup"));
  await waitFor(() => expect(api.sendVerificationCode).toHaveBeenCalledWith(email));
  expect(api.submitSignup).toHaveBeenCalledWith({ email, photos: [], tags: ["Reading"], privacyConsent: true });
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Verify email" }).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
  await screen.findByRole("heading", { name: "You successfully created an account" });
  expect(screen.queryByText("Ready to log in")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continue to login" }));
  await screen.findByText("Ready to log in");
  expect(api.verifyCode).toHaveBeenCalledWith("123456", email);
});
