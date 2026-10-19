import React, { useState } from "react";
import { expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProfileModal from "../components/discover/ProfileModal";

it("focuses the dialog, keeps keyboard navigation inside and restores the opener on Escape", () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open profile</button>{open && <ProfileModal
      profile={{ id: "test", name: "Alex", age: 25, gender: "Man" }} onClose={() => setOpen(false)} />}</>;
  }
  render(<Example />);
  const opener = screen.getByRole("button", { name: "Open profile" });
  opener.focus();
  fireEvent.click(opener);
  const first = screen.getByRole("button", { name: "Close", exact: true });
  const last = screen.getByRole("button", { name: "Report this profile" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: "Tab" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});
