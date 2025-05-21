import { describe, it, expect, vi } from "vitest";
import * as transport from "@/commands/_shared/transport";
import { builder } from "@/commands/_shared/builder";
import { readFile } from "./fsRead";

const CHUNK_SIZE = 1024;

describe("readFile integration", () => {
  it("orchestrates open, multiple reads, and close with progress", async () => {
    const size = 2500;
    const totalChunks = Math.ceil(size / CHUNK_SIZE);
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) data[i] = i % 256;

    let callCount = 0;
    const sendSpy = vi
      .spyOn(transport, "sendSysex")
      .mockImplementation(async () => {
        // OPEN response
        if (callCount === 0) {
          callCount++;
          return builder.jsonReply({ "^open": { fid: 42, size } });
        }
        // READ responses
        if (callCount <= totalChunks) {
          const offset = (callCount - 1) * CHUNK_SIZE;
          const length = Math.min(CHUNK_SIZE, size - offset);
          const chunk = data.slice(offset, offset + length);
          callCount++;
          return builder.jsonBinaryReply({}, chunk);
        }
        // CLOSE response
        callCount++;
        return builder.jsonReply({ ok: true });
      });

    const progressEvents: Array<[number, number]> = [];
    const buffer = await readFile(
      { path: "/FILE.BIN" },
      { onProgress: (bytes, total) => progressEvents.push([bytes, total]) },
    );

    expect(new Uint8Array(buffer)).toEqual(data);
    expect(progressEvents).toHaveLength(totalChunks);
    for (let i = 0; i < totalChunks; i++) {
      const expected = Math.min(CHUNK_SIZE * (i + 1), size);
      expect(progressEvents[i]).toEqual([expected, size]);
    }
    // ONE open + READs + ONE close
    expect(sendSpy).toHaveBeenCalledTimes(1 + totalChunks + 1);
  });

  it("aborts during read when signal is aborted", async () => {
    const size = 2048;
    const data = new Uint8Array(size);
    let callCount = 0;
    const controller = new AbortController();

    vi.spyOn(transport, "sendSysex").mockImplementation(async () => {
      switch (callCount) {
        case 0:
          callCount++;
          return builder.jsonReply({ "^open": { fid: 7, size } });
        case 1:
          controller.abort();
          callCount++;
          return builder.jsonBinaryReply({}, data.slice(0, CHUNK_SIZE));
        default:
          callCount++;
          return builder.jsonBinaryReply({}, data.slice(CHUNK_SIZE));
      }
    });

    await expect(
      readFile({ path: "/FILE.BIN" }, { signal: controller.signal }),
    ).rejects.toThrow("readFile: Aborted");
  });

  it("propagates error on close failure", async () => {
    const size = 1024;
    let callCount = 0;
    vi.spyOn(transport, "sendSysex").mockImplementation(async () => {
      switch (callCount++) {
        case 0:
          return builder.jsonReply({ "^open": { fid: 1, size } });
        case 1:
          return builder.jsonBinaryReply({}, new Uint8Array(size));
        default:
          throw new Error("Close failed");
      }
    });

    await expect(readFile({ path: "/FILE.BIN" })).rejects.toThrow(
      "Close failed",
    );
  });
});
