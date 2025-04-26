import { midiIn, midiOut } from '../state';
import { addDebugMessage } from './debug';

let midiAccess: MIDIAccess | null = null;
let monitorInterval: number | null = null;

// Observer pattern so other modules can react to raw MIDI data (e.g. DisplayViewer)
const midiListeners = new Set<(e: MIDIMessageEvent) => void>();

/** Initialize Web MIDI access and set up event listeners */
export async function initMidi(autoConnect: boolean = false): Promise<MIDIAccess | null> {
  if (!navigator.requestMIDIAccess) {
    console.error('Web MIDI API not supported');
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

/** Update the lists of inputs and outputs in state signals */
function updateDeviceLists() {
  if (!midiAccess) return;
  // nothing: component reads lists directly via midiAccess.inputs/outputs
}

/** Set MIDI input, updating signal and side-effects */
export function setMidiInput(input: MIDIInput | null) {
  if (midiIn.value === input) return;
  if (midiIn.value) {
    midiIn.value.removeEventListener('midimessage', handleMidiMessage);
  }
  midiIn.value = input;
  if (input) {
    input.addEventListener('midimessage', handleMidiMessage);
  }
}

/** Set MIDI output, updating signal */
export function setMidiOutput(output: MIDIOutput | null) {
  midiOut.value = output;
}

/** Handle hot-plug state changes */
function handleStateChange(_ev: MIDIConnectionEvent) {
  updateDeviceLists();
}

/** Auto-connect logic: pick first available ports matching 'Deluge' when autoConnect is true */
export function autoConnectDefaultPorts() {
  if (!midiAccess) return;
  for (const input of midiAccess.inputs.values()) {
    if (input.name?.includes('Deluge Port 3')) {
      setMidiInput(input);
      break;
    }
  }
  for (const output of midiAccess.outputs.values()) {
    if (output.name?.includes('Deluge Port 3')) {
      setMidiOutput(output);
      break;
    }
  }
}

/** MIDI message handler – re-export or use event emitter if needed */
export function subscribeMidiListener(listener: (e: MIDIMessageEvent) => void) {
  midiListeners.add(listener);
  return () => midiListeners.delete(listener);
}

function handleMidiMessage(event: MIDIMessageEvent) {
  // forward to listeners
  midiListeners.forEach((fn) => fn(event));
  console.debug('MIDI message', event.data);
  
  // Log SysEx messages to debug console
  if (event.data && event.data.length > 0 && event.data[0] === 0xF0) {
    const bytes = Array.from(event.data).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    // If this is a debug message from the Deluge (category 0x03)
    if (event.data.length > 2 && event.data[1] === 0x7D && event.data[2] === 0x03) {
      // Check if data length is enough to contain text (at least 7 bytes including F0, mfr ID, etc)
      if (event.data.length > 6) {
        try {
          // Extract ASCII text starting from position 5 (after SysEx header and command)
          const textBytes = event.data.slice(5, event.data.length - 1); // Exclude F7 at the end
          const text = String.fromCharCode.apply(null, Array.from(textBytes));
          addDebugMessage(`Message from Deluge: ${text}`);
        } catch (e) {
          addDebugMessage(`Debug message received (binary): ${bytes}`);
        }
      } else {
        addDebugMessage(`Debug message received: ${bytes}`);
      }
    } else {
      // For other SysEx messages, just log the raw data
      addDebugMessage(`SysEx received: ${bytes}`);
    }
  }
}

/** Get current MIDI inputs */
export function getMidiInputs(): MIDIInput[] {
  return midiAccess ? Array.from(midiAccess.inputs.values()) : [];
}

/** Get current MIDI outputs */
export function getMidiOutputs(): MIDIOutput[] {
  return midiAccess ? Array.from(midiAccess.outputs.values()) : [];
}

/** Send ping test command to Deluge */
export function ping() {
  if (!midiOut.value || !navigator.onLine) {
    console.error('Offline or MIDI Output not selected. Cannot send ping command.');
    return;
  }
  midiOut.value.send([0xf0, 0x7d, 0x00, 0xf7]);
}

/** Request full OLED display data */
export function getOled() {
  if (!midiOut.value || !navigator.onLine) {
    console.error('Offline or MIDI Output not selected. Cannot send OLED command.');
    return;
  }
  midiOut.value.send([0xf0, 0x7d, 0x02, 0x00, 0x01, 0xf7]);
}

/** Request full 7-segment display data */
export function get7Seg() {
  if (!midiOut.value || !navigator.onLine) {
    console.error('Offline or MIDI Output not selected. Cannot send 7-seg command.');
    return;
  }
  midiOut.value.send([0xf0, 0x7d, 0x02, 0x01, 0x00, 0xf7]);
}

/** Flip the screen orientation */
export function flipScreen() {
  if (!midiOut.value || !navigator.onLine) {
    console.error('Offline or MIDI Output not selected. Cannot send flip-screen command.');
    return;
  }
  midiOut.value.send([0xf0, 0x7d, 0x02, 0x00, 0x04, 0xf7]);
}

/** Request raw display update (force full or delta) */
export function getDisplay(force: boolean = false) {
  if (!midiOut.value || !navigator.onLine) {
    console.error('Offline or MIDI Output not selected. Cannot send display command.');
    return;
  }
  const code = force ? 0x03 : 0x02;
  midiOut.value.send([0xf0, 0x7d, 0x02, 0x00, code, 0xf7]);
}

/** Request debug messages from device */
export function getDebug() {
  if (!midiOut.value || !navigator.onLine) {
    console.error('Offline or MIDI Output not selected. Cannot send debug command.');
    addDebugMessage("Offline or MIDI Output not selected. Cannot request debug messages.");
    return false;
  }
  midiOut.value.send([0xf0, 0x7d, 0x03, 0x00, 0x01, 0xf7]);
  addDebugMessage("Requested debug messages from device");
  return true;
}

/** Request features status from device */
export function getFeatures() {
  if (!midiOut.value || !navigator.onLine) {
    console.error('Offline or MIDI Output not selected. Cannot send features status command.');
    addDebugMessage("Offline or MIDI Output not selected. Cannot request features status.");
    return false;
  }
  midiOut.value.send([0xf0, 0x7d, 0x03, 0x01, 0x01, 0xf7]);
  addDebugMessage("Requested features status from device");
  return true;
}

/** Request version information from device */
export function getVersion() {
  if (!midiOut.value || !navigator.onLine) {
    console.error('Offline or MIDI Output not selected. Cannot send version command.');
    addDebugMessage("Offline or MIDI Output not selected. Cannot request version info.");
    return false;
  }
  midiOut.value.send([0xf0, 0x7d, 0x03, 0x02, 0x01, 0xf7]);
  addDebugMessage("Requested version info from device");
  return true;
}

/**
 * Send a custom SysEx command to the Deluge
 * @param hexString A space-separated hex string, must start with F0 and end with F7
 * @returns true if sent successfully, false otherwise
 */
export function sendCustomSysEx(hexString: string): boolean {
  if (!midiOut.value || !navigator.onLine) {
    console.error('Offline or MIDI Output not selected. Cannot send custom SysEx.');
    addDebugMessage("Offline or MIDI Output not selected. Cannot send command.");
    return false;
  }
  
  if (!hexString.trim()) {
    console.error('ERROR: Please enter a valid SysEx command');
    addDebugMessage("ERROR: Please enter a valid SysEx command");
    return false;
  }
  
  try {
    // Parse hex string into bytes
    const parts = hexString.trim().split(/\s+/);
    const bytes = parts.map(p => parseInt(p, 16));
    
    if (bytes.some(isNaN)) {
      throw new Error("Invalid hex values");
    }
    
    // Ensure it starts with F0 and ends with F7
    if (bytes[0] !== 0xF0 || bytes[bytes.length - 1] !== 0xF7) {
      throw new Error("SysEx must start with F0 and end with F7");
    }
    
    // Format bytes as hex for logging
    const bytesFormatted = bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    addDebugMessage(`Sending SysEx: ${bytesFormatted}`);
    
    midiOut.value.send(bytes);
    return true;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(`Error sending custom SysEx: ${errorMessage}`);
    addDebugMessage(`ERROR: ${errorMessage}`);
    return false;
  }
}

/** Start polling display data at 1s intervals */
export function startMonitor() {
  if (monitorInterval !== null) return;
  getDisplay(true);
  monitorInterval = window.setInterval(() => getDisplay(false), 1000);
}

/** Stop polling display data */
export function stopMonitor() {
  if (monitorInterval !== null) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
