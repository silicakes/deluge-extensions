import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import {
  DisplayStylePicker,
  increaseCanvasSize,
} from "../components/DisplayStylePicker";
import { displaySettings } from "../state";

describe("DisplayStylePicker", () => {
  beforeEach(() => {
    // Reset displaySettings before each test
    displaySettings.value = {
      pixelWidth: 5,
      pixelHeight: 5,
      foregroundColor: "#eeeeee",
      backgroundColor: "#111111",
      use7SegCustomColors: false,
      minSize: 1,
      maxSize: 32,
      resizeStep: 1,
    };

    // Clear localStorage
    localStorage.clear();

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
    });
  });

  it("renders in compact mode initially", () => {
    render(<DisplayStylePicker compact={true} />);

    // Should only show the toggle button
    expect(screen.getByTitle("Display Style Settings")).toBeInTheDocument();

    // Expanded content should not be visible
    expect(screen.queryByText("Pixel Size")).not.toBeInTheDocument();
  });

  it("expands when toggle button is clicked", () => {
    render(<DisplayStylePicker compact={true} />);

    // Click toggle button
    fireEvent.click(screen.getByTitle("Display Style Settings"));

    // Now expanded content should be visible
    expect(screen.getByText("Pixel Size")).toBeInTheDocument();
    expect(screen.getByText("Colors")).toBeInTheDocument();
  });

  it("renders in expanded mode when compact=false", () => {
    render(<DisplayStylePicker compact={false} />);

    // Should show full content immediately
    expect(screen.getByText("Pixel Size")).toBeInTheDocument();
    expect(screen.getByText("Colors")).toBeInTheDocument();
  });

  it("updates UI when displaySettings changes externally", () => {
    render(<DisplayStylePicker compact={false} />);

    // Initial state
    const widthInput = screen.getByDisplayValue("5") as HTMLInputElement;
    expect(widthInput.value).toBe("5");

    // Simulate keyboard shortcut by calling exported function
    increaseCanvasSize();

    // UI should automatically update
    expect(widthInput.value).toBe("6");

    // Canvas dimensions should update too
    expect(screen.getByText("768×288")).toBeInTheDocument();
  });

  it("synchronizes changes between UI and global displaySettings", () => {
    render(<DisplayStylePicker compact={false} />);

    // Change input value
    const widthInput = screen.getByDisplayValue("5") as HTMLInputElement;
    fireEvent.input(widthInput, { target: { value: "10" } });

    // Global displaySettings should be updated
    expect(displaySettings.value.pixelWidth).toBe(10);

    // Canvas dimensions should update too
    expect(screen.getByText("1280×480")).toBeInTheDocument();
  });
});
