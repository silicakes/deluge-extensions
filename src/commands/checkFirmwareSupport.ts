import { checkFirmwareSupport as legacyCheckFirmwareSupport } from "@/lib/midi";

/**
 * Check if firmware supports smSysex protocol.
 * @returns Promise resolving to true if supported.
 */
export async function checkFirmwareSupport(): Promise<boolean> {
  return legacyCheckFirmwareSupport();
}
