import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { Header } from "../components/Header";
import { autoEnabled } from "../state";

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

  it("renders desktop navbar elements directly", () => {
    render(<Header />);

    // Check that select elements are visible in desktop layout
    expect(
      screen.getAllByLabelText(/MIDI Input Device/i)[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/MIDI Output Device/i)[0],
    ).toBeInTheDocument();

    // Check for auto toggle in desktop layout
    expect(
      screen.getAllByLabelText(/Auto-connect toggle/i)[0],
    ).toBeInTheDocument();

    // Check for text specific to desktop layout
    expect(
      screen.getByText(/Auto \(Connect \+ Display\)/i, { exact: false }),
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
