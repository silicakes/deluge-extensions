import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  drawOled,
  drawOledDelta,
  draw7Seg,
  enterFullscreenScale,
  exitFullscreenScale,
  registerCanvas,
  resizeCanvas,
} from "@/lib/display";
import { displaySettings, fullscreenActive } from "@/state";
import type {
  AnyControlMsg,
  ErrMsg,
  OkMsg,
  RoomActiveDisplay,
  RoomState,
} from "@/lib/screenStreaming/control";
import { nowMs } from "@/lib/screenStreaming/control";
import { decodeDisplaySysexFrame, DisplaySysexKind } from "@/lib/screenStreaming/codec";
import { createClientId } from "@/lib/screenStreaming/ids";
import { derivePasswordToken } from "@/lib/screenStreaming/passwordToken";
import { buildRoomWsUrl } from "@/lib/screenStreaming/wsUrl";
import { FullscreenToggleButton } from "@/components/FullscreenToggleButton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { PixelSizeControls } from "@/components/PixelSizeControls";

type ConnectionStatus =
  | "connecting"
  | "awaiting_ok"
  | "connected"
  | "needs_password"
  | "error"
  | "closed";

function errToFriendlyMessage(err: ErrMsg): string {
  switch (err.code) {
    case "room_full":
      return "Room is full (max 5 viewers).";
    case "password_required":
      return "This room requires a password.";
    case "bad_password":
      return "Incorrect password.";
    case "room_has_streamer":
      return "This room already has an active streamer.";
    case "room_owned_by_other_streamer":
      return "This room is owned by another streamer.";
    default:
      return err.msg || "Unable to join room.";
  }
}

function leaveViewerMode() {
  const next = new URL(window.location.origin + window.location.pathname);
  window.location.assign(next.toString());
}

export function ViewerApp(props: { roomId: string }) {
  const clientId = useMemo(() => createClientId(), []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIdRef = useRef<number | null>(null);

  const hasOledFullRef = useRef(false);
  const lastSeqRef = useRef<number | null>(null);
  const activeDisplayRef = useRef<RoomActiveDisplay | null>(null);
  const endStateRef = useRef<ConnectionStatus | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [activeDisplay, setActiveDisplay] = useState<RoomActiveDisplay | null>(
    null,
  );
  const [lastErr, setLastErr] = useState<ErrMsg | null>(null);

  const [password, setPassword] = useState("");
  const [passwordToken, setPasswordToken] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [debugUnlocked, setDebugUnlocked] = useState(false);
  const tapCountRef = useRef(0);
  const tapResetIdRef = useRef<number | null>(null);

  // Register the canvas with display helpers on mount.
  useEffect(() => {
    if (canvasRef.current) registerCanvas(canvasRef.current);
  }, []);

  // Resize canvas when display settings change.
  useEffect(() => {
    if (canvasRef.current) resizeCanvas(canvasRef.current);
  }, [displaySettings.value]);

  // Handle fullscreen changes (mirror DisplayViewer behavior).
  useEffect(() => {
    if (!canvasRef.current) return;

    if (fullscreenActive.value) {
      enterFullscreenScale(canvasRef.current);
      document.body.classList.add("fullscreen-mode");
      if (containerRef.current) {
        containerRef.current.style.display = "block";
        containerRef.current.style.visibility = "visible";
        containerRef.current.style.opacity = "1";
      }
    } else {
      exitFullscreenScale(canvasRef.current);
      document.body.classList.remove("fullscreen-mode");
    }
  }, [fullscreenActive.value]);

  // Listen for display:resized events to sync wrapper dimensions.
  useEffect(() => {
    const handleDisplayResized = (e: CustomEvent) => {
      if (containerRef.current) {
        containerRef.current.style.width = `${e.detail.width}px`;
        containerRef.current.style.height = `${e.detail.height}px`;
      }
    };
    window.addEventListener(
      "display:resized",
      handleDisplayResized as EventListener,
      true,
    );
    return () => {
      window.removeEventListener(
        "display:resized",
        handleDisplayResized as EventListener,
        true,
      );
    };
  }, []);

  // WebSocket connect/reconnect (roomId, passwordToken).
  useEffect(() => {
    hasOledFullRef.current = false;
    lastSeqRef.current = null;
    endStateRef.current = null;
    activeDisplayRef.current = null;
    setActiveDisplay(null);
    setRoomState(null);

    const wsUrl = buildRoomWsUrl({ roomId: props.roomId, role: "viewer" });
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    socketRef.current = ws;
    setStatus("connecting");
    setLastErr(null);

    const stopPing = () => {
      if (pingIdRef.current != null) {
        clearInterval(pingIdRef.current);
        pingIdRef.current = null;
      }
    };

    const closeSocket = () => {
      stopPing();
      try {
        ws.close();
      } catch {
        // ignore
      }
    };

    const sendJson = (msg: AnyControlMsg) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ ...msg, ts: nowMs() }));
    };

    ws.onopen = () => {
      endStateRef.current = null;
      setStatus("awaiting_ok");
      sendJson({
        t: "viewer:hello",
        roomId: props.roomId,
        clientId,
        passwordToken: passwordToken ?? undefined,
      });

      pingIdRef.current = window.setInterval(() => {
        sendJson({ t: "ping", roomId: props.roomId, clientId });
      }, 15_000);
    };

    const handleControl = (msg: AnyControlMsg) => {
      if (msg.t === "ok") {
        const ok = msg as OkMsg;
        setRoomState(ok.roomState);
        activeDisplayRef.current = ok.roomState.active ?? null;
        setActiveDisplay(ok.roomState.active ?? null);
        setStatus("connected");
        return;
      }

      if (msg.t === "err") {
        const err = msg as ErrMsg;
        setLastErr(err);

        if (err.code === "password_required" || err.code === "bad_password") {
          endStateRef.current = "needs_password";
          setStatus("needs_password");
        } else {
          endStateRef.current = "error";
          setStatus("error");
        }

        closeSocket();
        return;
      }

      if (msg.t === "display:active") {
        activeDisplayRef.current = msg.active;
        setActiveDisplay(msg.active);
        return;
      }
    };

    const handleBinary = (buf: ArrayBuffer) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let frame;
      try {
        frame = decodeDisplaySysexFrame(buf);
      } catch {
        return;
      }

      if (lastSeqRef.current != null && frame.seq <= lastSeqRef.current) {
        return;
      }
      lastSeqRef.current = frame.seq;

      const activeNow = activeDisplayRef.current;
      if (
        frame.kind === DisplaySysexKind.OledFull ||
        frame.kind === DisplaySysexKind.OledDelta
      ) {
        if (activeNow && activeNow !== "oled") return;
      } else if (frame.kind === DisplaySysexKind.Seg7) {
        if (activeNow && activeNow !== "seg7") return;
      }

      if (frame.kind === DisplaySysexKind.OledFull) {
        hasOledFullRef.current = true;
        drawOled(canvas, frame.payload);
        activeDisplayRef.current = "oled";
        setActiveDisplay("oled");
      } else if (frame.kind === DisplaySysexKind.OledDelta) {
        if (!hasOledFullRef.current) return;
        drawOledDelta(canvas, frame.payload);
        activeDisplayRef.current = "oled";
        setActiveDisplay("oled");
      } else if (frame.kind === DisplaySysexKind.Seg7) {
        const data = frame.payload;
        if (data.length < 11) return;
        const dots = data[6];
        const digitsRaw = Array.from(data.subarray(7, 11));
        draw7Seg(canvas, digitsRaw, dots);
        activeDisplayRef.current = "seg7";
        setActiveDisplay("seg7");
      }
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (!parsed || typeof parsed !== "object") return;
        const msg = parsed as AnyControlMsg;
        if (typeof msg.t !== "string") return;
        handleControl(msg);
        return;
      }

      if (ev.data instanceof ArrayBuffer) {
        handleBinary(ev.data);
        return;
      }

      if (ev.data instanceof Blob) {
        void ev.data.arrayBuffer().then(handleBinary);
      }
    };

    ws.onclose = () => {
      stopPing();
      if (endStateRef.current) setStatus(endStateRef.current);
      else setStatus("closed");
    };

    ws.onerror = () => {
      stopPing();
      if (endStateRef.current) setStatus(endStateRef.current);
      else setStatus("error");
    };

    return () => {
      stopPing();
      socketRef.current = null;
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
  }, [props.roomId, passwordToken]);

  const requestKeyframe = () => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        t: "viewer:request_full",
        roomId: props.roomId,
        clientId,
        ts: nowMs(),
      }),
    );
  };

  const unlockDebugIfNeeded = () => {
    tapCountRef.current += 1;
    if (tapResetIdRef.current != null) {
      clearTimeout(tapResetIdRef.current);
      tapResetIdRef.current = null;
    }
    tapResetIdRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
      tapResetIdRef.current = null;
    }, 1500);
    if (tapCountRef.current >= 7) {
      tapCountRef.current = 0;
      setDebugUnlocked(true);
    }
  };

  const handleSubmitPassword = async () => {
    setPasswordBusy(true);
    try {
      const token = await derivePasswordToken(props.roomId, password);
      setPasswordToken(token);
      setLastErr(null);
      setStatus("connecting");
    } finally {
      setPasswordBusy(false);
    }
  };

  const showError = status === "error" || status === "closed";
  const showPasswordPrompt = status === "needs_password";

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="w-full px-4 py-2 flex items-center bg-[var(--color-bg-offset)] shadow-sm border-b border-[var(--color-border)] sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <img
            src="/DEx-logo.png"
            alt="DEx Logo"
            className="h-8 w-auto md:h-10"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Viewer mode</span>
            <button
              type="button"
              className="text-xs font-mono text-[var(--color-text-muted)] hover:underline text-left"
              onClick={unlockDebugIfNeeded}
              title="Room code"
            >
              {props.roomId}
            </button>
          </div>
        </div>

        <div className="flex-1" />

        {!fullscreenActive.value && (
          <div className="flex items-center gap-2">
            <FullscreenToggleButton />
            <ThemeSwitcher />
            <button
              type="button"
              onClick={leaveViewerMode}
              className="text-sm px-3 py-1.5 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
            >
              Exit
            </button>
          </div>
        )}
      </header>

      {!fullscreenActive.value && (
        <div className="w-full max-w-screen-lg mx-auto px-4 mt-3">
          <PixelSizeControls />
        </div>
      )}

      <div className="w-full flex justify-center my-6">
        <div
          id="display-wrapper"
          ref={containerRef}
          className="screen-container inline-block p-0 transition-all relative"
          style={{ visibility: "visible", opacity: 1 }}
        >
          <canvas
            ref={canvasRef}
            className="image-rendering-pixelated border block"
            data-testid="viewer-display"
          />
        </div>
      </div>

      <main className="p-4 max-w-screen-lg mx-auto space-y-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-offset)] p-3">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="text-sm">
              <span className="font-semibold">Status:</span>{" "}
              <span className="font-mono">{status}</span>
            </div>
            <div className="text-sm">
              <span className="font-semibold">Active:</span>{" "}
              <span className="font-mono">{activeDisplay ?? "unknown"}</span>
            </div>
            <div className="text-sm">
              <span className="font-semibold">Viewers:</span>{" "}
              <span className="font-mono">
                {roomState ? `${roomState.viewers}/${roomState.viewerCap}` : "—"}
              </span>
            </div>
          </div>

          {showPasswordPrompt && (
            <div className="mt-3 space-y-2">
              <div className="text-sm text-[var(--color-text-muted)]">
                {lastErr ? errToFriendlyMessage(lastErr) : "Password required."}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="password"
                  value={password}
                  onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                  className="px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]"
                  placeholder="Room password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={handleSubmitPassword}
                  disabled={passwordBusy || !password}
                  className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
                >
                  Join
                </button>
              </div>
            </div>
          )}

          {showError && lastErr && (
            <div className="mt-3 text-sm text-red-600">
              {errToFriendlyMessage(lastErr)}
            </div>
          )}

          {debugUnlocked && !fullscreenActive.value && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Debug
              </div>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={requestKeyframe}
                  className="px-3 py-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
                >
                  Request keyframe
                </button>
                <div className="text-xs font-mono text-[var(--color-text-muted)]">
                  lastSeq={lastSeqRef.current ?? "—"}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
