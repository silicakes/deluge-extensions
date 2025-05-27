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

  it("handles large files by writing in chunks", async () => {
    const data = new Uint8Array(256); // 256 byte file (2 chunks of 128 bytes each)
    data.fill(42); // Fill with test data
    const mockExecuteCommand = vi.mocked(executeCommand);

    // Mock responses: open, write chunk 1, write chunk 2, close
    mockExecuteCommand
      .mockResolvedValueOnce({ fid: 123, err: 0 }) // open response
      .mockResolvedValueOnce({ err: 0 }) // write chunk 1 response
      .mockResolvedValueOnce({ err: 0 }) // write chunk 2 response
      .mockResolvedValueOnce({ err: 0 }); // close response

    await writeFile({ path: "/dir/large.bin", data });

    // Should be called 4 times: open, write chunk 1, write chunk 2, close
    expect(mockExecuteCommand).toHaveBeenCalledTimes(4);

    // Check open command
    expect(mockExecuteCommand.mock.calls[0][0].request).toEqual({
      open: { path: "/dir/large.bin", write: 1 },
    });

    // Check first write chunk (128 bytes at offset 0)
    expect(mockExecuteCommand.mock.calls[1][0].request).toEqual({
      write: { fid: 123, addr: 0, size: 128 },
    });

    // Check second write chunk (128 bytes at offset 128)
    expect(mockExecuteCommand.mock.calls[2][0].request).toEqual({
      write: { fid: 123, addr: 128, size: 128 },
    });

    // Check close command
    expect(mockExecuteCommand.mock.calls[3][0].request).toEqual({
      close: { fid: 123 },
    });
  });

  it("closes file on write error", async () => {
    const data = new Uint8Array([1, 2, 3]);
    const mockExecuteCommand = vi.mocked(executeCommand);

    // Mock responses: open succeeds, write fails
    mockExecuteCommand
      .mockResolvedValueOnce({ fid: 123, err: 0 }) // open response
      .mockRejectedValueOnce(new Error("Write failed")) // write error
      .mockResolvedValueOnce({ err: 0 }); // close response

    await expect(writeFile({ path: "/dir/file.bin", data })).rejects.toThrow(
      "Write failed",
    );

    // Should be called 3 times: open, write (fails), close (cleanup)
    expect(mockExecuteCommand).toHaveBeenCalledTimes(3);

    // Check that close was called for cleanup
    expect(mockExecuteCommand.mock.calls[2][0].request).toEqual({
      close: { fid: 123 },
    });
  });
});
