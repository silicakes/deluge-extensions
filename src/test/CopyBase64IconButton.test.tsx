import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { CopyBase64IconButton } from "../components/CopyBase64IconButton";
import { midiOut } from "../state";
import * as displayLib from "../lib/display";
import * as debugLib from "../lib/debug";

// Mock the addDebugMessage function
vi.mock("../lib/debug", () => ({
  addDebugMessage: vi.fn(),
}));

// Mock the copyCanvasToBase64 function
vi.mock("../lib/display", () => ({
  copyCanvasToBase64: vi.fn(),
}));

describe("CopyBase64IconButton", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset signal value with mock MIDI output
    midiOut.value = {
      id: "test-device",
      send: vi.fn(),
    } as unknown as MIDIOutput;
  });

  it("renders with opacity-0 class (initially hidden)", () => {
    render(<CopyBase64IconButton />);
    const button = screen.getByRole("button", {
      name: /copy display as base64/i,
    });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("opacity-0");
    expect(button.className).toContain("group-hover:opacity-100");
  });

  it("has the correct position relative to screenshot button", () => {
    render(<CopyBase64IconButton />);
    const button = screen.getByRole("button", {
      name: /copy display as base64/i,
    });
    expect(button.className).toContain("top-2");
    expect(button.className).toContain("right-12");
  });

  it("calls copyCanvasToBase64 when clicked", async () => {
    const mockCopyFn = vi.mocked(displayLib.copyCanvasToBase64);
    mockCopyFn.mockResolvedValue(undefined);

    render(<CopyBase64IconButton />);
    const button = screen.getByRole("button", {
      name: /copy display as base64/i,
    });

    fireEvent.click(button);

    // Wait for the promise to resolve
    await new Promise(process.nextTick);

    expect(mockCopyFn).toHaveBeenCalledTimes(1);
    expect(debugLib.addDebugMessage).toHaveBeenCalledWith(
      "Base64 Gzip string copied to clipboard.",
    );
  });

  it("handles errors from copyCanvasToBase64", async () => {
    const mockError = new Error("Test error");
    const mockCopyFn = vi.mocked(displayLib.copyCanvasToBase64);
    mockCopyFn.mockRejectedValue(mockError);

    render(<CopyBase64IconButton />);
    const button = screen.getByRole("button", {
      name: /copy display as base64/i,
    });

    fireEvent.click(button);

    // Wait for the promise to reject
    await expect(mockCopyFn()).rejects.toThrow();

    expect(debugLib.addDebugMessage).toHaveBeenCalledWith("Error: Test error");
  });

  it("is disabled when midiOut is null", () => {
    midiOut.value = null;
    render(<CopyBase64IconButton />);
    const button = screen.getByRole("button", {
      name: /copy display as base64/i,
    });
    expect(button).toBeDisabled();
  });
});
