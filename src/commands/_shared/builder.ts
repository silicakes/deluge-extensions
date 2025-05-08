/**
 * Builder utilities for constructing SysEx command payloads.
 */
export const builder = {
  /** Build a JSON-only SysEx request payload. */
  jsonOnly: (header: object): unknown => ({ json: header }),

  /** Build a JSON + binary SysEx request payload. */
  jsonPlusBinary: (header: object, binary: Uint8Array): unknown => ({
    json: header,
    binary,
  }),

  /** Helper to construct a JSON-only response in tests. */
  jsonReply: (header: object): unknown => ({ json: header }),

  /** Helper to construct a JSON + binary response in tests. */
  jsonBinaryReply: (header: object, binary: Uint8Array): unknown => ({
    json: header,
    binary,
  }),
};
