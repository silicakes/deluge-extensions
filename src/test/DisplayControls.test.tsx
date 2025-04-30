import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/preact";
import { DisplayControls } from "../components/DisplayControls";
import { midiOut } from "../state";

// Mock the AdvancedDisplayControls component
vi.mock("../components/AdvancedDisplayControls", () => ({
  AdvancedDisplayControls: () => (
    <div data-testid="advanced-controls">Advanced Controls Mock</div>
  ),
}));

describe("DisplayControls", () => {
  beforeEach(() => {
    // Reset midiOut state before each test
    midiOut.value = {} as MIDIOutput;
  });

  it("renders essential display buttons", () => {
    render(<DisplayControls />);

    // Verify only essential buttons are present
    expect(screen.getByText("Switch display type")).toBeInTheDocument();
    expect(screen.getByText("📸 Screenshot")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();

    // Verify AdvancedDisplayControls is rendered
    expect(screen.getByTestId("advanced-controls")).toBeInTheDocument();
  });

  it("no longer renders advanced buttons in the main toolbar", () => {
    render(<DisplayControls />);

    // Verify advanced buttons are NOT present in the main toolbar
    expect(screen.queryByText("Ping")).not.toBeInTheDocument();
    expect(screen.queryByText("Get OLED")).not.toBeInTheDocument();
    expect(screen.queryByText("Get 7-Seg")).not.toBeInTheDocument();
    expect(screen.queryByText("Refresh")).not.toBeInTheDocument();
    expect(screen.queryByText("Monitor")).not.toBeInTheDocument();
  });

  it("disables buttons when midiOut is null", () => {
    midiOut.value = null;
    render(<DisplayControls />);

    // Check that interactive buttons are disabled
    expect(screen.getByText("Switch display type")).toHaveAttribute("disabled");
    expect(screen.getByText("📸 Screenshot")).toHaveAttribute("disabled");
  });
});
