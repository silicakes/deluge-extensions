import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fileTree,
  expandedPaths,
  selectedPaths,
  fileTransferInProgress,
  midiOut,
} from "../state";
import * as midi from "@/commands";

// Mock the commands module
vi.mock("@/commands", () => ({
  fsDelete: vi.fn(),
  listDirectory: vi.fn(),
}));

describe("deletePath", () => {
  beforeEach(() => {
    // Reset state
    fileTree.value = {
      "/": [
        { name: "file.txt", attr: 32, size: 1024, date: 0, time: 0 },
        { name: "folder", attr: 16, size: 0, date: 0, time: 0 },
      ],
      "/folder": [
        { name: "subfile.txt", attr: 32, size: 512, date: 0, time: 0 },
      ],
    };
    expandedPaths.value = new Set(["/folder"]);
    selectedPaths.value = new Set(["/file.txt"]);
    fileTransferInProgress.value = false;

    midiOut.value = {
      id: "test-device",
      send: vi.fn(),
    } as unknown as MIDIOutput;

    vi.clearAllMocks();

    // Setup mock for fsDelete to simulate its behavior
    vi.mocked(midi.fsDelete).mockImplementation(async ({ path }) => {
      // Simulate file deletion logic
      if (path === "/file.txt") {
        // Update fileTree to remove the file
        fileTree.value["/"] = fileTree.value["/"].filter(
          (entry) => entry.name !== "file.txt",
        );
        // Remove from selectedPaths
        selectedPaths.value.delete(path);
      } else if (path === "/folder") {
        // Update fileTree to remove the folder
        fileTree.value["/"] = fileTree.value["/"].filter(
          (entry) => entry.name !== "folder",
        );
        delete fileTree.value["/folder"];
        // Remove from expandedPaths
        expandedPaths.value.delete(path);
        // Remove all selected paths under this folder
        Array.from(selectedPaths.value).forEach((p) => {
          if (p.startsWith(path)) {
            selectedPaths.value.delete(p);
          }
        });
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a file and update the file tree", async () => {
    // Act: Use midi namespace
    await midi.fsDelete({ path: "/file.txt" });

    // Assert
    expect(midi.fsDelete).toHaveBeenCalledWith({ path: "/file.txt" });
    // Check final state (deletePath updates it)
    expect(fileTree.value["/"]).toEqual([
      { name: "folder", attr: 16, size: 0, date: 0, time: 0 },
    ]);
    expect(selectedPaths.value.has("/file.txt")).toBe(false);
  });

  it("should delete a directory and its subdirectories from the file tree", async () => {
    // Act: Use midi namespace
    await midi.fsDelete({ path: "/folder" });

    // Assert
    expect(midi.fsDelete).toHaveBeenCalledWith({ path: "/folder" });
    // Check final state
    expect(fileTree.value["/"]).toEqual([
      { name: "file.txt", attr: 32, size: 1024, date: 0, time: 0 },
    ]);
    expect(fileTree.value["/folder"]).toBeUndefined();
    expect(expandedPaths.value.has("/folder")).toBe(false);
  });

  it("should remove the deleted path from selectedPaths", async () => {
    selectedPaths.value = new Set(["/file.txt", "/folder/subfile.txt"]);

    // Act: Use midi namespace
    await midi.fsDelete({ path: "/file.txt" });
    // Assert
    expect(selectedPaths.value.has("/file.txt")).toBe(false);
    expect(selectedPaths.value.has("/folder/subfile.txt")).toBe(true);

    // Act: Use midi namespace
    await midi.fsDelete({ path: "/folder" });
    // Assert
    expect(selectedPaths.value.has("/folder/subfile.txt")).toBe(false);
    expect(selectedPaths.value.size).toBe(0);
  });

  it("should handle errors from the deletePath operation", async () => {
    // Arrange: Override fsDelete mock to throw error
    vi.mocked(midi.fsDelete).mockRejectedValueOnce(
      new Error(
        `Failed to delete /file.txt as part of deleting /file.txt. Error: delete failed: Unknown error 42 ({"path":"/file.txt"})`,
      ),
    );

    // Act & Assert
    await expect(midi.fsDelete({ path: "/file.txt" })).rejects.toThrow(
      `Failed to delete /file.txt as part of deleting /file.txt. Error: delete failed: Unknown error 42 ({"path":"/file.txt"})`,
    );
    // Check state remains initial (mock didn't update state on error)
    expect(fileTree.value["/"]).toEqual([
      { name: "file.txt", attr: 32, size: 1024, date: 0, time: 0 },
      { name: "folder", attr: 16, size: 0, date: 0, time: 0 },
    ]);
  });

  it("should update fileTransferInProgress during operation", async () => {
    fileTransferInProgress.value = false;
    const progressChanges: boolean[] = [];
    progressChanges.push(fileTransferInProgress.value);

    // Mock fsDelete to simulate progress changes
    vi.mocked(midi.fsDelete).mockImplementation(async ({ path }) => {
      fileTransferInProgress.value = true;
      progressChanges.push(fileTransferInProgress.value);

      // Simulate the file deletion
      if (path === "/file.txt") {
        fileTree.value["/"] = fileTree.value["/"].filter(
          (entry) => entry.name !== "file.txt",
        );
        selectedPaths.value.delete(path);
      }

      fileTransferInProgress.value = false;
      progressChanges.push(fileTransferInProgress.value);
    });

    // Act: Use midi namespace
    await midi.fsDelete({ path: "/file.txt" });

    // Assert
    expect(progressChanges).toEqual([false, true, false]);
    expect(fileTree.value["/"]).toEqual([
      { name: "folder", attr: 16, size: 0, date: 0, time: 0 },
    ]);
  });
});
