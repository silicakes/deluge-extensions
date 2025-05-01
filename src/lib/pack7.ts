/**
 * 7-bit packing utilities for Deluge smSysex protocol
 *
 * Used for binary data transfer in the smSysex protocol. Every 7 bytes
 * of data are packed into 8 bytes, where the first byte contains the MSBs.
 */

/**
 * Pack 8-bit data into 7-bit data for SysEx transmission
 * @param data The 8-bit data to pack
 * @returns The packed 7-bit data
 */
export function pack7(data: Uint8Array): Uint8Array {
  if (data.length === 0) return new Uint8Array(0);

  // Calculate packed size: For every 7 bytes, we need 8 bytes (7 payload + 1 MSB collection)
  const packedSize = Math.ceil(data.length / 7) * 8;
  const result = new Uint8Array(packedSize);

  // Process chunks of 7 bytes
  for (let i = 0; i < data.length; i += 7) {
    const chunkSize = Math.min(7, data.length - i);
    const outIdx = (i / 7) * 8;

    // First byte holds the MSBs
    let hiBits = 0;

    // Extract MSBs and clear them in source data
    for (let j = 0; j < chunkSize; j++) {
      if (data[i + j] & 0x80) {
        hiBits |= 1 << j;
      }
    }

    result[outIdx] = hiBits;

    // Fill in the 7-bit data bytes
    for (let j = 0; j < chunkSize; j++) {
      result[outIdx + 1 + j] = data[i + j] & 0x7f;
    }
  }

  return result;
}

/**
 * Unpack 7-bit data into 8-bit data
 * @param data The packed 7-bit data
 * @returns The unpacked 8-bit data
 */
export function unpack7(data: Uint8Array): Uint8Array {
  if (data.length === 0) return new Uint8Array(0);

  // Calculate unpacked size: For every 8 bytes of input, we get 7 bytes of output
  // But need to handle possible incomplete final chunk
  const fullChunks = Math.floor(data.length / 8);
  const remainingBytes = data.length % 8;

  // Each full chunk gives 7 bytes, and there are 'remainingBytes - 1' output bytes
  // from the last chunk (if any)
  const unpackedSize =
    fullChunks * 7 + (remainingBytes > 0 ? remainingBytes - 1 : 0);
  const result = new Uint8Array(unpackedSize);

  // Process each chunk of 8 bytes (which unpacks to 7 bytes)
  for (let i = 0; i < data.length; i += 8) {
    const outIdx = (i / 8) * 7;

    // First byte contains MSBs
    const hiBits = data[i];

    // Determine how many bytes to process in this chunk
    const bytesToProcess = Math.min(7, data.length - i - 1);

    // Combine MSBs with 7-bit data
    for (let j = 0; j < bytesToProcess; j++) {
      result[outIdx + j] = data[i + 1 + j] | (hiBits & (1 << j) ? 0x80 : 0);
    }
  }

  return result;
}
