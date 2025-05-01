import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendCustomSysEx } from "../lib/midi";
import { midiOut } from "../state";

describe("sendCustomSysEx", () => {
  // Mock the midiOut and navigator
  beforeEach(() => {
    // Mock online status
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });

    // Set up a mock midiOut with a spy for send method
    const mockSend = vi.fn();
    midiOut.value = {
      send: mockSend,
    } as unknown as MIDIOutput;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when midiOut is null", () => {
    midiOut.value = null;
    const result = sendCustomSysEx("F0 00 F7");
    expect(result).toBe(false);
  });

  it("returns false when offline", () => {
    Object.defineProperty(navigator, "onLine", { value: false });
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

  it("returns false when SysEx doesnt start with F0", () => {
    const result = sendCustomSysEx("00 01 F7");
    expect(result).toBe(false);
  });

  it("returns false when SysEx doesnt end with F7", () => {
    const result = sendCustomSysEx("F0 00 01");
    expect(result).toBe(false);
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

// Test the fixed deletePath implementation
test("deletePath should await response and refresh directory", async () => {
  // Mock the MIDI output and sendJson
  midiOut.value = { send: vi.fn() } as unknown as MIDIOutput;
  const mockResponse = { "^delete": { err: 0 } };
  const sendJsonMock = vi.fn().mockResolvedValue(mockResponse);
  vi.spyOn(window, "sendJson").mockImplementation(sendJsonMock);

  // Mock listDirectory to verify it's called
  const listDirectoryMock = vi.fn().mockResolvedValue([]);
  vi.spyOn(window, "listDirectory").mockImplementation(listDirectoryMock);

  // Setup file tree with a test file
  fileTree.value = {
    "/test": [{ name: "file.txt", size: 100, attr: 0, date: 0, time: 0 }],
  };

  // Call deletePath
  await deletePath("/test/file.txt");

  // Verify sendJson was called with correct parameters
  expect(sendJsonMock).toHaveBeenCalledWith({
    delete: { path: "/test/file.txt" },
  });

  // Verify listDirectory was called to refresh the parent directory
  expect(listDirectoryMock).toHaveBeenCalledWith("/test");

  // Verify fileTransferInProgress was reset
  expect(fileTransferInProgress.value).toBe(false);
});
