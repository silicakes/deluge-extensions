import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/preact";
import { DisplayViewer } from "../components/DisplayViewer";
import { displaySettings } from "../state";

// Mock the canvas registration and drawing functions
vi.mock("../lib/display", () => ({
  registerCanvas: vi.fn(),
  drawOled: vi.fn(),
  drawOledDelta: vi.fn(),
  draw7Seg: vi.fn(),
  resizeCanvas: vi.fn(),
  enterFullscreenScale: vi.fn(),
  exitFullscreenScale: vi.fn(),
}));

// Mock the MIDI listener
vi.mock("@/lib/midi", () => ({
  subscribeMidiListener: vi.fn(() => () => {}),
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
