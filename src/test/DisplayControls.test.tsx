import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { DisplayControls } from "../components/DisplayControls";
import { midiOut } from "../state";

describe("DisplayControls", () => {
  beforeEach(() => {
    // Reset midiOut state before each test
    midiOut.value = {} as MIDIOutput;
  });

  it("renders all display-related buttons", () => {
    render(<DisplayControls />);

    // Verify display-related buttons are present
    expect(screen.getByText("Ping")).toBeInTheDocument();
    expect(screen.getByText("Get OLED")).toBeInTheDocument();
    expect(screen.getByText("Get 7-Seg")).toBeInTheDocument();
    expect(screen.getByText("Switch display type")).toBeInTheDocument();
    expect(screen.getByText("Refresh")).toBeInTheDocument();
    expect(screen.getByText("Monitor")).toBeInTheDocument();
    expect(screen.getByText("📸 Screenshot")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("does not render debug-related buttons after plan 12 refactoring", () => {
    render(<DisplayControls />);

    // Verify debug-related buttons are NOT present (moved to SysExConsole)
    expect(screen.queryByText("Get Debug")).not.toBeInTheDocument();
    expect(screen.queryByText("📋 Copy Base64")).not.toBeInTheDocument();
  });

  it("disables buttons when midiOut is null", () => {
    midiOut.value = null;
    render(<DisplayControls />);

    // Check that interactive buttons are disabled
    expect(screen.getByText("Ping")).toHaveAttribute("disabled");
    expect(screen.getByText("Get OLED")).toHaveAttribute("disabled");
    expect(screen.getByText("Get 7-Seg")).toHaveAttribute("disabled");
    expect(screen.getByText("Switch display type")).toHaveAttribute("disabled");
    expect(screen.getByText("Refresh")).toHaveAttribute("disabled");
    expect(screen.getByText("Monitor")).toHaveAttribute("disabled");
    expect(screen.getByText("📸 Screenshot")).toHaveAttribute("disabled");
  });
});
