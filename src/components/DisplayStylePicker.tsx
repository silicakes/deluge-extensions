import { useSignal, useComputed } from "@preact/signals";
import { useEffect, useRef, useCallback } from "preact/hooks";
import { Button } from "./Button";
import { displaySettings, DisplaySettings } from "../state";
import { isMobile } from "../lib/fullscreen";

/**
 * A custom hook for debouncing function calls
 */
function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
) {
  // Create a ref to track the timeout ID
  const timeoutRef = useRef<number | null>(null);

  // Return a memoized version of the callback that debounces calls
  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  );
}

type DisplayStylePickerProps = {
  compact?: boolean;
};

export function DisplayStylePicker({
  compact = false,
}: DisplayStylePickerProps) {
  const expanded = useSignal(!compact);

  const settings = useComputed(() => displaySettings.value);

  useEffect(() => {
    // Load saved settings from localStorage on component mount
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem("DExDisplaySettings");
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);

          // On mobile devices we ignore stale pixel width/height persisted from
          // a previous desktop session to avoid overflow issues. The current
          // pixel scale is already set by the responsive logic in display.ts.
          if (isMobile) {
            delete parsedSettings.pixelWidth;
            delete parsedSettings.pixelHeight;
          }

          // Update displaySettings with the remaining values, preserving
          // defaults for any missing properties.
          displaySettings.value = {
            ...displaySettings.value,
            ...parsedSettings,
          };
        }
      } catch (error) {
        console.error("Error loading saved display settings:", error);
      }
    };

    loadSettings();
  }, []);

  // Apply updates to the global signal only
  const apply = (patch: Partial<DisplaySettings>) => {
    displaySettings.value = { ...displaySettings.value, ...patch };
  };

  // Helper to clamp values within min/max range
  const clamp = (v: number) => {
    const { minSize, maxSize } = settings.value;
    return Math.max(minSize, Math.min(maxSize, v));
  };

  // Debounced function for saving settings to localStorage
  const saveSettings = useDebouncedCallback(() => {
    try {
      localStorage.setItem(
        "DExDisplaySettings",
        JSON.stringify(displaySettings.value),
      );
    } catch (error) {
      console.error("Error saving display settings:", error);
    }
  }, 300);

  // Save settings whenever display settings change
  useEffect(() => {
    saveSettings();
  }, [displaySettings.value]);

  // Handlers for pixel size adjustment
  const increaseSize = () => {
    const { pixelWidth, pixelHeight, resizeStep } = settings.value;
    apply({
      pixelWidth: clamp(pixelWidth + resizeStep),
      pixelHeight: clamp(pixelHeight + resizeStep),
    });
  };

  const decreaseSize = () => {
    const { pixelWidth, pixelHeight, resizeStep } = settings.value;
    apply({
      pixelWidth: clamp(pixelWidth - resizeStep),
      pixelHeight: clamp(pixelHeight - resizeStep),
    });
  };

  // Toggle compact/expanded view
  const toggleExpanded = () => {
    expanded.value = !expanded.value;
  };

  // Calculate resulting canvas dimension
  const canvasDimensions = `${settings.value.pixelWidth * 128}×${settings.value.pixelHeight * 48}`;

  // If in compact mode and not expanded, only show the toggle button
  if (compact && !expanded.value) {
    return (
      <Button onClick={toggleExpanded} title="Display Style Settings">
        <span role="img" aria-label="Display Settings">
          🖌️
        </span>
      </Button>
    );
  }

  return (
    <div className="display-style-picker bg-[var(--color-bg-offset)] p-3 rounded-md shadow-md border border-[var(--color-border)]">
      {compact && (
        <div className="flex justify-between mb-2">
          <h3 className="text-md font-medium">Display Style</h3>
          <button
            onClick={toggleExpanded}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Pixel Size</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={settings.value.minSize}
              max={settings.value.maxSize}
              value={settings.value.pixelWidth}
              onInput={(e) =>
                apply({
                  pixelWidth: clamp(+(e.target as HTMLInputElement).value),
                })
              }
              className="w-16 px-2 py-1 border rounded"
            />
            <span>×</span>
            <input
              type="number"
              min={settings.value.minSize}
              max={settings.value.maxSize}
              value={settings.value.pixelHeight}
              onInput={(e) =>
                apply({
                  pixelHeight: clamp(+(e.target as HTMLInputElement).value),
                })
              }
              className="w-16 px-2 py-1 border rounded"
            />
            <Button onClick={increaseSize} className="ml-2">
              ＋
            </Button>
            <Button onClick={decreaseSize}>－</Button>
            <span className="text-sm opacity-60 ml-2">{canvasDimensions}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Colors</label>
          <div className="flex items-center gap-2">
            <label className="text-sm">FG</label>
            <input
              type="color"
              value={settings.value.foregroundColor}
              onInput={(e) =>
                apply({ foregroundColor: (e.target as HTMLInputElement).value })
              }
              className="w-8 h-8 p-0 border-none"
            />
            <label className="text-sm ml-2">BG</label>
            <input
              type="color"
              value={settings.value.backgroundColor}
              onInput={(e) =>
                apply({ backgroundColor: (e.target as HTMLInputElement).value })
              }
              className="w-8 h-8 p-0 border-none"
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="use7SegCustomColors"
            checked={settings.value.use7SegCustomColors}
            onChange={(e) =>
              apply({
                use7SegCustomColors: (e.target as HTMLInputElement).checked,
              })
            }
            className="mr-2"
          />
          <label htmlFor="use7SegCustomColors" className="text-sm">
            Use custom colors for 7-segment
          </label>
        </div>
      </div>
    </div>
  );
}

// Hook to access display settings from other components
export function useDisplaySettings() {
  return displaySettings;
}

// Export handlers for keyboard shortcuts
export const increaseCanvasSize = () => {
  const { pixelWidth, pixelHeight, resizeStep, minSize, maxSize } =
    displaySettings.value;
  displaySettings.value = {
    ...displaySettings.value,
    pixelWidth: Math.max(minSize, Math.min(maxSize, pixelWidth + resizeStep)),
    pixelHeight: Math.max(minSize, Math.min(maxSize, pixelHeight + resizeStep)),
  };
};

export const decreaseCanvasSize = () => {
  const { pixelWidth, pixelHeight, resizeStep, minSize, maxSize } =
    displaySettings.value;
  displaySettings.value = {
    ...displaySettings.value,
    pixelWidth: Math.max(minSize, Math.min(maxSize, pixelWidth - resizeStep)),
    pixelHeight: Math.max(minSize, Math.min(maxSize, pixelHeight - resizeStep)),
  };
};
