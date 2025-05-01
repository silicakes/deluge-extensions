import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/preact";
import { DisplayControls } from "../components/DisplayControls";
import { midiOut } from "../state";

// Mock AdvancedDisplayControls to simplify this test
vi.mock("../components/AdvancedDisplayControls", () => ({
  AdvancedDisplayControls: () => (
    <div data-testid="advanced-controls">Advanced Controls Mock</div>
  ),
}));

describe("DisplayControls", () => {
  it("renders essential display buttons", () => {
    midiOut.value = { send: vi.fn() } as unknown as MIDIOutput;

    render(<DisplayControls />);

    // Verify only essential buttons are present
    expect(screen.getByText("📸 Screenshot")).toBeInTheDocument();

    // Verify AdvancedDisplayControls is rendered
    expect(screen.getByTestId("advanced-controls")).toBeInTheDocument();
  });

  it("no longer renders advanced buttons in the main toolbar", () => {
    render(<DisplayControls />);

    // Advanced controls should be in their own component now
    expect(screen.queryByText("Ping")).toBeNull();
    expect(screen.queryByText("OLED")).toBeNull();
    expect(screen.queryByText("7-Seg")).toBeNull();
    expect(screen.queryByText("Flip")).toBeNull();
  });

  it("disables buttons when midiOut is null", () => {
    midiOut.value = null;

    render(<DisplayControls />);

    // Screenshot button should be disabled
    const screenshotButton = screen.getByText("📸 Screenshot");
    expect(screenshotButton.closest("button")).toHaveAttribute("disabled");
  });
});
