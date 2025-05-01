import { midiOut } from "../state";
import { captureScreenshot } from "../lib/display";

/**
 * Floating screenshot button that appears when hovering over the display.
 */
export function ScreenshotIconButton() {
  // Disabled state if no MIDI output device is connected
  const disabled = !midiOut.value;

  // Handler for screenshot
  const handleScreenshot = () => captureScreenshot();

  return (
    <button
      onClick={handleScreenshot}
      disabled={disabled}
      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-800/70 hover:bg-gray-700/90 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      title="Take screenshot (S)"
      aria-label="Take screenshot"
      aria-haspopup="false"
      aria-pressed={false}
    >
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
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    </button>
  );
}
