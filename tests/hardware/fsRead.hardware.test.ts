/**
 * @hardware
 * Hardware integration tests for the readFile (fsRead) command.
 * These tests require a physical Deluge device and are skipped by default.
 */
import { describe, it } from "vitest";
import { readFile } from "../../src/commands";

describe("@hardware fsRead hardware test stub", () => {
  it.skip("reads a zero-byte file on device", async () => {
    await readFile({ path: "/ZERO.BIN" });
    // TODO: assert returned ArrayBuffer has byteLength === 0
  });

  it.skip("reads a small file (< CHUNK_SIZE) on device", async () => {
    await readFile({ path: "/SMALL.BIN" });
    // TODO: assert returned ArrayBuffer has byteLength > 0 && < CHUNK_SIZE
  });

  it.skip("reads a large (> 1MB) file on device", async () => {
    await readFile({ path: "/LARGE.BIN" });
    // TODO: assert returned ArrayBuffer has byteLength > 1MB
  });
});
