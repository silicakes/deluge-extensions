/**
 * Unpacks data encoded with a 7-to-8 bit RLE scheme.
 * @param {Uint8Array} src The packed source data.
 * @param {number} [estimatedDstSize] An estimate for the destination size to preallocate buffer.
 * @returns {Uint8Array} The unpacked 8-bit data.
 * @throws {Error} If unpacking fails due to invalid data or buffer issues.
 */
function unpack_7to8_rle(src, estimatedDstSize) {
    // Error codes matching Rust implementation
    const ERROR_CODES = {
        INCOMPLETE_PACKET: -1,
        MISSING_RUN_LENGTH_EXTENSION: -3,
        INVALID_DENSE_MARKER: -7,
        BUFFER_TOO_SMALL_DENSE: -11,
        BUFFER_TOO_SMALL_RLE: -12,
        UNKNOWN_ERROR: -99
    };

    // Map error codes to descriptive messages (matching Rust)
    const ERROR_MESSAGES = {
        [-1]: "Incomplete data packet",
        [-3]: "Missing run length extension byte",
        [-7]: "Invalid dense packet marker",
        [-11]: "Destination buffer too small for dense data",
        [-12]: "Destination buffer too small for RLE data",
        [-99]: "Unknown error"
    };

    /**
     * Creates an error with a standard format matching the Rust implementation
     * @param {number} code - Error code from ERROR_CODES
     * @param {string} [additionalInfo] - Optional additional context
     * @returns {Error} The formatted error
     */
    function createError(code, additionalInfo = '') {
        const message = ERROR_MESSAGES[code] || "Unknown error";
        const fullMessage = `Failed to unpack RLE data: ${message} (code: ${code})${additionalInfo ? ` - ${additionalInfo}` : ''}`;
        console.error(fullMessage);
        
        // Create an error object with both message and code
        const error = new Error(fullMessage);
        error.code = code;
        return error;
    }

    // Estimate destination size if not provided. RLE can expand significantly.
    // The factor 32 is a heuristic from the Rust code's allocation.
    const initialDstSize = estimatedDstSize || src.length * 32; 
    let dst = new Uint8Array(initialDstSize);
    let d = 0; // Destination index
    let s = 0; // Source index
    const src_len = src.length;

    /**
     * Ensures the destination buffer has enough capacity
     * @param {number} needed - Number of bytes needed
     * @param {number} errorCode - Error code to use if buffer can't be grown
     * @returns {boolean} True if capacity is ensured, throws otherwise
     */
    const ensureDstCapacity = (needed, errorCode) => {
        if (d + needed > dst.length) {
            try {
                // Grow buffer if needed
                const newSize = Math.max(dst.length * 2, d + needed + 1024); // Add some padding
                console.log(`Growing unpack buffer from ${dst.length} to ${newSize}`);
                let newDst = new Uint8Array(newSize);
                newDst.set(dst.subarray(0, d), 0);
                dst = newDst;
                return true;
            } catch (e) {
                // If we can't allocate more memory, throw with appropriate error code
                throw createError(errorCode, `Needed ${needed} more bytes at position ${d}`);
            }
        }
        return true;
    };

    // Main unpacking loop
    try {
        console.log(`Unpacking RLE data: ${src_len} bytes`);
        
        while (s + 1 < src_len) {
            const first = src[s];
            s += 1;

            if (first < 64) { // Dense packet
                let size = 0;
                let off = 0;
                if (first < 4)       { size = 2; off = 0; }
                else if (first < 12) { size = 3; off = 4; }
                else if (first < 28) { size = 4; off = 12; }
                else if (first < 60) { size = 5; off = 28; }
                else { throw createError(ERROR_CODES.INVALID_DENSE_MARKER, `Marker value: ${first} at index ${s-1}`); }

                if (s + size > src_len) {
                    throw createError(ERROR_CODES.INCOMPLETE_PACKET, 
                        `At index ${s-1}, need ${size} bytes, have ${src_len - s}`);
                }

                ensureDstCapacity(size, ERROR_CODES.BUFFER_TOO_SMALL_DENSE);

                const highbits = first - off;
                for (let j = 0; j < size; j++) {
                    dst[d + j] = src[s + j] & 0x7f;
                    if ((highbits & (1 << j)) !== 0) {
                        dst[d + j] |= 0x80;
                    }
                }

                d += size;
                s += size;
            } else { // RLE packet
                // first = 64 + (runlen << 1) + highbit
                const marker = first - 64;
                const high = (marker & 1) !== 0;
                let runlen = (marker >> 1);

                if (runlen === 31) { // Extended run length
                    if (s >= src_len) {
                        throw createError(ERROR_CODES.MISSING_RUN_LENGTH_EXTENSION, 
                            `At index ${s}`);
                    }
                    runlen = 31 + src[s];
                    s += 1;
                    if (s >= src_len) {
                        throw createError(ERROR_CODES.INCOMPLETE_PACKET,
                            `Missing value byte after extended run length at index ${s}`);
                    }
                }

                if (s >= src_len) {
                    throw createError(ERROR_CODES.INCOMPLETE_PACKET,
                        `Missing value byte at index ${s}`);
                }
                
                const byte = (src[s] & 0x7f) + (high ? 0x80 : 0);
                s += 1;

                ensureDstCapacity(runlen, ERROR_CODES.BUFFER_TOO_SMALL_RLE);

                // Fill runlen bytes with the value
                for (let i = 0; i < runlen; i++) {
                    dst[d + i] = byte;
                }
                d += runlen;
            }
        }

        console.log(`Successfully unpacked RLE data: ${d} bytes`);
        // Return only the populated part of the buffer
        return dst.subarray(0, d);
    } catch (e) {
        // If it's already one of our formatted errors, re-throw it
        if (e.code) throw e;
        
        // Otherwise wrap other errors as unknown errors
        throw createError(ERROR_CODES.UNKNOWN_ERROR, e.message);
    }
}

// Export if used as a module, otherwise assign to window for script tag usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { unpack_7to8_rle };
} else if (typeof window !== 'undefined') {
    window.unpack_7to8_rle = unpack_7to8_rle;
} 