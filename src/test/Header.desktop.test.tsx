import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { Header } from "../components/Header";

// Mock the midi library
vi.mock("../lib/midi", () => ({
  initMidi: vi.fn(),
  getMidiInputs: vi.fn().mockReturnValue([]),
  getMidiOutputs: vi.fn().mockReturnValue([]),
  setMidiInput: vi.fn(),
  setMidiOutput: vi.fn(),
  autoConnectDefaultPorts: vi.fn(),
}));

describe("Header on desktop viewport", () => {
  beforeEach(() => {
    // Set viewport width to desktop size (1440px)
    vi.stubGlobal("window", {
      ...window,
      innerWidth: 1440,
      matchMedia: (query: string) => ({
        matches: !query.includes("max-width: 640px"),
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

  it("renders desktop navbar without hamburger button", () => {
    render(<Header />);

    // Should not find the button that toggles the MIDI menu
    const hamburgerButton = screen.queryByRole("button", {
      name: /toggle midi devices menu/i,
    });
    expect(hamburgerButton).not.toBeInTheDocument();
  });

  it("shows desktop navbar elements directly", () => {
    render(<Header />);

    // Check that select elements are visible in desktop layout
    expect(
      screen.getAllByLabelText(/MIDI Input Device/i)[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/MIDI Output Device/i)[0],
    ).toBeInTheDocument();

    // Check for auto toggle in desktop layout
    expect(screen.getByLabelText(/Auto-connect toggle/i)).toBeInTheDocument();

    // Check for text specific to desktop layout
    expect(
      screen.getByText(/Auto \(Connect \+ Display\)/i),
    ).toBeInTheDocument();
  });

  it('shows "Live Demo" link on desktop', () => {
    render(<Header />);

    // This link is hidden on mobile but shown on desktop
    const demoLink = screen.getByText(/Live Demo/i);
    expect(demoLink).toBeInTheDocument();
    expect(demoLink).toBeVisible();
  });
});
