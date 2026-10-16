import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import QRCode from "qrcode";
import api from "../api";
import MfaForm from "../components/auth/MfaForm";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn() } }));
vi.mock("../api", () => ({ default: { post: vi.fn() } }));
const pending = { mfaSetupRequired: true, secret: "JBSWY3DPEHPK3PXP", challenge: "test-challenge" };
beforeEach(() => {
  vi.resetAllMocks();
  QRCode.toDataURL.mockResolvedValue("data:image/png;base64,test");
});
it("encodes the enrollment key and server TOTP settings, then verifies the scanned code", async () => {
  api.post.mockResolvedValue({ data: { recoveryCodes: ["recovery-example"] } });
  render(<MfaForm pending={pending} onComplete={vi.fn()} onCancel={vi.fn()} />);
  await screen.findByRole("img", { name: /scan with your authenticator/i });
  const uri = new URL(QRCode.toDataURL.mock.calls[0][0]);
  expect(uri.protocol).toBe("otpauth:");
  expect(uri.hostname).toBe("totp");
  expect(Object.fromEntries(uri.searchParams)).toEqual({ secret: pending.secret, issuer: "PostDate", algorithm: "SHA1", digits: "6", period: "30" });
  fireEvent.change(screen.getByLabelText("Authentication code"), { target: { value: "123 456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify" }));
  await screen.findByText("Save your recovery codes");
  expect(api.post).toHaveBeenCalledWith("/auth/mfa/verify", { challenge: pending.challenge, code: "123456" });
});
it("keeps the manual setup option when QR generation fails", async () => {
  QRCode.toDataURL.mockRejectedValue(new Error("generation failed"));
  render(<MfaForm pending={pending} />);
  await screen.findByText("QR code could not load. Use the manual setup key below.");
  expect(screen.getByText(pending.secret)).toBeTruthy();
});
it("does not generate an enrollment QR code during ordinary MFA login", async () => {
  render(<MfaForm pending={{ challenge: "login-challenge", mfaSetupRequired: false }} />);
  await waitFor(() => expect(screen.getByText(/one unused recovery code/)).toBeTruthy());
  expect(QRCode.toDataURL).not.toHaveBeenCalled();
});
