import { describe, it, expect, vi, afterEach } from "vitest";
import * as midi from "@/lib/midi";
import { deleteFile, DeleteFileParams } from "./fsDelete";

vi.mock("@/lib/midi", () => ({ deletePath: vi.fn() }));

describe("deleteFile command", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls legacy deletePath with correct path", async () => {
    const params: DeleteFileParams = { path: "/test.txt" };
    await deleteFile(params);
    expect(midi.deletePath).toHaveBeenCalledWith("/test.txt");
  });
});
