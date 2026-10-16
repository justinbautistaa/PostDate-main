import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PasswordInput from "../components/PasswordInput";
it("toggles visibility while preserving the password without submitting the form", () => {
  const submit = vi.fn(event => event.preventDefault());
  render(<form onSubmit={submit}><label htmlFor="test-password">Password</label><PasswordInput id="test-password" defaultValue="MySecret12345" autoComplete="new-password" /></form>);
  const input = screen.getByLabelText("Password");
  expect(input.type).toBe("password");
  fireEvent.click(screen.getByRole("button", { name:"Show password" }));
  expect(input.type).toBe("text"); expect(input.value).toBe("MySecret12345");
  fireEvent.click(screen.getByRole("button", { name:"Hide password" }));
  expect(input.type).toBe("password"); expect(submit).not.toHaveBeenCalled();
});
