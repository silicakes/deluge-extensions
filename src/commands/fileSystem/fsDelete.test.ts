import {
  describe,
  it,
  expect,
  vi,
  afterEach,
  beforeEach,
  MockedFunction,
} from "vitest";
import { fsDelete } from "./fsDelete";
// No longer directly mock sendJson or ensureSession from smsysex
// import { sendJson, ensureSession } from "../../lib/smsysex";
import { fileTree, expandedPaths, selectedPaths, FileEntry } from "../../state";
import { executeCommand } from "../_shared/executor";
import { builder } from "../_shared/builder";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";

// Mock the executor
vi.mock("../_shared/executor", () => ({
  executeCommand: vi.fn(),
}));

// Mock state (as before)
vi.mock("../../state", () => ({
  fileTree: { value: {} as Record<string, FileEntry[]> },
  expandedPaths: { value: new Set<string>() },
  selectedPaths: { value: new Set<string>() },
}));

describe("fsDelete command", () => {
  let mockExecuteCommand: MockedFunction<typeof executeCommand>;

  beforeEach(() => {
    mockExecuteCommand = executeCommand as MockedFunction<
      typeof executeCommand
    >;

    // Reset state mocks
    fileTree.value = {};
    expandedPaths.value = new Set<string>();
    selectedPaths.value = new Set<string>();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls executeCommand with correct parameters for successful deletion", async () => {
    const params = { path: "/test.txt" };
    // Simulate parser.expectOk succeeding by having executeCommand resolve
    // with what parser.expectOk would return (the json part of the response).
    mockExecuteCommand.mockResolvedValueOnce({ delete: { err: 0 } } as Record<
      string,
      unknown
    >);

    await fsDelete(params);

    expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    const callArgs = mockExecuteCommand.mock.calls[0][0];
    expect(callArgs.cmdId).toBe(SmsCommand.JSON);
    expect(callArgs.request).toEqual(params);
    expect(callArgs.build()).toEqual(
      builder.jsonOnly({ delete: { path: params.path } }),
    );
    expect(callArgs.parse).toBe(parser.expectOk); // Verify it's using the correct parser function

    // UI update checks (as before, simplified for this test focus)
    expect(fileTree.value["/"]).toEqual([]); // Parent directory of /test.txt is "/"
  });

  it("should update fileTree and selectedPaths correctly for a file", async () => {
    fileTree.value = {
      "/KITS": [{ name: "file.kit", attr: 0x20, size: 0, date: 0, time: 0 }],
      "/": [{ name: "KITS", attr: 0x10, size: 0, date: 0, time: 0 }],
    };
    selectedPaths.value = new Set(["/KITS/file.kit"]);
    const params = { path: "/KITS/file.kit" };
    mockExecuteCommand.mockResolvedValueOnce({ delete: { err: 0 } } as Record<
      string,
      unknown
    >);

    await fsDelete(params);

    expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    expect(fileTree.value["/KITS"]).toEqual([]);
    expect(selectedPaths.value.has("/KITS/file.kit")).toBe(false);
  });

  it("should throw an error if executeCommand (simulating parser.expectOk) throws", async () => {
    const params = { path: "/SONGS/song.xml" };
    const expectedError = new Error("Simulated parser error");
    mockExecuteCommand.mockRejectedValueOnce(expectedError);

    await expect(fsDelete(params)).rejects.toThrow(expectedError);
  });

  it("should remove directory and its subtree from fileTree and expandedPaths", async () => {
    fileTree.value = {
      "/": [{ name: "DIR", attr: 0x10, size: 0, date: 0, time: 0 }],
      "/DIR": [{ name: "file.txt", attr: 0x20, size: 0, date: 0, time: 0 }],
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
    mockExecuteCommand.mockResolvedValueOnce({ delete: { err: 0 } } as Record<
      string,
      unknown
    >);

    await fsDelete(params);

    expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    expect(fileTree.value["/DIR"]).toBeUndefined();
    expect(fileTree.value["/DIR/SUBDIR"]).toBeUndefined();
    expect(expandedPaths.value.has("/DIR")).toBe(false);
    expect(expandedPaths.value.has("/DIR/SUBDIR")).toBe(false);
    expect(selectedPaths.value.has("/DIR/file.txt")).toBe(false);
    expect(selectedPaths.value.has("/DIR/SUBDIR/another.txt")).toBe(false);
    expect(selectedPaths.value.has("/OTHER")).toBe(true);
  });
});
