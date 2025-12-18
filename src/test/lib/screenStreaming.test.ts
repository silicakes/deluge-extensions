import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  BIP39_ENGLISH_WORDS_2048,
  createRoomId,
  decodeDisplaySysexFrame,
  DisplaySysexKind,
  encodeDisplaySysexFrame,
  normalizeRoomId,
  derivePasswordToken,
  buildRoomWsUrl,
} from "@/lib/screenStreaming";

describe("screen streaming utilities", () => {
  describe("room codes", () => {
    it("includes a 2048-word list", () => {
      expect(BIP39_ENGLISH_WORDS_2048).toHaveLength(2048);
      expect(new Set(BIP39_ENGLISH_WORDS_2048).size).toBe(2048);
    });

    it("normalizes room ids", () => {
      expect(normalizeRoomId("  CACTUS Echo  lantern_saffron  ")).toBe(
        "cactus-echo-lantern-saffron",
      );
      expect(normalizeRoomId("__Hello---World__")).toBe("hello-world");
      expect(normalizeRoomId("")).toBe("");
      expect(normalizeRoomId("   ")).toBe("");
    });

    it("creates deterministic room id with mocked RNG", () => {
      const spy = vi
        .spyOn(crypto, "getRandomValues")
        .mockImplementation((arr) => {
          const view = arr as Uint32Array;
          view[0] = 0;
          view[1] = 1;
          view[2] = 2;
          view[3] = 3;
          return arr;
        });
      expect(createRoomId(4)).toBe("abandon-ability-able-about");
      spy.mockRestore();
    });
  });

  describe("password token", () => {
    it("derives sha256 token from roomId and password", async () => {
      const roomId = "Cactus Echo";
      const password = "correct horse battery staple";
      const normalizedRoomId = normalizeRoomId(roomId);
      const expected = createHash("sha256")
        .update(`DEx-screen-streaming:${normalizedRoomId}:${password}`)
        .digest("hex");
      await expect(derivePasswordToken(roomId, password)).resolves.toBe(expected);
    });
  });

  describe("binary frame codec", () => {
    it("round-trips a DISPLAY_SYSEX frame", () => {
      const payload = Uint8Array.from([0xf0, 0x7d, 0x02, 0x40, 0x01, 0xf7]);
      const encoded = encodeDisplaySysexFrame({
        seq: 123,
        kind: DisplaySysexKind.OledFull,
        payload,
      });
      const decoded = decodeDisplaySysexFrame(encoded);
      expect(decoded.seq).toBe(123);
      expect(decoded.kind).toBe(DisplaySysexKind.OledFull);
      expect(Array.from(decoded.payload)).toEqual(Array.from(payload));
    });

    it("rejects payload length mismatch", () => {
      const payload = Uint8Array.from([0xf0, 0x7d, 0x02, 0x41, 0x00, 0xf7]);
      const encoded = encodeDisplaySysexFrame({
        seq: 1,
        kind: DisplaySysexKind.Seg7,
        payload,
      });
      const view = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength);
      view.setUint16(9, payload.length + 1, false);
      expect(() => decodeDisplaySysexFrame(encoded)).toThrow(/payload length mismatch/);
    });
  });

  describe("ws url builder", () => {
    it("builds wss url from https location", () => {
      const url = buildRoomWsUrl({
        roomId: "room",
        role: "viewer",
        location: { protocol: "https:", host: "dex.test", search: "" } as Location,
      });
      expect(url).toBe("wss://dex.test/api/rooms/room/ws?role=viewer");
    });

    it("uses streamHost query override", () => {
      const url = buildRoomWsUrl({
        roomId: "room",
        role: "viewer",
        location: {
          protocol: "https:",
          host: "dex.test",
          search: "?streamHost=wss://relay.example",
        } as Location,
      });
      expect(url).toBe("wss://relay.example/api/rooms/room/ws?role=viewer");
    });
  });
});

