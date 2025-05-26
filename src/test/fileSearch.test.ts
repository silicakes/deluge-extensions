import { describe, it, expect, beforeEach, vi } from "vitest";
import { fileTree, searchQuery, searchResults, FileEntry } from "../state";
import { fileSearchService } from "../lib/fileSearch";

// Mock the listDirectoryComplete command
vi.mock("@/commands", () => ({
  listDirectoryComplete: vi.fn().mockResolvedValue([]),
}));

describe("FileSearchService", () => {
  beforeEach(() => {
    // Reset state before each test
    searchQuery.value = "";
    searchResults.value = [];

    // Setup test file tree
    fileTree.value = {
      "/": [
        { name: "song.wav", size: 1024, attr: 0, date: 0, time: 0 },
        { name: "samples", size: 0, attr: 0x10, date: 0, time: 0 },
        { name: "kick_drum.wav", size: 512, attr: 0, date: 0, time: 0 },
        { name: "snare_hit.wav", size: 256, attr: 0, date: 0, time: 0 },
      ],
      "/samples": [
        { name: "kick.wav", size: 512, attr: 0, date: 0, time: 0 },
        { name: "snare.wav", size: 256, attr: 0, date: 0, time: 0 },
        { name: "hihat.wav", size: 128, attr: 0, date: 0, time: 0 },
      ],
    };

    // Rebuild index with test data
    fileSearchService.rebuildIndex();
  });

  it("should find files by exact name", async () => {
    await fileSearchService.search("kick.wav");

    expect(searchResults.value).toHaveLength(1);
    expect(searchResults.value[0].item.entry.name).toBe("kick.wav");
    expect(searchResults.value[0].item.path).toBe("/samples/kick.wav");
  });

  it("should find files by partial name", async () => {
    await fileSearchService.search("wav");

    expect(searchResults.value.length).toBeGreaterThan(0);
    // Should find multiple .wav files
    const foundNames = searchResults.value.map((r) => r.item.entry.name);
    expect(foundNames).toContain("song.wav");
    expect(foundNames).toContain("kick_drum.wav");
  });

  it("should handle typos with fuzzy matching", async () => {
    await fileSearchService.search("kik"); // typo for 'kick'

    expect(searchResults.value.length).toBeGreaterThan(0);
    const foundNames = searchResults.value.map((r) => r.item.entry.name);
    expect(foundNames.some((name) => name.includes("kick"))).toBe(true);
  });

  it("should find directories", async () => {
    await fileSearchService.search("samples");

    expect(searchResults.value.length).toBeGreaterThan(0);
    // Find the directory entry specifically
    const directoryResult = searchResults.value.find(
      (r) => r.item.entry.name === "samples",
    );
    expect(directoryResult).toBeDefined();
    expect(directoryResult!.item.entry.attr & 0x10).toBe(0x10); // Directory flag
  });

  it("should return empty results for non-existent files", async () => {
    await fileSearchService.search("nonexistent");

    expect(searchResults.value).toHaveLength(0);
  });

  it("should return empty results for empty query", async () => {
    await fileSearchService.search("");

    expect(searchResults.value).toHaveLength(0);
  });

  it("should search in file paths", async () => {
    await fileSearchService.search("samples/kick");

    expect(searchResults.value.length).toBeGreaterThan(0);
    const foundPaths = searchResults.value.map((r) => r.item.path);
    expect(foundPaths.some((path) => path.includes("/samples/kick"))).toBe(
      true,
    );
  });

  it("should limit results to 20 high-quality items", async () => {
    // Create a large file tree
    const largeFileTree: Record<string, FileEntry[]> = { "/": [] };
    for (let i = 0; i < 50; i++) {
      largeFileTree["/"].push({
        name: `file${i}.wav`,
        size: 1024,
        attr: 0,
        date: 0,
        time: 0,
      });
    }

    fileTree.value = largeFileTree;
    fileSearchService.rebuildIndex();

    await fileSearchService.search("file");

    expect(searchResults.value.length).toBeLessThanOrEqual(20);
  });

  it("should include match information", async () => {
    await fileSearchService.search("kick");

    expect(searchResults.value.length).toBeGreaterThan(0);
    const result = searchResults.value[0];
    expect(result.score).toBeDefined();
    expect(typeof result.score).toBe("number");
  });

  it("should prioritize exact and prefix matches", async () => {
    // Add files with different match types
    fileTree.value = {
      "/": [
        { name: "kick.wav", size: 512, attr: 0, date: 0, time: 0 }, // Exact match
        { name: "kick_drum.wav", size: 512, attr: 0, date: 0, time: 0 }, // Prefix match
        { name: "808_kick.wav", size: 512, attr: 0, date: 0, time: 0 }, // Word boundary
        { name: "snare_kick_hat.wav", size: 512, attr: 0, date: 0, time: 0 }, // Mid-word
      ],
    };

    fileSearchService.rebuildIndex();
    await fileSearchService.search("kick");

    expect(searchResults.value.length).toBeGreaterThan(0);

    // Exact match should be first (lowest score)
    const exactMatch = searchResults.value.find(
      (r) => r.item.entry.name === "kick.wav",
    );
    const prefixMatch = searchResults.value.find(
      (r) => r.item.entry.name === "kick_drum.wav",
    );

    expect(exactMatch).toBeDefined();
    expect(prefixMatch).toBeDefined();

    if (exactMatch && prefixMatch) {
      expect(exactMatch.score).toBeLessThan(prefixMatch.score);
    }
  });
});
