import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setSysExBufferEnabled,
  isSysExBufferEnabled,
  setBatchedMessageListener,
  handleFragment,
  flushAllMessages,
  getBufferStats,
} from "@/lib/sysex_buffer";

describe("sysex_buffer module", () => {
  beforeEach(() => {
    // Reset feature flag and clear any stored value
    setSysExBufferEnabled(true);
    localStorage.clear();
    // Clear any window overrides
    delete window.DELUGE_NO_BUFFER;
    delete window.ENABLE_SYSEX_BUFFER;
    // Clear pending fragments and timeouts
    flushAllMessages();
    // Remove listener
    setBatchedMessageListener(null);
  });

  afterEach(() => {
    // Clean up after tests
    flushAllMessages();
    setBatchedMessageListener(null);
    vi.restoreAllMocks();
  });

  it("toggles buffering feature flag and persists to localStorage", () => {
    setSysExBufferEnabled(false);
    expect(isSysExBufferEnabled()).toBe(false);
    expect(localStorage.getItem("ENABLE_SYSEX_BUFFER")).toBe("false");

    setSysExBufferEnabled(true);
    expect(isSysExBufferEnabled()).toBe(true);
    expect(localStorage.getItem("ENABLE_SYSEX_BUFFER")).toBe("true");
  });

  it("respects debug flag to disable buffering", () => {
    window.DELUGE_NO_BUFFER = true;
    setSysExBufferEnabled(true);
    expect(isSysExBufferEnabled()).toBe(false);
  });

  it("respects window ENABLE_SYSEX_BUFFER override", () => {
    // Even if feature flag is false, window override takes precedence
    setSysExBufferEnabled(false);
    window.ENABLE_SYSEX_BUFFER = true;
    expect(isSysExBufferEnabled()).toBe(true);
    // And true override can be turned off
    window.ENABLE_SYSEX_BUFFER = false;
    expect(isSysExBufferEnabled()).toBe(false);
  });

  it("ignores non-SysEx or buffering-disabled events", () => {
    const listener = vi.fn();
    setBatchedMessageListener(listener);

    // Non-SysEx data (first byte !== 0xF0)
    handleFragment({ data: new Uint8Array([0x00, 1, 2]) } as MIDIMessageEvent);
    // With buffering disabled via flag
    setSysExBufferEnabled(false);
    handleFragment({
      data: new Uint8Array([0xf0, 0x7d, 0x04, 1, 0x7b, 0x00]),
    } as MIDIMessageEvent);

    expect(getBufferStats()).toEqual({ messageIds: 0, fragments: 0 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("buffers fragments and broadcasts on complete message", () => {
    const listener = vi.fn();
    setBatchedMessageListener(listener);

    // First fragment (incomplete, no 0xF7 at end)
    const frag1 = new Uint8Array([0xf0, 0x7d, 0x04, 5, 0x7b, 10, 20]);
    handleFragment({ data: frag1 } as MIDIMessageEvent);
    expect(getBufferStats()).toEqual({ messageIds: 1, fragments: 1 });
    expect(listener).not.toHaveBeenCalled();

    // Second fragment completes message (ends with 0xF7)
    const frag2 = new Uint8Array([0xf0, 0x7d, 0x04, 5, 0x7b, 30, 40, 0xf7]);
    handleFragment({ data: frag2 } as MIDIMessageEvent);

    // Should broadcast exactly once
    expect(listener).toHaveBeenCalledTimes(1);

    // Combined data equals frag1 + frag2
    const combined = new Uint8Array(frag1.length + frag2.length);
    combined.set(frag1, 0);
    combined.set(frag2, frag1.length);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ data: combined }),
    );

    // Buffer should be cleared
    expect(getBufferStats()).toEqual({ messageIds: 0, fragments: 0 });
  });

  it("flushAllMessages flushes pending without needing complete fragment", () => {
    const listener = vi.fn();
    setBatchedMessageListener(listener);

    const frag = new Uint8Array([0xf0, 0x7d, 0x04, 8, 0x7b, 99]);
    handleFragment({ data: frag } as MIDIMessageEvent);
    expect(getBufferStats()).toEqual({ messageIds: 1, fragments: 1 });

    // Force flush pending messages
    flushAllMessages();
    expect(listener).toHaveBeenCalledTimes(1);
    // Data forwarded should be the single fragment as-is
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ data: frag }),
    );
    expect(getBufferStats()).toEqual({ messageIds: 0, fragments: 0 });
  });
});
