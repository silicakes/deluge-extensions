import { normalizeRoomId } from "./roomCode";

function toHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  return Array.from(view, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function derivePasswordToken(
  roomId: string,
  password: string,
): Promise<string> {
  const normalizedRoomId = normalizeRoomId(roomId);
  const input = `DEx-screen-streaming:${normalizedRoomId}:${password}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return toHex(digest);
}
