import { useEffect } from "preact/hooks";
import { useSignal, useComputed } from "@preact/signals";
import { midiIn, midiOut } from "../state";
import {
  initMidi,
  getMidiInputs,
  getMidiOutputs,
  setMidiInput,
  setMidiOutput,
  autoConnectDefaultPorts,
} from "../lib/midi";

// Compact MIDI device selector suitable for placement in the header bar
export function MidiDeviceNavbar() {
  const inputSignal = midiIn;
  const outputSignal = midiOut;

  // local UI state
  const autoSignal = useSignal(
    localStorage.getItem("autoConnectEnabled") === "true"
  );
  const inputs = useSignal<MIDIInput[]>([]);
  const outputs = useSignal<MIDIOutput[]>([]);
  const online = useSignal<boolean>(navigator.onLine);

  // initialise WebMIDI and populate lists
  useEffect(() => {
    (async () => {
      const access = await initMidi(autoSignal.value);
      if (!access) return;
      inputs.value = getMidiInputs();
      outputs.value = getMidiOutputs();
      access.onstatechange = () => {
        inputs.value = getMidiInputs();
        outputs.value = getMidiOutputs();
      };
    })();
  }, [autoSignal.value]);

  // persist auto-connect preference
  useEffect(() => {
    localStorage.setItem("autoConnectEnabled", autoSignal.value.toString());
  }, [autoSignal.value]);

  // online/offline indicator
  useEffect(() => {
    const handler = () => (online.value = navigator.onLine);
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  }, []);

  // restore previously chosen ports
  useEffect(() => {
    if (!inputs.value.length && !outputs.value.length) return;
    const inId = localStorage.getItem("midiInPortId");
    const outId = localStorage.getItem("midiOutPortId");
    if (inId && !inputSignal.value)
      setMidiInput(inputs.value.find((d) => d.id === inId) || null);
    if (outId && !outputSignal.value)
      setMidiOutput(outputs.value.find((d) => d.id === outId) || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.value.length, outputs.value.length]);

  // persist selected ports
  useEffect(() => {
    localStorage.setItem("midiInPortId", inputSignal.value?.id || "");
  }, [inputSignal.value]);
  useEffect(() => {
    localStorage.setItem("midiOutPortId", outputSignal.value?.id || "");
  }, [outputSignal.value]);

  const ready = useComputed(() => online.value && !!outputSignal.value);

  const onInputChange = (e: Event) => {
    const id = (e.target as HTMLSelectElement).value;
    const device = getMidiInputs().find((d) => d.id === id) || null;
    setMidiInput(device);
  };
  const onOutputChange = (e: Event) => {
    const id = (e.target as HTMLSelectElement).value;
    const device = getMidiOutputs().find((d) => d.id === id) || null;
    setMidiOutput(device);
  };
  const onAutoToggle = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    autoSignal.value = checked;
    if (checked) {
      autoConnectDefaultPorts();
      inputs.value = getMidiInputs();
      outputs.value = getMidiOutputs();
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap text-sm max-w-full">
      <span className="hidden md:inline font-semibold mr-1">MIDI</span>
      <span>In:</span>
      <select
        className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] max-w-[10rem]"
        value={inputSignal.value?.id || ""}
        onChange={onInputChange}
      >
        <option value="">None</option>
        {inputs.value.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name || d.id}
          </option>
        ))}
      </select>
      <span>Out:</span>
      <select
        className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] max-w-[10rem]"
        value={outputSignal.value?.id || ""}
        onChange={onOutputChange}
      >
        <option value="">None</option>
        {outputs.value.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name || d.id}
          </option>
        ))}
      </select>
      {/* Auto-connect toggle switch */}
      <label
        htmlFor="navbar-auto"
        className="flex items-center cursor-pointer ml-2"
      >
        <div className="relative">
          {/* Hidden checkbox */}
          <input
            id="navbar-auto"
            type="checkbox"
            checked={autoSignal.value}
            onChange={onAutoToggle}
            className="sr-only peer"
          />
          {/* Switch track */}
          <div className="w-9 h-5 bg-gray-300 rounded-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:bg-blue-600 transition-colors"></div>
          {/* Switch knob */}
          <div className="absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
        </div>
        <span className="ml-2 select-none">Auto</span>
      </label>
      <span
        className={`h-2 w-2 rounded-full ml-2 ${ready.value ? "bg-green-500" : "bg-red-500"}`}
        title={ready.value ? "webmidi ready" : "offline"}
      ></span>
    </div>
  );
}
