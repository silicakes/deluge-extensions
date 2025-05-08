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
  const p = payload as { json?: unknown; binary?: unknown };
  if (p.json && !p.binary) {
    const jsonRes = await sendJson(p.json);
    return { json: jsonRes };
  }
  if (p.json && p.binary instanceof Uint8Array) {
    const jsonRes = await sendJson(p.json);
    return { json: jsonRes, binary: p.binary };
  }
  throw new Error("transport.sendSysex: unsupported payload");
}
