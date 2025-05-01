import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/preact";
import { ShortcutHelpOverlay } from "../components/ShortcutHelpOverlay";
import { Header } from "../components/Header";
import { helpOpen } from "../state";
import { globalShortcuts } from "../lib/shortcuts";

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ThemeSwitcher and other components used in Header
vi.mock("../components/ThemeSwitcher", () => ({
  ThemeSwitcher: () => (
    <div data-testid="theme-switcher">Theme Switcher Mock</div>
  ),
}));

vi.mock("../components/MidiDeviceNavbarMobile", () => ({
  MidiDeviceNavbarMobile: () => (
    <div data-testid="midi-navbar-mobile">MIDI Device Navbar Mobile Mock</div>
  ),
}));

vi.mock("../components/MidiDeviceNavbarDesktop", () => ({
  MidiDeviceNavbarDesktop: () => (
    <div data-testid="midi-navbar-desktop">MIDI Device Navbar Desktop Mock</div>
  ),
}));

vi.mock("../components/FullscreenToggleButton", () => ({
  FullscreenToggleButton: () => (
    <div data-testid="fullscreen-toggle">Fullscreen Toggle Mock</div>
  ),
}));

vi.mock("../components/FileBrowserToggleButton", () => ({
  default: () => (
    <div data-testid="file-browser-toggle">File Browser Toggle Mock</div>
  ),
}));

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

  it("should toggle help overlay when clicking the help icon in the header", () => {
    // Render the Header component with the HelpIconButton
    render(<Header />);

    // Find the help icon button in the header
    const helpButton = screen.getByTitle("Keyboard help (?)");
    expect(helpButton).toBeTruthy();

    // Initial state should be closed
    expect(helpOpen.value).toBe(false);

    // Click the help icon
    fireEvent.click(helpButton);

    // Verify helpOpen is now true
    expect(helpOpen.value).toBe(true);

    // Click the help icon again
    fireEvent.click(helpButton);

    // Verify helpOpen is back to false
    expect(helpOpen.value).toBe(false);
  });
});
