import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/preact";
import { ScreenshotIconButton } from "../components/ScreenshotIconButton";
import { midiOut } from "../state";
import * as display from "../lib/display";

// Mock the display module
vi.mock("../lib/display", () => ({
  captureScreenshot: vi.fn(),
}));

describe("ScreenshotIconButton", () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock midiOut value to be non-null by default
    midiOut.value = { send: vi.fn() } as unknown as MIDIOutput;
  });

  it("renders correctly with opacity-0 class for hover visibility", () => {
    const { container } = render(<ScreenshotIconButton />);
    const button = container.querySelector("button");

    expect(button).toHaveClass("opacity-0");
    expect(button).toHaveClass("group-hover:opacity-100");
  });

  it("calls captureScreenshot when clicked", () => {
    const { container } = render(<ScreenshotIconButton />);
    const button = container.querySelector("button");

    fireEvent.click(button!);
    expect(display.captureScreenshot).toHaveBeenCalled();
  });

  it("is disabled when midiOut.value is null", () => {
    midiOut.value = null;
    const { container } = render(<ScreenshotIconButton />);
    const button = container.querySelector("button");

    expect(button).toBeDisabled();
  });

  it("has appropriate accessibility attributes", () => {
    const { container } = render(<ScreenshotIconButton />);
    const button = container.querySelector("button");

    expect(button).toHaveAttribute("aria-label", "Take screenshot");
    expect(button).toHaveAttribute("title", "Take screenshot (S)");
  });
});
