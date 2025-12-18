import { signal } from "@preact/signals";
import { subscribeMidiListener } from "@/commands";
import { getOLED } from "@/commands/display";
import { midiIn, midiOut } from "@/state";
import { isPollingActive, pollingMs, startPolling } from "@/lib/display";
import {
  encodeDisplaySysexFrame,
  DisplaySysexKind,
} from "@/lib/screenStreaming/codec";
import type {
  AnyControlMsg,
  ErrMsg,
  OkMsg,
  RoomActiveDisplay,
  RoomState,
} from "@/lib/screenStreaming/control";
import { nowMs } from "@/lib/screenStreaming/control";
import { createClientId, getOrCreateOwnerKey } from "@/lib/screenStreaming/ids";
import { buildRoomWsUrl } from "@/lib/screenStreaming/wsUrl";

export type ScreenStreamerStatus =
  | "idle"
  | "connecting"
  | "awaiting_ok"
  | "streaming"
  | "error";

export const screenStreamerStatus = signal<ScreenStreamerStatus>("idle");
export const screenStreamerRoomId = signal<string | null>(null);
export const screenStreamerRoomState = signal<RoomState | null>(null);
export const screenStreamerError = signal<ErrMsg | null>(null);

let ws: WebSocket | null = null;
let pingId: number | null = null;
let reconnectId: number | null = null;
let reconnectAttempt = 0;
let manualStop = false;

let currentClientId: string | null = null;
let currentOwnerKey: string | null = null;
let currentRoomId: string | null = null;
let currentPasswordToken: string | undefined;
let currentStreamHost: string | undefined;

let unsubMidi: (() => void) | null = null;
let seq = 0;
let hasSentOledFull = false;
let lastActive: RoomActiveDisplay | null = null;

function clearTimers() {
  if (pingId != null) {
    clearInterval(pingId);
    pingId = null;
  }
  if (reconnectId != null) {
    clearTimeout(reconnectId);
    reconnectId = null;
  }
}

function sendJson(msg: AnyControlMsg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ ...msg, ts: nowMs() }));
}

function closeWs() {
  try {
    ws?.close();
  } catch {
    // ignore
  } finally {
    ws = null;
  }
}

function cleanupConnections() {
  clearTimers();
  closeWs();
  if (unsubMidi) {
    unsubMidi();
    unsubMidi = null;
  }
}

function classifyDisplaySysex(data: Uint8Array): DisplaySysexKind | null {
  if (data.length < 5 || data[0] !== 0xf0 || data[1] !== 0x7d) return null;

  if (data[2] === 0x02 && data[3] === 0x40 && data[4] === 1) {
    return DisplaySysexKind.OledFull;
  }
  if (data[2] === 0x02 && data[3] === 0x40 && data[4] === 2) {
    return DisplaySysexKind.OledDelta;
  }
  if (data[2] === 0x02 && data[3] === 0x41 && data[4] === 0) {
    return DisplaySysexKind.Seg7;
  }
  return null;
}

function ensureMidiSubscription() {
  if (unsubMidi) return;

  unsubMidi = subscribeMidiListener((e) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (screenStreamerStatus.value !== "streaming") return;

    const data = e.data as Uint8Array;
    const kind = classifyDisplaySysex(data);
    if (kind == null) return;

    if (kind === DisplaySysexKind.OledDelta && !hasSentOledFull) return;

    seq += 1;
    const frame = encodeDisplaySysexFrame({ seq, kind, payload: data });
    ws.send(frame);

    if (kind === DisplaySysexKind.OledFull) {
      hasSentOledFull = true;
    }

    const active: RoomActiveDisplay =
      kind === DisplaySysexKind.Seg7 ? "seg7" : "oled";
    if (active !== lastActive) {
      lastActive = active;
      sendJson({
        t: "display:active",
        roomId: currentRoomId!,
        clientId: currentClientId!,
        active,
      });
    }
  });
}

async function requestOledFull() {
  try {
    await getOLED();
  } catch {
    // ignore
  }
}

function scheduleReconnect() {
  if (manualStop) return;
  if (!currentRoomId) return;

  reconnectAttempt += 1;
  const delayMs = Math.min(10_000, 500 * 2 ** Math.min(6, reconnectAttempt));
  reconnectId = window.setTimeout(() => {
    reconnectId = null;
    connect();
  }, delayMs);
}

function connect() {
  if (!currentRoomId || !currentClientId || !currentOwnerKey) return;

  clearTimers();
  closeWs();

  screenStreamerStatus.value = "connecting";
  const wsUrl = buildRoomWsUrl({
    roomId: currentRoomId,
    role: "streamer",
    streamHost: currentStreamHost,
  });
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    screenStreamerStatus.value = "awaiting_ok";
    sendJson({
      t: "streamer:hello",
      roomId: currentRoomId!,
      clientId: currentClientId!,
      ownerKey: currentOwnerKey!,
      passwordToken: currentPasswordToken,
      meta: {
        pollingMs,
      },
    });

    pingId = window.setInterval(() => {
      sendJson({ t: "ping", roomId: currentRoomId!, clientId: currentClientId! });
    }, 15_000);
  };

  ws.onmessage = (ev) => {
    if (typeof ev.data !== "string") return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    const msg = parsed as AnyControlMsg;
    if (typeof msg.t !== "string") return;

    if (msg.t === "ok") {
      const ok = msg as OkMsg;
      screenStreamerRoomState.value = ok.roomState;
      screenStreamerStatus.value = "streaming";
      screenStreamerError.value = null;
      reconnectAttempt = 0;

      seq = ok.roomState.lastSeq ?? 0;
      hasSentOledFull = false;
      lastActive = ok.roomState.active ?? null;

      ensureMidiSubscription();
      void requestOledFull();
      return;
    }

    if (msg.t === "err") {
      const err = msg as ErrMsg;
      manualStop = true;
      screenStreamerError.value = err;
      screenStreamerStatus.value = "error";
      clearTimers();
      closeWs();
      return;
    }

    if (msg.t === "streamer:request_full") {
      void requestOledFull();
    }
  };

  ws.onclose = () => {
    clearTimers();
    ws = null;
    if (manualStop) return;
    if (screenStreamerStatus.value !== "error") {
      screenStreamerStatus.value = "connecting";
    }
    scheduleReconnect();
  };

  ws.onerror = () => {
    if (manualStop) return;
    closeWs();
  };
}

export function startScreenStreaming(options: {
  roomId: string;
  passwordToken?: string;
  streamHost?: string;
}) {
  if (!midiOut.value || !midiIn.value) {
    throw new Error("Select a MIDI input and output to start streaming.");
  }
  if (!isPollingActive()) {
    startPolling();
  }

  manualStop = false;
  cleanupConnections();

  currentRoomId = options.roomId;
  currentPasswordToken = options.passwordToken;
  currentStreamHost = options.streamHost;
  currentClientId = createClientId();
  currentOwnerKey = getOrCreateOwnerKey();

  screenStreamerRoomId.value = options.roomId;
  screenStreamerRoomState.value = null;
  screenStreamerError.value = null;
  screenStreamerStatus.value = "connecting";

  connect();
}

export function stopScreenStreaming() {
  manualStop = true;
  cleanupConnections();
  reconnectAttempt = 0;

  currentClientId = null;
  currentOwnerKey = null;
  currentRoomId = null;
  currentPasswordToken = undefined;
  currentStreamHost = undefined;

  seq = 0;
  hasSentOledFull = false;
  lastActive = null;

  screenStreamerStatus.value = "idle";
  screenStreamerRoomId.value = null;
  screenStreamerRoomState.value = null;
}

export function refreshStreamedDisplay() {
  void requestOledFull();
}
