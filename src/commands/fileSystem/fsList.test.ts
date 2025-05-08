import { describe, it, expect, vi, afterEach } from "vitest";
import * as midi from "@/lib/midi";
import { listDirectory, ListDirectoryParams } from "./fsList";
import type { FileEntry } from "@/state";

vi.mock("@/lib/midi", () => ({ listDirectory: vi.fn() }));

describe("listDirectory command", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("forwards parameters to legacy listDirectory and returns result", async () => {
    const mockEntries: FileEntry[] = [
      { name: "file.txt", attr: 32, size: 100, date: 0, time: 0 },
    ];
    vi.mocked(midi.listDirectory).mockResolvedValue(mockEntries);

    const params: ListDirectoryParams = {
      path: "/test",
      offset: 1,
      lines: 10,
      force: true,
    };
    const result = await listDirectory(params);

    expect(midi.listDirectory).toHaveBeenCalledWith("/test", {
      offset: 1,
      lines: 10,
      force: true,
    });
    expect(result).toBe(mockEntries);
  });
});
