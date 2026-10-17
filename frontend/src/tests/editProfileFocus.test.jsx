import React, { useState } from "react";
import { expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EditProfileModal from "../components/profile/EditProfileModal";
it("keeps keyboard focus in the edit dialog and returns it to its opener", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Edit your profile</button><EditProfileModal open={open} profile={{ displayName: "Alex", gender: "female", birthdate: "1999-01-01" }} onClose={() => setOpen(false)} /></>;
  }
  render(<Harness />);
  const opener = screen.getByRole("button", { name: "Edit your profile" });
  opener.focus(); fireEvent.click(opener);
  const dialog = screen.getByRole("dialog");
  expect(document.activeElement.tagName).toBe("INPUT");
  const buttons = dialog.querySelectorAll("button");
  buttons[0].focus(); fireEvent.keyDown(buttons[0], { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});
