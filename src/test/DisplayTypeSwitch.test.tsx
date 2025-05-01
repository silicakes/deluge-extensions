import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { DisplayTypeSwitch } from "../components/DisplayTypeSwitch";
import { midiOut, displayType } from "../state";
import * as midi from "../lib/midi";

// Mock the midi functions
vi.mock("../lib/midi", () => ({
  flipScreen: vi.fn(),
}));

describe("DisplayTypeSwitch", () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset state
    midiOut.value = {} as MIDIOutput;
    displayType.value = "OLED";
  });

  it("renders the toggle switch with proper labels", () => {
    render(<DisplayTypeSwitch />);

    // Check for labels
    expect(screen.getByText("7SEG")).toBeInTheDocument();
    expect(screen.getByText("OLED")).toBeInTheDocument();

    // Check for the toggle input
    expect(screen.getByLabelText("Toggle display type")).toBeInTheDocument();
  });

  it("reflects the current display type", () => {
    // Test with OLED display type
    displayType.value = "OLED";
    const { container, unmount } = render(<DisplayTypeSwitch />);
    const switchInput = container.querySelector("#display-type-switch");
    expect(switchInput).toBeChecked();

    unmount();

    // Rerender with 7SEG display type
    displayType.value = "7SEG";
    const { container: container2 } = render(<DisplayTypeSwitch />);
    const switchInput2 = container2.querySelector("#display-type-switch");
    expect(switchInput2).not.toBeChecked();
  });

  it("calls flipScreen and updates displayType when toggled", () => {
    displayType.value = "OLED";
    render(<DisplayTypeSwitch />);

    // Toggle the switch
    fireEvent.click(screen.getByLabelText("Toggle display type"));

    // Check that flipScreen was called
    expect(midi.flipScreen).toHaveBeenCalledTimes(1);

    // Check that displayType was updated
    expect(displayType.value).toBe("7SEG");

    // Toggle again
    fireEvent.click(screen.getByLabelText("Toggle display type"));

    // Check that flipScreen was called again
    expect(midi.flipScreen).toHaveBeenCalledTimes(2);

    // Check that displayType was updated back
    expect(displayType.value).toBe("OLED");
  });

  it("is disabled when midiOut is null", () => {
    midiOut.value = null;
    render(<DisplayTypeSwitch />);

    // Check that the switch is disabled
    const switchElement = screen.getByLabelText("Toggle display type");
    expect(switchElement).toBeDisabled();

    // Parent label should have opacity-50 class when disabled
    const label = switchElement.closest("label");
    expect(label).toHaveClass("opacity-50");
    expect(label).toHaveClass("pointer-events-none");
  });
});
