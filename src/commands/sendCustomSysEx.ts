import { midiOut } from "@/state";
import { addDebugMessage } from "@/lib/debug";

/**
 * Send a custom SysEx command to the Deluge device.
 * @param hexString A space-separated hex string, must start with F0 and end with F7.
 * @returns true if sent successfully, false otherwise
 */
export function sendCustomSysEx(hexString: string): boolean {
  // Ensure MIDI output is selected
  if (!midiOut.value) {
    addDebugMessage("MIDI Output not selected. Cannot send custom SysEx.");
    return false;
  }
  const trimmed = hexString.trim();
  if (!trimmed) {
    addDebugMessage("ERROR: Please enter a valid SysEx command");
    return false;
  }
  // Split into tokens and parse hex values
  const parts = trimmed.split(/\s+/);
  const bytes: number[] = parts.map((p) => {
    const lower = p.toLowerCase();
    const hex = lower.startsWith("0x") ? lower.slice(2) : lower;
    return parseInt(hex, 16);
  });
  // Validate parsing
  if (bytes.some((b) => isNaN(b))) {
    addDebugMessage("ERROR: Invalid hex values");
    return false;
  }
  // Validate SysEx framing
  if (bytes[0] !== 0xf0 || bytes[bytes.length - 1] !== 0xf7) {
    addDebugMessage("ERROR: SysEx must start with F0 and end with F7");
    return false;
  }
  // Send the payload
  try {
    midiOut.value.send(bytes);
    addDebugMessage(`Sent: ${parts.join(" ")}`);
    return true;
  } catch (e) {
    if (e instanceof Error) {
      addDebugMessage(`ERROR: ${e.message}`);
    } else {
      addDebugMessage("ERROR: Error sending SysEx");
    }
    return false;
  }
}
