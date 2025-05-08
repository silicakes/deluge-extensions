/**
 * Utilities for 7-bit packing and unpacking for MIDI SysEx.
 */

/**
 * Convert binary data to 7-bit MIDI-safe format (for SysEx).
 * @param data Uint8Array of data to encode.
 * @returns Encoded array of 7-bit values.
 */
export function encode7Bit(data: Uint8Array): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i += 7) {
    const bytesInGroup = Math.min(7, data.length - i);
    let highBits = 0;
    for (let j = 0; j < bytesInGroup; j++) {
      if (data[i + j] & 0x80) {
        highBits |= 1 << j;
      }
    }
    result.push(highBits);
    for (let j = 0; j < bytesInGroup; j++) {
      result.push(data[i + j] & 0x7f);
    }
  }
  return result;
}

/**
 * Decode 7-bit MIDI-safe format back to binary data.
 * @param encoded Array of 7-bit values with high-bits bytes.
 * @returns Original binary data as Uint8Array.
 */
export function decode7Bit(encoded: number[]): Uint8Array {
  const result: number[] = [];
  let i = 0;
  while (i < encoded.length) {
    const highBits = encoded[i++];
    const groupLen = Math.min(7, encoded.length - i);
    for (let j = 0; j < groupLen; j++) {
      const low7 = encoded[i++];
      const bit = (highBits >> j) & 0x01;
      result.push((bit << 7) | low7);
    }
  }
  return new Uint8Array(result);
}
