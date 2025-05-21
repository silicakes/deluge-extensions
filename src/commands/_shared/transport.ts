import { midiOut } from "@/state";
import { sendJson } from "@/lib/smsysex";

/**
 * Transport layer for sending and receiving SysEx messages.
 * Supports JSON-only, raw SysEx payloads, and basic JSON+binary fallback.
 */
export async function sendSysex(payload: unknown): Promise<unknown> {
  // Raw SysEx payload as Uint8Array
  if (payload instanceof Uint8Array) {
    if (!midiOut.value) throw new Error("MIDI output not selected");
    midiOut.value.send(payload);
    return {};
  }
  // Raw SysEx payload as number array
  if (Array.isArray(payload)) {
    if (!midiOut.value) throw new Error("MIDI output not selected");
    midiOut.value.send(payload);
    return {};
  }
  // JSON-only or JSON+binary command
  const p = payload as { json?: unknown; binary?: Uint8Array };
  if (p.json && !p.binary) {
    const jsonRes = await sendJson(p.json);
    return { json: jsonRes };
  }
  // Handle file write: JSON payload followed by 0x00 and packed binary data
  if (p.json && p.binary && (p.json as { write: unknown }).write) {
    // sendJson will need to be modified to handle this special case:
    // serialize json, then 0x00, then pack and append binary, all in one SysEx message.
    // It should still parse and return the Deluge's JSON response (e.g., { "^write": {...} })
    console.log(
      "[transport] Detected write command with binary. Delegating to sendJson with binary payload.",
    );
    const writeCmdResponseJson = await sendJson(p.json, p.binary); // Pass both to sendJson
    return { json: writeCmdResponseJson };
  }
  // Fallback for other potential json+binary types if ever needed, or error.
  // For now, if it's json+binary but not a 'write' command, it's an unsupported structure.
  if (p.json && p.binary) {
    console.error(
      "[transport] Received json+binary payload that is not a 'write' command. This is unhandled.",
    );
    // Mimic old broken behavior for safety, but log error.
    const jsonRes = await sendJson(p.json);
    return {
      json: jsonRes,
      binary: p.binary,
      error: "Unhandled json+binary structure",
    };
  }

  throw new Error("transport.sendSysex: unsupported payload");
}
