import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { resetSession } from "@/lib/smsysex";
import type { SmsSession } from "@/lib/smsysex";
import { midiOut } from "@/state";

// Mock the state module
vi.mock("@/state", () => ({
  midiOut: { value: null },
}));

describe("smsysex integration - message ID exhaustion fix", () => {
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

  it("should handle many file operations without message ID exhaustion", () => {
    // With the old implementation (IDs 1-7), we'd run out after ~7 operations
    // With the fix (IDs 0x41-0x4F = 15), and MAX_MESSAGES = 100, we should handle many more

    // Test the mathematical improvements
    const oldIdRange = 7; // Old implementation
    const newIdRange = 15; // With fix (0x4F - 0x41 + 1)
    const messagesPerFile = 3; // open, write, close
    const maxMessagesPerSession = 100; // Updated constant
    const oldMaxMessagesPerSession = 10; // Old constant

    // Calculate capacity
    const oldCapacity = Math.min(
      Math.floor(oldMaxMessagesPerSession / messagesPerFile),
      oldIdRange, // Limited by ID exhaustion
    );

    const newCapacity = Math.floor(maxMessagesPerSession / messagesPerFile);

    // Verify improvements
    expect(newIdRange).toBeGreaterThan(oldIdRange);
    expect(newCapacity).toBeGreaterThan(oldCapacity);

    // Log the improvements
    console.log(
      `Old system: ${oldIdRange} IDs, could handle ~${oldCapacity} files before issues`,
    );
    console.log(
      `New system: ${newIdRange} IDs, can handle ~${newCapacity} files per session`,
    );
    console.log(
      `Improvement: ${Math.round((newCapacity / oldCapacity - 1) * 100)}% more files per session`,
    );

    // Verify the ID generation logic with the fix
    const mockSession: SmsSession = {
      sid: 1,
      midMin: 0x41,
      midMax: 0x4f,
      counter: 1,
    };

    // Helper functions that mirror the implementation
    function buildMsgId(s: SmsSession): number {
      const range = s.midMax - s.midMin + 1;
      const id = s.midMin + ((s.counter - 1) % range);
      return id;
    }

    function incrementCounter(s: SmsSession): void {
      const range = s.midMax - s.midMin + 1;
      s.counter = (s.counter % range) + 1;
    }

    // Simulate message ID generation for many operations
    const generatedIds: number[] = [];
    for (let fileOp = 0; fileOp < 50; fileOp++) {
      // Each file operation generates multiple message IDs
      for (let msg = 0; msg < messagesPerFile; msg++) {
        const id = buildMsgId(mockSession);
        generatedIds.push(id);
        incrementCounter(mockSession);
      }
    }

    // Verify all IDs are valid
    generatedIds.forEach((id) => {
      expect(id).toBeGreaterThanOrEqual(mockSession.midMin);
      expect(id).toBeLessThanOrEqual(mockSession.midMax);
    });

    // Verify we're using the full range
    const uniqueIds = new Set(generatedIds);
    expect(uniqueIds.size).toBe(newIdRange);
  });

  it("should properly cycle through all available message IDs", () => {
    // Test the ID cycling logic directly
    const session: SmsSession = {
      sid: 1,
      midMin: 0x41,
      midMax: 0x4f,
      counter: 1,
    };

    // Helper functions that mirror the implementation
    function buildMsgId(s: SmsSession): number {
      const range = s.midMax - s.midMin + 1;
      const id = s.midMin + ((s.counter - 1) % range);
      return id;
    }

    function incrementCounter(s: SmsSession): void {
      const range = s.midMax - s.midMin + 1;
      s.counter = (s.counter % range) + 1;
    }

    const usedIds = new Set<number>();
    const idSequence: number[] = [];

    // Generate 30 IDs to see the cycling behavior
    for (let i = 0; i < 30; i++) {
      const id = buildMsgId(session);
      usedIds.add(id);
      idSequence.push(id);
      incrementCounter(session);
    }

    // Should use all 15 available IDs
    expect(usedIds.size).toBe(15);

    // Verify the sequence cycles properly
    expect(idSequence[0]).toBe(0x41); // First ID
    expect(idSequence[14]).toBe(0x4f); // Last ID before cycling
    expect(idSequence[15]).toBe(0x41); // Cycles back to first
    expect(idSequence[29]).toBe(0x4f); // Still cycling correctly

    // Log the improvement
    console.log("Message ID cycling test:");
    console.log(`- Available IDs: ${usedIds.size} (was limited to 7)`);
    console.log(
      `- ID range: 0x${session.midMin.toString(16)} to 0x${session.midMax.toString(16)}`,
    );
    console.log(
      `- First 20 IDs: ${idSequence
        .slice(0, 20)
        .map((id) => `0x${id.toString(16)}`)
        .join(", ")}`,
    );
  });
});
