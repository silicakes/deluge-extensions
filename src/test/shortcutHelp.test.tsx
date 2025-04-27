import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/preact";
import { ShortcutHelpOverlay } from "../components/ShortcutHelpOverlay";
import { helpOpen } from "../state";
import { globalShortcuts } from "../lib/shortcuts";

describe("ShortcutHelpOverlay", () => {
  beforeEach(() => {
    // Reset the helpOpen signal before each test
    helpOpen.value = false;
    cleanup();
  });

  it("should not render when helpOpen is false", () => {
    render(<ShortcutHelpOverlay />);

    // Should not find the heading in the document
    const heading = screen.queryByText("Keyboard Shortcuts");
    expect(heading).toBeNull();
  });

  it("should render when helpOpen is true", () => {
    helpOpen.value = true;
    render(<ShortcutHelpOverlay />);

    // Should find the heading in the document
    const heading = screen.getByText("Keyboard Shortcuts");
    expect(heading).toBeTruthy();
  });

  it("should display all shortcuts from globalShortcuts", () => {
    helpOpen.value = true;
    render(<ShortcutHelpOverlay />);

    // Check if all shortcut descriptions are displayed
    globalShortcuts.forEach((shortcut) => {
      const descriptionElement = screen.getByText(shortcut.description);
      expect(descriptionElement).toBeTruthy();

      // Also check if the key is displayed
      const keyElement = screen.getByText(shortcut.keys);
      expect(keyElement).toBeTruthy();
    });
  });

  it("should close when Escape key is pressed", () => {
    helpOpen.value = true;
    render(<ShortcutHelpOverlay />);

    // Verify it's open
    expect(screen.getByText("Keyboard Shortcuts")).toBeTruthy();

    // Press Escape key
    fireEvent.keyDown(window, { key: "Escape" });

    // Verify helpOpen is now false
    expect(helpOpen.value).toBe(false);
  });

  it("should close when clicking the close button", () => {
    helpOpen.value = true;
    render(<ShortcutHelpOverlay />);

    // Verify it's open
    expect(screen.getByText("Keyboard Shortcuts")).toBeTruthy();

    // Click the close button
    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);

    // Verify helpOpen is now false
    expect(helpOpen.value).toBe(false);
  });

  it("should close when clicking the backdrop", () => {
    helpOpen.value = true;
    render(<ShortcutHelpOverlay />);

    // Verify it's open
    expect(screen.getByText("Keyboard Shortcuts")).toBeTruthy();

    // Get the dialog backdrop (the parent div)
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);

    // Verify helpOpen is now false
    expect(helpOpen.value).toBe(false);
  });
});
