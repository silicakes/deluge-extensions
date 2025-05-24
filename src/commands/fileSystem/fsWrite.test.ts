import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { writeFile } from "./fsWrite";
import { executeCommand } from "../_shared/executor";
import { midiOut } from "../../state";

// Mock the executor module
vi.mock("../_shared/executor", () => ({
  executeCommand: vi.fn(),
}));

describe("writeFile command", () => {
  beforeEach(() => {
    // Set up midiOut to prevent "MIDI output not selected" error
    midiOut.value = {
      id: "test-device",
      send: vi.fn(),
    } as unknown as MIDIOutput;

    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    midiOut.value = null;
  });

  it("executes open, write, and close commands in sequence", async () => {
    const data = new Uint8Array([1, 2, 3]);
    const mockExecuteCommand = vi.mocked(executeCommand);

    // Mock responses for each command
    mockExecuteCommand
      .mockResolvedValueOnce({ fid: 123, err: 0 }) // open response
      .mockResolvedValueOnce({ err: 0 }) // write response
      .mockResolvedValueOnce({ err: 0 }); // close response

    await writeFile({ path: "/dir/file.bin", data });

    // Should be called 3 times: open, write, close
    expect(mockExecuteCommand).toHaveBeenCalledTimes(3);

    // Check open command
    expect(mockExecuteCommand.mock.calls[0][0].request).toEqual({
      open: { path: "/dir/file.bin", write: 1 },
    });

    // Check write command
    expect(mockExecuteCommand.mock.calls[1][0].request).toEqual({
      write: { fid: 123, addr: 0, size: 3 },
    });

    // Check close command
    expect(mockExecuteCommand.mock.calls[2][0].request).toEqual({
      close: { fid: 123 },
    });
  });
});
