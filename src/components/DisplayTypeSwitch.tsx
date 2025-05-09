import { flipScreen } from "@/commands/display";
import { displayType, midiOut } from "../state";

export function DisplayTypeSwitch() {
  const handleToggle = () => {
    // Call the flipScreen command to toggle display type on device
    flipScreen();

    // Optimistically update the local display type (7SEG ↔ OLED)
    displayType.value = displayType.value === "OLED" ? "7SEG" : "OLED";
  };

  // Disable the switch when there's no MIDI output
  const disabled = !midiOut.value;

  // Determine if we're in 7SEG mode
  const is7Seg = displayType.value === "7SEG";

  return (
    <label
      htmlFor="display-type-switch"
      className={`flex items-center cursor-pointer ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      title="Toggle between OLED & 7-segment screens"
    >
      <span
        className={`mr-2 text-sm font-medium ${is7Seg ? "text-red-600 font-bold" : ""}`}
      >
        7SEG
      </span>
      <div className="relative">
        {/* Hidden checkbox */}
        <input
          id="display-type-switch"
          type="checkbox"
          checked={displayType.value === "OLED"}
          onChange={handleToggle}
          className="sr-only peer"
          aria-label="Toggle display type"
          disabled={disabled}
        />
        {/* Switch track - blue for OLED, red for 7SEG */}
        <div
          className={`w-10 h-5 rounded-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors ${
            is7Seg ? "bg-red-600" : "bg-blue-600 peer-checked:bg-blue-600"
          }`}
        ></div>
        {/* Switch knob */}
        <div className="absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
      </div>
      <span
        className={`ml-2 text-sm font-medium ${!is7Seg ? "text-blue-600 font-bold" : ""}`}
      >
        OLED
      </span>
    </label>
  );
}
