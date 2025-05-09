import { describe, it, expect, vi, afterEach } from "vitest";
import * as libMidi from "@/lib/midi";
import { checkFirmwareSupport } from "./checkFirmwareSupport";

describe("checkFirmwareSupport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves true when legacy function resolves", async () => {
    vi.spyOn(libMidi, "checkFirmwareSupport").mockResolvedValue(true);
    await expect(checkFirmwareSupport()).resolves.toBe(true);
  });

  it("rejects when legacy function rejects", async () => {
    vi.spyOn(libMidi, "checkFirmwareSupport").mockRejectedValue(
      new Error("fail"),
    );
    await expect(checkFirmwareSupport()).rejects.toThrow("fail");
  });
});
