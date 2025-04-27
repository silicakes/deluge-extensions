import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { SysExConsole } from "../components/SysExConsole";
import { midiOut } from "../state";
import * as midi from "../lib/midi";

// Mock the getDebug function
vi.mock("../lib/midi", async () => {
  const actual = await vi.importActual("../lib/midi");
  return {
    ...(actual as object),
    getDebug: vi.fn(),
  };
});

// Mock the copyCanvasToBase64 function
vi.mock("../lib/display", () => ({
  copyCanvasToBase64: vi.fn(),
}));

describe("SysExConsole", () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset midiOut state before each test
    midiOut.value = {} as MIDIOutput;
  });

  it("renders debug console toggle button", () => {
    render(<SysExConsole />);

    // There should be a button to toggle the console
    const toggleButton = screen.getByLabelText("Toggle SysEx Console");
    expect(toggleButton).toBeDefined();
  });

  it("opens console when toggle button is clicked", () => {
    render(<SysExConsole />);

    // Click the toggle button
    const toggleButton = screen.getByLabelText("Toggle SysEx Console");
    fireEvent.click(toggleButton);

    // The console header should now be visible
    expect(screen.getByText("SysEx Console")).toBeDefined();
  });

  it("renders 'Fetch once' button in header after plan 12 refactoring", () => {
    render(<SysExConsole />);

    // Open the console
    const toggleButton = screen.getByLabelText("Toggle SysEx Console");
    fireEvent.click(toggleButton);

    // Should have the "Fetch once" button that was relocated from DisplayControls
    const fetchButton = screen.getByText("Fetch once");
    expect(fetchButton).toBeDefined();
  });

  it("calls getDebug when 'Fetch once' button is clicked", () => {
    render(<SysExConsole />);

    // Open the console
    const toggleButton = screen.getByLabelText("Toggle SysEx Console");
    fireEvent.click(toggleButton);

    // Click the "Fetch once" button
    const fetchButton = screen.getByText("Fetch once");
    fireEvent.click(fetchButton);

    // Verify getDebug was called
    expect(midi.getDebug).toHaveBeenCalledTimes(1);
  });

  it("renders 'Copy Base64' button in footer", () => {
    render(<SysExConsole />);

    // Open the console
    const toggleButton = screen.getByLabelText("Toggle SysEx Console");
    fireEvent.click(toggleButton);

    // Should have the "Copy Base64" button
    const copyButton = screen.getByText("Copy Base64");
    expect(copyButton).toBeDefined();
  });

  it("disables buttons when midiOut is null", () => {
    midiOut.value = null;
    render(<SysExConsole />);

    // Open the console
    const toggleButton = screen.getByLabelText("Toggle SysEx Console");
    fireEvent.click(toggleButton);

    // Debug-related buttons should be disabled
    expect(screen.getByText("Fetch once")).toHaveAttribute("disabled");
    expect(screen.getByText("Auto")).toHaveAttribute("disabled");
    expect(screen.getByText("Copy Base64")).toHaveAttribute("disabled");
    expect(screen.getByText("Send")).toHaveAttribute("disabled");
  });
});
