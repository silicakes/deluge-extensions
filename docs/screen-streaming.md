# Screen Streaming

This document covers:

- How to use screen streaming (streamer + viewer)
- Local development / LAN testing (local relay)
- Remote deployment (Cloudflare Pages + Durable Objects)
- Protocol + architecture notes

## Goal

Add “Screen Streaming” to DEx in a way that matches how DEx actually works today:

- **Streamer** (Chrome/Edge on desktop or Android): runs normal DEx, connects to the Deluge via WebMIDI, and relays *only* the Deluge display state over the network.
- **Viewer** (iOS Safari / any browser): runs a lightweight DEx “viewer mode” that does **not** use WebMIDI; it just joins a room and renders the incoming display state to a canvas.
- Transport: **WebSocket signaling + WebSocket data relay** via **Cloudflare Worker + Durable Object (DO)**.
- Optional later: upgrade to WebRTC DataChannel; keep room/auth concepts and the same on-wire frame format where possible.

---

## Using screen streaming

### Streamer (Deluge connected)

1. Open DEx in a WebMIDI-capable browser (Chrome/Edge) and connect your Deluge.
2. Click **Screen streaming** in the header.
3. Choose a room code (diceware-style words) and optionally enable a password.
4. Click **Start streaming**.
5. Share the **Join URL** or QR code with viewers.
6. Use **Refresh display** if you want to force a keyframe.

Notes:

- Rooms are one-way: only the creator streams.
- Viewer cap is 5.

### Viewer (no Deluge needed)

1. Open the Join URL (works on iOS Safari and any modern browser).
2. If prompted, enter the room password.
3. Only the *active* Deluge display is rendered (OLED vs 7-seg).

Debug (hidden):

- Tap the room code 7× to reveal a **Request keyframe** button (sends `viewer:request_full`).

Fullscreen / keep-awake:

- Fullscreen can be toggled via the UI or the `f` shortcut (external keyboard).
- On browsers that support the Screen Wake Lock API, DEx requests a wake lock while fullscreen is active to reduce screen sleep.

---

## Remote deployment (Cloudflare Pages)

The default deployment expects the relay to be available on the same origin as the SPA:

```
wss://<your-dex-domain>/api/rooms/<roomId>/ws?role=...
```

This repo implements the relay as a Pages “advanced worker” in `functions/_worker.ts`.

### Setup

In your Cloudflare Pages project (Settings → Functions → Durable Objects):

1. Deploy the site normally (Pages will pick up `functions/_worker.ts` automatically).
2. Add a Durable Object binding:
   - binding name: `ROOMS`
   - class name: `RoomDurableObject`
   - create/select a DO namespace for the room instances
   - apply to Preview and Production environments as needed
3. Redeploy.

### Verify

- `https://<your-dex-domain>/api/health` returns `ok`
- Starting a stream connects to `wss://<your-dex-domain>/api/rooms/.../ws?role=streamer`

### Alternative: deploy relay separately

You can also deploy the relay as a standalone Worker (see `worker/wrangler.toml`) and point the frontend at it:

- build-time: `VITE_STREAM_HOST=wss://<relay-host>`
- runtime: `?streamHost=wss://<relay-host>`

---

## Reality check: what DEx already does (and what we should reuse)

DEx already has a complete “Deluge display pipeline”:

- WebMIDI input subscription and fanout: `src/lib/webMidi.ts`
- Display message parsing/decoding and rendering:
  - OLED is currently **128×48** in DEx.
  - OLED device payload is a packed **7-to-8 RLE** format; `src/lib/display.ts` already unpacks it.
  - OLED updates can be “full” or “delta”; DEx already applies deltas and maintains a framebuffer.
  - 7-seg rendering is already implemented in `src/lib/display.ts` via `draw7Seg(...)` / `render7Seg(...)`.
- Display refresh cadence is currently driven by polling (default `pollingMs = 1000` in `src/lib/display.ts`), so “fps” is not 60 by default. Streaming should mirror the *actual* update cadence unless we intentionally increase polling.

Streaming should **not** invent a new display decoder, and it must **not** relay unrelated SysEx traffic (file browser / smSysex JSON / debug).

---

## High-level architecture

- DEx frontend remains a static SPA (Cloudflare Pages).
- A Worker + DO provides:
  - Exactly one active streamer per room (no takeovers)
  - Up to 5 viewers per room
  - Last-known “screen snapshot” for instant join (in-memory only)
  - Heartbeats + cleanup

Key integration point on the frontend:

- The streamer side subscribes to **incoming display updates** (the same place that currently drives `DisplayViewer`) and publishes them to the room WS.
- The viewer side renders incoming frames using existing display helpers.

---

## What exactly are we streaming?

We only need to mirror the Deluge’s display state, but we should **not** bake display assumptions (frame size, encoding, future firmware changes) into the streaming protocol.

Recommended approach:

- Stream the **raw Deluge display SysEx payloads** that DEx already receives:
  - OLED “full frame” SysEx message
  - OLED “delta” SysEx message
  - 7-seg SysEx message
- On **viewer join**, send a **full frame first** (keyframe), then continue with deltas.
  - This keeps the viewer’s OLED state correct without re-encoding a framebuffer.

We do **not** stream:

- MIDI device selection / WebMIDI details
- Debug log, file browser, or any other SysEx traffic

---

## Message protocol (WS JSON control + WS binary frames)

### Control messages (JSON)

All JSON messages include:

```ts
type Base = { t: string; roomId: string; clientId: string; ts?: number };
```

Streamer → DO:

```ts
type StreamerHello = Base & {
  t: "streamer:hello";
  // Room password is opt-in: if provided, viewers must also provide it to join.
  // The streamer should send a derived token, not the plaintext password.
  passwordToken?: string;
  // Stream ownership token (not shared) to enforce "creator-only streaming".
  // Generated once client-side and persisted (e.g. localStorage) for reconnects.
  ownerKey: string;
  meta?: { device?: string; appVersion?: string; pollingMs?: number };
};
type Ping = Base & { t: "ping" };
type Bye = Base & { t: "bye" };
type DisplayActive = Base & { t: "display:active"; active: "oled" | "seg7" };
```

Viewer → DO:

```ts
type ViewerHello = Base & { t: "viewer:hello"; passwordToken?: string };
```

DO → clients:

```ts
type Ok = Base & { t: "ok"; role: "streamer" | "viewer"; roomState: RoomState };
type Err = Base & { t: "err"; code: string; msg: string };
type RoomState = {
  hasStreamer: boolean;
  viewers: number;
  viewerCap: number;
  lastSeq?: number;
  active?: "oled" | "seg7";
  requiresPassword: boolean;
};
type ViewerCount = Base & { t: "room:viewers"; viewers: number };
type StreamerStatus = Base & { t: "room:streamer"; status: "online" | "offline" };
type RequestFull = Base & {
  t: "streamer:request_full";
  screen: "oled" | "seg7" | "both";
};
```

### Frame messages (binary)

We keep a small binary envelope and treat the payload as **opaque bytes**. The protocol is **pass-through display SysEx** (full on join, then deltas), not a re-encoded framebuffer.

#### Binary envelope

```
bytes:
0..1   magic "DX"  (0x44, 0x58)
2      version     (0x01)
3      msgType     (0x01 = DISPLAY_SYSEX)
4..7   seq         (uint32 BE)
8      kind        (0=OLED_FULL, 1=OLED_DELTA, 2=SEG7)
9..10  payloadLen  (uint16 BE)  // optional; WS frame length can be used instead
11..   payload     // raw SysEx bytes (starts with 0xF0, ends with 0xF7)
```

#### Payload

- Payload is the **exact SysEx message bytes** DEx received from the Deluge for that display update.
- Viewer rendering should reuse the same logic as `DisplayViewer`:
  - For `OLED_FULL`: call `drawOled(canvas, sysexBytes)`
  - For `OLED_DELTA`: call `drawOledDelta(canvas, sysexBytes)`
  - For `SEG7`: extract digits/dots exactly as `DisplayViewer` already does (or implement a `draw7SegFromSysex` helper)

Notes:

- WS is reliable and ordered; OLED deltas will apply correctly as long as the viewer receives a full frame first.
- DO and streamer should ensure “keyframe first” semantics for new viewers.

---

## Durable Object behavior

### Room state

- `streamer: WebSocket | null`
- `viewers: Map<clientId, WebSocket>`
- `lastOledFull: ArrayBuffer | null` (last `DISPLAY_SYSEX` frame with `kind=OLED_FULL`)
- `lastSeg7: ArrayBuffer | null` (last `DISPLAY_SYSEX` frame with `kind=SEG7`)
- `lastSeq: number`
- `activeDisplay: "oled" | "seg7"` (defaults to what the streamer last reported / what last arrived)
- `viewerCap: 5`
- `passwordToken: string | null` (room password is opt-in; store token only, never plaintext)
- `ownerKey: string | null` (creator-only streaming)
- `createdAt`, `updatedAt`

### Relay rules

- Only accept binary `DISPLAY_SYSEX` frames from the streamer connection.
- Drop frames that exceed a **very generous hard maximum** (e.g. 256KB) as an abuse guardrail (and treat it as a protocol violation).
- Enforce a sustained frame-rate limit:
  - If the streamer exceeds **60 frames within any rolling 1 second window**, start dropping frames until the rate returns below the threshold.
- Enforce monotonic `seq` (drop old/out-of-order).
- Store:
  - `OLED_FULL` → `lastOledFull`
  - `SEG7` → `lastSeg7`
- **Join ordering matters:** a viewer must receive `lastOledFull` before any `OLED_DELTA` frames.
  - Easiest: on `viewer:hello`, send snapshots first, then add the viewer to the broadcast set.
- If `lastOledFull` is missing when a viewer joins:
  - DO should send `streamer:request_full` to the streamer and keep the viewer pending until a keyframe arrives (or timeout with an error).

### Connection / role rules (no takeovers)

- Streamer:
  - If a streamer is already connected, reject new `role=streamer` connections (`err code="room_has_streamer"`).
  - If `ownerKey` is already set for the room and the incoming streamer’s `ownerKey` does not match, reject (`err code="room_owned_by_other_streamer"`).
  - If this is the first streamer ever for the room, set `ownerKey` from `streamer:hello`.
- Viewer:
  - Enforce viewer cap = 5. If full, respond with `err code="room_full"` and close the WS.
  - If the room has a password, require `passwordToken` to match; otherwise respond with:
    - `err code="password_required"` when missing
    - `err code="bad_password"` when provided but incorrect
  - Viewers are never allowed to upgrade to streamer; the only way to stream is `role=streamer` (and will be rejected by the above rules).

### Heartbeats

- Clients send JSON `ping` every 10–15s.
- DO closes idle connections after 45s and cleans up empty rooms.

---

## Frontend integration (DEx)

### Routing / “Viewer mode”

DEx currently has no router. We can avoid adding any routing dependencies by using a **query parameter** to enter viewer mode.

- Keep the existing “full app” at `/`.
- Add a lightweight viewer mode via URL like: `/?roomId=<roomId>`
- Implement mode selection in `src/main.tsx`:
  - If `roomId` exists in `window.location.search`, render `<ViewerApp roomId="..." />`
  - Else render existing `<App />`

Viewer mode should:

- Not call `initMidi(...)` or auto-connect
- Not render SysEx console, file browser, or any hardware actions
- Render: canvas + fullscreen + optional pixel scale controls

### Streamer flow

- UI action: “Start streaming”
  - Visible only when WebMIDI is available and a MIDI output is selected.
  - If the user is not already polling the display, show a prompt (“Enable display polling to stream”) or offer a one-click enable.
  - Optional: “Require password” toggle that forces viewers to enter a password before they can view.
- Connect:
  - `ws = new WebSocket(${STREAM_HOST}/api/rooms/${roomId}/ws?role=streamer)`
  - Send `streamer:hello` (include DEx version + current pollingMs)
- Emit frames:
  - Subscribe to display updates at the same layer that already receives them.
  - Preferred implementation: stream **pass-through display SysEx**:
    - When an OLED full frame SysEx is received → send `kind=OLED_FULL` with raw SysEx bytes
    - When an OLED delta SysEx is received → send `kind=OLED_DELTA` with raw SysEx bytes
    - When a 7SEG SysEx is received → send `kind=SEG7` with raw SysEx bytes
  - Throttle/suppress duplicates so you don’t spam identical frames.
  - Ensure a keyframe exists:
    - Immediately after `streamer:hello` succeeds, request a forced full OLED frame so the first frame a viewer sees after joining is a full frame.
- UI:
  - Show join URL for viewers (copy button)
  - Show QR code for the join URL (no router needed)
    - Example viewer URL: `https://dex.yourdomain/?roomId=<roomId>`
  - Include a visible “Refresh display” button that forces a full OLED frame (sends a keyframe).

### Viewer flow

- Open the join URL (e.g. via QR): `/?roomId=<roomId>`
- Connect:
  - `ws = new WebSocket(${STREAM_HOST}/api/rooms/${roomId}/ws?role=viewer)`
  - Send `viewer:hello` (include `passwordToken` if prompted)
- On `DISPLAY_SYSEX` frames:
  - Decode header, extract the raw SysEx bytes, and render using the same code paths as `DisplayViewer`.
- Hidden debug option:
  - Provide a non-obvious UI affordance to request a keyframe (for debugging/resync), e.g.:
    - Tap the room code 7 times to reveal “Debug” controls.
    - Debug control: “Request keyframe” (OLED full) which triggers `streamer:request_full` to the streamer.

---

## Security / Abuse Controls

- Room IDs: **Diceware-style room codes** (2048-word list, normalized to `lowercase-hyphens`)
  - Recommend 4 words (≈ 44 bits of entropy): easy to speak + hard to guess online.
  - Example: `cactus-echo-lantern-saffron`
  - Always normalize input (case-insensitive; collapse whitespace; convert to hyphens).
- Viewer cap: 5 viewers per room (show a friendly “Room is full” message)
- Payload caps: avoid small “expected size” limits; only enforce a **very generous hard maximum** (e.g. 256KB) as an abuse guardrail, not as a protocol assumption
- Frame rate cap: drop if streamer exceeds **60fps sustained for 1s** (rolling window)
- Optional password (opt-in):
  - Streamer can require a password; viewers must supply it to join.
  - Implement via `passwordToken = SHA-256("DEx-screen-streaming:" + roomId + ":" + password)` (or equivalent) so the password itself is never sent/stored.

---

## Local relay (alternative deployment)

Provide a local Node-based relay server that speaks the same protocol (no persistence, in-memory rooms):

- `/api/rooms/:roomId/ws?role=...`
- Same hello/control + same binary `DISPLAY_SYSEX` envelope

Run:

```sh
node server.mjs
```

If your frontend is served over HTTPS (hosted DEx / installed PWA), browsers will require `wss://` (TLS). The relay supports TLS via Node built-ins:

```sh
node server/relay.mjs --host 0.0.0.0 --port 8787 --tls-cert ./cert.pem --tls-key ./key.pem
```

Local dev flow (LAN testing):

1. Start the relay: `node server.mjs` (default port `8787`)
2. Start the client: `yarn dev --host`
3. In the streamer UI, keep the room as `local-local` (stable dev room) and set **Share base URL** to `http://<lan-ip>:5173` so the QR/link works on mobile.
4. On mobile (same network), open the Join URL shown in the modal, e.g.:
   - `http://<lan-ip>:5173/?roomId=local-local`
   - or `http://<lan-ip>:5173/roomId=local-local`
5. DEx will connect to the relay at `ws(s)://<lan-ip>:8787` by default on local hostnames (no extra query params needed).

If you need a secure context on mobile (e.g. to test APIs that require HTTPS), serve the frontend over HTTPS and run the relay with TLS so it’s reachable as `wss://<lan-ip>:8787`.

Then point the frontend at it:

- Build-time: `VITE_STREAM_HOST=ws://<relay-host>:8787`
- Runtime: `?streamHost=ws://<relay-host>:8787`

Frontend config:

- Build-time: `VITE_STREAM_HOST=wss://...`
- Runtime override: `?streamHost=wss://...`

Note: if you start DEx with `?streamHost=...`, the streaming UI’s Join URL / QR will include the same `streamHost` (unless you override the Share base URL).

---

## Acceptance criteria (aligned with DEx behavior)

- Viewer on iOS Safari can see updates with low latency relative to streamer (network overhead should be negligible compared to polling cadence).
- Joining mid-stream shows the current screen within 1s (keyframe-first, then deltas).
- Viewer mode does not require WebMIDI and does not show hardware-only UI.
- Viewers cannot become streamers (single-streamer room, no takeovers).
- Room enforces viewer cap (5) with a friendly “Room is full” message.
- Streaming never relays non-display SysEx traffic.
- Rooms clean up when streamer disconnects and no viewers remain.

---

## Implementation plan

1. Add Diceware room-code generator + UI (generate/regenerate/copy), and build join URLs using `?roomId=...`.
2. Add optional room password UI and implement `passwordToken` derivation (streamer sets it; viewer prompts for it).
3. Implement viewer mode entry in `src/main.tsx` based on `roomId` query param and build the viewer-only UI (active display only).
4. Implement Worker + DO room relay with:
   - single-streamer enforcement (`room_has_streamer`, `room_owned_by_other_streamer`)
   - viewer cap = 5 (`room_full`)
   - password enforcement (`password_required`, `bad_password`)
   - keyframe-first join semantics (`lastOledFull`, `streamer:request_full`)
   - sustained >60fps drop policy (rolling 1s window)
5. Integrate streamer-side frame emission:
   - pass-through OLED full + delta + 7SEG SysEx frames only
   - immediately force a full OLED frame after streamer connects
   - add a visible “Refresh display” button to send a keyframe
6. Add viewer-side hidden debug “Request keyframe” control.
7. Add tests (codec encode/decode, DO room rules, viewer cap/password errors, keyframe ordering).
