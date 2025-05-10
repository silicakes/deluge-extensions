import { describe, it, expect, vi, afterEach } from "vitest";
import { deleteFile } from "./fsDelete";
import { executeCommand } from "../_shared/executor";
import { SmsCommand } from "../_shared/types";

// Mock the executor for SysEx transport
vi.mock("../_shared/executor", () => ({ executeCommand: vi.fn() }));

describe("deleteFile command", () => {
  afterEach(() => vi.clearAllMocks());

  it("sends SysEx delete command with correct request", async () => {
    const params = { path: "/test.txt" };
    await deleteFile(params);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        cmdId: SmsCommand.JSON,
        request: expect.objectContaining({ delete: { path: "/test.txt" } }),
      }),
    );
  });
});
