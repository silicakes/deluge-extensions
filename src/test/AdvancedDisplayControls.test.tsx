import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { AdvancedDisplayControls } from "../components/AdvancedDisplayControls";
import { midiOut, monitorMode } from "../state";
import * as midiModule from "@/commands";

// Mock midi functions
vi.mock("../lib/midi", () => ({
  ping: vi.fn(),
  getOled: vi.fn(),
  get7Seg: vi.fn(),
  flipScreen: vi.fn(),
  startMonitor: vi.fn(),
  stopMonitor: vi.fn(),
}));

// Mock display functions
vi.mock("../lib/display", () => ({
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
}));

describe("AdvancedDisplayControls", () => {
  beforeEach(() => {
    // Reset midiOut state before each test
    midiOut.value = {} as MIDIOutput;
    monitorMode.value = false;

    // Clear mock call history
    vi.clearAllMocks();
  });

  it("renders the toggle button", () => {
    render(<AdvancedDisplayControls />);

    // Find the settings gear button
    const toggleButton = screen.getByTestId("advanced-controls-toggle");
    expect(toggleButton).toBeInTheDocument();
  });

  it("opens drawer when the toggle button is clicked", () => {
    render(<AdvancedDisplayControls />);

    // Initially drawer should be closed
    const drawer = screen.getByTestId("advanced-controls-drawer");
    expect(drawer).toHaveAttribute("aria-hidden", "true");

    // Click toggle button
    const toggleButton = screen.getByTestId("advanced-controls-toggle");
    fireEvent.click(toggleButton);

    // Drawer should now be open
    expect(drawer).toHaveAttribute("aria-hidden", "false");
  });

  it("renders all advanced buttons in the drawer", () => {
    render(<AdvancedDisplayControls />);

    // Open the drawer
    const toggleButton = screen.getByTestId("advanced-controls-toggle");
    fireEvent.click(toggleButton);

    // Verify all advanced buttons are present
    expect(screen.getByText("Ping")).toBeInTheDocument();
    expect(screen.getByText("Get OLED")).toBeInTheDocument();
    expect(screen.getByText("Get 7-Seg")).toBeInTheDocument();
    expect(screen.getByText("Flip Screen")).toBeInTheDocument();
    expect(screen.getByText("Refresh")).toBeInTheDocument();
    expect(screen.getByText("Monitor")).toBeInTheDocument();
  });

  it("closes drawer when clicking outside", () => {
    render(<AdvancedDisplayControls />);

    // Open the drawer
    const toggleButton = screen.getByTestId("advanced-controls-toggle");
    fireEvent.click(toggleButton);

    // Drawer should be open
    const drawer = screen.getByTestId("advanced-controls-drawer");
    expect(drawer).toHaveAttribute("aria-hidden", "false");

    // Click outside the drawer
    fireEvent.mouseDown(document.body);

    // Drawer should now be closed
    expect(drawer).toHaveAttribute("aria-hidden", "true");
  });

  it("closes drawer when pressing Escape", () => {
    render(<AdvancedDisplayControls />);

    // Open the drawer
    const toggleButton = screen.getByTestId("advanced-controls-toggle");
    fireEvent.click(toggleButton);

    // Drawer should be open
    const drawer = screen.getByTestId("advanced-controls-drawer");
    expect(drawer).toHaveAttribute("aria-hidden", "false");

    // Press Escape key
    fireEvent.keyDown(document, { key: "Escape" });

    // Drawer should now be closed
    expect(drawer).toHaveAttribute("aria-hidden", "true");
  });

  it("disables buttons when midiOut is null", () => {
    midiOut.value = null;
    render(<AdvancedDisplayControls />);

    // Open the drawer
    const toggleButton = screen.getByTestId("advanced-controls-toggle");
    fireEvent.click(toggleButton);

    // All buttons should be disabled
    expect(screen.getByText("Ping")).toHaveAttribute("disabled");
    expect(screen.getByText("Get OLED")).toHaveAttribute("disabled");
    expect(screen.getByText("Get 7-Seg")).toHaveAttribute("disabled");
    expect(screen.getByText("Flip Screen")).toHaveAttribute("disabled");
    expect(screen.getByText("Refresh")).toHaveAttribute("disabled");
    expect(screen.getByText("Monitor")).toHaveAttribute("disabled");
  });

  it("updates monitorMode signal when Monitor button is clicked", () => {
    render(<AdvancedDisplayControls />);

    // Open the drawer
    const toggleButton = screen.getByTestId("advanced-controls-toggle");
    fireEvent.click(toggleButton);

    // Initial state
    expect(monitorMode.value).toBe(false);
    expect(screen.getByTestId("monitor-button")).toHaveTextContent("Monitor");

    // Click Monitor button
    fireEvent.click(screen.getByTestId("monitor-button"));

    // Monitor mode should be enabled
    expect(monitorMode.value).toBe(true);
    expect(midiModule.startMonitor).toHaveBeenCalled();

    // Button text should change
    expect(screen.getByTestId("monitor-button")).toHaveTextContent(
      "Stop Monitoring",
    );
  });

  it("shows monitor status based on monitorMode signal", () => {
    render(<AdvancedDisplayControls />);

    // Open the drawer
    const toggleButton = screen.getByTestId("advanced-controls-toggle");
    fireEvent.click(toggleButton);

    // Initial state - verify that the status shows MONITOR OFF when monitorMode is false
    expect(monitorMode.value).toBe(false);
    expect(screen.getByTestId("monitor-status")).toHaveTextContent(
      "MONITOR OFF",
    );

    // After clicking the monitor button, we expect monitorMode to change
    fireEvent.click(screen.getByTestId("monitor-button"));
    expect(monitorMode.value).toBe(true);

    // And the UI should reflect the new state
    expect(screen.getByTestId("monitor-button")).toHaveTextContent(
      "Stop Monitoring",
    );
  });
});
