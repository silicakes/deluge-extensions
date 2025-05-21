import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { midiOut } from "@/state";
import { sendCustomSysEx } from "./sendCustomSysEx";

// Ensure MIDI output is properly mocked

describe("sendCustomSysEx", () => {
  beforeEach(() => {
    const mockSend = vi.fn();
    midiOut.value = { send: mockSend } as unknown as MIDIOutput;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when midiOut is null", () => {
    midiOut.value = null;
    const result = sendCustomSysEx("F0 00 F7");
    expect(result).toBe(false);
  });

  it("returns false when input is empty", () => {
    const result = sendCustomSysEx("   ");
    expect(result).toBe(false);
  });

  it("returns false when parsing invalid hex values", () => {
    const result = sendCustomSysEx("F0 ZZ F7");
    expect(result).toBe(false);
  });

  it("returns false when SysEx doesn't start with F0", () => {
    const result = sendCustomSysEx("00 01 F7");
    expect(result).toBe(false);
  });

  it("returns false when SysEx doesn't end with F7", () => {
    const result = sendCustomSysEx("F0 00 01");
    expect(result).toBe(false);
  });

  it("correctly sends payload for valid hex string without prefix", () => {
    const hex = "F0 7D 04 00 05 F7";
    const result = sendCustomSysEx(hex);
    expect(result).toBe(true);
    expect(midiOut.value?.send).toHaveBeenCalledWith([
      0xf0, 0x7d, 0x04, 0x00, 0x05, 0xf7,
    ]);
  });

  it("correctly parses hex string with 0x prefix", () => {
    const result = sendCustomSysEx("0xF0 0x01 0x02 0xF7");
    expect(result).toBe(true);
    expect(midiOut.value?.send).toHaveBeenCalledWith([0xf0, 0x01, 0x02, 0xf7]);
  });

  it("correctly parses hex string without prefix", () => {
    const result = sendCustomSysEx("F0 7D 03 00 01 F7");
    expect(result).toBe(true);
    expect(midiOut.value?.send).toHaveBeenCalledWith([
      0xf0, 0x7d, 0x03, 0x00, 0x01, 0xf7,
    ]);
  });

  it("correctly parses hex string with mixed formats", () => {
    const result = sendCustomSysEx("F0 0x7D 03 0x00 01 F7");
    expect(result).toBe(true);
    expect(midiOut.value?.send).toHaveBeenCalledWith([
      0xf0, 0x7d, 0x03, 0x00, 0x01, 0xf7,
    ]);
  });
});
