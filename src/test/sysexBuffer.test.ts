/**
 * Tests for SysEx buffer implementation
 *
 * Verifies that the buffer correctly batches fragments, flushes on timeouts,
 * and maintains memory usage within bounds.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handleFragment,
  getBufferStats,
  flushAllMessages,
  setSysExBufferEnabled,
} from "../lib/sysex_buffer";
import * as smsysex from "../lib/smsysex";

describe("SysEx Message Batching", () => {
  let handleSysexMessageMock;

  // Setup before each test
  beforeEach(() => {
    // Mock window.setTimeout
    vi.useFakeTimers();

    // Enable the buffer
    setSysExBufferEnabled(true);

    // Reset any pending messages
    flushAllMessages();

    // Mock the smsysex module's handleSysexMessage function
    handleSysexMessageMock = vi
      .spyOn(smsysex, "handleSysexMessage")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original implementations
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should batch multiple fragments with the same msgId", () => {
    // Create 10 fragments with the same message ID
    for (let i = 0; i < 9; i++) {
      const fragment = new Uint8Array([
        0xf0, 0x7d, 0x04, 0x42, 0x01, 0x02, 0x03,
      ]);
      const event = { data: fragment } as MIDIMessageEvent;
      handleFragment(event);
    }

    // Add final fragment with F7 terminator
    const finalFragment = new Uint8Array([
      0xf0, 0x7d, 0x04, 0x42, 0x04, 0x05, 0xf7,
    ]);
    const finalEvent = { data: finalFragment } as MIDIMessageEvent;
    handleFragment(finalEvent);

    // Should have triggered handleSysexMessage exactly once with combined message
    expect(handleSysexMessageMock).toHaveBeenCalledTimes(1);

    // Verify combined data is correct
    const eventArg = handleSysexMessageMock.mock.calls[0][0];
    expect(eventArg.data.length).toBe(70); // 10 fragments * 7 bytes each

    // Buffer should be empty after processing
    const stats = getBufferStats();
    expect(stats.messageIds).toBe(0);
    expect(stats.fragments).toBe(0);
  });

  it("should flush an incomplete message after timeout", () => {
    // Send fragments without F7 terminator
    for (let i = 0; i < 5; i++) {
      const fragment = new Uint8Array([
        0xf0,
        0x7d,
        0x04,
        0x42,
        i,
        i + 1,
        i + 2,
      ]);
      const event = { data: fragment } as MIDIMessageEvent;
      handleFragment(event);
    }

    // No immediate call to handleSysexMessage
    expect(handleSysexMessageMock).not.toHaveBeenCalled();

    // Buffer should contain message fragments
    const initialStats = getBufferStats();
    expect(initialStats.messageIds).toBe(1);
    expect(initialStats.fragments).toBe(5);

    // Advance time to trigger flush
    vi.advanceTimersByTime(20);

    // Should now have triggered handleSysexMessage once
    expect(handleSysexMessageMock).toHaveBeenCalledTimes(1);

    // Buffer should be empty
    const finalStats = getBufferStats();
    expect(finalStats.messageIds).toBe(0);
    expect(finalStats.fragments).toBe(0);
  });

  it("should handle large number of fragments efficiently", () => {
    // Create 1000 small fragments
    const fragments = [];
    for (let i = 0; i < 1000; i++) {
      fragments.push(
        new Uint8Array([0xf0, 0x7d, 0x04, 0x42, i & 0xff, (i >> 8) & 0xff]),
      );
    }

    // Add terminator to last one
    fragments[fragments.length - 1] = new Uint8Array([
      0xf0, 0x7d, 0x04, 0x42, 0xe8, 0x03, 0xf7,
    ]);

    // Process all fragments
    fragments.forEach((fragment) => {
      handleFragment({ data: fragment } as MIDIMessageEvent);
    });

    // Should have triggered handleSysexMessage exactly once
    expect(handleSysexMessageMock).toHaveBeenCalledTimes(1);

    // Buffer should be empty after processing
    const stats = getBufferStats();
    expect(stats.messageIds).toBe(0);
    expect(stats.fragments).toBe(0);
  });

  it("should flush when buffer exceeds size limit", () => {
    // Create fragments that together exceed MAX_BUFFER_SIZE (64KB)
    // Each fragment is 8KB
    const largeFragment = new Uint8Array(8 * 1024);
    largeFragment[0] = 0xf0;
    largeFragment[1] = 0x7d;
    largeFragment[2] = 0x04;
    largeFragment[3] = 0x42;

    // Send 9 large fragments (total 72KB, exceeding 64KB limit)
    for (let i = 0; i < 9; i++) {
      handleFragment({ data: largeFragment } as MIDIMessageEvent);
    }

    // Should flush once we hit the limit
    expect(handleSysexMessageMock).toHaveBeenCalledTimes(1);

    // Buffer should be partially emptied
    const stats = getBufferStats();
    expect(stats.messageIds).toBe(1); // Still tracking the message ID
    expect(stats.fragments).toBeLessThan(9); // But with fewer fragments
  });

  it("should not batch when disabled", () => {
    // Disable buffering
    setSysExBufferEnabled(false);

    // Send multiple fragments
    for (let i = 0; i < 5; i++) {
      const fragment = new Uint8Array([0xf0, 0x7d, 0x04, 0x42, i, i + 1, 0xf7]);
      handleFragment({ data: fragment } as MIDIMessageEvent);
    }

    // Each fragment should pass through
    expect(handleSysexMessageMock).toHaveBeenCalledTimes(0);

    // Buffer should be empty
    const stats = getBufferStats();
    expect(stats.messageIds).toBe(0);
    expect(stats.fragments).toBe(0);
  });
});
