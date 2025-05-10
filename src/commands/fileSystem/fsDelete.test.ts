import { describe, it, expect, vi, afterEach } from "vitest";
import { deleteFile } from "./fsDelete";
import { sendJson, ensureSession } from "../../lib/smsysex";

// Mock the smsysex transport functions
vi.mock("../../lib/smsysex", () => ({
  sendJson: vi.fn().mockResolvedValue({ "^delete": { err: 0 } }),
  ensureSession: vi.fn().mockResolvedValue(undefined),
}));

describe("deleteFile command", () => {
  afterEach(() => vi.clearAllMocks());

  it("sends SysEx delete command with correct request", async () => {
    const params = { path: "/test.txt" };
    await deleteFile(params);
    expect(ensureSession).toHaveBeenCalledTimes(1);
    expect(sendJson).toHaveBeenCalledWith({ delete: { path: "/test.txt" } });
  });
});
