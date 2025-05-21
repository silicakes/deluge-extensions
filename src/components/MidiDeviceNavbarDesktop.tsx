import { useMidiNavbar } from "../hooks/useMidiNavbar";

interface MidiDeviceNavbarDesktopProps {
  className?: string;
}

export function MidiDeviceNavbarDesktop({
  className = "",
}: MidiDeviceNavbarDesktopProps) {
  const {
    inputSignal,
    outputSignal,
    inputs,
    outputs,
    online,
    ready,
    onInputChange,
    onOutputChange,
    onAutoToggle,
    autoEnabled,
  } = useMidiNavbar();

  return (
    <div
      className={`flex items-center gap-2 flex-wrap text-sm max-w-full ${className}`}
    >
      <span className="hidden md:inline font-semibold mr-1">MIDI</span>
      <span>In:</span>
      <select
        className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] max-w-[8rem] md:max-w-[10rem]"
        value={inputSignal.value?.id || ""}
        onChange={onInputChange}
        aria-label="MIDI Input Device"
        data-testid="midi-input-select"
      >
        <option value="">None</option>
        {inputs.value.map((d) => (
          <option key={d.id} value={d.id} className="truncate">
            {d.name || d.id}
          </option>
        ))}
      </select>
      <span>Out:</span>
      <select
        className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] max-w-[8rem] md:max-w-[10rem]"
        value={outputSignal.value?.id || ""}
        onChange={onOutputChange}
        aria-label="MIDI Output Device"
        data-testid="midi-output-select"
      >
        <option value="">None</option>
        {outputs.value.map((d) => (
          <option key={d.id} value={d.id} className="truncate">
            {d.name || d.id}
          </option>
        ))}
      </select>
      {/* Auto-connect toggle switch */}
      <label
        htmlFor="navbar-auto-desktop"
        className="flex items-center cursor-pointer ml-2"
      >
        <div className="relative">
          {/* Hidden checkbox */}
          <input
            id="navbar-auto-desktop"
            type="checkbox"
            checked={autoEnabled.value}
            onChange={onAutoToggle}
            className="sr-only peer"
            aria-label="Auto-connect toggle"
            data-testid="auto-connect-toggle"
          />
          {/* Switch track */}
          <div className="w-9 h-5 bg-gray-300 rounded-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:bg-blue-600 transition-colors"></div>
          {/* Switch knob */}
          <div className="absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
        </div>
        <span
          className="ml-2 select-none"
          title="Auto-connect ports and start display polling"
        >
          Auto (Connect + Display)
        </span>
      </label>
      <div className="flex items-center gap-1 ml-2">
        {/* MIDI status indicator */}
        <span
          className={`h-2 w-2 rounded-full ${ready.value ? "bg-green-500" : "bg-red-500"}`}
          title={ready.value ? "MIDI ready" : "No MIDI output selected"}
          data-testid="midi-status-indicator"
        ></span>
        {/* Network status indicator - only visible when offline */}
        {!online.value && (
          <span
            className="text-xs px-1 py-0.5 bg-gray-700 text-gray-300 rounded ml-1"
            title="App is in offline mode"
          >
            offline
          </span>
        )}
      </div>
    </div>
  );
}
