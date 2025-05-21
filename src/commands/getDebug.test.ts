import { describe, it, expect, vi, afterEach } from "vitest";
import * as transport from "@/commands/_shared/transport";
import * as debug from "@/lib/debug";
import { getDebug } from "./getDebug";

describe("getDebug", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends debug SysEx and returns true", async () => {
    const sendSpy = vi.spyOn(transport, "sendSysex").mockResolvedValue({});
    const addSpy = vi.spyOn(debug, "addDebugMessage");
    await expect(getDebug()).resolves.toBe(true);
    expect(sendSpy).toHaveBeenCalledWith([0xf0, 0x7d, 0x03, 0x00, 0x01, 0xf7]);
    expect(addSpy).toHaveBeenCalledWith("Requested debug messages from device");
  });

  it("returns false and adds error message when sendSysex throws", async () => {
    vi.spyOn(transport, "sendSysex").mockRejectedValue(new Error("fail"));
    const addSpy = vi.spyOn(debug, "addDebugMessage");
    await expect(getDebug()).resolves.toBe(false);
    expect(addSpy).toHaveBeenCalledWith(
      "MIDI Output not selected. Cannot request debug messages.",
    );
  });
});
