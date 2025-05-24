import { describe, it, expect, vi, afterEach } from "vitest";
import { listDirectory, listDirectoryComplete } from "./fsList";
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

describe("listDirectoryComplete command", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create mock file entries
  function createMockEntries(count: number, startIndex = 0): FileEntry[] {
    return Array.from({ length: count }, (_, i) => ({
      name: `file${startIndex + i}.txt`,
      attr: 32,
      size: 100 + i,
      date: 0,
      time: 0,
    }));
  }

  it("should load directory in chunks", async () => {
    // Mock responses with 64 entries each
    const mockResponses = [
      createMockEntries(64, 0),
      createMockEntries(64, 64),
      createMockEntries(32, 128), // Last chunk is partial
      [], // Empty response to signal end
    ];

    let callCount = 0;
    vi.mocked(executeCommand).mockImplementation(async () => {
      const response = mockResponses[callCount] || [];
      callCount++;
      return { list: response, err: 0 };
    });

    const result = await listDirectoryComplete({ path: "/SONGS" });

    // Verify all entries were loaded
    expect(result.length).toBe(160);
    expect(result[0].name).toBe("file0.txt");
    expect(result[159].name).toBe("file159.txt");

    // Verify correct number of calls (now 4 with the empty response)
    expect(executeCommand).toHaveBeenCalledTimes(4);

    // Verify offset progression
    expect(executeCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        request: expect.objectContaining({
          dir: { path: "/SONGS", offset: 0, lines: 64, force: undefined },
        }),
      }),
    );
    expect(executeCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        request: expect.objectContaining({
          dir: { path: "/SONGS", offset: 64, lines: 64, force: undefined },
        }),
      }),
    );
    expect(executeCommand).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        request: expect.objectContaining({
          dir: { path: "/SONGS", offset: 128, lines: 64, force: undefined },
        }),
      }),
    );
    expect(executeCommand).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        request: expect.objectContaining({
          dir: { path: "/SONGS", offset: 160, lines: 64, force: undefined },
        }),
      }),
    );
  });

  it("should handle empty directory", async () => {
    vi.mocked(executeCommand).mockResolvedValue({ list: [], err: 0 });

    const result = await listDirectoryComplete({ path: "/EMPTY" });

    expect(result.length).toBe(0);
    expect(executeCommand).toHaveBeenCalledTimes(1);
  });

  it("should handle single chunk directory", async () => {
    const mockEntries = createMockEntries(10);
    let callCount = 0;
    vi.mocked(executeCommand).mockImplementation(async () => {
      if (callCount === 0) {
        callCount++;
        return { list: mockEntries, err: 0 };
      } else {
        return { list: [], err: 0 };
      }
    });

    const result = await listDirectoryComplete({ path: "/SMALL" });

    expect(result.length).toBe(10);
    expect(executeCommand).toHaveBeenCalledTimes(2); // Now needs 2 calls to confirm end
  });

  it("should report progress during loading", async () => {
    const mockResponses = [
      createMockEntries(64, 0),
      createMockEntries(64, 64),
      createMockEntries(32, 128),
      [], // Empty response to signal end
    ];

    let callCount = 0;
    vi.mocked(executeCommand).mockImplementation(async () => {
      const response = mockResponses[callCount] || [];
      callCount++;
      return { list: response, err: 0 };
    });

    const progress: number[] = [];
    await listDirectoryComplete({
      path: "/SONGS",
      onProgress: (loaded) => progress.push(loaded),
    });

    expect(progress).toEqual([64, 128, 160]);
  });

  it("should pass force parameter correctly", async () => {
    vi.mocked(executeCommand).mockResolvedValue({ list: [], err: 0 });

    await listDirectoryComplete({ path: "/TEST", force: true });

    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          dir: { path: "/TEST", offset: 0, lines: 64, force: true },
        }),
      }),
    );
  });

  it("should handle exactly 64 entries (edge case)", async () => {
    const mockEntries = createMockEntries(64);
    let callCount = 0;
    vi.mocked(executeCommand).mockImplementation(async () => {
      if (callCount === 0) {
        callCount++;
        return { list: mockEntries, err: 0 };
      } else {
        return { list: [], err: 0 };
      }
    });

    const result = await listDirectoryComplete({ path: "/EXACT64" });

    expect(result.length).toBe(64);
    expect(executeCommand).toHaveBeenCalledTimes(2); // Should check for more
  });

  it("should prevent infinite loops with safety check", async () => {
    // Always return full chunks to simulate infinite directory
    vi.mocked(executeCommand).mockResolvedValue({
      list: createMockEntries(64),
      err: 0,
    });

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await listDirectoryComplete({ path: "/INFINITE" });

    // Should stop at safety limit
    expect(result.length).toBeLessThanOrEqual(10064); // Just over 10000
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("has over 10000 entries"),
    );

    consoleSpy.mockRestore();
  });
});
