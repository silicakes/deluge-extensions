import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { forwardRef } from "preact/compat";
import { displaySettings, displayType } from "../state";
import { DISPLAY_META, computeCanvasDims } from "../lib/display";

/**
 * DisplayCanvas - Responsible for rendering Deluge display output (OLED or 7SEG)
 * Pure rendering component with no side-effects except drawing to its own canvas.
 */
export const DisplayCanvas = forwardRef<HTMLCanvasElement>((_, ref) => {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  // Use either the forwarded ref or our internal ref
  const canvasRef = ref || internalCanvasRef;

  const currentType = useSignal(displayType.value);
  const pixelSettings = useSignal(displaySettings.value);

  // Track current dimensions for parent container sizing
  const dimensions = useSignal<{
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  }>({
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
  });

  // Update dimensions when pixel settings or display type change
  useEffect(() => {
    // Access the canvas through the ref (which might be forwarded or internal)
    const canvas = "current" in canvasRef ? canvasRef.current : null;
    if (!canvas) return;

    const { pixelWidth, pixelHeight } = pixelSettings.value;
    const type = currentType.value;

    // Compute new dimensions
    const { cssW, cssH, offsetX, offsetY } = computeCanvasDims(
      type,
      pixelWidth,
      pixelHeight
    );

    // Set canvas dimensions
    canvas.width = cssW;
    canvas.height = cssH;

    // Apply pixel rendering style
    canvas.style.imageRendering = "pixelated";

    // Store dimensions for parent container
    dimensions.value = { width: cssW, height: cssH, offsetX, offsetY };

    // Emit custom event for parent components that might need to respond
    window.dispatchEvent(
      new CustomEvent("display:resized", {
        detail: { width: cssW, height: cssH, offsetX, offsetY },
      })
    );
  }, [currentType.value, pixelSettings.value, canvasRef]);

  // Sync with global signals
  useEffect(() => {
    const handleDisplayTypeChange = () => {
      currentType.value = displayType.value;
    };

    const handleSettingsChange = () => {
      pixelSettings.value = displaySettings.value;
    };

    // Initial sync
    handleDisplayTypeChange();
    handleSettingsChange();

    // Subscribe to changes
    const displayTypeUnsubscribe = displayType.subscribe(
      handleDisplayTypeChange
    );
    const settingsUnsubscribe = displaySettings.subscribe(handleSettingsChange);

    return () => {
      displayTypeUnsubscribe();
      settingsUnsubscribe();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="block image-rendering-pixelated border"
      aria-label={`Deluge ${currentType.value} display`}
    />
  );
});

// Export dimensions accessor for parent components
export function getCanvasDimensions() {
  return {
    OLED: DISPLAY_META.OLED,
    "7SEG": DISPLAY_META["7SEG"],
  };
}
