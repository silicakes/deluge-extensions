import { useSignal, useComputed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { fullscreenActive } from "../state";
import * as fullscreen from "../lib/fullscreen";

export function FullscreenToggleButton() {
  const isSupported = useSignal(
    typeof document !== "undefined" && document.fullscreenEnabled
  );

  // Initialize fullscreen event listeners on mount
  useEffect(() => {
    if (isSupported.value) {
      fullscreen.initFullscreenListeners();
    }
  }, []);

  // Don't render if fullscreen is not supported
  if (!isSupported.value) return null;

  return (
    <button
      type="button"
      onClick={() => fullscreen.toggle()}
      className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-blue-500"
      aria-label="Toggle fullscreen"
      aria-pressed={fullscreenActive.value}
      title="Toggle fullscreen mode (F)"
    >
      {/* Conditional rendering based on fullscreen state */}
      {fullscreenActive.value ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 3v3a2 2 0 0 1-2 2H3"></path>
          <path d="M21 8h-3a2 2 0 0 1-2-2V3"></path>
          <path d="M3 16h3a2 2 0 0 1 2 2v3"></path>
          <path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>
        </svg>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8V5a2 2 0 0 1 2-2h3"></path>
          <path d="M16 3h3a2 2 0 0 1 2 2v3"></path>
          <path d="M21 16v3a2 2 0 0 1-2 2h-3"></path>
          <path d="M8 21H5a2 2 0 0 1-2-2v-3"></path>
        </svg>
      )}
    </button>
  );
}
