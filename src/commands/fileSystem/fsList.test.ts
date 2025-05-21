import { describe, it, expect, vi, afterEach } from "vitest";
import { listDirectory } from "./fsList";
import { executeCommand } from "../_shared/executor";
import { SmsCommand } from "../_shared/types";
import type { FileEntry } from "@/state";

// Mock the executor for SysEx transport
vi.mock("../_shared/executor", () => ({ executeCommand: vi.fn() }));

describe("listDirectory command", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends SysEx dir command and returns entries", async () => {
    const mockEntries: FileEntry[] = [
      { name: "file.txt", attr: 32, size: 100, date: 0, time: 0 },
    ];
    // Mock executor to return directory object
    vi.mocked(executeCommand).mockResolvedValue({ list: mockEntries, err: 0 });

    const params = { path: "/test", offset: 1, lines: 10, force: true };
    const result = await listDirectory(params);

    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        cmdId: SmsCommand.JSON,
        request: expect.objectContaining({
          dir: { path: "/test", offset: 1, lines: 10, force: true },
        }),
      }),
    );
    expect(result).toBe(mockEntries);
  });
});
