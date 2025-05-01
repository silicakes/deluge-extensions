import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { displaySettings } from "../state";
import * as display from "../lib/display";

describe("Pixel Grid Toggle", () => {
  let originalDisplaySettings: typeof displaySettings.value;
  let canvasMock: HTMLCanvasElement;
  let ctxMock: CanvasRenderingContext2D;

  // Mock fillRect to track calls with different dimensions
  const fillRectSpy = vi.fn();

  beforeEach(() => {
    // Save original settings
    originalDisplaySettings = { ...displaySettings.value };

    // Create a mock canvas
    canvasMock = document.createElement("canvas");
    canvasMock.width = 128;
    canvasMock.height = 48;

    // Create a mock context with spies
    ctxMock = canvasMock.getContext("2d") as CanvasRenderingContext2D;
    ctxMock.fillRect = fillRectSpy;

    // Spy on the CanvasRenderingContext2D methods
    vi.spyOn(canvasMock, "getContext").mockReturnValue(ctxMock);

    // Reset fill count between tests
    fillRectSpy.mockClear();
  });

  afterEach(() => {
    // Restore original settings
    displaySettings.value = originalDisplaySettings;
    vi.restoreAllMocks();
  });

  it("should render pixels with inset when showPixelGrid is true", () => {
    // Set up test frame with some pixels lit
    const testFrame = new Uint8Array(128 * 6);
    // Set a few pixels to be "on"
    testFrame[0] = 0x01; // First pixel in first row
    testFrame[128] = 0x02; // Second bit in second page

    // Ensure grid is enabled
    displaySettings.value = {
      ...displaySettings.value,
      showPixelGrid: true,
    };

    // Call our internal renderOledCanvas function
    // We need to access it through the module's internal scope
    const renderFn =
      (display as any).__test__?.renderOledCanvas ||
      (() => {
        display.drawOled(canvasMock, createSysExMock(testFrame));
      });

    renderFn(ctxMock, testFrame, 5, 5);

    // With grid enabled, all fillRect calls for pixels should have inset (0.5px)
    // We count background fill + actual pixel fills
    expect(fillRectSpy).toHaveBeenCalled();

    // Check some fillRect calls to ensure they have inset
    const insetCalls = fillRectSpy.mock.calls.filter(
      (call: any[]) =>
        call[0] % 1 === 0.5 &&
        call[1] % 1 === 0.5 &&
        call[2] % 1 === 0 &&
        call[3] % 1 === 0,
    );

    // We should have inset calls
    expect(insetCalls.length).toBeGreaterThan(0);
  });

  it("should render pixels without inset when showPixelGrid is false", () => {
    // Set up test frame with some pixels lit
    const testFrame = new Uint8Array(128 * 6);
    // Set a few pixels to be "on"
    testFrame[0] = 0x01; // First pixel in first row
    testFrame[128] = 0x02; // Second bit in second page

    // Disable grid
    displaySettings.value = {
      ...displaySettings.value,
      showPixelGrid: false,
    };

    // Call our internal renderOledCanvas function
    const renderFn =
      (display as any).__test__?.renderOledCanvas ||
      (() => {
        display.drawOled(canvasMock, createSysExMock(testFrame));
      });

    renderFn(ctxMock, testFrame, 5, 5);

    // With grid disabled, all fillRect calls for pixels should have no inset (0px)
    expect(fillRectSpy).toHaveBeenCalled();

    // For pixels, we should see calls with integer coordinates and full width/height
    // Check that all pixel fillRect calls use whole pixels (no 0.5 inset)
    const integralCalls = fillRectSpy.mock.calls.filter(
      (call: any[]) =>
        call[0] % 1 === 0 &&
        call[1] % 1 === 0 &&
        // Skip the background rect which is always integral
        !(call[0] === 0 && call[1] === 0 && call[2] === 640 && call[3] === 240),
    );

    // We should have some integral calls for the pixel fills
    expect(integralCalls.length).toBeGreaterThan(0);
  });

  // Helper to mock a SysEx message containing our test frame
  function createSysExMock(frame: Uint8Array): Uint8Array {
    // Simple mock - real implementation would need proper RLE encoding
    const header = new Uint8Array([0xf0, 0x00, 0x01, 0x77, 0x7f, 0x00]);
    const footer = new Uint8Array([0xf7]);
    const result = new Uint8Array(header.length + frame.length + footer.length);
    result.set(header);
    result.set(frame, header.length);
    result.set(footer, header.length + frame.length);
    return result;
  }
});
