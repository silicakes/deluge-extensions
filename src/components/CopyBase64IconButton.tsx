import { midiOut } from "../state";
import { copyCanvasToBase64 } from "../lib/display";
import { addDebugMessage } from "../lib/debug";

/**
 * Floating copy-to-base64 button that appears when hovering over the display.
 */
export function CopyBase64IconButton() {
  // Disabled state if no MIDI output device is connected
  const disabled = !midiOut.value;

  // Handler for copying to base64
  const handleCopyBase64 = async () => {
    try {
      await copyCanvasToBase64();
      addDebugMessage("Base64 Gzip string copied to clipboard.");
    } catch (err) {
      addDebugMessage(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      console.error("Copy to Base64 failed:", err);
    }
  };

  return (
    <button
      onClick={handleCopyBase64}
      disabled={disabled}
      className="absolute top-2 right-12 w-8 h-8 rounded-full bg-gray-800/70 hover:bg-gray-700/90 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      title="Copy display as Base64 (C)"
      aria-label="Copy display as Base64"
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
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
  );
}
