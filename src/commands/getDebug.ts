import { getDebug as legacyGetDebug } from "@/lib/midi";

/**
 * Request debug messages from the Deluge device.
 * @returns true if sent successfully, false otherwise.
 */
export function getDebug(): boolean {
  return legacyGetDebug();
}
