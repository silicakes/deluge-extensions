type Env = {
  ROOMS: DurableObjectNamespace;
};

function normalizeRoomId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
    if (!m) return new Response("Not found", { status: 404 });

    if (!isWebSocketUpgrade(request)) {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const rawRoomId = decodeURIComponent(m[1] ?? "");
    const roomId = normalizeRoomId(rawRoomId);
    if (!roomId) return new Response("Invalid roomId", { status: 400 });

    const id = env.ROOMS.idFromName(roomId);
    const stub = env.ROOMS.get(id);
    return stub.fetch(request);
  },
};

type StreamRole = "streamer" | "viewer";
type RoomActiveDisplay = "oled" | "seg7";

type BaseMsg = { t: string; roomId: string; clientId: string; ts?: number };
type StreamerHello = BaseMsg & {
  t: "streamer:hello";
  passwordToken?: string;
  ownerKey: string;
  meta?: { device?: string; appVersion?: string; pollingMs?: number };
};
type ViewerHello = BaseMsg & { t: "viewer:hello"; passwordToken?: string };
type Ping = BaseMsg & { t: "ping" };
type Bye = BaseMsg & { t: "bye" };
type DisplayActive = BaseMsg & { t: "display:active"; active: RoomActiveDisplay };
type ViewerRequestFull = BaseMsg & { t: "viewer:request_full" };
type StreamerRequestFull = BaseMsg & { t: "streamer:request_full" };
type Ok = BaseMsg & { t: "ok"; role: StreamRole; roomState: RoomState };
type Err = BaseMsg & { t: "err"; code: string; msg: string };

type RoomState = {
  hasStreamer: boolean;
  viewers: number;
  viewerCap: number;
  lastSeq?: number;
  active?: RoomActiveDisplay;
  requiresPassword: boolean;
  createdAt?: number;
  updatedAt?: number;
};

type AnyControl =
  | StreamerHello
  | ViewerHello
  | Ping
  | Bye
  | DisplayActive
  | ViewerRequestFull
  | StreamerRequestFull
  | Ok
  | Err;

const FRAME_MAGIC_0 = 0x44; // 'D'
const FRAME_MAGIC_1 = 0x58; // 'X'
const FRAME_VERSION = 0x01;
const FRAME_MSG_DISPLAY_SYSEX = 0x01;
const FRAME_HEADER_BYTES = 11;

const FRAME_KIND_OLED_FULL = 0;
const FRAME_KIND_OLED_DELTA = 1;
const FRAME_KIND_SEG7 = 2;

const VIEWER_CAP = 5;
const MAX_FRAME_BYTES = 256 * 1024;
const MAX_FPS = 60;
const FPS_WINDOW_MS = 1000;
const IDLE_TIMEOUT_MS = 45_000;
const SWEEP_MS = 15_000;

type ConnMeta = {
  role: StreamRole;
  roomId: string;
  clientId: string | null;
  authed: boolean;
  lastSeen: number;
};

export class RoomDurableObject {
  private readonly createdAt = Date.now();
  private updatedAt = Date.now();

  private ownerKey: string | null = null;
  private passwordToken: string | null = null;

  private streamer: { ws: WebSocket; meta: ConnMeta; ownerKey: string } | null =
    null;
  private viewers = new Map<string, { ws: WebSocket; meta: ConnMeta }>();
  private pendingViewers = new Map<string, { ws: WebSocket; meta: ConnMeta }>();

  private lastOledFull: ArrayBuffer | null = null;
  private lastSeg7: ArrayBuffer | null = null;
  private lastSeq = 0;
  private activeDisplay: RoomActiveDisplay | null = null;

  private recentFrameTimes: number[] = [];
  private sweepId: number | null = null;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    void this.state.blockConcurrencyWhile(async () => {
      this.startSweep();
    });
  }

  private startSweep() {
    if (this.sweepId != null) return;
    this.sweepId = setInterval(() => this.sweep(), SWEEP_MS) as unknown as number;
  }

  private stopSweepIfIdle() {
    const hasAny =
      this.streamer != null ||
      this.viewers.size > 0 ||
      this.pendingViewers.size > 0;
    if (hasAny) return;
    if (this.sweepId != null) {
      clearInterval(this.sweepId);
      this.sweepId = null;
    }
  }

  private sweep() {
    const now = Date.now();

    if (this.streamer && now - this.streamer.meta.lastSeen > IDLE_TIMEOUT_MS) {
      this.streamer.ws.close(4000, "idle");
      this.streamer = null;
    }

    for (const [id, v] of this.viewers) {
      if (now - v.meta.lastSeen > IDLE_TIMEOUT_MS) {
        v.ws.close(4000, "idle");
        this.viewers.delete(id);
      }
    }

    for (const [id, v] of this.pendingViewers) {
      if (now - v.meta.lastSeen > IDLE_TIMEOUT_MS) {
        v.ws.close(4000, "idle");
        this.pendingViewers.delete(id);
      }
    }

    this.stopSweepIfIdle();
  }

  private roomState(): RoomState {
    return {
      hasStreamer: this.streamer != null,
      viewers: this.viewers.size + this.pendingViewers.size,
      viewerCap: VIEWER_CAP,
      lastSeq: this.lastSeq || undefined,
      active: this.activeDisplay ?? undefined,
      requiresPassword: this.passwordToken != null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private sendJson(ws: WebSocket, msg: AnyControl) {
    try {
      ws.send(JSON.stringify({ ...msg, ts: Date.now() }));
    } catch {
      // ignore
    }
  }

  private err(ws: WebSocket, roomId: string, clientId: string, code: string, msg: string) {
    this.sendJson(ws, { t: "err", roomId, clientId, code, msg });
    try {
      ws.close(4001, code);
    } catch {
      // ignore
    }
  }

  private ok(ws: WebSocket, roomId: string, clientId: string, role: StreamRole) {
    this.sendJson(ws, { t: "ok", roomId, clientId, role, roomState: this.roomState() });
  }

  async fetch(request: Request): Promise<Response> {
    if (!isWebSocketUpgrade(request)) {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    if (role !== "streamer" && role !== "viewer") {
      return new Response("Invalid role", { status: 400 });
    }

    const pathMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
    const roomId = normalizeRoomId(
      decodeURIComponent(pathMatch?.[1] ?? ""),
    );
    if (!roomId) return new Response("Invalid roomId", { status: 400 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const meta: ConnMeta = {
      role,
      roomId,
      clientId: null,
      authed: false,
      lastSeen: Date.now(),
    };

    server.addEventListener("message", (ev) => {
      meta.lastSeen = Date.now();
      this.updatedAt = meta.lastSeen;
      this.startSweep();
      void this.onMessage(server, meta, ev.data);
    });
    server.addEventListener("close", () => {
      this.onClose(server, meta);
    });
    server.addEventListener("error", () => {
      this.onClose(server, meta);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private onClose(ws: WebSocket, meta: ConnMeta) {
    if (this.streamer?.ws === ws) {
      this.streamer = null;
    }

    if (meta.clientId) {
      this.viewers.delete(meta.clientId);
      this.pendingViewers.delete(meta.clientId);
    } else {
      for (const [id, v] of this.viewers) {
        if (v.ws === ws) this.viewers.delete(id);
      }
      for (const [id, v] of this.pendingViewers) {
        if (v.ws === ws) this.pendingViewers.delete(id);
      }
    }

    this.stopSweepIfIdle();
  }

  private parseJson(data: unknown): AnyControl | null {
    if (typeof data !== "string") return null;
    try {
      return JSON.parse(data) as AnyControl;
    } catch {
      return null;
    }
  }

  private parseFrameHeader(buf: ArrayBuffer): { seq: number; kind: number } | null {
    if (buf.byteLength < FRAME_HEADER_BYTES) return null;
    const bytes = new Uint8Array(buf);
    if (
      bytes[0] !== FRAME_MAGIC_0 ||
      bytes[1] !== FRAME_MAGIC_1 ||
      bytes[2] !== FRAME_VERSION ||
      bytes[3] !== FRAME_MSG_DISPLAY_SYSEX
    ) {
      return null;
    }
    const view = new DataView(buf);
    const seq = view.getUint32(4, false);
    const kind = bytes[8];
    const payloadLen = view.getUint16(9, false);
    const actualPayloadLen = buf.byteLength - FRAME_HEADER_BYTES;
    if (payloadLen !== 0 && payloadLen !== actualPayloadLen) return null;
    return { seq, kind };
  }

  private shouldDropForFps(now: number): boolean {
    this.recentFrameTimes = this.recentFrameTimes.filter(
      (t) => now - t <= FPS_WINDOW_MS,
    );
    if (this.recentFrameTimes.length >= MAX_FPS) return true;
    this.recentFrameTimes.push(now);
    return false;
  }

  private broadcastBinary(buf: ArrayBuffer) {
    for (const { ws } of this.viewers.values()) {
      try {
        ws.send(buf);
      } catch {
        // ignore
      }
    }
  }

  private broadcastJson(msg: AnyControl) {
    for (const { ws } of this.viewers.values()) {
      this.sendJson(ws, msg);
    }
  }

  private flushPendingOnOledFull(buf: ArrayBuffer) {
    if (this.pendingViewers.size === 0) return;
    for (const [id, v] of this.pendingViewers) {
      try {
        v.ws.send(buf);
        this.viewers.set(id, v);
      } catch {
        // ignore
      }
    }
    this.pendingViewers.clear();
  }

  private maybeUpdateActiveDisplay(next: RoomActiveDisplay, roomId: string, clientId: string) {
    if (this.activeDisplay === next) return;
    this.activeDisplay = next;
    this.broadcastJson({ t: "display:active", roomId, clientId, active: next });
  }

  private async onMessage(ws: WebSocket, meta: ConnMeta, data: unknown) {
    if (typeof data === "string") {
      const msg = this.parseJson(data);
      if (!msg) return;

      if (!msg.roomId || !msg.clientId) return;
      meta.clientId = msg.clientId;

      if (msg.t === "ping") return;
      if (msg.t === "bye") {
        ws.close(1000, "bye");
        return;
      }

      if (meta.role === "streamer") {
        if (msg.t === "streamer:hello") {
          const hello = msg as StreamerHello;

          if (this.streamer && this.streamer.ws !== ws) {
            this.err(ws, meta.roomId, hello.clientId, "room_has_streamer", "Room already has a streamer");
            return;
          }

          if (this.ownerKey && this.ownerKey !== hello.ownerKey) {
            this.err(
              ws,
              meta.roomId,
              hello.clientId,
              "room_owned_by_other_streamer",
              "Room is owned by another streamer",
            );
            return;
          }
          if (!this.ownerKey) this.ownerKey = hello.ownerKey;

          this.passwordToken = hello.passwordToken ?? null;
          this.streamer = { ws, meta, ownerKey: hello.ownerKey };

          this.ok(ws, meta.roomId, hello.clientId, "streamer");
          return;
        }

        if (!this.streamer || this.streamer.ws !== ws) return;

        if (msg.t === "display:active") {
          const da = msg as DisplayActive;
          this.maybeUpdateActiveDisplay(da.active, da.roomId, da.clientId);
          return;
        }

        return;
      }

      // Viewer role
      if (msg.t === "viewer:hello") {
        const hello = msg as ViewerHello;

        const viewerCount = this.viewers.size + this.pendingViewers.size;
        if (viewerCount >= VIEWER_CAP) {
          this.err(ws, meta.roomId, hello.clientId, "room_full", "Room is full");
          return;
        }

        if (this.passwordToken) {
          if (!hello.passwordToken) {
            this.err(
              ws,
              meta.roomId,
              hello.clientId,
              "password_required",
              "Password required",
            );
            return;
          }
          if (hello.passwordToken !== this.passwordToken) {
            this.err(ws, meta.roomId, hello.clientId, "bad_password", "Bad password");
            return;
          }
        }

        meta.authed = true;
        meta.clientId = hello.clientId;

        this.ok(ws, meta.roomId, hello.clientId, "viewer");

        const needsOledKeyframe =
          (this.activeDisplay ?? "oled") === "oled" && this.lastOledFull == null;
        if (needsOledKeyframe && this.streamer) {
          this.pendingViewers.set(hello.clientId, { ws, meta });
          this.sendJson(this.streamer.ws, {
            t: "streamer:request_full",
            roomId: meta.roomId,
            clientId: hello.clientId,
          });
          return;
        }

        // Send snapshots first, then add to broadcast set.
        if (this.lastOledFull) ws.send(this.lastOledFull);
        if (this.lastSeg7) ws.send(this.lastSeg7);
        this.viewers.set(hello.clientId, { ws, meta });
        return;
      }

      if (!meta.authed || !meta.clientId) return;

      if (msg.t === "viewer:request_full") {
        if (!this.streamer) return;
        this.sendJson(this.streamer.ws, {
          t: "streamer:request_full",
          roomId: meta.roomId,
          clientId: meta.clientId,
        });
      }

      return;
    }

    // Binary frames
    if (!(data instanceof ArrayBuffer)) return;
    if (!this.streamer || this.streamer.ws !== ws) return;

    if (data.byteLength > MAX_FRAME_BYTES) {
      ws.close(1009, "frame too large");
      return;
    }

    const header = this.parseFrameHeader(data);
    if (!header) return;

    const now = Date.now();
    if (this.shouldDropForFps(now)) return;

    if (header.seq <= this.lastSeq) return;
    this.lastSeq = header.seq;

    const shouldFlushPending = header.kind === FRAME_KIND_OLED_FULL;
    if (header.kind === FRAME_KIND_OLED_FULL) {
      this.lastOledFull = data;
      this.maybeUpdateActiveDisplay("oled", meta.roomId, meta.clientId ?? "streamer");
    } else if (header.kind === FRAME_KIND_SEG7) {
      this.lastSeg7 = data;
      this.maybeUpdateActiveDisplay("seg7", meta.roomId, meta.clientId ?? "streamer");
    } else if (header.kind === FRAME_KIND_OLED_DELTA) {
      this.maybeUpdateActiveDisplay("oled", meta.roomId, meta.clientId ?? "streamer");
    }

    this.broadcastBinary(data);
    if (shouldFlushPending) this.flushPendingOnOledFull(data);
  }
}
