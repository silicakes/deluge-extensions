/**
 * smSysex Protocol transport layer
 *
 * Implements session handling, message-ID rotation, and the communication
 * with the Deluge firmware 4.x using the smSysex protocol.
 */
import { midiOut } from "../state";
import { decode7Bit } from "@/commands/_shared/pack";
import { pack_8bit_to_7bit } from "./sysexPacking";
import type { FileEntry } from "../state";

// Define smSysex commands
export enum SmsCommand {
  PING = 0x00,
  POPUP = 0x01,
  HID = 0x02,
  DEBUG = 0x03,
  JSON = 0x04,
  JSON_REPLY = 0x05,
  PONG = 0x7f,
}

const ENABLE_SYSEX_LOG = false;
const log = ENABLE_SYSEX_LOG ? console.log : () => {};

// Standard Synthstrom manufacturer ID
const STD_MANUFACTURER_ID = [0x00, 0x21, 0x7b, 0x01];
// Developer ID for testing/development
const DEV_MANUFACTURER_ID = [0x7d];

// Session information
export interface SmsSession {
  sid: number; // Session ID
  midMin: number; // Minimum message ID for this session
  midMax: number; // Maximum message ID for this session
  counter: number; // Current message counter (1-7)
}

// Cached session
let currentSession: SmsSession | null = null;

// Flag to force developer ID usage
let useDevId = localStorage.getItem("dex-dev-sysex") === "true";

/**
 * Build a message ID from session ID and counter
 * @param s Session info
 * @returns Message ID byte
 */
function buildMsgId(s: SmsSession): number {
  // Format: bits 0-2 = counter (1-7), bits 3-6 = session ID
  return s.midMin | (s.counter & 0x07);
}

/**
 * Increment the message counter for the session
 * @param s Session to update
 */
function incrementCounter(s: SmsSession): void {
  // Increment and wrap 1-7 (we don't use 0)
  s.counter = (s.counter % 7) + 1;
}

/**
 * Opens a session with the Deluge
 * @param tag Client identifier
 * @returns Promise resolving to session information
 */
export async function openSession(tag = "DEx"): Promise<SmsSession> {
  if (!midiOut.value) {
    throw new Error("MIDI output not selected");
  }

  // If we already have a session, return it
  if (currentSession) {
    return currentSession;
  }

  log("Opening smSysex session with tag:", tag);
  const sessionCmd = { session: { tag } };
  const jsonData = JSON.stringify(sessionCmd);

  // Convert to bytes (each char is one byte in ASCII/UTF-8)
  const jsonBytes = new Uint8Array(jsonData.length);
  for (let i = 0; i < jsonData.length; i++) {
    jsonBytes[i] = jsonData.charCodeAt(i);
  }

  // Build SysEx message for session request
  // For session requests, msgId is 0
  const manufacturerId = useDevId ? DEV_MANUFACTURER_ID : STD_MANUFACTURER_ID;
  const sysexHeader = [0xf0, ...manufacturerId, SmsCommand.JSON, 0];
  const sysexFooter = [0xf7];

  const message = new Uint8Array([
    ...sysexHeader,
    ...Array.from(jsonBytes),
    ...sysexFooter,
  ]);

  return new Promise((resolve, reject) => {
    // Set up timeout
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Session negotiation timed out after 10000ms. Check that your Deluge is connected, " +
            "powered on, and has firmware version 4.0 or higher with SysEx Protocol enabled.",
        ),
      );
    }, 10000);

    // Set up response listener
    const cleanup = subscribeSysexListener((data) => {
      clearTimeout(timeoutId);
      cleanup(); // Remove listener once we get a response

      try {
        log(
          "Received session response:",
          Array.from(data).map((b) => b.toString(16)),
        );
        // Parse the response to get session info
        const parsedResponse = parseSysexResponse(data);

        // Check the .json property of the parsed response
        if (
          parsedResponse &&
          parsedResponse.json &&
          "^session" in parsedResponse.json
        ) {
          // Access the session info via parsedResponse.json
          const sessionInfo = parsedResponse.json["^session"] as Record<
            string,
            unknown
          >;
          log("Session info:", sessionInfo);

          // Verify required properties exist
          if (
            typeof sessionInfo.sid !== "number" ||
            typeof sessionInfo.midMin !== "number" ||
            typeof sessionInfo.midMax !== "number"
          ) {
            throw new Error(
              "Invalid session response: missing required fields",
            );
          }

          // Create and cache the session
          currentSession = {
            sid: sessionInfo.sid as number,
            midMin: sessionInfo.midMin as number,
            midMax: sessionInfo.midMax as number,
            counter: 1, // Start counter at 1
          };

          log("Session established:", currentSession);
          resolve(currentSession);
        } else {
          console.error("Invalid session response format:", parsedResponse);
          reject(new Error("Invalid session response"));
        }
      } catch (err) {
        console.error("Error processing session response:", err);
        reject(err);
      }
    });

    // Send the session request
    log("Sending session request");
    const output = midiOut.value;
    if (output) {
      output.send(message);
    } else {
      cleanup();
      reject(new Error("MIDI output not available"));
    }
  });
}

/**
 * Get the current session or open a new one if needed
 */
export async function ensureSession(): Promise<SmsSession> {
  if (currentSession) {
    return currentSession;
  }
  return openSession();
}

/**
 * Send a JSON command to the Deluge and wait for the response
 * @param cmd The JSON command object
 * @param binaryPayload Optional binary payload for write commands
 * @param s The session to use
 * @returns Promise resolving to the JSON response
 */
export async function sendJson(
  cmd: object,
  binaryPayload?: Uint8Array,
  s?: SmsSession,
): Promise<Record<string, unknown>> {
  if (!midiOut.value) {
    throw new Error("MIDI output not selected");
  }

  log("sendJson called with command:", cmd);

  // Get or create a session if not provided
  if (!s) {
    log("No session provided, ensuring session exists");
    s = await ensureSession();
    log("Session ensured:", s);
  }

  // Build message ID and increment counter
  const msgId = buildMsgId(s);
  incrementCounter(s);
  log(`Using msgId: ${msgId.toString(16)}, counter now: ${s.counter}`);

  // Convert JSON to bytes
  const jsonData = JSON.stringify(cmd);
  log("JSON payload:", jsonData);
  const jsonBytes = new Uint8Array(jsonData.length);
  for (let i = 0; i < jsonData.length; i++) {
    jsonBytes[i] = jsonData.charCodeAt(i);
  }

  // Build SysEx message
  const manufacturerId = useDevId ? DEV_MANUFACTURER_ID : STD_MANUFACTURER_ID;
  const sysexHeader = [0xf0, ...manufacturerId, SmsCommand.JSON, msgId];
  const sysexFooter = [0xf7];

  let message: Uint8Array;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((cmd as any).write && binaryPayload) {
    log(
      "[smsysex] Detected 'write' command with binary data. Packing and appending.",
    );
    const packedBinary = pack_8bit_to_7bit(binaryPayload);
    const separator = new Uint8Array([0x00]);
    message = new Uint8Array([
      ...sysexHeader,
      ...Array.from(jsonBytes),
      ...separator,
      ...packedBinary,
      ...sysexFooter,
    ]);
    log(`[smsysex] Combined message length for write: ${message.length}`);
  } else {
    message = new Uint8Array([
      ...sysexHeader,
      ...Array.from(jsonBytes),
      ...sysexFooter,
    ]);
  }

  log(
    "SysEx message:",
    Array.from(message)
      .map((b) => "0x" + b.toString(16).padStart(2, "0"))
      .join(" "),
  );

  return new Promise((resolve, reject) => {
    // Setup timeout
    const timeoutMs = 10000; // Increased from 5000 to 10000ms
    const timeoutId = setTimeout(() => {
      console.warn(`Command timed out after ${timeoutMs}ms:`, cmd);
      cleanup();
      reject(
        new Error(
          `SysEx command timed out after ${timeoutMs}ms. Check if device is connected and firmware supports SysEx protocol.`,
        ),
      );
    }, timeoutMs);

    // Set up response listener
    const cleanup = subscribeSysexListener((data) => {
      log(
        `Received SysEx response, checking if matches msgId ${msgId.toString(16)}`,
      );

      // Check if this is our response (matching msgId)
      // The position depends on manufacturer ID length (dev ID or full ID)
      const isDevId = data[1] === 0x7d;
      const msgIdPos = isDevId ? 3 : 6;
      const responseMsgId = data[msgIdPos];
      log(
        `Response msgId: ${responseMsgId.toString(16)}, expected: ${msgId.toString(16)}, position: ${msgIdPos}`,
      );

      if (data.length > msgIdPos && responseMsgId === msgId) {
        log("Message ID matched, processing response");
        clearTimeout(timeoutId);
        cleanup(); // Remove listener

        try {
          // Parse the response, getting JSON and potentially binary data
          const { json, binaryData } = parseSysexResponse(data);

          // If binary data exists (read response), attach it to the result
          if (binaryData) {
            json.data = binaryData; // Attach as 'data' property
          }
          resolve(json);
        } catch (err) {
          console.error("Failed to parse response:", err);
          reject(err);
        }
      } else {
        log("Message ID did not match, ignoring");
      }
    });

    // Send the command
    log("Sending SysEx command...");
    if (midiOut.value) {
      midiOut.value.send(message);
      log("SysEx command sent");
    } else {
      console.error("MIDI output disappeared");
      cleanup();
      reject(new Error("MIDI output not available"));
    }
  });
}

/**
 * Send a ping command and wait for pong response
 * @returns Promise that resolves on successful pong
 */
export async function ping(s?: SmsSession): Promise<void> {
  if (!midiOut.value) {
    throw new Error("MIDI output not selected");
  }

  // Get or create a session
  if (!s) {
    s = await ensureSession();
  }

  // Ping command: empty JSON object
  const cmd = { ping: {} };

  return sendJson(cmd, undefined, s).then(() => {
    // If sendJson resolves, ping succeeded
    return;
  });
}

/**
 * Parse a SysEx response containing JSON data
 * @param data SysEx message data
 * @returns Parsed JSON object
 */
function parseSysexResponse(data: Uint8Array): {
  json: Record<string, unknown>;
  binaryData?: Uint8Array;
} {
  try {
    // Skip the SysEx header (F0 + manufacturer ID + command + msgId)
    const headerSize = data[1] === 0x7d ? 4 : 7;

    // Find the end of the SysEx message (F7)
    const sysexEnd = data.lastIndexOf(0xf7);
    if (sysexEnd === -1) {
      throw new Error("Invalid SysEx: missing terminator");
    }

    // Find the 0x00 separator, if present
    let separatorIdx = -1;
    for (let i = headerSize; i < sysexEnd; i++) {
      if (data[i] === 0x00) {
        separatorIdx = i;
        break;
      }
    }

    // Extract JSON part and potentially binary data
    const jsonBytes = data.slice(
      headerSize,
      separatorIdx !== -1 ? separatorIdx : sysexEnd,
    );
    let binaryData: Uint8Array | undefined = undefined;

    if (separatorIdx !== -1) {
      const packedBinary = data.slice(separatorIdx + 1, sysexEnd);
      // Simple check if unpacking is needed - might need refinement
      // Assuming 7-bit packing if it contains bytes >= 0x80
      try {
        binaryData = decode7Bit(Array.from(packedBinary));
      } catch (e) {
        console.warn("Failed to decode binary data, assuming raw:", e);
        binaryData = packedBinary; // Fallback to raw if decode fails
      }
    }

    const jsonText = String.fromCharCode.apply(null, Array.from(jsonBytes));
    log("Raw JSON part:", jsonText);

    try {
      const json = JSON.parse(jsonText);
      // Check if this is actually a read response based on the presence of binary data
      // or the key "^read"
      if (binaryData || (json && json["^read"])) {
        log("Read response detected, returning JSON and binary data.");
        return { json, binaryData };
      }
      // For non-read responses, just return JSON
      return { json };
    } catch (parseError) {
      console.warn(
        "Standard JSON parse failed, checking fallbacks:",
        parseError,
      );

      // Fallback for directory listing
      if (
        jsonText.includes('"^dir"') &&
        jsonText.includes('"list"') &&
        jsonText.includes('"name"')
      ) {
        log("Detected directory listing - using manual extraction");
        return { json: extractDirectoryEntries(jsonText) };
      }

      // Fallback for session response
      if (jsonText.includes('"^session"') || jsonText.includes('"session"')) {
        log("Constructing fallback session object");
        return {
          json: {
            "^session": {
              sid: 1,
              midMin: 0x41,
              midMax: 0x4f,
            },
          },
        };
      }

      // If no fallbacks match, re-throw original error
      throw parseError;
    }
  } catch (err) {
    console.error("Error parsing SysEx response:", err);
    // Ensure a consistent return type even on error, maybe return null/error?
    // For now, rethrowing to maintain original behavior
    throw new Error(`Failed to parse SysEx response: ${err}`);
  }
}

/**
 * Sanitize a filename to remove problematic characters
 * @param name The raw filename from device
 * @returns A sanitized filename safe for display and processing
 */
function sanitizeFilename(name: string): string {
  // Use character code checking instead of regex for control characters
  let result = "";
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    // Skip control characters
    if (code < 32 || (code >= 127 && code <= 159)) {
      continue;
    }
    // Replace Windows-invalid filename chars
    if (["\\", "/", ":", "*", "?", '"', "<", ">", "|"].includes(name[i])) {
      result += "_";
    } else {
      result += name[i];
    }
  }
  return result;
}

/**
 * Extract directory entries from a malformed JSON response
 * This is a fallback when JSON parsing fails on directory listings
 *
 * @param jsonText The raw JSON text containing directory entries
 * @returns A directory response object with extracted entries
 */
function extractDirectoryEntries(jsonText: string): Record<string, unknown> {
  const entries: FileEntry[] = [];

  // Use regex to extract entries, even if JSON is malformed
  // This pattern carefully handles possibly malformed filenames by using a more robust approach
  const entryRegex =
    /"name"\s*:\s*"([^"]*?)"\s*,\s*"size"\s*:\s*(\d+)\s*,\s*"date"\s*:\s*(\d+)\s*,\s*"time"\s*:\s*(\d+)\s*,\s*"attr"\s*:\s*(\d+)/g;

  // First extract entries with complete and proper syntax
  let match;
  while ((match = entryRegex.exec(jsonText)) !== null) {
    try {
      // Note: match[0] is the full match, match[1] is the first capture group
      const rawName = match[1];
      const size = parseInt(match[2], 10);
      const date = parseInt(match[3], 10);
      const time = parseInt(match[4], 10);
      const attr = parseInt(match[5], 10);

      // Clean the filename
      const name = sanitizeFilename(rawName);

      const entry: FileEntry = {
        name,
        size,
        date,
        time,
        attr,
      };

      entries.push(entry);
    } catch (err) {
      console.warn("Failed to parse entry:", match, err);
      // Skip this entry and continue
    }
  }

  log(`Extracted ${entries.length} entries using regex fallback`);

  // Return a properly formatted directory response
  return {
    "^dir": {
      list: entries,
      err: 0,
    },
  };
}

// Collection of binary data response handlers
const binaryResponseHandlers = new Map<number, (data: Uint8Array) => void>();

/**
 * Process a binary block from SysEx
 * This is used for read/write operations where the response includes binary data
 * @param data SysEx message containing binary data after JSON
 * @param msgId Message ID to identify the handler
 */
function processBinaryResponse(data: Uint8Array, msgId: number): void {
  const handler = binaryResponseHandlers.get(msgId);
  if (!handler) return;

  try {
    // Find the 0x00 separator that marks the start of binary data
    let separatorIdx = -1;
    for (let i = 7; i < data.length - 1; i++) {
      if (data[i] === 0x00) {
        separatorIdx = i;
        break;
      }
    }

    if (separatorIdx === -1) {
      throw new Error("Binary response missing separator");
    }

    // Extract binary data (packed in 7-bit format)
    const packedData = data.slice(separatorIdx + 1, data.length - 1);

    // Unpack to 8-bit data
    const unpacked = decode7Bit(Array.from(packedData));

    // Call the handler
    handler(unpacked);

    // Remove the handler
    binaryResponseHandlers.delete(msgId);
  } catch (err) {
    console.error("Error processing binary response:", err);
    binaryResponseHandlers.delete(msgId);
  }
}

/**
 * Set up a binary response handler for a specific message ID
 * @param msgId Message ID to watch for
 * @param handler Function to call with the unpacked binary data
 */
export function setBinaryResponseHandler(
  msgId: number,
  handler: (data: Uint8Array) => void,
): void {
  binaryResponseHandlers.set(msgId, handler);
}

// Observer pattern for raw SysEx messages
const sysexListeners = new Set<(data: Uint8Array) => void>();

/**
 * Subscribe to all SysEx messages
 * @param listener Function to call with raw SysEx data
 * @returns Cleanup function to unsubscribe
 */
export function subscribeSysexListener(
  listener: (data: Uint8Array) => void,
): () => void {
  sysexListeners.add(listener);
  return () => sysexListeners.delete(listener);
}

/**
 * Handle incoming MIDI message, filtering for SysEx
 * This should be called from the midi.ts handleMidiMessage function
 * @param event MIDI message event
 */
export function handleSysexMessage(event: MIDIMessageEvent): void {
  if (!event.data || event.data[0] !== 0xf0) return; // Not SysEx or no data

  // Call all listeners with the raw data
  const data = new Uint8Array(event.data);
  sysexListeners.forEach((listener) => listener(data));

  // Handle binary response if this is a JSON_REPLY with a known msgId
  const isDevId = data[1] === 0x7d;
  const commandPos = isDevId ? 2 : 5;
  const msgIdPos = isDevId ? 3 : 6;

  if (data.length > msgIdPos && data[commandPos] === SmsCommand.JSON_REPLY) {
    // Get message ID
    const msgId = data[msgIdPos];

    if (binaryResponseHandlers.has(msgId)) {
      processBinaryResponse(data, msgId);
    }
  }
}

/**
 * Force use of developer ID (0x7D) instead of standard Synthstrom ID
 * @param useDevMode True to use developer ID, false to use standard ID
 */
export function setDeveloperIdMode(useDevMode: boolean): void {
  useDevId = useDevMode;
  localStorage.setItem("dex-dev-sysex", useDevMode.toString());

  // Reset session when changing mode
  currentSession = null;
}
