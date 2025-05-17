import { useComputed } from "@preact/signals";
import { displaySettings } from "../state";
import { usePersistDisplaySettings } from "../hooks/useDisplaySettingsPersistence";
import { decreaseCanvasSize, increaseCanvasSize } from "../lib/display";

/**
 * A component that displays and controls the pixel size of the display.
 * This component sits directly above the canvas for easy access.
 */
export function PixelSizeControls() {
  // Use useComputed to ensure we're always showing the latest value
  const pixelSize = useComputed(() => ({
    width: displaySettings.value.pixelWidth,
    height: displaySettings.value.pixelHeight,
  }));

  // Calculate canvas dimensions for display
  const canvasWidth = useComputed(() => pixelSize.value.width * 128); // OLED width
  const canvasHeight = useComputed(() => pixelSize.value.height * 48); // OLED height

  // Setup persistence
  usePersistDisplaySettings();

  // Handle pixel size increment/decrement with constraints
  const handleIncrease = () => {
    increaseCanvasSize();
  };

  const handleDecrease = () => {
    decreaseCanvasSize();
  };

  return (
    <div
      id="pixel-toolbar"
      className="bg-[var(--color-bg-offset)] rounded-lg p-2 shadow-sm border border-[var(--color-border)] flex items-center justify-between mx-auto max-w-md"
    >
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium mr-2">Screen (pixel) Size:</span>

        <button
          onClick={handleDecrease}
          disabled={pixelSize.value.width <= displaySettings.value.minSize}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Decrease pixel size"
          data-testid="decrease-screen-size-button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <span className="font-mono" data-testid="pixel-size-indicator">
          {pixelSize.value.width}×{pixelSize.value.height}
        </span>

        <button
          onClick={handleIncrease}
          disabled={pixelSize.value.width >= displaySettings.value.maxSize}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Increase screen size"
          data-testid="increase-screen-size-button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <div className="text-sm text-[var(--color-text-subtle)]">
        {canvasWidth.value} × {canvasHeight.value} px
      </div>
    </div>
  );
}
