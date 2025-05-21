import { sendSysex } from "@/commands/_shared/transport";

/**
 * Retrieve version information from the Deluge device
 */
export async function getVersion(): Promise<void> {
  await sendSysex([0xf0, 0x7d, 0x03, 0x02, 0x01, 0xf7]);
}

/**
 * Retrieve features status from the Deluge device
 */
export async function getFeatures(): Promise<void> {
  await sendSysex([0xf0, 0x7d, 0x03, 0x01, 0x01, 0xf7]);
}
