import { describe, it, expect, vi } from "vitest";
import { computeCanvasDims, DISPLAY_META, render7Seg } from "../lib/display";

describe("Display Scaling", () => {
  describe("computeCanvasDims", () => {
    it("calculates correct dimensions for OLED display at various pixel sizes", () => {
      // Test with pixel size 1
      const dim1 = computeCanvasDims("OLED", 1, 1);
      expect(dim1.cssW).toBe(DISPLAY_META.OLED.w);
      expect(dim1.cssH).toBe(DISPLAY_META.OLED.h);

      // Test with pixel size 2
      const dim2 = computeCanvasDims("OLED", 2, 2);
      expect(dim2.cssW).toBe(DISPLAY_META.OLED.w * 2);
      expect(dim2.cssH).toBe(DISPLAY_META.OLED.h * 2);

      // Test with different width and height
      const dim3 = computeCanvasDims("OLED", 3, 2);
      expect(dim3.cssW).toBe(DISPLAY_META.OLED.w * 3);
      expect(dim3.cssH).toBe(DISPLAY_META.OLED.h * 2);
    });

    it("calculates correct dimensions for 7SEG display at various pixel sizes", () => {
      // Test with pixel size 1
      const dim1 = computeCanvasDims("7SEG", 1, 1);
      expect(dim1.cssW).toBe(DISPLAY_META["7SEG"].w);
      expect(dim1.cssH).toBe(DISPLAY_META["7SEG"].h);

      // Test with pixel size 2
      const dim2 = computeCanvasDims("7SEG", 2, 2);
      expect(dim2.cssW).toBe(DISPLAY_META["7SEG"].w * 2);
      expect(dim2.cssH).toBe(DISPLAY_META["7SEG"].h * 2);
    });

    it("returns correct offsets for centering", () => {
      const dim1 = computeCanvasDims("OLED", 2, 2);
      expect(dim1.offsetX).toBe(0);
      expect(dim1.offsetY).toBe(0);

      const dim2 = computeCanvasDims("7SEG", 2, 2);
      expect(dim2.offsetX).toBe(0);
      expect(dim2.offsetY).toBe(0);
    });
  });

  describe("render7Seg", () => {
    it("draws 7-segment display with correct dimensions", () => {
      // Create a mock canvas context with all the methods we use
      const mockCtx = {
        fillRect: vi.fn(),
        fillStyle: "",
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        rect: vi.fn(),
        canvas: {
          width: DISPLAY_META.OLED.w * 2,
          height: DISPLAY_META.OLED.h * 2,
        },
      } as unknown as CanvasRenderingContext2D;

      // Set up test digits and dots
      const digits = [8, 8, 8, 8]; // All segments on
      const dots = 0b1111; // All dots on
      const pixelWidth = 2;
      const pixelHeight = 2;

      // Call the render function
      render7Seg(mockCtx, digits, dots, pixelWidth, pixelHeight);

      // Verify background is cleared
      expect(mockCtx.fillRect).toHaveBeenCalledWith(
        0,
        0,
        mockCtx.canvas.width,
        mockCtx.canvas.height
      );

      // Verify path drawing methods were called
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
      expect(mockCtx.closePath).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();

      // With 4 digits, we should have:
      // - 7 segments per digit = 28 segment paths
      // - 4 decimal points
      // Total: 32 paths
      expect(mockCtx.beginPath).toHaveBeenCalledTimes(32);
    });
  });
});
