import { describe, it, expect, vi, beforeEach, MockedFunction } from "vitest";
import { fsDelete } from "./fsDelete";
// No longer directly mock sendJson or ensureSession from smsysex
// import { sendJson, ensureSession } from "../../lib/smsysex";
import { fileTree, expandedPaths, selectedPaths, FileEntry } from "../../state";
import { executeCommand } from "../_shared/executor";
import { builder } from "../_shared/builder";
// parser import no longer needed
import { SmsCommand } from "../_shared/types";
import type { ExecuteCommandOpts } from "../_shared/executor";
import type { ReqFsDelete } from "./schema";

// Mock the executor
vi.mock("../_shared/executor", () => ({
  executeCommand: vi.fn(),
}));

// Mock fsList to control listDirectory behavior within fsDelete
vi.mock("./fsList", async (importOriginal) => {
  const original = await importOriginal<typeof import("./fsList")>();
  return {
    ...original,
    listDirectory: vi.fn(), // We will mock its implementation per test suite needs
    listDirectoryComplete: vi.fn(), // Mock listDirectoryComplete which is actually used by fsDelete
  };
});

// Mock state (as before)
vi.mock("../../state", () => ({
  fileTree: { value: {} as Record<string, FileEntry[]> },
  expandedPaths: { value: new Set<string>() },
  selectedPaths: { value: new Set<string>() },
}));

// Get the mock functions after vi.mock has been processed
import { listDirectoryComplete } from "./fsList";
const mockListDirectoryComplete = listDirectoryComplete as MockedFunction<
  typeof listDirectoryComplete
>;

// Define an interface for the expected options for delete calls
interface DeleteExecuteCommandOpts
  extends ExecuteCommandOpts<ReqFsDelete, Record<string, unknown>> {
  build: () => { json: { delete: { path: string } } };
}

describe("fsDelete command", () => {
  let mockExecuteCommand: MockedFunction<typeof executeCommand>;

  beforeEach(() => {
    vi.clearAllMocks(); // Clear all mocks, including listDirectory
    mockExecuteCommand = executeCommand as MockedFunction<
      typeof executeCommand
    >;

    // Default successful mock for delete operations via executeCommand
    // Individual tests can override this for specific delete calls if needed.
    mockExecuteCommand.mockResolvedValue({ delete: { err: 0 } } as Record<
      string,
      unknown
    >);

    fileTree.value = {};
    expandedPaths.value = new Set<string>();
    selectedPaths.value = new Set<string>();
  });

  describe("when deleting files", () => {
    beforeEach(() => {
      // For file deletion tests, listDirectoryComplete on the file path should throw (or indicate it's not a dir)
      mockListDirectoryComplete.mockImplementation(async ({ path }) => {
        // Simulate typical error when trying to list a file as a directory
        throw new Error(`Simulated: Cannot list path '${path}', it is a file.`);
      });
    });

    it("calls executeCommand once for the file deletion", async () => {
      const params = { path: "/test.txt" };
      await fsDelete(params);
      expect(mockListDirectoryComplete).toHaveBeenCalledWith({ path: "/" });
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      const callArgs = mockExecuteCommand.mock.calls[0][0];
      expect(callArgs.cmdId).toBe(SmsCommand.JSON);
      expect(callArgs.request).toEqual({ delete: { path: "/test.txt" } });
      expect(callArgs.build()).toEqual(
        builder.jsonOnly({ delete: { path: "/test.txt" } }),
      );
      expect(fileTree.value["/"]).toEqual([]);
    });

    it("should update fileTree and selectedPaths correctly for a file", async () => {
      fileTree.value = {
        "/KITS": [{ name: "file.kit", attr: 0x20, size: 0, date: 0, time: 0 }],
        "/": [{ name: "KITS", attr: 0x10, size: 0, date: 0, time: 0 }],
      };
      selectedPaths.value = new Set(["/KITS/file.kit"]);
      const params = { path: "/KITS/file.kit" };
      await fsDelete(params);
      expect(mockListDirectoryComplete).toHaveBeenCalledWith({ path: "/KITS" });
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(fileTree.value["/KITS"]).toEqual([]);
      expect(selectedPaths.value.has("/KITS/file.kit")).toBe(false);
    });

    it("should throw error from executeCommand if file deletion fails", async () => {
      const params = { path: "/SONGS/song.xml" };
      const expectedError = new Error("Simulated delete error");
      mockExecuteCommand.mockRejectedValueOnce(expectedError);

      await expect(fsDelete(params)).rejects.toThrow(
        `Failed to delete ${params.path} as part of deleting ${params.path}. Error: ${expectedError.message}`,
      );
      expect(mockListDirectoryComplete).toHaveBeenCalledWith({
        path: "/SONGS",
      });
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe("when deleting directories", () => {
    beforeEach(() => {
      mockListDirectoryComplete.mockImplementation(async ({ path }) => {
        if (path === "/") {
          return [{ name: "DIR", attr: 0x10, size: 0, date: 0, time: 0 }];
        }
        if (path === "/DIR") {
          return [
            { name: "file.txt", attr: 0x20, size: 0, date: 0, time: 0 },
            { name: "SUBDIR", attr: 0x10, size: 0, date: 0, time: 0 },
          ];
        }
        if (path === "/DIR/SUBDIR") {
          return [
            { name: "another.txt", attr: 0x20, size: 0, date: 0, time: 0 },
          ];
        }
        return []; // Default for any other unexpected list calls
      });
    });

    it("should remove directory and its subtree recursively", async () => {
      fileTree.value = {
        "/": [{ name: "DIR", attr: 0x10, size: 0, date: 0, time: 0 }],
        "/DIR": [
          { name: "file.txt", attr: 0x20, size: 0, date: 0, time: 0 },
          { name: "SUBDIR", attr: 0x10, size: 0, date: 0, time: 0 },
        ],
        "/DIR/SUBDIR": [
          { name: "another.txt", attr: 0x20, size: 0, date: 0, time: 0 },
        ],
      };
      expandedPaths.value = new Set(["/DIR", "/DIR/SUBDIR"]);
      selectedPaths.value = new Set([
        "/DIR/file.txt",
        "/DIR/SUBDIR/another.txt",
        "/OTHER",
      ]);
      const params = { path: "/DIR" };

      // Mock a successful response for all delete executeCommand calls
      // executeCommand will be called for another.txt, file.txt, SUBDIR, DIR
      mockExecuteCommand.mockResolvedValue({ delete: { err: 0 } } as Record<
        string,
        unknown
      >);

      await fsDelete(params);

      // Check listDirectoryComplete calls
      expect(mockListDirectoryComplete).toHaveBeenCalledWith({ path: "/DIR" });
      expect(mockListDirectoryComplete).toHaveBeenCalledWith({
        path: "/DIR/SUBDIR",
      });

      expect(mockExecuteCommand).toHaveBeenCalledTimes(4);

      const deletedPaths = mockExecuteCommand.mock.calls.map((call) => {
        const opts = call[0] as DeleteExecuteCommandOpts;
        return opts.build().json.delete.path;
      });
      expect(deletedPaths).toContain("/DIR/SUBDIR/another.txt");
      expect(deletedPaths).toContain("/DIR/file.txt");
      expect(deletedPaths).toContain("/DIR/SUBDIR");
      expect(deletedPaths).toContain("/DIR");

      // Check state updates
      expect(fileTree.value["/DIR"]).toBeUndefined();
      expect(fileTree.value["/DIR/SUBDIR"]).toBeUndefined();
      expect(expandedPaths.value.has("/DIR")).toBe(false);
      expect(expandedPaths.value.has("/DIR/SUBDIR")).toBe(false);
      expect(selectedPaths.value.has("/DIR/file.txt")).toBe(false);
      expect(selectedPaths.value.has("/DIR/SUBDIR/another.txt")).toBe(false);
      expect(selectedPaths.value.has("/OTHER")).toBe(true);
    });
  });
});
