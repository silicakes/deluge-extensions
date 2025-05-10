import { describe, it, expect, vi, afterEach } from "vitest";
import { executeCommand } from "../_shared/executor";
import { SmsCommand } from "../_shared/types";
import { makeDirectory } from "./fsMkdir";

// Mock the executor for SysEx transport
vi.mock("../_shared/executor", () => ({ executeCommand: vi.fn() }));

describe("makeDirectory command", () => {
  afterEach(() => vi.clearAllMocks());

  it("sends SysEx mkdir command with correct request", async () => {
    const params = { path: "/newdir" };
    await makeDirectory(params);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        cmdId: SmsCommand.JSON,
        request: expect.objectContaining({ mkdir: { path: "/newdir" } }),
      }),
    );
  });
});
