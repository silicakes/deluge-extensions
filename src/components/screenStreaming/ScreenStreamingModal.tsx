import { useEffect, useMemo, useState } from "preact/hooks";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { midiIn, midiOut } from "@/state";
import { createRoomId, normalizeRoomId } from "@/lib/screenStreaming/roomCode";
import { derivePasswordToken } from "@/lib/screenStreaming/passwordToken";
import type { ErrMsg } from "@/lib/screenStreaming/control";
import {
  refreshStreamedDisplay,
  screenStreamerError,
  screenStreamerRoomId,
  screenStreamerRoomState,
  screenStreamerStatus,
  startScreenStreaming,
  stopScreenStreaming,
} from "@/services/screenStreamingStreamer";
import { QrCodeSvg } from "./QrCodeSvg";

function buildViewerUrl(roomId: string): string {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("roomId", roomId);
  return url.toString();
}

function friendlyStreamerError(err: ErrMsg): string {
  if (err.code === "room_has_streamer") return "Room already has a streamer.";
  if (err.code === "room_owned_by_other_streamer")
    return "Room is owned by another streamer.";
  return err.msg || "Unable to start streaming.";
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function ScreenStreamingModal(props: { onClose: () => void }) {
  const status = screenStreamerStatus.value;
  const activeRoomId = screenStreamerRoomId.value;
  const roomState = screenStreamerRoomState.value;
  const err = screenStreamerError.value;

  const [draftRoomId, setDraftRoomId] = useState(() => createRoomId());
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const effectiveRoomId = status === "idle" ? draftRoomId : activeRoomId;
  const joinUrl = useMemo(
    () => (effectiveRoomId ? buildViewerUrl(effectiveRoomId) : null),
    [effectiveRoomId],
  );

  useEffect(() => {
    if (copied == null) return;
    const id = window.setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const canStart = status === "idle" && !!midiOut.value && !!midiIn.value;
  const canStop = status !== "idle";

  const regenerateRoom = () => setDraftRoomId(createRoomId());

  const start = async () => {
    if (!draftRoomId) return;
    if (!midiOut.value || !midiIn.value) return;

    const normalizedRoomId = normalizeRoomId(draftRoomId);
    if (!normalizedRoomId) return;
    setDraftRoomId(normalizedRoomId);

    setBusy(true);
    try {
      const passwordToken = requirePassword
        ? await derivePasswordToken(normalizedRoomId, password)
        : undefined;
      startScreenStreaming({ roomId: normalizedRoomId, passwordToken });
      setPassword("");
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const stop = () => {
    stopScreenStreaming();
  };

  const copyJoinUrl = async () => {
    if (!joinUrl) return;
    await copyText(joinUrl);
    setCopied("link");
  };

  const copyRoomCode = async () => {
    if (!effectiveRoomId) return;
    await copyText(effectiveRoomId);
    setCopied("room");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Screen streaming"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-offset)] text-[var(--color-text)] shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div>
            <div className="text-lg font-semibold">Screen streaming</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              One-way room (max 5 viewers)
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="p-2 rounded-md hover:bg-[var(--color-bg-hover)]"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {(!midiOut.value || !midiIn.value) && (
            <div className="text-sm text-[var(--color-text-muted)]">
              Select a Deluge MIDI device to start streaming.
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-semibold">Room</div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={effectiveRoomId ?? ""}
                onInput={(e) => setDraftRoomId((e.target as HTMLInputElement).value)}
                disabled={status !== "idle"}
                className="flex-1 min-w-[16rem] px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] font-mono text-sm"
              />
              <button
                type="button"
                onClick={copyRoomCode}
                disabled={!effectiveRoomId}
                className="px-3 py-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] text-sm"
              >
                {copied === "room" ? "Copied" : "Copy"}
              </button>
              {status === "idle" && (
                <button
                  type="button"
                  onClick={regenerateRoom}
                  className="px-3 py-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] text-sm"
                >
                  Regenerate
                </button>
              )}
            </div>
          </div>

          {status === "idle" && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requirePassword}
                  onChange={(e) =>
                    setRequirePassword((e.target as HTMLInputElement).checked)
                  }
                />
                Require password (optional)
              </label>
              {requirePassword && (
                <input
                  type="password"
                  value={password}
                  onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                  className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]"
                  placeholder="Room password"
                  autoComplete="new-password"
                />
              )}
              <div className="text-xs text-[var(--color-text-muted)]">
                Password is hashed (token) before sending.
              </div>
            </div>
          )}

          {joinUrl && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">Join URL</div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  value={joinUrl}
                  readOnly
                  className="flex-1 min-w-[16rem] px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={copyJoinUrl}
                  className="px-3 py-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] text-sm"
                >
                  {copied === "link" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex justify-center">
                <QrCodeSvg
                  text={joinUrl}
                  className="w-48 h-48 rounded-lg border border-[var(--color-border)] bg-white p-2"
                  title="Join room QR"
                />
              </div>
            </div>
          )}

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="text-sm">
                <span className="font-semibold">Status:</span>{" "}
                <span className="font-mono">{status}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Viewers:</span>{" "}
                <span className="font-mono">
                  {roomState ? `${roomState.viewers}/${roomState.viewerCap}` : "—"}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Requires password:</span>{" "}
                <span className="font-mono">
                  {roomState?.requiresPassword ? "yes" : "no"}
                </span>
              </div>
            </div>

            {err && (
              <div className="mt-2 text-sm text-red-600">
                {friendlyStreamerError(err)}
              </div>
            )}

            {status === "streaming" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={refreshStreamedDisplay}
                  className="px-3 py-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] text-sm"
                >
                  Refresh display
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--color-border)] flex justify-between gap-2">
          <button
            type="button"
            onClick={stop}
            disabled={!canStop}
            className="px-3 py-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] text-sm disabled:opacity-50"
          >
            Stop
          </button>
          <button
            type="button"
            onClick={start}
            disabled={!canStart || busy || (requirePassword && !password)}
            className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            Start streaming
          </button>
        </div>
      </div>
    </div>
  );
}
