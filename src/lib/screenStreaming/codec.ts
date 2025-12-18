export const STREAM_MAGIC_0 = 0x44; // 'D'
export const STREAM_MAGIC_1 = 0x58; // 'X'
export const STREAM_VERSION = 0x01;

export const STREAM_MSG_TYPE_DISPLAY_SYSEX = 0x01;

export const STREAM_HEADER_BYTES = 11;

export enum DisplaySysexKind {
  OledFull = 0,
  OledDelta = 1,
  Seg7 = 2,
}

export type DisplaySysexFrame = {
  msgType: typeof STREAM_MSG_TYPE_DISPLAY_SYSEX;
  seq: number;
  kind: DisplaySysexKind;
  payload: Uint8Array;
};

export function encodeDisplaySysexFrame(
  frame: Omit<DisplaySysexFrame, "msgType">,
): Uint8Array {
  const payloadLen = frame.payload.length;
  const header = new Uint8Array(STREAM_HEADER_BYTES);
  header[0] = STREAM_MAGIC_0;
  header[1] = STREAM_MAGIC_1;
  header[2] = STREAM_VERSION;
  header[3] = STREAM_MSG_TYPE_DISPLAY_SYSEX;

  const view = new DataView(header.buffer);
  view.setUint32(4, frame.seq >>> 0, false);
  header[8] = frame.kind;

  // payloadLen is optional; if payload is larger than uint16, set 0 and rely
  // on the WS frame length.
  view.setUint16(9, payloadLen < 0x10000 ? payloadLen : 0, false);

  const out = new Uint8Array(STREAM_HEADER_BYTES + payloadLen);
  out.set(header, 0);
  out.set(frame.payload, STREAM_HEADER_BYTES);
  return out;
}

export function decodeDisplaySysexFrame(
  data: ArrayBuffer | Uint8Array,
): DisplaySysexFrame {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < STREAM_HEADER_BYTES) {
    throw new Error("frame too short");
  }
  if (bytes[0] !== STREAM_MAGIC_0 || bytes[1] !== STREAM_MAGIC_1) {
    throw new Error("bad magic");
  }
  if (bytes[2] !== STREAM_VERSION) {
    throw new Error("unsupported version");
  }
  if (bytes[3] !== STREAM_MSG_TYPE_DISPLAY_SYSEX) {
    throw new Error("unsupported msgType");
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  const seq = view.getUint32(4, false);
  const kind = bytes[8] as DisplaySysexKind;
  const payloadLen = view.getUint16(9, false);
  const payload = bytes.subarray(STREAM_HEADER_BYTES);
  if (payloadLen !== 0 && payloadLen !== payload.length) {
    throw new Error("payload length mismatch");
  }

  return { msgType: STREAM_MSG_TYPE_DISPLAY_SYSEX, seq, kind, payload };
}

export function tryDecodeDisplaySysexFrame(
  data: ArrayBuffer | Uint8Array,
): DisplaySysexFrame | null {
  try {
    return decodeDisplaySysexFrame(data);
  } catch {
    return null;
  }
}
