import { BIP39_ENGLISH_WORDS_2048 } from "./bip39English2048";

export const DEFAULT_ROOM_WORD_COUNT = 4;

export function normalizeRoomId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function createRoomId(
  wordCount: number = DEFAULT_ROOM_WORD_COUNT,
): string {
  if (!Number.isInteger(wordCount) || wordCount < 1 || wordCount > 8) {
    throw new Error("wordCount must be an integer between 1 and 8");
  }

  const rands = new Uint32Array(wordCount);
  crypto.getRandomValues(rands);
  const words = Array.from(rands, (n) => BIP39_ENGLISH_WORDS_2048[n & 2047]);
  return words.join("-");
}
