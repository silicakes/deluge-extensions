import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyFile } from "./fsCopy";
import { executeCommand } from "../_shared/executor";
import { SmsCommand } from "../_shared/types";

// Mock the executeCommand function
vi.mock("../_shared/executor", () => ({
  executeCommand: vi.fn(),
}));

const mockExecuteCommand = vi.mocked(executeCommand);

describe("copyFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should copy a file successfully", async () => {
    mockExecuteCommand.mockResolvedValue({});

    await copyFile({
      from: "/SONGS/original.XML",
      to: "/SONGS/backup.XML",
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith({
      cmdId: SmsCommand.JSON,
      request: {
        copy: { from: "/SONGS/original.XML", to: "/SONGS/backup.XML" },
      },
      build: expect.any(Function),
      parse: expect.any(Function),
    });
  });

  it("should handle copy between different directories", async () => {
    mockExecuteCommand.mockResolvedValue({});

    await copyFile({
      from: "/KITS/drum.wav",
      to: "/SAMPLES/drum_backup.wav",
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith({
      cmdId: SmsCommand.JSON,
      request: {
        copy: { from: "/KITS/drum.wav", to: "/SAMPLES/drum_backup.wav" },
      },
      build: expect.any(Function),
      parse: expect.any(Function),
    });
  });

  it("should propagate errors from executeCommand", async () => {
    const error = new Error("Copy failed");
    mockExecuteCommand.mockRejectedValue(error);

    await expect(
      copyFile({
        from: "/SONGS/test.XML",
        to: "/SONGS/test_copy.XML",
      }),
    ).rejects.toThrow("Copy failed");
  });
});
