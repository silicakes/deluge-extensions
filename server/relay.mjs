import http from "node:http";
import https from "node:https";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { Buffer } from "node:buffer";
import process from "node:process";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const VIEWER_CAP = 5;
const MAX_FRAME_BYTES = 256 * 1024;
const MAX_FPS = 60;
const FPS_WINDOW_MS = 1000;
const IDLE_TIMEOUT_MS = 45_000;
const SWEEP_MS = 15_000;

const FRAME_MAGIC_0 = 0x44; // 'D'
const FRAME_MAGIC_1 = 0x58; // 'X'
const FRAME_VERSION = 0x01;
const FRAME_MSG_DISPLAY_SYSEX = 0x01;
const FRAME_HEADER_BYTES = 11;

const FRAME_KIND_OLED_FULL = 0;
const FRAME_KIND_OLED_DELTA = 1;
const FRAME_KIND_SEG7 = 2;

function normalizeRoomId(input) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function parseArgs(argv) {
  const args = {
    host: "0.0.0.0",
    port: 8787,
    tlsCert: null,
    tlsKey: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--host") args.host = String(argv[++i]);
    else if (a === "--tls-cert") args.tlsCert = String(argv[++i]);
    else if (a === "--tls-key") args.tlsKey = String(argv[++i]);
  }
  if (!Number.isFinite(args.port) || args.port <= 0) {
    throw new Error("Invalid --port");
  }
  if ((args.tlsCert && !args.tlsKey) || (!args.tlsCert && args.tlsKey)) {
    throw new Error("Provide both --tls-cert and --tls-key");
  }
  return args;
}

function nowMs() {
  return Date.now();
}

function sha1Base64(input) {
  return createHash("sha1").update(input).digest("base64");
}

function writeHttpError(socket, status, message) {
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
}

function encodeServerFrame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | (opcode & 0x0f); // FIN + opcode
  return Buffer.concat([header, payload]);
}

class WsConn {
  constructor(socket, head) {
    this.socket = socket;
    this.closed = false;
    this.buffer = head?.length ? Buffer.from(head) : Buffer.alloc(0);
    this.fragmentOpcode = null;
    this.fragmentParts = [];
    this.onText = null;
    this.onBinary = null;
    this.onClose = null;

    socket.on("data", (chunk) => {
      if (this.closed) return;
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.process();
    });
    socket.on("close", () => this.handleClose());
    socket.on("end", () => this.handleClose());
    socket.on("error", () => this.handleClose());
  }

  handleClose() {
    if (this.closed) return;
    this.closed = true;
    if (this.onClose) this.onClose();
  }

  close(code = 1000, reason = "") {
    if (this.closed) return;
    const payload =
      code != null
        ? Buffer.concat([
            Buffer.from([(code >> 8) & 0xff, code & 0xff]),
            Buffer.from(String(reason ?? ""), "utf8"),
          ])
        : Buffer.alloc(0);
    try {
      this.socket.write(encodeServerFrame(0x8, payload));
    } catch {
      // ignore
    }
    try {
      this.socket.end();
    } catch {
      // ignore
    }
    this.handleClose();
  }

  sendText(text) {
    if (this.closed) return;
    const payload = Buffer.from(String(text), "utf8");
    this.socket.write(encodeServerFrame(0x1, payload));
  }

  sendBinary(buf) {
    if (this.closed) return;
    const payload = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    this.socket.write(encodeServerFrame(0x2, payload));
  }

  sendPong(payload) {
    if (this.closed) return;
    const p = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    this.socket.write(encodeServerFrame(0xa, p));
  }

  process() {
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;

      if (len === 126) {
        if (this.buffer.length < off + 2) return;
        len = this.buffer.readUInt16BE(off);
        off += 2;
      } else if (len === 127) {
        if (this.buffer.length < off + 8) return;
        const bigLen = this.buffer.readBigUInt64BE(off);
        if (bigLen > BigInt(Number.MAX_SAFE_INTEGER)) {
          this.close(1009, "payload too large");
          return;
        }
        len = Number(bigLen);
        off += 8;
      }

      if (!masked) {
        this.close(1002, "client frames must be masked");
        return;
      }
      if (this.buffer.length < off + 4 + len) return;

      const maskKey = this.buffer.subarray(off, off + 4);
      off += 4;
      const payload = this.buffer.subarray(off, off + len);
      off += len;

      // Advance buffer before unmasking payload.
      this.buffer = this.buffer.subarray(off);

      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskKey[i & 3];
      }

      this.handleFrame({ fin, opcode, payload });
    }
  }

  handleFrame(frame) {
    const { fin, opcode, payload } = frame;

    if (opcode === 0x8) {
      this.close(1000, "closed");
      return;
    }
    if (opcode === 0x9) {
      this.sendPong(payload);
      return;
    }
    if (opcode === 0xa) {
      return;
    }

    if (opcode === 0x0) {
      if (this.fragmentOpcode == null) {
        this.close(1002, "unexpected continuation");
        return;
      }
      this.fragmentParts.push(payload);
      if (!fin) return;

      const full = Buffer.concat(this.fragmentParts);
      const originalOpcode = this.fragmentOpcode;
      this.fragmentOpcode = null;
      this.fragmentParts = [];
      this.dispatchMessage(originalOpcode, full);
      return;
    }

    if (opcode !== 0x1 && opcode !== 0x2) {
      this.close(1003, "unsupported opcode");
      return;
    }

    if (!fin) {
      this.fragmentOpcode = opcode;
      this.fragmentParts = [payload];
      return;
    }

    this.dispatchMessage(opcode, payload);
  }

  dispatchMessage(opcode, payload) {
    if (opcode === 0x1) {
      const text = payload.toString("utf8");
      if (this.onText) this.onText(text);
      return;
    }
    if (opcode === 0x2) {
      if (this.onBinary) this.onBinary(payload);
    }
  }
}

class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.createdAt = nowMs();
    this.updatedAt = this.createdAt;

    this.ownerKey = null;
    this.passwordToken = null;

    this.streamer = null; // { conn, meta, ownerKey }
    this.viewers = new Map(); // clientId -> { conn, meta }
    this.pendingViewers = new Map(); // clientId -> { conn, meta }

    this.lastOledFull = null; // Buffer
    this.lastSeg7 = null; // Buffer
    this.lastSeq = 0;
    this.activeDisplay = null; // "oled" | "seg7"
    this.frameTimes = [];
  }

  state() {
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

  sendJson(conn, msg) {
    conn.sendText(JSON.stringify({ ...msg, ts: nowMs() }));
  }

  err(conn, clientId, code, msg) {
    this.sendJson(conn, { t: "err", roomId: this.roomId, clientId, code, msg });
    conn.close(4001, code);
  }

  ok(conn, clientId, role) {
    this.sendJson(conn, {
      t: "ok",
      roomId: this.roomId,
      clientId,
      role,
      roomState: this.state(),
    });
  }

  broadcastJson(msg) {
    for (const { conn } of this.viewers.values()) this.sendJson(conn, msg);
  }

  broadcastBinary(buf) {
    for (const { conn } of this.viewers.values()) conn.sendBinary(buf);
  }

  maybeSetActive(nextActive, clientId) {
    if (this.activeDisplay === nextActive) return;
    this.activeDisplay = nextActive;
    this.broadcastJson({
      t: "display:active",
      roomId: this.roomId,
      clientId,
      active: nextActive,
    });
  }

  shouldDropForFps(now) {
    this.frameTimes = this.frameTimes.filter((t) => now - t <= FPS_WINDOW_MS);
    if (this.frameTimes.length >= MAX_FPS) return true;
    this.frameTimes.push(now);
    return false;
  }

  attach(conn, meta) {
    conn.onClose = () => this.detach(conn, meta);
    conn.onText = (text) => this.handleText(conn, meta, text);
    conn.onBinary = (buf) => this.handleBinary(conn, meta, buf);
  }

  detach(conn, meta) {
    if (this.streamer?.conn === conn) this.streamer = null;

    if (meta.clientId) {
      this.viewers.delete(meta.clientId);
      this.pendingViewers.delete(meta.clientId);
    } else {
      for (const [id, v] of this.viewers) if (v.conn === conn) this.viewers.delete(id);
      for (const [id, v] of this.pendingViewers) if (v.conn === conn) this.pendingViewers.delete(id);
    }
  }

  handleText(conn, meta, text) {
    meta.lastSeen = nowMs();
    this.updatedAt = meta.lastSeen;

    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    if (typeof msg.t !== "string") return;
    if (typeof msg.roomId !== "string" || typeof msg.clientId !== "string") return;
    if (msg.roomId !== this.roomId) return;

    meta.clientId = msg.clientId;

    if (msg.t === "ping") return;
    if (msg.t === "bye") {
      conn.close(1000, "bye");
      return;
    }

    if (meta.role === "streamer") {
      if (msg.t === "streamer:hello") {
        const ownerKey = String(msg.ownerKey ?? "");
        const passwordToken = msg.passwordToken ? String(msg.passwordToken) : null;

        if (this.streamer && this.streamer.conn !== conn) {
          this.err(conn, msg.clientId, "room_has_streamer", "Room already has a streamer");
          return;
        }

        if (this.ownerKey && this.ownerKey !== ownerKey) {
          this.err(
            conn,
            msg.clientId,
            "room_owned_by_other_streamer",
            "Room is owned by another streamer",
          );
          return;
        }
        if (!this.ownerKey) this.ownerKey = ownerKey;

        this.passwordToken = passwordToken;
        this.streamer = { conn, meta, ownerKey };
        this.ok(conn, msg.clientId, "streamer");
        return;
      }

      if (!this.streamer || this.streamer.conn !== conn) return;

      if (msg.t === "display:active") {
        const active = msg.active === "seg7" ? "seg7" : "oled";
        this.maybeSetActive(active, msg.clientId);
      }
      return;
    }

    // Viewer
    if (msg.t === "viewer:hello") {
      const viewerCount = this.viewers.size + this.pendingViewers.size;
      if (viewerCount >= VIEWER_CAP) {
        this.err(conn, msg.clientId, "room_full", "Room is full");
        return;
      }

      const pass = msg.passwordToken ? String(msg.passwordToken) : null;
      if (this.passwordToken) {
        if (!pass) {
          this.err(conn, msg.clientId, "password_required", "Password required");
          return;
        }
        if (pass !== this.passwordToken) {
          this.err(conn, msg.clientId, "bad_password", "Bad password");
          return;
        }
      }

      meta.authed = true;
      meta.clientId = msg.clientId;

      this.ok(conn, msg.clientId, "viewer");

      const active = this.activeDisplay ?? "oled";
      const needsOledKeyframe = active === "oled" && this.lastOledFull == null;
      if (needsOledKeyframe) {
        this.pendingViewers.set(msg.clientId, { conn, meta });
        if (this.streamer) {
          this.sendJson(this.streamer.conn, {
            t: "streamer:request_full",
            roomId: this.roomId,
            clientId: msg.clientId,
          });
        }
        return;
      }

      if (this.lastOledFull) conn.sendBinary(this.lastOledFull);
      if (this.lastSeg7) conn.sendBinary(this.lastSeg7);
      this.viewers.set(msg.clientId, { conn, meta });
      return;
    }

    if (!meta.authed || !meta.clientId) return;

    if (msg.t === "viewer:request_full") {
      if (!this.streamer) return;
      this.sendJson(this.streamer.conn, {
        t: "streamer:request_full",
        roomId: this.roomId,
        clientId: meta.clientId,
      });
    }
  }

  parseFrameHeader(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < FRAME_HEADER_BYTES) return null;
    if (
      buf[0] !== FRAME_MAGIC_0 ||
      buf[1] !== FRAME_MAGIC_1 ||
      buf[2] !== FRAME_VERSION ||
      buf[3] !== FRAME_MSG_DISPLAY_SYSEX
    ) {
      return null;
    }
    const seq = buf.readUInt32BE(4);
    const kind = buf[8];
    const payloadLen = buf.readUInt16BE(9);
    const actual = buf.length - FRAME_HEADER_BYTES;
    if (payloadLen !== 0 && payloadLen !== actual) return null;
    return { seq, kind };
  }

  flushPendingOledFull(buf) {
    if (this.pendingViewers.size === 0) return;
    for (const [id, v] of this.pendingViewers) {
      v.conn.sendBinary(buf);
      this.viewers.set(id, v);
    }
    this.pendingViewers.clear();
  }

  handleBinary(conn, meta, buf) {
    meta.lastSeen = nowMs();
    this.updatedAt = meta.lastSeen;

    if (!this.streamer || this.streamer.conn !== conn) return;
    if (buf.length > MAX_FRAME_BYTES) {
      conn.close(1009, "frame too large");
      return;
    }

    const header = this.parseFrameHeader(buf);
    if (!header) return;

    const now = nowMs();
    if (this.shouldDropForFps(now)) return;

    if (header.seq <= this.lastSeq) return;
    this.lastSeq = header.seq;

    const shouldFlushPending = header.kind === FRAME_KIND_OLED_FULL;
    if (header.kind === FRAME_KIND_OLED_FULL) {
      this.lastOledFull = buf;
      this.maybeSetActive("oled", meta.clientId ?? "streamer");
    } else if (header.kind === FRAME_KIND_SEG7) {
      this.lastSeg7 = buf;
      this.maybeSetActive("seg7", meta.clientId ?? "streamer");
    } else if (header.kind === FRAME_KIND_OLED_DELTA) {
      this.maybeSetActive("oled", meta.clientId ?? "streamer");
    }

    this.broadcastBinary(buf);
    if (shouldFlushPending) this.flushPendingOledFull(buf);
  }
}

function parseRoomFromRequest(req) {
  const base = `http://${req.headers.host ?? "localhost"}`;
  const url = new URL(req.url ?? "/", base);
  const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
  if (!match) return null;

  const rawRoomId = decodeURIComponent(match[1] ?? "");
  const roomId = normalizeRoomId(rawRoomId);
  if (!roomId) return null;

  const role = url.searchParams.get("role");
  if (role !== "streamer" && role !== "viewer") return null;

  return { roomId, role };
}

function makeWsAccept(secKey) {
  return sha1Base64(`${secKey}${WS_GUID}`);
}

function isWebSocketUpgrade(req) {
  const up = req.headers.upgrade;
  return typeof up === "string" && up.toLowerCase() === "websocket";
}

function sweepRooms(rooms) {
  const now = nowMs();
  for (const [roomId, room] of rooms) {
    const maybeClose = (v) => {
      if (now - v.meta.lastSeen > IDLE_TIMEOUT_MS) v.conn.close(4000, "idle");
    };

    if (room.streamer) maybeClose(room.streamer);
    for (const v of room.viewers.values()) maybeClose(v);
    for (const v of room.pendingViewers.values()) maybeClose(v);

    const empty =
      room.streamer == null &&
      room.viewers.size === 0 &&
      room.pendingViewers.size === 0;
    if (empty) rooms.delete(roomId);
  }
}

const { host, port, tlsCert, tlsKey } = parseArgs(process.argv.slice(2));
const rooms = new Map();

const requestHandler = (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
};

const server =
  tlsCert && tlsKey
    ? https.createServer(
        {
          cert: fs.readFileSync(tlsCert),
          key: fs.readFileSync(tlsKey),
        },
        requestHandler,
      )
    : http.createServer(requestHandler);

server.on("upgrade", (req, socket, head) => {
  if (!isWebSocketUpgrade(req)) {
    writeHttpError(socket, 426, "Expected WebSocket upgrade");
    return;
  }

  const parsed = parseRoomFromRequest(req);
  if (!parsed) {
    writeHttpError(socket, 400, "Invalid room request");
    return;
  }

  const secKey = req.headers["sec-websocket-key"];
  if (typeof secKey !== "string" || !secKey) {
    writeHttpError(socket, 400, "Missing Sec-WebSocket-Key");
    return;
  }

  const accept = makeWsAccept(secKey);
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      "",
    ].join("\r\n"),
  );

  const conn = new WsConn(socket, head);
  const room = rooms.get(parsed.roomId) ?? new Room(parsed.roomId);
  rooms.set(parsed.roomId, room);

  const meta = {
    role: parsed.role,
    roomId: parsed.roomId,
    clientId: null,
    authed: false,
    lastSeen: nowMs(),
  };
  room.attach(conn, meta);
});

server.listen(port, host, () => {
  const proto = tlsCert && tlsKey ? "https" : "http";
  const wsProto = tlsCert && tlsKey ? "wss" : "ws";
  console.log(`[relay] listening on ${proto}://${host}:${port}`);
  console.log(
    `[relay] ws endpoint: ${wsProto}://${host}:${port}/api/rooms/:roomId/ws?role=...`,
  );
});

setInterval(() => sweepRooms(rooms), SWEEP_MS);
