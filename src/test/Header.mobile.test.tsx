import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { Header } from "../components/Header";
import { autoEnabled } from "../state";

// Mock the webMidi library
vi.mock("@/lib/webMidi", () => ({
  initMidi: vi.fn(),
  getMidiInputs: vi.fn().mockReturnValue([]),
  getMidiOutputs: vi.fn().mockReturnValue([]),
  setMidiInput: vi.fn(),
  setMidiOutput: vi.fn(),
  autoConnectDefaultPorts: vi.fn(),
}));

// Mock the useMidiNavbar hook
vi.mock("../hooks/useMidiNavbar", () => ({
  useMidiNavbar: () => ({
    inputSignal: { value: null },
    outputSignal: { value: null },
    inputs: { value: [] },
    outputs: { value: [] },
    online: { value: true },
    ready: { value: false },
    onInputChange: vi.fn(),
    onOutputChange: vi.fn(),
    onAutoToggle: vi.fn(),
    autoEnabled,
  }),
}));

describe("Header on mobile viewport", () => {
  beforeEach(() => {
    // Set viewport width to mobile size (375px)
    vi.stubGlobal("window", {
      ...window,
      innerWidth: 375,
      matchMedia: (query: string) => ({
        matches: query.includes("max-width: 640px"),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });

    // Reset any mocks
    vi.clearAllMocks();
  });

  it("renders mobile navbar with hamburger button", () => {
    render(<Header />);

    // Find the button that toggles the MIDI menu
    const hamburgerButton = screen.getByRole("button", {
      name: /toggle midi devices menu/i,
    });
    expect(hamburgerButton).toBeInTheDocument();

    // Verify that the menu is initially collapsed
    const midiMenu = document.getElementById("midi-menu");
    expect(midiMenu).toHaveClass("hidden");
  });

  it("expands the MIDI menu when hamburger button is clicked", () => {
    render(<Header />);

    // Find and click the hamburger button
    const hamburgerButton = screen.getByRole("button", {
      name: /toggle midi devices menu/i,
    });
    fireEvent.click(hamburgerButton);

    // Verify the menu is now visible
    const midiMenu = document.getElementById("midi-menu");
    expect(midiMenu).not.toHaveClass("hidden");
    expect(midiMenu).toHaveClass("block");

    // Check that we can see the MIDI selectors
    expect(
      screen.getAllByLabelText("MIDI Input Device")[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText("MIDI Output Device")[0],
    ).toBeInTheDocument();
  });

  it("collapses the MIDI menu when button is clicked again", () => {
    render(<Header />);

    // Find and click the hamburger button to expand
    const hamburgerButton = screen.getByRole("button", {
      name: /toggle midi devices menu/i,
    });
    fireEvent.click(hamburgerButton);

    // Click again to collapse
    fireEvent.click(hamburgerButton);

    // Verify the menu is hidden again
    const midiMenu = document.getElementById("midi-menu");
    expect(midiMenu).toHaveClass("hidden");
  });

  it("updates aria-expanded attribute correctly", () => {
    render(<Header />);

    // Find hamburger button
    const hamburgerButton = screen.getByRole("button", {
      name: /toggle midi devices menu/i,
    });

    // Initially false
    expect(hamburgerButton).toHaveAttribute("aria-expanded", "false");

    // Click to expand
    fireEvent.click(hamburgerButton);
    expect(hamburgerButton).toHaveAttribute("aria-expanded", "true");

    // Click to collapse
    fireEvent.click(hamburgerButton);
    expect(hamburgerButton).toHaveAttribute("aria-expanded", "false");
  });
});
