import { useEffect, useRef } from "preact/hooks";
import {
  registerCanvas,
  drawOled,
  drawOledDelta,
  draw7Seg,
  resizeCanvas,
  enterFullscreenScale,
  exitFullscreenScale,
} from "../lib/display";
import { subscribeMidiListener } from "@/lib/midi";
import { displaySettings, fullscreenActive } from "../state";

/**
 * DisplayViewer – renders the Deluge OLED / 7-segment output onto a canvas.
 * Now positioned outside the Card container to enable proper fullscreen behavior.
 */
export function DisplayViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      true
    );

    return () => {
      window.removeEventListener(
        "display:resized",
        handleDisplayResized as EventListener,
        true
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
        drawOled(view, data);
      }
      // OLED delta
      else if (data[2] === 0x02 && data[3] === 0x40 && data[4] === 2) {
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
      className="screen-container inline-block p-0 transition-all"
      style={{ visibility: "visible", opacity: 1 }}
    >
      <canvas
        ref={canvasRef}
        className="image-rendering-pixelated border block"
      />
    </div>
  );
}
