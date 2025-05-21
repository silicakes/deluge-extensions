import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { SysExConsole } from "../components/SysExConsole";
import { midiOut } from "../state";
import * as midi from "@/commands";

describe("SysExConsole", () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset midiOut state before each test
    midiOut.value = { send: vi.fn() } as unknown as MIDIOutput;
  });

  it("renders debug console toggle button", () => {
    render(<SysExConsole />);

    // Check that the toggle button is rendered
    const toggleButton = screen.getByLabelText("Toggle SysEx Console");
    expect(toggleButton).toBeDefined();
  });

  it("opens console when toggle button is clicked", () => {
    render(<SysExConsole />);

    // Get the toggle button and click it
    const toggleButton = screen.getByLabelText("Toggle SysEx Console");
    fireEvent.click(toggleButton);

    // Verify the drawer is visible
    const drawer = screen.getByText("SysEx Console");
    expect(drawer).toBeDefined();
  });

  it("renders 'Fetch once' button in header after plan 12 refactoring", () => {
    render(<SysExConsole />);

    // Click toggle to open console
    fireEvent.click(screen.getByLabelText("Toggle SysEx Console"));

    // Should have the fetch button in the header section
    const fetchButton = screen.getByText("Fetch once");
    expect(fetchButton).toBeDefined();
  });

  it("calls getDebug when 'Fetch once' button is clicked", () => {
    const spy = vi.spyOn(midi, "getDebug").mockResolvedValue(true);

    render(<SysExConsole />);

    // Click toggle to open console
    fireEvent.click(screen.getByLabelText("Toggle SysEx Console"));

    // Click the fetch button
    fireEvent.click(screen.getByText("Fetch once"));

    // getDebug should have been called
    expect(spy).toHaveBeenCalled();
  });

  it("disables buttons when midiOut is null", () => {
    // Set midiOut to null
    midiOut.value = null;

    render(<SysExConsole />);

    // Click toggle to open console
    fireEvent.click(screen.getByLabelText("Toggle SysEx Console"));

    // Buttons should be disabled
    expect(screen.getByText("Fetch once")).toHaveAttribute("disabled");
    expect(screen.getByText("Auto")).toHaveAttribute("disabled");
    expect(screen.getByText("Send")).toHaveAttribute("disabled");
  });

  it("renders custom SysEx input field", () => {
    render(<SysExConsole />);

    // Open the console
    fireEvent.click(screen.getByLabelText("Toggle SysEx Console"));

    // Check that the input field is rendered
    const input = screen.getByLabelText("Custom SysEx input");
    expect(input).toBeDefined();

    // Check that the send button is rendered
    const sendButton = screen.getByText("Send");
    expect(sendButton).toBeDefined();
  });
});
