import { effect } from "@preact/signals";
import { displaySettings, DisplaySettings } from "../state";

/**
 * Loads display settings from localStorage
 * Used once in App.tsx on mount to hydrate the displaySettings signal
 */
export function loadDisplaySettings(): void {
  // Skip if we're in SSR or localStorage isn't available
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return;
  }

  try {
    const raw = localStorage.getItem("DExDisplaySettings");
    if (raw) {
      const parsed: Partial<DisplaySettings> = JSON.parse(raw);

      // Determine if we're on a mobile device
      const mobileRegex =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileEnv = mobileRegex.test(navigator.userAgent);

      // Ignore potentially stale pixel dimensions on mobile to prevent overflow
      if (isMobileEnv) {
        delete (parsed as Partial<DisplaySettings>).pixelWidth;
        delete (parsed as Partial<DisplaySettings>).pixelHeight;
      }

      displaySettings.value = { ...displaySettings.value, ...parsed };
    }
  } catch (err) {
    console.error("Failed to load DExDisplaySettings from localStorage:", err);
  }
}

/**
 * Custom hook that sets up an effect to persist display settings to localStorage
 * whenever they change, with debouncing to limit writes
 */
export function usePersistDisplaySettings(): void {
  // Debounce time in ms
  const DEBOUNCE_MS = 500;
  let timeoutId: number | null = null;

  // The effect will rerun whenever displaySettings.value changes
  effect(() => {
    // Clear any existing timeout to debounce rapid changes
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }

    // Set a new timeout to save settings after debounce period
    timeoutId = window.setTimeout(() => {
      try {
        localStorage.setItem(
          "DExDisplaySettings",
          JSON.stringify(displaySettings.value),
        );
      } catch (err) {
        console.error(
          "Failed to save DExDisplaySettings to localStorage:",
          err,
        );
      }
      timeoutId = null;
    }, DEBOUNCE_MS);
  });
}
