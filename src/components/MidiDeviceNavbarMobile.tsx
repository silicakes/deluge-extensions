import { useSignal } from "@preact/signals";
import { useMidiNavbar } from "../hooks/useMidiNavbar";

interface MidiDeviceNavbarMobileProps {
  className?: string;
}

export function MidiDeviceNavbarMobile({
  className = "",
}: MidiDeviceNavbarMobileProps) {
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

  // Mobile-specific state for collapsible menu
  const collapsed = useSignal(true);

  const toggleMenu = () => {
    collapsed.value = !collapsed.value;
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <button
        aria-expanded={!collapsed.value}
        aria-controls="midi-menu"
        aria-label="Toggle MIDI devices menu"
        onClick={toggleMenu}
        className="flex items-center gap-1 py-1 px-2 text-sm font-medium rounded border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-offset)]"
      >
        {/* Musical note icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <span>MIDI</span>
        <span
          className={`ml-1 transition-transform duration-200 ${collapsed.value ? "" : "rotate-180"}`}
        >
          ▼
        </span>
        {/* Status indicator next to button */}
        <span
          className={`ml-auto h-2 w-2 rounded-full ${ready.value ? "bg-green-500" : "bg-red-500"}`}
          title={ready.value ? "MIDI ready" : "No MIDI output selected"}
        ></span>
      </button>

      {/* Collapsible menu */}
      <div
        id="midi-menu"
        className={`flex flex-col gap-2 mt-2 p-2 border border-[var(--color-border)] rounded bg-[var(--color-bg)] ${collapsed.value ? "hidden" : "block"}`}
      >
        <div className="flex flex-col">
          <label htmlFor="mobile-midi-in" className="text-sm font-medium mb-1">
            MIDI In:
          </label>
          <select
            id="mobile-midi-in"
            className="w-full h-9 border border-[var(--color-border)] rounded px-2 bg-[var(--color-bg)] text-[var(--color-text)]"
            value={inputSignal.value?.id || ""}
            onChange={onInputChange}
            aria-label="MIDI Input Device"
          >
            <option value="">None</option>
            {inputs.value.map((d) => (
              <option key={d.id} value={d.id} className="truncate">
                {d.name || d.id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="mobile-midi-out" className="text-sm font-medium mb-1">
            MIDI Out:
          </label>
          <select
            id="mobile-midi-out"
            className="w-full h-9 border border-[var(--color-border)] rounded px-2 bg-[var(--color-bg)] text-[var(--color-text)]"
            value={outputSignal.value?.id || ""}
            onChange={onOutputChange}
            aria-label="MIDI Output Device"
          >
            <option value="">None</option>
            {outputs.value.map((d) => (
              <option key={d.id} value={d.id} className="truncate">
                {d.name || d.id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between mt-1">
          {/* Auto-connect toggle switch */}
          <label
            htmlFor="navbar-auto-mobile"
            className="flex items-center cursor-pointer"
          >
            <div className="relative">
              {/* Hidden checkbox */}
              <input
                id="navbar-auto-mobile"
                type="checkbox"
                checked={autoEnabled.value}
                onChange={onAutoToggle}
                className="sr-only peer"
                aria-label="Auto-connect toggle"
              />
              {/* Switch track */}
              <div className="w-10 h-6 bg-gray-300 rounded-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:bg-blue-600 transition-colors"></div>
              {/* Switch knob - slightly larger for mobile */}
              <div className="absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
            </div>
            <span
              className="ml-2 text-sm"
              title="Auto-connect ports and start display polling"
            >
              Auto-connect
            </span>
          </label>

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {!online.value && (
              <span
                className="text-xs px-1 py-0.5 bg-gray-700 text-gray-300 rounded"
                title="App is in offline mode"
              >
                offline
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
