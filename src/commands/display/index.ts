import { sendSysex } from "@/commands/_shared/transport";

/**
 * Request full OLED display data from the Deluge device.
 */
export async function getOLED(): Promise<void> {
  await sendSysex([0xf0, 0x7d, 0x02, 0x00, 0x01, 0xf7]);
}

/**
 * Request 7-segment display data from the Deluge device.
 */
export async function get7Seg(): Promise<void> {
  await sendSysex([0xf0, 0x7d, 0x02, 0x01, 0x00, 0xf7]);
}

/**
 * Flip the screen orientation on the Deluge device.
 */
export async function flipScreen(): Promise<void> {
  await sendSysex([0xf0, 0x7d, 0x02, 0x00, 0x04, 0xf7]);
}
