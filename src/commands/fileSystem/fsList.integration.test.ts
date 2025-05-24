import { describe, it, expect, vi } from "vitest";
import { listDirectoryComplete } from "./fsList";

describe("listDirectoryComplete Integration", () => {
  it("should demonstrate chunking with progress reporting", async () => {
    // Skip this test in CI or when no device is connected
    if (process.env.CI || !process.env.TEST_WITH_DEVICE) {
      console.log("Skipping integration test - no device connected");
      return;
    }

    const progressUpdates: number[] = [];

    // Test with a real directory that might have many files
    const entries = await listDirectoryComplete({
      path: "/SONGS",
      onProgress: (loaded) => {
        progressUpdates.push(loaded);
        console.log(`Loading progress: ${loaded} entries`);
      },
    });

    console.log(`Total entries loaded: ${entries.length}`);
    console.log(`Progress updates: ${progressUpdates.join(", ")}`);

    // Verify we got entries
    expect(entries).toBeDefined();
    expect(Array.isArray(entries)).toBe(true);

    // If we got progress updates, verify they're incremental
    if (progressUpdates.length > 1) {
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i]).toBeGreaterThan(progressUpdates[i - 1]);
      }
    }

    // Log some sample entries
    if (entries.length > 0) {
      console.log("Sample entries:");
      entries.slice(0, 5).forEach((entry) => {
        console.log(
          `  - ${entry.name} (size: ${entry.size}, attr: ${entry.attr})`,
        );
      });
    }
  });

  it("example: loading a large directory with UI feedback", async () => {
    // This is a documentation example showing how to use the function
    // with a mock UI update function

    const mockUpdateUI = vi.fn((message: string) => {
      console.log(`UI Update: ${message}`);
    });

    // Skip actual API call in test
    if (process.env.CI || !process.env.TEST_WITH_DEVICE) {
      return;
    }

    mockUpdateUI("Starting directory load...");

    const entries = await listDirectoryComplete({
      path: "/",
      onProgress: (loaded, total) => {
        if (total) {
          mockUpdateUI(`Loading: ${loaded}/${total} files`);
        } else {
          mockUpdateUI(`Loading: ${loaded} files...`);
        }
      },
    });

    mockUpdateUI(`Complete! Loaded ${entries.length} files`);

    // Verify UI was updated
    expect(mockUpdateUI).toHaveBeenCalled();
    expect(mockUpdateUI).toHaveBeenLastCalledWith(
      expect.stringContaining("Complete!"),
    );
  });
});
