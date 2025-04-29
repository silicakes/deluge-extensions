/** display.ts - Display rendering helpers ported from legacy code */

import * as midi from "./midi";
import { displaySettings, displayType, fullscreenActive } from "../state";

/**
 * Unpacks data encoded with a 7-to-8 bit RLE scheme.
 * @param src The packed source data.
 * @param estimatedDstSize Optional estimate for destination size.
 * @returns The unpacked 8-bit data.
 */
export function unpack7to8Rle(
  src: Uint8Array,
  estimatedDstSize?: number,
): Uint8Array {
  // Ported from legacy-scripts/legacy-unpack.js – converts Synthstrom 7-bit RLE to raw 8-bit buffer
  // The algorithm works on a byte-stream where each packet starts with a *marker* byte.
  // If the marker < 64  → *dense* packet encoding 2-5 bytes of literal data.
  // If the marker ≥ 64   → *run-length* packet encoding N repetitions of one byte.
  // A dense marker encodes both the literal byte count (size) **and** the MSBs of each
  // literal byte.  Run-length markers encode the high-bit of the value and the run count.

  const ERROR = (msg: string) => new Error(`unpack7to8Rle: ${msg}`);

  // Heuristic – full OLED frame is 6×128 = 768 bytes. We default to x32 expansion like legacy.
  let dst = new Uint8Array(estimatedDstSize ?? src.length * 32);
  let di = 0;
  let si = 0;

  const ensureCap = (need: number) => {
    if (di + need <= dst.length) return;
    const next = Math.max(dst.length * 2, di + need + 1024);
    const bigger = new Uint8Array(next);
    bigger.set(dst, 0);
    dst = bigger;
  };

  while (si < src.length) {
    const first = src[si++];

    if (first < 64) {
      // Dense packet – literal bytes 2-5 in length
      let size = 0;
      let off = 0;
      if (first < 4) {
        size = 2;
        off = 0;
      } else if (first < 12) {
        size = 3;
        off = 4;
      } else if (first < 28) {
        size = 4;
        off = 12;
      } else if (first < 60) {
        size = 5;
        off = 28;
      } else {
        throw ERROR(`invalid dense marker ${first}`);
      }
      if (si + size > src.length) throw ERROR("incomplete dense packet");

      ensureCap(size);
      const highBits = first - off;
      for (let j = 0; j < size; j++) {
        const byte = src[si + j] & 0x7f;
        if ((highBits & (1 << j)) !== 0) dst[di + j] = byte | 0x80;
        else dst[di + j] = byte;
      }
      si += size;
      di += size;
    } else {
      // RLE packet
      const marker = first - 64;
      const high = (marker & 1) !== 0;
      let runLen = marker >> 1;
      if (runLen === 31) {
        if (si >= src.length) throw ERROR("missing extended runlen");
        runLen = 31 + src[si++];
      }
      if (si >= src.length) throw ERROR("missing value byte");
      const value = (src[si++] & 0x7f) | (high ? 0x80 : 0);

      ensureCap(runLen);
      dst.fill(value, di, di + runLen);
      di += runLen;
    }
  }
  return dst.subarray(0, di);
}

// -------------------- Display drawing helpers --------------------

// Internal buffer to keep the current OLED frame so deltas can be applied
const OLED_WIDTH = 128;
const OLED_PAGES = 6; // 6×8 = 48 rows
const FRAME_BYTES = OLED_WIDTH * OLED_PAGES; // 768

// Display dimensions metadata - used for proper scaling
export const DISPLAY_META = {
  OLED: { w: 128, h: 48 }, // px
  "7SEG": { w: 88, h: 40 }, // 4 digits (22px each) + 3 dot columns (2px)
} as const;

export let oledFrame = new Uint8Array(FRAME_BYTES);

// Track what content is currently drawn so we can redraw after a scale change
type FrameKind = "NONE" | "OLED" | "7SEG";
let lastKind: FrameKind = "NONE";
let lastDigits: number[] = [0, 0, 0, 0];
let lastDots = 0;

// Store previous pixel dimensions when entering fullscreen
let previousPixelWidth = 0;
let previousPixelHeight = 0;

// Declare a variable to hold the resize listener so we can remove it later
let fullscreenResizeListener: (() => void) | null = null;

/**
 * Computes canvas dimensions based on display type and pixel size
 * @param type Display type ("OLED" or "7SEG")
 * @param pixelWidth Width of each logical pixel in CSS pixels
 * @param pixelHeight Height of each logical pixel in CSS pixels
 * @returns Canvas dimensions and offset for centering
 */
export function computeCanvasDims(
  type: "OLED" | "7SEG",
  pixelWidth: number,
  pixelHeight: number,
): { cssW: number; cssH: number; offsetX: number; offsetY: number } {
  const meta = DISPLAY_META[type];
  const cssW = meta.w * pixelWidth;
  const cssH = meta.h * pixelHeight;

  // For now, we're not centering with offset,
  // but the function is set up to support it in the future
  return {
    cssW,
    cssH,
    offsetX: 0,
    offsetY: 0,
  };
}

/** Low-level pixel renderer shared by full & delta draws */
function renderOledCanvas(
  ctx: CanvasRenderingContext2D,
  frame: Uint8Array,
  pxW: number,
  pxH: number,
) {
  const indist = 0.5; // visually pleasing inset so individual pixels have gaps
  ctx.fillStyle = displaySettings.value.backgroundColor;
  ctx.fillRect(0, 0, OLED_WIDTH * pxW, 48 * pxH);
  ctx.fillStyle = displaySettings.value.foregroundColor;
  for (let page = 0; page < OLED_PAGES; page++) {
    for (let bit = 0; bit < 8; bit++) {
      const mask = 1 << bit;
      for (let x = 0; x < OLED_WIDTH; x++) {
        const byte = frame[page * OLED_WIDTH + x];
        if ((byte & mask) !== 0) {
          const y = page * 8 + bit;
          ctx.fillRect(
            x * pxW + indist,
            y * pxH + indist,
            pxW - 2 * indist,
            pxH - 2 * indist,
          );
        }
      }
    }
  }
}

export function drawOled(
  canvas: HTMLCanvasElement,
  sysEx: Uint8Array,
  customPixelWidth?: number,
  customPixelHeight?: number,
): void {
  if (sysEx.length < 8) return;
  const packed = sysEx.subarray(6, sysEx.length - 1);
  const unpacked = unpack7to8Rle(packed);
  if (unpacked.length !== FRAME_BYTES) return; // ignore malformed
  oledFrame = unpacked;

  const pxW = customPixelWidth ?? displaySettings.value.pixelWidth;
  const pxH = customPixelHeight ?? displaySettings.value.pixelHeight;

  // Always resize the canvas to match OLED dimensions
  const width = DISPLAY_META.OLED.w * pxW;
  const height = DISPLAY_META.OLED.h * pxH;
  canvas.width = width;
  canvas.height = height;

  // Dispatch a resize event (important for container to adjust)
  window.dispatchEvent(
    new CustomEvent("display:resized", {
      detail: { width, height, offsetX: 0, offsetY: 0 },
    }),
  );

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  renderOledCanvas(ctx, oledFrame, pxW, pxH);

  // Update display type and last kind
  displayType.value = "OLED";
  lastKind = "OLED";
}

export function drawOledDelta(
  canvas: HTMLCanvasElement,
  sysEx: Uint8Array,
  customPixelWidth?: number,
  customPixelHeight?: number,
): void {
  if (sysEx.length < 8) return;
  const first = sysEx[5];
  // const len = sysEx[6]; // Not used but kept for documentation
  const packed = sysEx.subarray(7, sysEx.length - 1);
  const unpacked = unpack7to8Rle(packed);

  oledFrame.set(unpacked, first * 8);

  const pxW = customPixelWidth ?? displaySettings.value.pixelWidth;
  const pxH = customPixelHeight ?? displaySettings.value.pixelHeight;

  // Always resize the canvas to match OLED dimensions
  const width = DISPLAY_META.OLED.w * pxW;
  const height = DISPLAY_META.OLED.h * pxH;
  canvas.width = width;
  canvas.height = height;

  // Dispatch a resize event (important for container to adjust)
  window.dispatchEvent(
    new CustomEvent("display:resized", {
      detail: { width, height, offsetX: 0, offsetY: 0 },
    }),
  );

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  renderOledCanvas(ctx, oledFrame, pxW, pxH);

  // Update display type and last kind
  displayType.value = "OLED";
  lastKind = "OLED";
}

// 7-segment display segment mapping lookup table (0-F)

/**
 * Renders 7-segment display buffer to canvas with proper scaling
 * @param ctx Canvas context to draw on
 * @param digits Array of 4 digit values (0-F)
 * @param dots Bitmap indicating which decimal points are active
 * @param pixelWidth Width of each logical pixel in CSS pixels
 * @param pixelHeight Height of each logical pixel in CSS pixels
 */
export function render7Seg(
  ctx: CanvasRenderingContext2D,
  digits: number[],
  dots: number,
  pixelWidth: number,
  pixelHeight: number,
): void {
  // Get canvas dimensions (or use default OLED dimensions for tests)
  const canvasWidth = ctx.canvas?.width ?? DISPLAY_META.OLED.w * pixelWidth;
  const canvasHeight = ctx.canvas?.height ?? DISPLAY_META.OLED.h * pixelHeight;

  // Clear the entire canvas with the background color
  ctx.fillStyle = displaySettings.value.backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Use color settings for the 7-segment display
  const activeColor = displaySettings.value.use7SegCustomColors
    ? displaySettings.value.foregroundColor
    : "#CC3333";
  const inactiveColor = displaySettings.value.use7SegCustomColors
    ? displaySettings.value.backgroundColor
    : "#331111";

  // Calculate scale factor based on pixel size - match original scaling
  const scale = Math.min(pixelWidth, pixelHeight) / 5;

  // Scale all dimensions proportionally (using exact values from original code)
  const digit_height = 120 * scale;
  const digit_width = 60 * scale;
  const stroke_thick = 9 * scale;
  const half_height = digit_height / 2;
  const out_adj = 0.5 * scale;
  const in_adj = 1.5 * scale;
  const dot_size = 6.5 * scale;
  const digit_spacing = 13 * scale;

  // Calculate total width of the 7-segment display to center it
  const total_7seg_width = 4 * digit_width + 3 * digit_spacing + 16 * scale; // 4 digits + spacing + margins

  // Calculate centering offsets
  const offset_x = Math.max(0, (canvasWidth - total_7seg_width) / 2);
  const offset_y = Math.max(0, (canvasHeight - digit_height - 12 * scale) / 2);

  // Define segment path arrays exactly as in the original
  const topbot = [
    [out_adj, 0],
    [stroke_thick + in_adj, stroke_thick],
    [digit_width - (stroke_thick + in_adj), stroke_thick],
    [digit_width - out_adj, 0],
  ];

  const halfside = [
    [0, out_adj],
    [stroke_thick, stroke_thick + in_adj],
    [stroke_thick, half_height - stroke_thick * 0.5 - in_adj],
    [0, half_height - out_adj],
  ];

  const h = half_height;
  const ht = stroke_thick;
  const hta = stroke_thick / 2;
  const midline = [
    [out_adj, h],
    [ht, h - hta],
    [digit_width - ht, h - hta],
    [digit_width - out_adj, h],
    [digit_width - ht, h + hta],
    [ht, h + hta],
  ];

  // Draw each digit
  for (let d = 0; d < 4; d++) {
    const digit = digits[d];
    const dot = (dots & (1 << d)) !== 0;

    // X offset for this digit - add the centering offset
    const off_x = offset_x + 8 * scale + (digit_spacing + digit_width) * d;

    // Draw all 7 segments
    for (let s = 0; s < 7; s++) {
      ctx.beginPath();

      // Select the appropriate path for this segment
      let path;
      if (s === 0) {
        path = midline;
      } else if (s === 3 || s === 6) {
        path = topbot;
      } else {
        path = halfside;
      }

      // Draw the segment path exactly as in the original
      for (let i = 0; i < path.length; i++) {
        const c = [...path[i]]; // Clone the point to avoid modifying the original

        // Apply transformations based on segment position (exact same as original)
        if (s === 2 || s === 3 || s === 4) {
          c[1] = digit_height - c[1]; // Flip horizontally
        }
        if (s === 4 || s === 5) {
          c[0] = digit_width - c[0]; // Flip vertically
        }

        // Create the path with added vertical offset
        if (i === 0) {
          ctx.moveTo(off_x + c[0], offset_y + 6 * scale + c[1]);
        } else {
          ctx.lineTo(off_x + c[0], offset_y + 6 * scale + c[1]);
        }
      }

      ctx.closePath();

      // Fill with active or inactive color
      ctx.fillStyle = (digit & (1 << s)) !== 0 ? activeColor : inactiveColor;
      ctx.fill();
    }

    // Draw the decimal point - exactly as in original code
    ctx.beginPath();
    ctx.rect(
      off_x + digit_width + 3 * scale,
      offset_y + 6 * scale + digit_height + 3 * scale,
      dot_size,
      dot_size,
    );
    ctx.fillStyle = dot ? activeColor : inactiveColor;
    ctx.fill();
  }

  // Track last state for redraw
  lastKind = "7SEG";
  lastDigits = [...digits];
  lastDots = dots;
}

export function draw7Seg(
  canvas: HTMLCanvasElement,
  digits: number[],
  dots: number,
  customPixelWidth: number = displaySettings.value.pixelWidth,
  customPixelHeight: number = displaySettings.value.pixelHeight,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Use the OLED dimensions for the canvas size to ensure consistent physical dimensions
  const width = DISPLAY_META.OLED.w * customPixelWidth;
  const height = DISPLAY_META.OLED.h * customPixelHeight;
  canvas.width = width;
  canvas.height = height;

  // Dispatch a resize event (important for container to adjust)
  window.dispatchEvent(
    new CustomEvent("display:resized", {
      detail: { width, height, offsetX: 0, offsetY: 0 },
    }),
  );

  // Render 7-segment display
  render7Seg(ctx, digits, dots, customPixelWidth, customPixelHeight);

  // Update display type
  displayType.value = "7SEG";
}

// -----------------------------------------------------------------

// Reference to the canvas element managed by DisplayViewer
let canvasRef: HTMLCanvasElement | null = null;

// Polling interval for display refresh
export const pollingMs = 1000;
let pollingId: number | null = null;

export function startPolling() {
  if (pollingId == null) {
    pollingId = window.setInterval(() => midi.getDisplay(false), pollingMs);
  }
}

export function stopPolling() {
  if (pollingId != null) {
    clearInterval(pollingId);
    pollingId = null;
  }
}

/**
 * Register the canvas that display helpers will operate on.
 * Should be called once by <DisplayViewer /> after the ref is available.
 */
export function registerCanvas(canvas: HTMLCanvasElement) {
  canvasRef = canvas;
  resizeCanvas(canvas);
}

/** Redraw the most recent frame buffer after canvas dimensions change */
function redrawCurrentFrame() {
  if (!canvasRef) return;

  const { pixelWidth, pixelHeight } = displaySettings.value;

  // Always use OLED dimensions for consistent sizing
  const cssW = DISPLAY_META.OLED.w * pixelWidth;
  const cssH = DISPLAY_META.OLED.h * pixelHeight;
  canvasRef.width = cssW;
  canvasRef.height = cssH;

  switch (lastKind) {
    case "OLED": {
      const ctx = canvasRef.getContext("2d");
      if (ctx) renderOledCanvas(ctx, oledFrame, pixelWidth, pixelHeight);
      break;
    }
    case "7SEG": {
      draw7Seg(canvasRef, lastDigits, lastDots, pixelWidth, pixelHeight);
      break;
    }
    default:
      // nothing to redraw yet
      break;
  }
}

// Resize the canvas based on displaySettings
export function resizeCanvas(canvas: HTMLCanvasElement): void {
  if (!canvas) return;

  const { pixelWidth, pixelHeight } = displaySettings.value;
  const type = displayType.value; // Get current display type from signal

  // Always use OLED dimensions for consistent sizing
  const cssW = DISPLAY_META.OLED.w * pixelWidth;
  const cssH = DISPLAY_META.OLED.h * pixelHeight;

  // Set canvas dimensions
  canvas.width = cssW;
  canvas.height = cssH;

  // Apply pixel rendering style
  canvas.style.imageRendering = "pixelated";

  // Emit a custom event with new dimensions for wrapper to listen to
  window.dispatchEvent(
    new CustomEvent("display:resized", {
      detail: { width: cssW, height: cssH },
    }),
  );

  // If the current display type doesn't match lastKind, update lastKind to match
  // This ensures we're always using the correct renderer when switching types
  if (
    (type === "OLED" && lastKind !== "OLED") ||
    (type === "7SEG" && lastKind !== "7SEG")
  ) {
    lastKind = type;
  }

  // Redraw current frame with new size
  redrawCurrentFrame();
}

/** Increase canvas pixel size by one step (up to maxSize). */
export function increaseCanvasSize() {
  const { pixelWidth, pixelHeight, resizeStep, minSize, maxSize } =
    displaySettings.value;
  displaySettings.value = {
    ...displaySettings.value,
    pixelWidth: Math.max(minSize, Math.min(maxSize, pixelWidth + resizeStep)),
    pixelHeight: Math.max(minSize, Math.min(maxSize, pixelHeight + resizeStep)),
  };

  if (canvasRef) {
    resizeCanvas(canvasRef);
  }
}

/** Decrease canvas pixel size by one step (down to minSize). */
export function decreaseCanvasSize() {
  const { pixelWidth, pixelHeight, resizeStep, minSize, maxSize } =
    displaySettings.value;
  displaySettings.value = {
    ...displaySettings.value,
    pixelWidth: Math.max(minSize, Math.min(maxSize, pixelWidth - resizeStep)),
    pixelHeight: Math.max(minSize, Math.min(maxSize, pixelHeight - resizeStep)),
  };

  if (canvasRef) {
    resizeCanvas(canvasRef);
  }
}

/**
 * Calculate the largest integer scale that fits the screen dimensions
 * @returns The optimal integer scale for fullscreen
 */
function calculateOptimalScale(): number {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const type = displayType.value;
  const meta = DISPLAY_META[type];

  // Calculate maximum possible integer scale that fits the screen
  const scaleX = Math.floor(screenWidth / meta.w);
  const scaleY = Math.floor(screenHeight / meta.h);

  // Use the smaller of the two scales to ensure the entire canvas fits
  return Math.max(1, Math.min(scaleX, scaleY));
}

/**
 * Set the pixel scale for fullscreen mode
 * @param canvas The canvas element to resize
 */
export function enterFullscreenScale(canvas: HTMLCanvasElement): void {
  // Store current pixel dimensions
  previousPixelWidth = displaySettings.value.pixelWidth;
  previousPixelHeight = displaySettings.value.pixelHeight;

  // Calculate optimal integer scale for fullscreen
  const optimalScale = calculateOptimalScale();

  // Update settings with the new scale
  displaySettings.value = {
    ...displaySettings.value,
    pixelWidth: optimalScale,
    pixelHeight: optimalScale,
  };

  // Apply the new dimensions
  resizeCanvas(canvas);

  // Redraw with the new scale
  redrawCurrentFrame();

  // Attach resize/orientation listeners so canvas rescales when viewport changes (e.g. device rotation)
  if (!fullscreenResizeListener) {
    fullscreenResizeListener = () => {
      // Only react if still in fullscreen mode
      if (fullscreenActive.value) {
        applyOptimalFullscreenScale();
      }
    };
    window.addEventListener("resize", fullscreenResizeListener);
    window.addEventListener("orientationchange", fullscreenResizeListener);
  }
}

/**
 * Restore the pixel scale after exiting fullscreen
 * @param canvas The canvas element to resize
 */
export function exitFullscreenScale(canvas: HTMLCanvasElement): void {
  // Restore previous pixel dimensions
  if (previousPixelWidth > 0 && previousPixelHeight > 0) {
    displaySettings.value = {
      ...displaySettings.value,
      pixelWidth: previousPixelWidth,
      pixelHeight: previousPixelHeight,
    };

    // Reset the stored values
    previousPixelWidth = 0;
    previousPixelHeight = 0;

    // Apply the restored dimensions
    resizeCanvas(canvas);

    // Redraw with the restored scale
    redrawCurrentFrame();
  }

  // Detach resize/orientation listeners when leaving fullscreen to avoid leaks
  if (fullscreenResizeListener) {
    window.removeEventListener("resize", fullscreenResizeListener);
    window.removeEventListener("orientationchange", fullscreenResizeListener);
    fullscreenResizeListener = null;
  }
}

// Replace the existing toggleFullScreen function with this improved one
export async function toggleFullScreen(): Promise<void> {
  // NOTE: This function is kept for backward compatibility
  // The actual functionality has been moved to lib/fullscreen.ts
  const { toggle } = await import("./fullscreen");
  toggle();
}

/**
 * Capture the current canvas as PNG and trigger download with a timestamped filename.
 */
export function captureScreenshot() {
  if (!canvasRef) {
    console.warn("captureScreenshot: no canvas registered");
    return;
  }
  const dataUrl = canvasRef.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  link.download = `deluge-screenshot-${ts}.png`;
  link.click();
}

/**
 * Copy the provided OLED buffer as a gzipped Base64 string to the clipboard in the format "::screen[<base64>]".
 * This is a low-level utility that handles compression and clipboard operations.
 * @param buffer The OLED buffer as Uint8Array to compress and convert to Base64
 * @returns Promise that resolves when clipboard write is complete or rejects with an error
 */
export async function copyBufferToClipboard(buffer: Uint8Array): Promise<void> {
  if (!buffer || !(buffer instanceof Uint8Array)) {
    throw new Error("No OLED data available to copy.");
  }

  if (!window.CompressionStream || !navigator.clipboard) {
    throw new Error(
      "CompressionStream or Clipboard API not supported in this browser.",
    );
  }

  try {
    // Compress the buffer with gzip
    const compressed = await new Response(
      new Blob([buffer]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer();

    // Convert to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split("data:application/octet-stream;base64,")[1];
        if (!base64) {
          reject(new Error("Could not extract base64 data"));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(
        new File([compressed], "", { type: "application/octet-stream" }),
      );
    });

    // Create the markdown-style directive and copy to clipboard
    const markdownString = `::screen[${base64Data}]`;
    await navigator.clipboard.writeText(markdownString);

    return;
  } catch (err) {
    throw new Error(
      `Failed to copy OLED data: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Copy the current canvas as a gzipped Base64 string to the clipboard.
 * @param lastOled Optional OLED buffer to use; if not provided, uses the current oledFrame
 */
export async function copyCanvasToBase64(lastOled?: Uint8Array): Promise<void> {
  try {
    // Use provided buffer or fall back to the current frame
    const buffer = lastOled || oledFrame;
    await copyBufferToClipboard(buffer);
  } catch (err) {
    console.error("Copy to Base64 failed:", err);
    throw err;
  }
}

/**
 * Apply the optimal integer scale based on current viewport while in fullscreen.
 * This helper does **not** touch the `previousPixelWidth/Height` cache so it can
 * be invoked repeatedly (e.g. on orientation changes) without losing the
 * original pre-fullscreen dimensions.
 */
function applyOptimalFullscreenScale() {
  if (!canvasRef) return;
  const optimalScale = calculateOptimalScale();

  // Only update when scale actually changes to avoid unnecessary redraws
  if (
    optimalScale !== displaySettings.value.pixelWidth ||
    optimalScale !== displaySettings.value.pixelHeight
  ) {
    displaySettings.value = {
      ...displaySettings.value,
      pixelWidth: optimalScale,
      pixelHeight: optimalScale,
    };

    // Apply & redraw at the new scale
    resizeCanvas(canvasRef);
  }
}
