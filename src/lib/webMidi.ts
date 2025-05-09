import { midiIn, midiOut } from "../state";
import { handleSysexMessage } from "./smsysex";
import { handleFragment } from "./sysex_buffer";

let midiAccess: MIDIAccess | null = null;

/** Update the lists of inputs and outputs in state signals */
function updateDeviceLists() {
  if (!midiAccess) return;
}

/** Handle hot-plug state changes */
function handleStateChange() {
  updateDeviceLists();
}

/** Initialize Web MIDI access and set up event listeners */
export async function initMidi(
  autoConnect: boolean = false,
): Promise<MIDIAccess | null> {
  if (!navigator.requestMIDIAccess) {
    console.error("Web MIDI API not supported");
    return null;
  }
  midiAccess = await navigator.requestMIDIAccess({ sysex: true });
  midiAccess.onstatechange = handleStateChange;
  updateDeviceLists();
  if (autoConnect) {
    autoConnectDefaultPorts();
  }
  return midiAccess;
}

/** Set MIDI input, updating signal and side-effects */
export function setMidiInput(input: MIDIInput | null) {
  if (midiIn.value === input) return;
  if (midiIn.value) {
    midiIn.value.removeEventListener("midimessage", handleMidiMessage);
  }
  midiIn.value = input;
  if (input) {
    input.addEventListener("midimessage", handleMidiMessage);
  }
}

/** Set MIDI output, updating signal */
export function setMidiOutput(output: MIDIOutput | null) {
  midiOut.value = output;
}

/** Auto-connect logic: pick first available ports matching 'Deluge' when autoConnect is true */
export function autoConnectDefaultPorts() {
  if (!midiAccess) return;
  for (const input of midiAccess.inputs.values()) {
    if (input.name?.includes("Deluge Port 3")) {
      setMidiInput(input);
      break;
    }
  }
  for (const output of midiAccess.outputs.values()) {
    if (output.name?.includes("Deluge Port 3")) {
      setMidiOutput(output);
      break;
    }
  }
}

// Observer pattern so other modules can react to raw MIDI data
const midiListeners = new Set<(e: MIDIMessageEvent) => void>();

/** Subscribe to raw MIDI messages */
export function subscribeMidiListener(listener: (e: MIDIMessageEvent) => void) {
  midiListeners.add(listener);
  return () => midiListeners.delete(listener);
}

function handleMidiMessage(event: MIDIMessageEvent) {
  if (event.data && event.data.length > 0 && event.data[0] === 0xf0) {
    handleFragment(event);
    handleSysexMessage(event);
  }
  // Forward to subscribers
  midiListeners.forEach((fn) => fn(event));
}

/**
 * Select both input and output MIDI devices that include the word 'deluge'
 * @param index The index of the Deluge device to select (0-based)
 * @returns True if a device was found and selected, false otherwise
 */
export function selectDelugeDevice(index: number): boolean {
  if (!midiAccess) return false;
  const delugeInputs = Array.from(midiAccess.inputs.values()).filter((input) =>
    input.name?.toLowerCase().includes("deluge"),
  );
  const delugeOutputs = Array.from(midiAccess.outputs.values()).filter(
    (output) => output.name?.toLowerCase().includes("deluge"),
  );
  if (
    index < 0 ||
    index >= delugeInputs.length ||
    index >= delugeOutputs.length
  ) {
    console.log(`No Deluge device found at index ${index}`);
    return false;
  }
  setMidiInput(delugeInputs[index]);
  setMidiOutput(delugeOutputs[index]);
  console.log(
    `Selected Deluge device ${index + 1}: ${delugeInputs[index].name}`,
  );
  return true;
}

/** Get current MIDI inputs */
export function getMidiInputs(): MIDIInput[] {
  return midiAccess ? Array.from(midiAccess.inputs.values()) : [];
}

/** Get current MIDI outputs */
export function getMidiOutputs(): MIDIOutput[] {
  return midiAccess ? Array.from(midiAccess.outputs.values()) : [];
}
