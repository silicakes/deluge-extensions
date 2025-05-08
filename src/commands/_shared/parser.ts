/**
 * Possible response structures from different parts of the application
 */
interface RawResponse {
  json?: Record<string, unknown>;
  binary?: Uint8Array;
  data?: Uint8Array;
  [key: string]: unknown;
}

/**
 * Parser utilities to interpret SysEx responses.
 */
export const parser = {
  /** Extract JSON property keyed by `key` from a response. */
  json:
    <T>(key: string) =>
    (raw: unknown): T => {
      const response = raw as RawResponse;
      if (!response.json || !(key in response.json)) {
        throw new Error(`Invalid JSON response, missing key ${key}`);
      }
      return response.json[key] as T;
    },

  /** Extract binary payload from a JSON+binary response under property `key`. */
  jsonPlusBinary:
    <T>(key: string) =>
    (raw: unknown): T => {
      // Check for binary data in various possible locations based on how the real device responds
      const binaryData = findBinaryData(raw as RawResponse);

      if (!binaryData) {
        throw new Error(`Invalid binary response, missing binary data`);
      }

      return { [key]: binaryData } as unknown as T;
    },

  /**
   * Ensure a response indicates success and return it.
   * This handles various success response formats from the Deluge.
   */
  expectOk: (raw: unknown): Record<string, unknown> => {
    const response = raw as RawResponse;
    if (!response.json) {
      throw new Error("Missing JSON response");
    }

    // Case 1: Simple {ok: true} format used in tests
    if (response.json.ok === true) {
      return response.json;
    }

    // Case 2: Deluge format like {"^close": { "fid": 113, "err": 0 }}
    // Check for any property that has an err field with value 0
    for (const key of Object.keys(response.json)) {
      const value = response.json[key];
      if (
        typeof value === "object" &&
        value !== null &&
        "err" in value &&
        (value as Record<string, unknown>).err === 0
      ) {
        return response.json;
      }
    }

    throw new Error("Expected ok response");
  },
};

/**
 * Helper to find binary data in various possible locations in the response
 * @param raw The raw response object
 * @returns The binary data if found, or undefined if not found
 */
function findBinaryData(raw: RawResponse): Uint8Array | undefined {
  // Check common locations for binary data based on observed structures

  // Check direct binary property (used in tests)
  if (raw.binary instanceof Uint8Array) {
    return raw.binary;
  }

  // Check data property at root level (how smsysex.ts attaches it)
  if (raw.data instanceof Uint8Array) {
    return raw.data;
  }

  // Check json.data (alternative structure from smsysex.ts)
  if (raw.json && "data" in raw.json && raw.json.data instanceof Uint8Array) {
    return raw.json.data as Uint8Array;
  }

  // Check for json in response keys (might have binary attached at root)
  const jsonKeys = Object.keys(raw);
  for (const key of jsonKeys) {
    const value = raw[key] as Record<string, unknown>;
    if (
      key.startsWith("json") &&
      value &&
      "data" in value &&
      value.data instanceof Uint8Array
    ) {
      return value.data as Uint8Array;
    }
  }

  return undefined;
}
