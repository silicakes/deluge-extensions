## Goal

Add “Screen Streaming” to DEx in a way that matches how DEx actually works today:

- **Streamer** (Chrome/Edge on desktop or Android): runs normal DEx, connects to the Deluge via WebMIDI, and relays *only* the Deluge display state over the network.
- **Viewer** (iOS Safari / any browser): runs a lightweight DEx “viewer mode” that does **not** use WebMIDI; it just joins a room and renders the incoming display state to a canvas.
- Transport: **WebSocket signaling + WebSocket data relay** via **Cloudflare Worker + Durable Object (DO)**.
- Optional later: upgrade to WebRTC DataChannel; keep room/auth concepts and the same on-wire frame format where possible.

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

Provide a Node-based relay server that speaks the same protocol:

- `/api/rooms/:roomId/ws?role=...`
- Same hello/control + same binary `DISPLAY_SYSEX` envelope

Frontend config:

- `STREAM_HOST=wss://...` (env var at build time) or query param override.
  - Frontend (Vite): use `VITE_STREAM_HOST=wss://...`
  - Runtime override: `?streamHost=wss://...`

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
