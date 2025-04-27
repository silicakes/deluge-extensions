/** display.ts - Display rendering helpers ported from legacy code */

import * as midi from "./midi";
import { displaySettings } from "../state";

/**
 * Unpacks data encoded with a 7-to-8 bit RLE scheme.
 * @param src The packed source data.
 * @param estimatedDstSize Optional estimate for destination size.
 * @returns The unpacked 8-bit data.
 */
export function unpack7to8Rle(
  src: Uint8Array,
  estimatedDstSize?: number
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
let oledFrame = new Uint8Array(FRAME_BYTES);

// Track what content is currently drawn so we can redraw after a scale change
type FrameKind = "NONE" | "OLED" | "7SEG";
let lastKind: FrameKind = "NONE";
let lastDigits: number[] = [0, 0, 0, 0];
let lastDots = 0;

// Add these variables near the top of the file, after existing variable declarations
// Store previous pixel dimensions when entering fullscreen
let previousPixelWidth = 0;
let previousPixelHeight = 0;

/** Low-level pixel renderer shared by full & delta draws */
function renderOledCanvas(
  ctx: CanvasRenderingContext2D,
  frame: Uint8Array,
  pxW: number,
  pxH: number
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
            pxH - 2 * indist
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
  customPixelHeight?: number
): void {
  if (sysEx.length < 8) return;
  const packed = sysEx.subarray(6, sysEx.length - 1);
  const unpacked = unpack7to8Rle(packed);
  if (unpacked.length !== FRAME_BYTES) return; // ignore malformed
  oledFrame = unpacked;

  const pxW = customPixelWidth ?? displaySettings.value.pixelWidth;
  const pxH = customPixelHeight ?? displaySettings.value.pixelHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  renderOledCanvas(ctx, oledFrame, pxW, pxH);
  // TAG current frame so it can be redrawn later
  lastKind = "OLED";
}

export function drawOledDelta(
  canvas: HTMLCanvasElement,
  sysEx: Uint8Array,
  customPixelWidth?: number,
  customPixelHeight?: number
): void {
  if (sysEx.length < 8) return;
  const first = sysEx[5];
  // const len = sysEx[6]; // Not used but kept for documentation
  const packed = sysEx.subarray(7, sysEx.length - 1);
  const unpacked = unpack7to8Rle(packed);

  oledFrame.set(unpacked, first * 8);

  const pxW = customPixelWidth ?? displaySettings.value.pixelWidth;
  const pxH = customPixelHeight ?? displaySettings.value.pixelHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  renderOledCanvas(ctx, oledFrame, pxW, pxH);
  // TAG current frame so it can be redrawn later
  lastKind = "OLED";
}

export function draw7Seg(
  canvas: HTMLCanvasElement,
  digits: number[],
  dots: number,
  customPixelWidth: number = displaySettings.value.pixelWidth,
  customPixelHeight: number = displaySettings.value.pixelHeight
): void {
  const offsetX = 10;
  const offsetY = 5;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (lastKind === "OLED") {
    // If we're switching from OLED to 7-segment, clear the previous display
    ctx.fillStyle = displaySettings.value.backgroundColor;
    ctx.fillRect(
      offsetX,
      offsetY,
      customPixelWidth * 128,
      customPixelHeight * 48
    );
  } else {
    // Otherwise, just clear the whole canvas
    ctx.fillStyle = displaySettings.value.backgroundColor;
    ctx.fillRect(
      offsetX,
      offsetY,
      ctx.canvas.width - 2 * offsetX,
      ctx.canvas.height - 2 * offsetY
    );
  }

  // Use color settings for the 7-segment display
  // Default red LED-like colors, but allow for customization
  const activeColor = displaySettings.value.use7SegCustomColors
    ? displaySettings.value.foregroundColor
    : "#CC3333";
  const inactiveColor = displaySettings.value.use7SegCustomColors
    ? displaySettings.value.backgroundColor
    : "#331111";

  // Calculate dimensions based on pixel size
  const scale = Math.min(customPixelWidth, customPixelHeight) / 5;

  // Scale all dimensions proportionally
  const digit_height = 120 * scale;
  const digit_width = 60 * scale;
  const stroke_thick = 9 * scale;
  const half_height = digit_height / 2;
  const out_adj = 0.5 * scale;
  const in_adj = 1.5 * scale;
  const dot_size = 6.5 * scale;
  const digit_spacing = 13 * scale;

  let off_y = offsetY + 6 * scale;

  let topbot = [
    [out_adj, 0],
    [stroke_thick + in_adj, stroke_thick],
    [digit_width - (stroke_thick + in_adj), stroke_thick],
    [digit_width - out_adj, 0],
  ];
  let halfside = [
    [0, out_adj],
    [stroke_thick, stroke_thick + in_adj],
    [stroke_thick, half_height - stroke_thick * 0.5 - in_adj],
    [0, half_height - out_adj],
  ];
  let h = half_height;
  let ht = stroke_thick;
  let hta = stroke_thick / 2;
  let midline = [
    [out_adj, h],
    [ht, h - hta],
    [digit_width - ht, h - hta],
    [digit_width - out_adj, h],
    [digit_width - ht, h + hta],
    [ht, h + hta],
  ];

  for (let d = 0; d < 4; d++) {
    let digit = digits[d];
    let dot = (dots & (1 << d)) != 0;

    let off_x = offsetX + 8 * scale + (digit_spacing + digit_width) * d;

    for (let s = 0; s < 7; s++) {
      ctx.beginPath();
      let path;
      if (s == 0) {
        path = midline;
      } else if (s == 3 || s == 6) {
        path = topbot;
      } else {
        path = halfside;
      }
      for (let i = 0; i < path.length; i++) {
        let c = path[i];
        if (s == 2 || s == 3 || s == 4) {
          c = [c[0], digit_height - c[1]];
        } // flip horiz
        if (s == 4 || s == 5) {
          c = [digit_width - c[0], c[1]];
        } // flip vert
        if (i == 0) {
          ctx.moveTo(off_x + c[0], off_y + c[1]);
        } else {
          ctx.lineTo(off_x + c[0], off_y + c[1]);
        }
      }

      ctx.closePath();

      if (digit & (1 << s)) {
        ctx.fillStyle = activeColor;
      } else {
        ctx.fillStyle = inactiveColor;
      }
      ctx.fill();
    }

    // the dot
    ctx.beginPath();
    ctx.rect(
      off_x + digit_width + 3 * scale,
      off_y + digit_height + 3 * scale,
      dot_size,
      dot_size
    );
    if (dot) {
      ctx.fillStyle = activeColor;
    } else {
      ctx.fillStyle = inactiveColor;
    }
    ctx.fill();
  }
  // TAG current frame so it can be redrawn later
  lastKind = "7SEG";
  // Cache values so we can redraw when size changes
  lastDigits = digits.slice(0, 4);
  lastDots = dots;
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
  switch (lastKind) {
    case "OLED": {
      const ctx = canvasRef.getContext("2d");
      if (ctx)
        renderOledCanvas(
          ctx,
          oledFrame,
          displaySettings.value.pixelWidth,
          displaySettings.value.pixelHeight
        );
      break;
    }
    case "7SEG": {
      draw7Seg(
        canvasRef,
        lastDigits,
        lastDots,
        displaySettings.value.pixelWidth,
        displaySettings.value.pixelHeight
      );
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

  // Set canvas dimensions exactly to display size without padding
  canvas.width = OLED_WIDTH * pixelWidth;
  canvas.height = 48 * pixelHeight;

  // Apply pixel rendering style
  canvas.style.imageRendering = "pixelated";

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

  // Calculate maximum possible integer scale that fits the screen
  // accounting for the 128×48 logical pixels of the Deluge screen
  const scaleX = Math.floor(screenWidth / OLED_WIDTH);
  const scaleY = Math.floor(screenHeight / 48); // 48 rows (6 pages * 8 pixels)

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
 * Copy the current canvas PNG (base64 string) to the clipboard.
 */
export async function copyCanvasToBase64() {
  if (!canvasRef) {
    console.warn("copyCanvasToBase64: no canvas registered");
    return;
  }
  const base64 = canvasRef.toDataURL("image/png").split(",")[1];
  try {
    await navigator.clipboard.writeText(base64);
  } catch (err) {
    console.error("Failed to copy Base64 data to clipboard", err);
  }
}
