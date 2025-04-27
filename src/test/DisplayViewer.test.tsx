import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/preact";
import { DisplayViewer } from "../components/DisplayViewer";

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

describe("DisplayViewer", () => {
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

    // Ensure the button exists when not in fullscreen mode
    const button = screen.getByText("Copy Base64");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Copy Base64 of OLED buffer");
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
