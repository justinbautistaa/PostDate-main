import React from "react";
import { expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProfilePhoto from "../components/ProfilePhoto";

it("replaces a failed photo without leaving a broken image and retries a new URL", () => {
  const { rerender } = render(<ProfilePhoto src="/old.webp" name="Alex Rivera" alt="Alex" large />);
  fireEvent.error(screen.getByRole("img", { name: "Alex" }));
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("Photo unavailable")).toBeTruthy();
  expect(screen.getByText("AR")).toBeTruthy();
  rerender(<ProfilePhoto src="/new.webp" name="Alex Rivera" alt="Alex" large />);
  expect(screen.getByRole("img", { name: "Alex" }).getAttribute("src")).toBe("/new.webp");
  expect(screen.queryByText("Photo unavailable")).toBeNull();
});
