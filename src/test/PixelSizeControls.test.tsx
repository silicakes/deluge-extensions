import { render, fireEvent, waitFor } from "@testing-library/preact";
import { PixelSizeControls } from "../components/PixelSizeControls";
import { displaySettings } from "../state";
import * as displayLib from "../lib/display";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock display functions
vi.mock("../lib/display", () => ({
  increaseCanvasSize: vi.fn(),
  decreaseCanvasSize: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("PixelSizeControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset display settings before each test
    displaySettings.value = {
      pixelWidth: 5,
      pixelHeight: 5,
      foregroundColor: "#eeeeee",
      backgroundColor: "#111111",
      use7SegCustomColors: false,
      minSize: 1,
      maxSize: 32,
      resizeStep: 1,
      showPixelGrid: false,
    };
  });

  it("renders with current pixel size", () => {
    const { getByText } = render(<PixelSizeControls />);

    // Check if the current pixel size is displayed using regex
    expect(getByText(/5×5/)).toBeTruthy();

    // Check if canvas dimensions are shown using regex
    expect(getByText(/640 × 240 px/)).toBeTruthy();
  });

  it("calls increaseCanvasSize when + button is clicked", () => {
    const { getByLabelText } = render(<PixelSizeControls />);

    // Click the increase button
    fireEvent.click(getByLabelText("Increase pixel size"));

    // Check if the function was called
    expect(displayLib.increaseCanvasSize).toHaveBeenCalledTimes(1);
  });

  it("calls decreaseCanvasSize when - button is clicked", () => {
    const { getByLabelText } = render(<PixelSizeControls />);

    // Click the decrease button
    fireEvent.click(getByLabelText("Decrease pixel size"));

    // Check if the function was called
    expect(displayLib.decreaseCanvasSize).toHaveBeenCalledTimes(1);
  });

  it("updates display when pixel size changes", async () => {
    const { getByText } = render(<PixelSizeControls />);

    // Check initial value
    expect(getByText(/5×5/)).toBeTruthy();

    // Update pixel size manually in display settings
    displaySettings.value = {
      ...displaySettings.value,
      pixelWidth: 10,
      pixelHeight: 10,
    };

    // Wait for signal propagation with regex pattern matching
    await waitFor(
      () => {
        expect(getByText(/10×10/)).toBeTruthy();
        expect(getByText(/1280 × 480 px/)).toBeTruthy();
      },
      { timeout: 1000 },
    );
  });

  it("disables decrease button when at minimum size", () => {
    // Set the pixel width to the minimum size
    displaySettings.value = {
      ...displaySettings.value,
      pixelWidth: 1,
      pixelHeight: 1,
    };

    const { getByLabelText } = render(<PixelSizeControls />);

    // Check if the decrease button is disabled
    expect(getByLabelText("Decrease pixel size")).toHaveAttribute("disabled");
  });

  it("disables increase button when at maximum size", () => {
    // Set the pixel width to the maximum size
    displaySettings.value = {
      ...displaySettings.value,
      pixelWidth: 32,
      pixelHeight: 32,
    };

    const { getByLabelText } = render(<PixelSizeControls />);

    // Check if the increase button is disabled
    expect(getByLabelText("Increase pixel size")).toHaveAttribute("disabled");
  });
});
