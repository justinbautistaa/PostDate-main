import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import RecoveryForm from "../components/auth/RecoveryForm";
import NewPasswordForm from "../components/auth/NewPasswordForm";
import * as api from "../services/postdateApi";
vi.mock("../services/postdateApi", () => ({ loginUser: vi.fn(), requestRecoveryCode: vi.fn(), verifyRecoveryCode: vi.fn(), resetPassword: vi.fn() }));
vi.mock("../components/VerificationModal", () => ({ default: () => null }));
beforeEach(() => {
  vi.resetAllMocks();
  api.requestRecoveryCode.mockResolvedValue({ expiresInSeconds: 300, resendAfterSeconds: 60 });
  api.verifyRecoveryCode.mockResolvedValue({ resetToken: "reset-proof" });
  api.resetPassword.mockResolvedValue({ ok: true });
});

it.each([" ".repeat(12), "a".repeat(73), "😀".repeat(19), "short"])("rejects an unusable replacement password before submitting %#", async password => {
  const submit = vi.fn();
  render(<NewPasswordForm onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Repeat"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByLabelText("New password").getAttribute("aria-invalid")).toBe("true");
  expect(submit).not.toHaveBeenCalled();
});
it.each([["admin", "/admin"], ["moderator", "/staff"], ["user", "/dashboard"]])("%s login opens the correct workspace", async (role, destination) => {
  api.loginUser.mockResolvedValue({ userId: `person-${role}`, role });
  render(<MemoryRouter initialEntries={["/login"]}><Routes><Route path="/login" element={<Login />} /><Route path={destination} element={<p>{role} workspace</p>} /></Routes></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: `${role}@example.test` } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "OriginalSecret123" } });
  fireEvent.click(screen.getByRole("button", { name: "Log-in" }));
  await screen.findByText(`${role} workspace`);
});
it("completes recovery from email through code verification and a saved password", async () => {
  render(<MemoryRouter><Login /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "admin@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  await screen.findByRole("heading", { name: "Recovery" });
  expect(screen.getByText("admin@example.test")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: "123" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
  await screen.findByText("Enter the six-digit code from your email.");
  expect(api.verifyRecoveryCode).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: "123 456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
  await screen.findByLabelText("New password");
  expect(api.verifyRecoveryCode).toHaveBeenCalledWith({ email: "admin@example.test", code: "123456" });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "ReplacementSecret123" } });
  fireEvent.change(screen.getByLabelText("Repeat"), { target: { value: "ReplacementSecret123" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await screen.findByText("Password updated. Log in");
  expect(api.resetPassword).toHaveBeenCalledWith({ resetToken: "reset-proof", newPassword: "ReplacementSecret123" });
  expect(screen.getByLabelText("Email address").value).toBe("admin@example.test");
});
it("allows requesting a new code before expiry after the resend cooldown", async () => {
  const resend = vi.fn().mockResolvedValue();
  render(<RecoveryForm email="admin@example.test" expiresAt={Date.now() + 300000} resendAt={Date.now() - 1} onResend={resend} onVerify={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
  await waitFor(() => expect(resend).toHaveBeenCalledTimes(1));
});
it("can return to login without losing the recovery email", async () => {
  render(<MemoryRouter><Login /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "member@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.click(await screen.findByRole("button", { name: "Back to login" }));
  expect(screen.getByLabelText("Email address").value).toBe("member@example.test");
});
it("explains unavailable mail service without opening a misleading code screen", async () => {
  api.requestRecoveryCode.mockRejectedValue({ response: { status: 503 } });
  render(<MemoryRouter><Login /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "member@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  await screen.findByText("Email recovery is unavailable. Contact the site administrator.");
  expect(screen.queryByLabelText("Recovery code")).toBeNull();
});
