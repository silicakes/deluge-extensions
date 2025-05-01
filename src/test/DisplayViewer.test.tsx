import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { DisplayViewer } from "../components/DisplayViewer";
import { fullscreenActive } from "../state";

// Mock the necessary functions
vi.mock("../lib/debug", () => ({
  addDebugMessage: vi.fn(),
}));

vi.mock("../lib/display", () => ({
  registerCanvas: vi.fn(),
  drawOled: vi.fn(),
  drawOledDelta: vi.fn(),
  draw7Seg: vi.fn(),
  resizeCanvas: vi.fn(),
  enterFullscreenScale: vi.fn(),
  exitFullscreenScale: vi.fn(),
  copyCanvasToBase64: vi.fn(),
  oledFrame: new Uint8Array(128 * 6),
}));

vi.mock("../lib/midi", () => ({
  subscribeMidiListener: vi.fn().mockReturnValue(() => {}),
}));

// Mock the DisplayTypeSwitch component
vi.mock("../components/DisplayTypeSwitch", () => ({
  DisplayTypeSwitch: () => (
    <div data-testid="display-type-switch">Display Type Switch Mock</div>
  ),
}));

// Mock the CopyBase64IconButton component
vi.mock("../components/CopyBase64IconButton", () => ({
  CopyBase64IconButton: () => (
    <button data-testid="copy-base64-button">Copy Base64 Icon</button>
  ),
}));

// Mock the ScreenshotIconButton component
vi.mock("../components/ScreenshotIconButton", () => ({
  ScreenshotIconButton: () => (
    <button data-testid="screenshot-button">Screenshot Icon</button>
  ),
}));

describe("DisplayViewer", () => {
  beforeEach(() => {
    // Reset fullscreen state
    fullscreenActive.value = false;
  });

  it("renders the canvas with correct structure", () => {
    const { container } = render(<DisplayViewer />);

    // Should have a wrapper with id="display-wrapper"
    const wrapper = container.querySelector("#display-wrapper");
    expect(wrapper).toBeInTheDocument();

    // Wrapper should have the screen-container class but not the border class
    expect(wrapper).toHaveClass("screen-container");
    expect(wrapper).not.toHaveClass("border");

    // Should have a canvas inside the wrapper
    const canvas = wrapper?.querySelector("canvas");
    expect(canvas).toBeInTheDocument();

    // Canvas should have the border class
    expect(canvas).toHaveClass("border");
    expect(canvas).toHaveClass("image-rendering-pixelated");
    expect(canvas).toHaveClass("block");

    // Should have the display type switch
    expect(screen.getByTestId("display-type-switch")).toBeInTheDocument();

    // Ensure the Copy Base64 button exists when not in fullscreen mode
    const copyButton = screen.getByTestId("copy-base64-button");
    expect(copyButton).toBeInTheDocument();

    // Ensure the Screenshot button exists when not in fullscreen mode
    const screenshotButton = screen.getByTestId("screenshot-button");
    expect(screenshotButton).toBeInTheDocument();
  });

  it("hides the display type switch in fullscreen mode", () => {
    fullscreenActive.value = true;
    render(<DisplayViewer />);

    // The display type switch should not be visible in fullscreen mode
    expect(screen.queryByTestId("display-type-switch")).not.toBeInTheDocument();
    // The copy base64 button should not be visible in fullscreen mode
    expect(screen.queryByTestId("copy-base64-button")).not.toBeInTheDocument();
    // The screenshot button should not be visible in fullscreen mode
    expect(screen.queryByTestId("screenshot-button")).not.toBeInTheDocument();
  });

  it("listens for display:resized events", () => {
    const { container } = render(<DisplayViewer />);

    // Get the wrapper element
    const wrapper = container.querySelector("#display-wrapper") as HTMLElement;
    expect(wrapper).toBeInTheDocument();

    // Initial state
    expect(wrapper.style.width).toBe("");
    expect(wrapper.style.height).toBe("");

    // Simulate display:resized event
    const resizeEvent = new CustomEvent("display:resized", {
      detail: { width: 1280, height: 480 },
    });
    window.dispatchEvent(resizeEvent);

    // Wrapper should update its dimensions
    expect(wrapper.style.width).toBe("1280px");
    expect(wrapper.style.height).toBe("480px");
  });

  it("applies CSS classes for proper rendering", () => {
    const { container } = render(<DisplayViewer />);

    // Canvas should have display:block for proper border rendering
    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveClass("block");

    // Wrapper should have transition for smooth resize
    const wrapper = container.querySelector("#display-wrapper");
    expect(wrapper).toHaveClass("transition-all");
  });
});
