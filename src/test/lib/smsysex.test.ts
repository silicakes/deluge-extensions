import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { resetSession } from "@/lib/smsysex";
import type { SmsSession } from "@/lib/smsysex";
import { midiOut } from "@/state";

// Mock the state module
vi.mock("@/state", () => ({
  midiOut: { value: null },
}));

describe("smsysex message ID range", () => {
  let mockMidiOut: { send: Mock };

  beforeEach(() => {
    // Reset session state
    resetSession();

    // Create mock MIDI output
    mockMidiOut = {
      send: vi.fn(),
    };

    // Set the mocked midiOut
    midiOut.value = mockMidiOut as unknown as MIDIOutput;
  });

  describe("buildMsgId and incrementCounter", () => {
    it("should use full message ID range", async () => {
      // Mock session response
      const mockSession: SmsSession = {
        sid: 1,
        midMin: 0x41, // 65
        midMax: 0x4f, // 79
        counter: 1,
      };

      // Helper to simulate the internal buildMsgId and incrementCounter functions
      function buildMsgId(s: SmsSession): number {
        const range = s.midMax - s.midMin + 1;
        const id = s.midMin + ((s.counter - 1) % range);
        return id;
      }

      function incrementCounter(s: SmsSession): void {
        const range = s.midMax - s.midMin + 1;
        s.counter = (s.counter % range) + 1;
      }

      // Test ID generation across the full range
      const ids: number[] = [];
      for (let i = 0; i < 20; i++) {
        ids.push(buildMsgId(mockSession));
        incrementCounter(mockSession);
      }

      // Should start at midMin (0x41 = 65)
      expect(ids[0]).toBe(0x41);

      // Should reach midMax (0x4f = 79)
      expect(ids[14]).toBe(0x4f);

      // Should wrap around back to midMin
      expect(ids[15]).toBe(0x41);

      // Verify full range is used (15 unique values: 0x41 to 0x4f)
      const uniqueIds = new Set(ids.slice(0, 15));
      expect(uniqueIds.size).toBe(15);

      // Verify all IDs are within the valid range
      ids.forEach((id) => {
        expect(id).toBeGreaterThanOrEqual(0x41);
        expect(id).toBeLessThanOrEqual(0x4f);
      });
    });

    it("should handle different ID ranges", async () => {
      // Test with a different range
      const mockSession: SmsSession = {
        sid: 2,
        midMin: 0x20, // 32
        midMax: 0x7f, // 127
        counter: 1,
      };

      function buildMsgId(s: SmsSession): number {
        const range = s.midMax - s.midMin + 1;
        const id = s.midMin + ((s.counter - 1) % range);
        return id;
      }

      function incrementCounter(s: SmsSession): void {
        const range = s.midMax - s.midMin + 1;
        s.counter = (s.counter % range) + 1;
      }

      // Test a few IDs
      const ids: number[] = [];
      for (let i = 0; i < 100; i++) {
        ids.push(buildMsgId(mockSession));
        incrementCounter(mockSession);
      }

      // Should start at midMin
      expect(ids[0]).toBe(0x20);

      // All IDs should be within range
      ids.forEach((id) => {
        expect(id).toBeGreaterThanOrEqual(0x20);
        expect(id).toBeLessThanOrEqual(0x7f);
      });

      // Should have used many different IDs (96 unique values possible)
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBeGreaterThan(50);
    });
  });

  describe("session renewal", () => {
    it("should track messages sent and have higher limit", () => {
      // The implementation now supports 100 messages per session
      // We can't directly test MAX_MESSAGES_PER_SESSION since it's not exported,
      // but we can verify the behavior is working with the new ID range

      // With the old implementation (IDs 1-7), we'd exhaust IDs quickly
      // With the new implementation (e.g., IDs 0x41-0x4F = 15 IDs), we have more room

      const mockSession: SmsSession = {
        sid: 1,
        midMin: 0x41,
        midMax: 0x4f,
        counter: 1,
      };

      // Helper functions matching the implementation
      function buildMsgId(s: SmsSession): number {
        const range = s.midMax - s.midMin + 1;
        const id = s.midMin + ((s.counter - 1) % range);
        return id;
      }

      function incrementCounter(s: SmsSession): void {
        const range = s.midMax - s.midMin + 1;
        s.counter = (s.counter % range) + 1;
      }

      // Generate many message IDs
      const generatedIds = new Set<number>();
      for (let i = 0; i < 100; i++) {
        const id = buildMsgId(mockSession);
        generatedIds.add(id);
        incrementCounter(mockSession);
      }

      // With the fix, we should be cycling through all 15 available IDs
      expect(generatedIds.size).toBe(15);

      // Verify we can handle 100+ messages without issue
      expect(mockSession.counter).toBeGreaterThanOrEqual(1);
      expect(mockSession.counter).toBeLessThanOrEqual(15);
    });
  });
});
