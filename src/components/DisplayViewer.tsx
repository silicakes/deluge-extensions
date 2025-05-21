import { useEffect, useRef, useCallback } from "preact/hooks";
import {
  registerCanvas,
  drawOled,
  drawOledDelta,
  draw7Seg,
  resizeCanvas,
  enterFullscreenScale,
  exitFullscreenScale,
  copyCanvasToBase64,
  oledFrame,
} from "../lib/display";
import { subscribeMidiListener } from "@/commands";
import { displaySettings, fullscreenActive } from "../state";
import { addDebugMessage } from "../lib/debug";
import { DisplayTypeSwitch } from "./DisplayTypeSwitch";
import { ScreenshotIconButton } from "./ScreenshotIconButton";
import { CopyBase64IconButton } from "./CopyBase64IconButton";

/**
 * DisplayViewer – renders the Deluge OLED / 7-segment output onto a canvas.
 * Now positioned outside the Card container to enable proper fullscreen behavior.
 */
export function DisplayViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastBufferRef = useRef<Uint8Array | null>(null);

  // Register the canvas with display helpers on mount
  useEffect(() => {
    if (canvasRef.current) {
      registerCanvas(canvasRef.current);
    }
  }, []);

  // Resize canvas when display settings change
  useEffect(() => {
    if (canvasRef.current) {
      resizeCanvas(canvasRef.current);
    }
  }, [displaySettings.value]);

  // Handle fullscreen changes
  useEffect(() => {
    if (!canvasRef.current) return;

    if (fullscreenActive.value) {
      // Apply integer scaling when entering fullscreen
      enterFullscreenScale(canvasRef.current);
      // Add fullscreen-mode class to body
      document.body.classList.add("fullscreen-mode");
      // Make sure container is visible
      if (containerRef.current) {
        containerRef.current.style.display = "block";
        containerRef.current.style.visibility = "visible";
        containerRef.current.style.opacity = "1";
      }
    } else {
      // Restore original scale when exiting fullscreen
      exitFullscreenScale(canvasRef.current);
      // Remove fullscreen-mode class from body
      document.body.classList.remove("fullscreen-mode");
    }
  }, [fullscreenActive.value]);

  // Handle Base64 copy action
  const handleCopyBase64 = useCallback(async () => {
    try {
      if (!lastBufferRef.current) {
        throw new Error("No display data available to copy");
      }
      await copyCanvasToBase64(lastBufferRef.current);
      addDebugMessage("Base64 Gzip string copied to clipboard.");
    } catch (err) {
      addDebugMessage(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      console.error("Copy to Base64 failed:", err);
    }
  }, []);

  // Listen for display:resized events to sync wrapper dimensions
  useEffect(() => {
    const handleDisplayResized = (e: CustomEvent) => {
      if (containerRef.current) {
        containerRef.current.style.width = `${e.detail.width}px`;
        containerRef.current.style.height = `${e.detail.height}px`;
      }
    };

    // Use capture to get event before anyone else
    window.addEventListener(
      "display:resized",
      handleDisplayResized as EventListener,
      true,
    );

    return () => {
      window.removeEventListener(
        "display:resized",
        handleDisplayResized as EventListener,
        true,
      );
    };
  }, []);

  // Subscribe to raw MIDI messages so we can feed display helpers later
  useEffect(() => {
    const unsubscribe = subscribeMidiListener((e) => {
      const view = canvasRef.current;
      if (!view) return;

      const data = e.data as Uint8Array;
      if (data.length < 5 || data[0] !== 0xf0 || data[1] !== 0x7d) {
        return; // not our packet
      }

      // OLED full frame
      if (data[2] === 0x02 && data[3] === 0x40 && data[4] === 1) {
        // Store the last buffer for Base64 copy feature
        drawOled(view, data);
        // After drawing, store a reference to the updated oledFrame
        lastBufferRef.current = new Uint8Array(oledFrame);
      }
      // OLED delta
      else if (data[2] === 0x02 && data[3] === 0x40 && data[4] === 2) {
        // For deltas, we still keep track of the last buffer for copy feature
        // Just create a copy of the current oledFrame before it gets updated
        lastBufferRef.current = new Uint8Array(oledFrame);

        drawOledDelta(view, data);
      }
      // 7-seg packet
      else if (data[2] === 0x02 && data[3] === 0x41 && data[4] === 0) {
        const dots = data[6];
        const digitsRaw = Array.from(data.subarray(7, 11));
        draw7Seg(view, digitsRaw, dots);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <div
      id="display-wrapper"
      ref={containerRef}
      className="screen-container inline-block p-0 transition-all relative group"
      style={{ visibility: "visible", opacity: 1 }}
    >
      <canvas
        ref={canvasRef}
        className="image-rendering-pixelated border block"
        data-testid="main-display"
      />

      {/* Screenshot and Copy Base64 icons - only visible on hover, hidden in fullscreen */}
      {!fullscreenActive.value && (
        <>
          <CopyBase64IconButton onClick={handleCopyBase64} />
          <ScreenshotIconButton />
        </>
      )}

      {/* Display type toggle switch placed above the canvas */}
      {!fullscreenActive.value && (
        <div className="flex justify-end mt-2">
          <DisplayTypeSwitch />
        </div>
      )}
    </div>
  );
}
