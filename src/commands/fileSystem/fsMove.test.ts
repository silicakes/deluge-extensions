import { describe, it, expect, vi, beforeEach } from "vitest";
import { moveFile } from "./fsMove";
import { executeCommand } from "../_shared/executor";
import { SmsCommand } from "../_shared/types";

// Mock the executeCommand function
vi.mock("../_shared/executor", () => ({
  executeCommand: vi.fn(),
}));

const mockExecuteCommand = vi.mocked(executeCommand);

describe("moveFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should move a file successfully", async () => {
    mockExecuteCommand.mockResolvedValue({});

    await moveFile({
      from: "/SONGS/old.XML",
      to: "/SONGS/new.XML",
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith({
      cmdId: SmsCommand.JSON,
      request: { move: { from: "/SONGS/old.XML", to: "/SONGS/new.XML" } },
      build: expect.any(Function),
      parse: expect.any(Function),
    });
  });

  it("should handle move between different directories", async () => {
    mockExecuteCommand.mockResolvedValue({});

    await moveFile({
      from: "/KITS/drum.wav",
      to: "/SAMPLES/drum_moved.wav",
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith({
      cmdId: SmsCommand.JSON,
      request: {
        move: { from: "/KITS/drum.wav", to: "/SAMPLES/drum_moved.wav" },
      },
      build: expect.any(Function),
      parse: expect.any(Function),
    });
  });

  it("should propagate errors from executeCommand", async () => {
    const error = new Error("Move failed");
    mockExecuteCommand.mockRejectedValue(error);

    await expect(
      moveFile({
        from: "/SONGS/test.XML",
        to: "/SONGS/test_moved.XML",
      }),
    ).rejects.toThrow("Move failed");
  });

  it("should include update_paths when specified", async () => {
    mockExecuteCommand.mockResolvedValue({});

    await moveFile({
      from: "/SONGS/old.XML",
      to: "/SONGS/new.XML",
      update_paths: true,
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith({
      cmdId: SmsCommand.JSON,
      request: {
        move: {
          from: "/SONGS/old.XML",
          to: "/SONGS/new.XML",
          update_paths: true,
        },
      },
      build: expect.any(Function),
      parse: expect.any(Function),
    });
  });

  it("should not include update_paths when false", async () => {
    mockExecuteCommand.mockResolvedValue({});

    await moveFile({
      from: "/SONGS/old.XML",
      to: "/SONGS/new.XML",
      update_paths: false,
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith({
      cmdId: SmsCommand.JSON,
      request: {
        move: {
          from: "/SONGS/old.XML",
          to: "/SONGS/new.XML",
        },
      },
      build: expect.any(Function),
      parse: expect.any(Function),
    });
  });

  it("should not include update_paths when not specified", async () => {
    mockExecuteCommand.mockResolvedValue({});

    await moveFile({
      from: "/SONGS/old.XML",
      to: "/SONGS/new.XML",
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith({
      cmdId: SmsCommand.JSON,
      request: {
        move: {
          from: "/SONGS/old.XML",
          to: "/SONGS/new.XML",
        },
      },
      build: expect.any(Function),
      parse: expect.any(Function),
    });
  });
});
