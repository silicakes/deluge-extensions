import { sendSysex } from "@/commands/_shared/transport";
import { addDebugMessage } from "@/lib/debug";

/**
 * Request debug messages from the Deluge device.
 * @returns true if sent successfully, false otherwise.
 */
export async function getDebug(): Promise<boolean> {
  try {
    await sendSysex([0xf0, 0x7d, 0x03, 0x00, 0x01, 0xf7]);
    addDebugMessage("Requested debug messages from device");
    return true;
  } catch {
    addDebugMessage("MIDI Output not selected. Cannot request debug messages.");
    return false;
  }
}
