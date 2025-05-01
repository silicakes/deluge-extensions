import { midiIn, midiOut, fileTree, FileEntry } from "../state";
import { addDebugMessage } from "./debug";
import {
  ensureSession,
  handleSysexMessage,
  ping as smsPing,
  sendJson,
  setDeveloperIdMode,
} from "./smsysex";

let midiAccess: MIDIAccess | null = null;
let monitorInterval: number | null = null;

const SYSEX_COMMANDS = {
  PING: [0xf0, 0x7d, 0x00, 0xf7],
  GET_OLED: [0xf0, 0x7d, 0x02, 0x00, 0x01, 0xf7],
  GET_7SEG: [0xf0, 0x7d, 0x02, 0x01, 0x00, 0xf7],
  GET_DISPLAY: [0xf0, 0x7d, 0x02, 0x00, 0x02, 0xf7],
  GET_DISPLAY_FORCE: [0xf0, 0x7d, 0x02, 0x00, 0x03, 0xf7],
  FLIP: [0xf0, 0x7d, 0x02, 0x00, 0x04, 0xf7],
  GET_DEBUG: [0xf0, 0x7d, 0x03, 0x00, 0x01, 0xf7],
  GET_FEATURES: [0xf0, 0x7d, 0x03, 0x01, 0x01, 0xf7],
  GET_VERSION: [0xf0, 0x7d, 0x03, 0x02, 0x01, 0xf7],
};

const sendSysEx = (command: keyof typeof SYSEX_COMMANDS) => {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send SysEx command.");
    return;
  }
  midiOut.value.send(SYSEX_COMMANDS[command]);
};

// Observer pattern so other modules can react to raw MIDI data (e.g. DisplayViewer)
const midiListeners = new Set<(e: MIDIMessageEvent) => void>();

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

/** Update the lists of inputs and outputs in state signals */
function updateDeviceLists() {
  if (!midiAccess) return;
  // nothing: component reads lists directly via midiAccess.inputs/outputs
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

/** Handle hot-plug state changes */
function handleStateChange() {
  updateDeviceLists();
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

/** MIDI message handler – re-export or use event emitter if needed */
export function subscribeMidiListener(listener: (e: MIDIMessageEvent) => void) {
  midiListeners.add(listener);
  return () => midiListeners.delete(listener);
}

function handleMidiMessage(event: MIDIMessageEvent) {
  // forward to listeners
  midiListeners.forEach((fn) => fn(event));
  console.debug("MIDI message", event.data);

  // Handle SysEx messages for smSysex protocol
  if (event.data && event.data.length > 0 && event.data[0] === 0xf0) {
    // Forward to smSysex handler
    handleSysexMessage(event);

    const bytes = Array.from(event.data)
      .map((b) => "0x" + b.toString(16).toUpperCase().padStart(2, "0"))
      .join(" ");
    // If this is a debug message from the Deluge (category 0x03)
    if (
      event.data.length > 2 &&
      event.data[1] === 0x7d &&
      event.data[2] === 0x03
    ) {
      // Check if data length is enough to contain text (at least 7 bytes including F0, mfr ID, etc)
      if (event.data.length > 6) {
        try {
          // Extract ASCII text starting from position 5 (after SysEx header and command)
          const textBytes = event.data.slice(5, event.data.length - 1); // Exclude F7 at the end
          const text = String.fromCharCode.apply(null, Array.from(textBytes));
          addDebugMessage(`Message from Deluge: ${text}`);
        } catch {
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
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send ping command.");
    return;
  }

  // Try using smSysex ping (new protocol)
  smsPing().catch((err) => {
    console.warn("smSysex ping failed, falling back to legacy ping:", err);
    // Fallback to legacy ping
    if (midiOut.value) {
      midiOut.value.send([0xf0, 0x7d, 0x00, 0xf7]);
    }
  });
}

/** Request full OLED display data */
export function getOled() {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send OLED command.");
    return;
  }
  midiOut.value.send([0xf0, 0x7d, 0x02, 0x00, 0x01, 0xf7]);
}

/** Request full 7-segment display data */
export function get7Seg() {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send 7-seg command.");
    return;
  }
  sendSysEx("GET_7SEG");
}

/** Flip the screen orientation */
export function flipScreen() {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send flip-screen command.");
    return;
  }
  sendSysEx("FLIP");
}

/** Request raw display update (force full or delta) */
export function getDisplay(force: boolean = false) {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send display command.");
    return;
  }
  const command = force ? "GET_DISPLAY_FORCE" : "GET_DISPLAY";
  sendSysEx(command);
}

/** Request debug messages from device */
export function getDebug() {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send debug command.");
    addDebugMessage("MIDI Output not selected. Cannot request debug messages.");
    return false;
  }
  sendSysEx("GET_DEBUG");
  addDebugMessage("Requested debug messages from device");
  return true;
}

/** Request features status from device */
export function getFeatures() {
  if (!midiOut.value) {
    console.error(
      "MIDI Output not selected. Cannot send features status command.",
    );
    addDebugMessage(
      "MIDI Output not selected. Cannot request features status.",
    );
    return false;
  }
  midiOut.value.send([0xf0, 0x7d, 0x03, 0x01, 0x01, 0xf7]);
  addDebugMessage("Requested features status from device");
  return true;
}

/** Request version information from device */
export function getVersion() {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send version command.");
    addDebugMessage("MIDI Output not selected. Cannot request version info.");
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
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send custom SysEx.");
    addDebugMessage("MIDI Output not selected. Cannot send command.");
    return false;
  }

  if (!hexString.trim()) {
    console.error("ERROR: Please enter a valid SysEx command");
    addDebugMessage("ERROR: Please enter a valid SysEx command");
    return false;
  }

  try {
    // Parse hex string into bytes
    const parts = hexString.trim().split(/\s+/);
    const bytes = parts.map((p) => parseInt(p, 16));

    if (bytes.some(isNaN)) {
      throw new Error("Invalid hex values");
    }

    // Ensure it starts with F0 and ends with F7
    if (bytes[0] !== 0xf0 || bytes[bytes.length - 1] !== 0xf7) {
      throw new Error("SysEx must start with F0 and end with F7");
    }

    midiOut.value.send(bytes);
    addDebugMessage(`Sent: ${parts.join(" ")}`);
    return true;
  } catch (e) {
    console.error("Error sending SysEx", e);
    if (e instanceof Error) {
      addDebugMessage(`ERROR: ${e.message}`);
    }
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

/**
 * Test SysEx connectivity to ensure the device supports file browser commands
 * @returns Promise resolving to true if connected successfully
 */
export async function testSysExConnectivity(): Promise<boolean> {
  if (!midiOut.value) {
    console.error("testSysExConnectivity: MIDI Output not selected");
    throw new Error("MIDI Output not selected");
  }

  console.log("Testing SysEx connectivity...");
  try {
    // First try using the standard Synthstrom ID
    console.log("Trying standard Synthstrom ID first");
    await smsPing();
    console.log("Standard ID ping succeeded");
    return true;
  } catch (err) {
    console.warn("Standard SysEx ping failed, trying developer ID:", err);

    try {
      // Try with developer ID (0x7D)
      console.log("Switching to developer ID (0x7D)");
      setDeveloperIdMode(true);
      await smsPing();
      console.log("Developer ID ping succeeded");
      return true;
    } catch (devErr) {
      console.error("Developer ID ping also failed:", devErr);
      // Reset to standard mode
      setDeveloperIdMode(false);
      throw new Error("Device doesn't support SysEx communication");
    }
  }
}

/**
 * List contents of a directory on the Deluge
 * @param path Directory path to list
 * @param offset Starting index for pagination
 * @param lines Maximum number of entries to return
 * @returns Promise resolving to array of FileEntry objects
 */
export async function listDirectory(
  path: string,
  offset: number = 0,
  lines: number = 64,
): Promise<FileEntry[]> {
  if (!midiOut.value) {
    console.error("listDirectory: MIDI Output not selected");
    throw new Error("MIDI Output not selected");
  }

  console.log(
    `Listing directory ${path} (offset=${offset}, lines=${lines})...`,
  );
  try {
    // Ensure path starts with /
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    // Use smSysex transport to send the dir command
    console.log("Sending dir command via smSysex...");
    const response = await sendJson({
      dir: {
        path,
        offset,
        lines,
      },
    });

    console.log("Received directory response:", response);

    // Parse the response
    if (
      response &&
      response["^dir"] &&
      typeof response["^dir"] === "object" &&
      response["^dir"] !== null &&
      "list" in response["^dir"]
    ) {
      const dirResponse = response["^dir"] as Record<string, unknown>;
      const entries = dirResponse.list as FileEntry[];

      console.log(`Found ${entries.length} entries in ${path}`);

      // Update our fileTree signal with the new data
      // Keep all existing entries and add these new ones
      fileTree.value = { ...fileTree.value, [path]: entries };

      return entries;
    } else {
      console.error("Invalid directory response:", response);
      throw new Error("Failed to list directory: Invalid response");
    }
  } catch (err) {
    console.error(`Failed to list directory ${path}:`, err);
    throw err;
  }
}

/**
 * Check if firmware supports smSysex protocol
 * @returns Promise resolving to true if supported
 */
export async function checkFirmwareSupport(): Promise<boolean> {
  if (!midiOut.value) {
    console.error("checkFirmwareSupport: MIDI Output not selected");
    throw new Error("MIDI Output not selected");
  }

  console.log("Checking firmware smSysex support...");
  try {
    // Try to establish a session - this will fail on unsupported firmware
    console.log("Attempting to establish a session...");
    await ensureSession();
    console.log("Session established - firmware supports smSysex");
    return true;
  } catch (err) {
    console.error("Firmware doesn't support smSysex protocol:", err);
    throw new Error("Firmware doesn't support smSysex protocol");
  }
}
