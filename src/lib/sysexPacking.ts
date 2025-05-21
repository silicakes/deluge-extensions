/**
 * SysEx 7-bit packing utilities.
 * Based on Deluge firmware's approach.
 */

/**
 * Packs an 8-bit Uint8Array into a 7-bit clean Uint8Array for SysEx transport.
 * Each group of 7 data bytes becomes 8 SysEx bytes (1 header + 7 data).
 * @param dataIn The 8-bit data to pack.
 * @returns A new Uint8Array with the 7-bit packed data.
 */
export function pack_8bit_to_7bit(dataIn: Uint8Array): Uint8Array {
  const dataOut = [];
  let inOffset = 0;

  while (inOffset < dataIn.length) {
    let hiBits = 0;
    const chunk = [];
    // Process up to 7 bytes for the current block
    for (let i = 0; i < 7; i++) {
      if (inOffset < dataIn.length) {
        const byte = dataIn[inOffset++];
        if (byte & 0x80) {
          // Check MSB
          hiBits |= 1 << i; // Set corresponding bit in hiBits
        }
        chunk.push(byte & 0x7f); // Add 7 LSBs to chunk
      } else {
        // If dataIn ends, pad with 0s for the 7-byte block structure if needed for MSB collection,
        // though Deluge seems to handle unterminated blocks for packing.
        // For simplicity here, we only push actual data bytes.
        // The spec implies blocks are always full or the packer handles it.
        // Let's assume the last block might be shorter than 7 bytes.
        chunk.push(0); // Placeholder, actual Deluge might not need this if hiBits is correct for actual bytes
      }
    }
    dataOut.push(hiBits);
    dataOut.push(
      ...chunk.slice(0, Math.min(7, dataIn.length - (inOffset - chunk.length))),
    ); // only push actual data parts
  }

  // Refined packing logic based on typical SysEx packing:
  // The previous loop was a bit complex. A more standard approach:
  const result: number[] = [];
  let n = 0;
  while (n < dataIn.length) {
    const count = Math.min(7, dataIn.length - n); // Number of data bytes in this group (1-7)
    let msbs = 0;
    const dataBytesForGroup: number[] = [];
    for (let i = 0; i < count; i++) {
      const eightBitByte = dataIn[n + i];
      msbs |= ((eightBitByte & 0x80) >> 7) << i; // Shift MSB to its position in msbs byte
      dataBytesForGroup.push(eightBitByte & 0x7f); // Add 7 LSBs
    }
    result.push(msbs);
    result.push(...dataBytesForGroup);
    n += count;
  }
  return new Uint8Array(result);
}

/**
 * Unpacks 7-bit clean SysEx data back into an 8-bit Uint8Array.
 * Each group of 8 SysEx bytes (1 header + 7 data) becomes up to 7 data bytes.
 * @param dataIn The 7-bit packed data to unpack.
 * @param unpackedSize The expected size of the unpacked 8-bit data (optional, but recommended for accuracy).
 * @returns A new Uint8Array with the unpacked 8-bit data.
 */
export function unpack_7bit_from_8bit(
  dataIn: Uint8Array,
  unpackedSize?: number,
): Uint8Array {
  const dataOut = [];
  let inOffset = 0;
  let outOffset = 0;

  while (inOffset < dataIn.length) {
    if (dataIn.length < inOffset + 1) break; // Not enough data for hiBits byte
    const hiBits = dataIn[inOffset++];

    for (let i = 0; i < 7; i++) {
      if (unpackedSize !== undefined && outOffset >= unpackedSize) break;
      if (dataIn.length < inOffset + 1) break; // Not enough data for this data byte

      let byte = dataIn[inOffset++];
      if ((hiBits >> i) & 1) {
        // Check corresponding bit in hiBits
        byte |= 0x80; // Set MSB if indicated
      }
      dataOut.push(byte);
      outOffset++;
    }
  }
  return new Uint8Array(dataOut);
}
