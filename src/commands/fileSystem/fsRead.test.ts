// Unit tests for fsRead command.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as transport from "@/commands/_shared/transport";
import { readFile } from "./fsRead";
import { midiOut } from "@/state";

const DUMMY_DATA = new Uint8Array(4096).map((_, i) => i % 256);

function mockTransportSuccess() {
  let callCount = 0;
  vi.spyOn(transport, "sendSysex").mockImplementation(async () => {
    switch (callCount++) {
      case 0:
        // First call for the open command
        return { json: { "^open": { fid: 1, size: DUMMY_DATA.length } } };
      case 1:
      case 2:
      case 3:
      case 4: {
        // Subsequent calls for reading chunks
        const readIndex = callCount - 1; // First read has readIndex = 1
        const start = (readIndex - 1) * 1024; // Convert to 0-based index
        const remaining = Math.max(0, DUMMY_DATA.length - start);
        const chunkSize = Math.min(1024, remaining);

        if (chunkSize === 0) {
          // Handle case where there's no more data to read
          return { json: { ok: true } };
        }

        const chunk = DUMMY_DATA.slice(start, start + chunkSize);
        return { binary: chunk };
      }
      default:
        // Last call for the close command
        return { json: { ok: true } };
    }
  });
}

describe("readFile()", () => {
  // Setup and teardown to mock midiOut
  beforeEach(() => {
    // Mock midiOut with a send method
    midiOut.value = {
      send: vi.fn(),
    } as unknown as MIDIOutput;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    midiOut.value = null;
  });

  it("reads and concatenates 4 chunks", async () => {
    mockTransportSuccess();
    const buffer = await readFile({ path: "/TEST.BIN" });
    expect(new Uint8Array(buffer)).toEqual(DUMMY_DATA);
  });

  it("throws error if open fails", async () => {
    vi.spyOn(transport, "sendSysex").mockRejectedValue(
      new Error("Open failed"),
    );
    await expect(readFile({ path: "/NON_EXISTENT.BIN" })).rejects.toThrow(
      "Open failed",
    );
  });

  it("propagates error during chunk read", async () => {
    let callCount = 0;
    vi.spyOn(transport, "sendSysex").mockImplementation(async () => {
      switch (callCount++) {
        case 0:
          return { json: { "^open": { fid: 1, size: 2048 } } };
        case 1: {
          const firstChunk = new Uint8Array(1024);
          return { binary: firstChunk };
        }
        default:
          throw new Error("Chunk read failed");
      }
    });
    await expect(readFile({ path: "/TEST.BIN" })).rejects.toThrow(
      "Chunk read failed",
    );
  });

  it("aborts reading when signal is aborted", async () => {
    const controller = new AbortController();
    let callCount = 0;
    vi.spyOn(transport, "sendSysex").mockImplementation(async () => {
      switch (callCount++) {
        case 0:
          return { json: { "^open": { fid: 1, size: 2048 } } };
        case 1: {
          controller.abort();
          const chunk = new Uint8Array(1024);
          return { binary: chunk };
        }
        default: {
          const nextChunk = new Uint8Array(1024);
          return { binary: nextChunk };
        }
      }
    });
    await expect(
      readFile({ path: "/TEST.BIN" }, { signal: controller.signal }),
    ).rejects.toThrow("readFile: Aborted");
  });
});
