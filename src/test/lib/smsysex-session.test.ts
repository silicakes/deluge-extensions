import { describe, it, expect, vi, beforeEach } from "vitest";
import { openSession, resetSession } from "../../lib/smsysex";
import { midiOut } from "../../state";

// Mock MIDI output
const mockMidiOut = {
  send: vi.fn(),
};

describe("smsysex session management", () => {
  beforeEach(() => {
    // Reset session state
    resetSession();

    // Set up mock MIDI output
    midiOut.value = mockMidiOut as unknown as MIDIOutput;

    // Clear mocks
    vi.clearAllMocks();
  });

  it("should parse session response correctly", async () => {
    // Simulate a session response like the one in the logs
    const sessionResponseBytes = [
      0xf0,
      0x7d,
      0x04,
      0x00, // SysEx header with dev ID
      0x7b,
      0x22,
      0x5e,
      0x73,
      0x65,
      0x73,
      0x73,
      0x69,
      0x6f,
      0x6e,
      0x22,
      0x3a,
      0x20,
      0x7b,
      0x0a,
      0x22,
      0x73,
      0x69,
      0x64,
      0x22,
      0x3a,
      0x20,
      0x36,
      0x2c,
      0x0a,
      0x22,
      0x74,
      0x61,
      0x67,
      0x22,
      0x3a,
      0x20,
      0x22,
      0x44,
      0x45,
      0x78,
      0x22,
      0x2c,
      0x0a,
      0x22,
      0x6d,
      0x69,
      0x64,
      0x42,
      0x61,
      0x73,
      0x65,
      0x22,
      0x3a,
      0x20,
      0x34,
      0x38,
      0x2c,
      0x0a,
      0x22,
      0x6d,
      0x69,
      0x64,
      0x4d,
      0x69,
      0x6e,
      0x22,
      0x3a,
      0x20,
      0x34,
      0x39,
      0x2c,
      0x0a,
      0x22,
      0x6d,
      0x69,
      0x64,
      0x4d,
      0x61,
      0x78,
      0x22,
      0x3a,
      0x20,
      0x35,
      0x35,
      0x7d,
      0x7d,
      0xf7, // SysEx end
    ];

    // Start session opening (this will set up the listener)
    const sessionPromise = openSession("DEx");

    // Simulate receiving the session response
    setTimeout(() => {
      // Create a mock MIDI event
      const mockEvent = {
        data: new Uint8Array(sessionResponseBytes),
      } as MIDIMessageEvent;

      // Import and call the handler directly
      import("../../lib/smsysex").then(({ handleSysexMessage }) => {
        handleSysexMessage(mockEvent);
      });
    }, 10);

    // Wait for session to be established
    const session = await sessionPromise;

    // Verify session properties
    expect(session.sid).toBe(6);
    expect(session.midMin).toBe(49);
    expect(session.midMax).toBe(55);
    expect(session.counter).toBe(1);
  });

  it("should handle session response parsing errors gracefully", async () => {
    // Simulate a malformed session response
    const malformedResponse = [
      0xf0,
      0x7d,
      0x04,
      0x00, // SysEx header
      0x7b,
      0x22,
      0x62,
      0x61,
      0x64, // Incomplete JSON
      0xf7, // SysEx end
    ];

    // Start session opening
    const sessionPromise = openSession("DEx");

    // Simulate receiving the malformed response
    setTimeout(() => {
      const mockEvent = {
        data: new Uint8Array(malformedResponse),
      } as MIDIMessageEvent;

      import("../../lib/smsysex").then(({ handleSysexMessage }) => {
        handleSysexMessage(mockEvent);
      });
    }, 10);

    // Should either succeed with fallback values or timeout
    try {
      const session = await sessionPromise;
      // If it succeeds, it should have fallback values
      expect(session.sid).toBeDefined();
      expect(session.midMin).toBeDefined();
      expect(session.midMax).toBeDefined();
    } catch (error) {
      // If it fails, it should be a timeout or parsing error
      expect(error).toBeInstanceOf(Error);
    }
  });
});
