import { checkFirmwareSupport as serviceCheckFirmwareSupport } from "@/lib/checkFirmwareSupport";

/**
 * Check if firmware supports smSysex protocol.
 * @returns Promise resolving to true if supported.
 */
export async function checkFirmwareSupport(): Promise<boolean> {
  return serviceCheckFirmwareSupport();
}
