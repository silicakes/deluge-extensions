import { midiOut } from "../state";
import { ensureSession } from "./smsysex";

/**
 * Check if firmware supports smSysex protocol.
 * @returns Promise resolving to true if supported.
 */
export async function checkFirmwareSupport(): Promise<boolean> {
  if (!midiOut.value) {
    console.error("checkFirmwareSupport: MIDI Output not selected");
    throw new Error("MIDI Output not selected");
  }

  console.log("Checking firmware smSysex support...");
  try {
    console.log("Attempting to establish a session...");
    await ensureSession();
    console.log("Session established - firmware supports smSysex");
    return true;
  } catch (err) {
    console.error("Firmware doesn't support smSysex protocol:", err);
    throw new Error("Firmware doesn't support smSysex protocol");
  }
}
