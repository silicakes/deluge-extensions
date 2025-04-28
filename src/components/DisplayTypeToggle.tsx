import { useSignal } from "@preact/signals";
import { displayType } from "../state";

/**
 * DisplayTypeToggle - Button to switch between OLED and 7-segment display types
 */
export function DisplayTypeToggle() {
  const currentType = useSignal(displayType.value);

  const toggleDisplayType = () => {
    // Toggle between OLED and 7SEG
    displayType.value = currentType.value === "OLED" ? "7SEG" : "OLED";
  };

  return (
    <button
      onClick={toggleDisplayType}
      className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
      aria-label="Toggle display type"
      title="Switch between OLED and 7-Segment displays"
    >
      {currentType.value === "OLED" ? "Switch to 7-Segment" : "Switch to OLED"}
    </button>
  );
}
