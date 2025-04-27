import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { DisplayStylePicker } from "../components/DisplayStylePicker";
import { displaySettings } from "../state";

// Setup localStorage mock
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

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

    // Mock localStorage before each test
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });

    // Reset mock counts
    vi.clearAllMocks();
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
});
