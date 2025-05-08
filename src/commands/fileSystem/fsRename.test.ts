import { describe, it, expect, vi, afterEach } from "vitest";
import * as midi from "@/lib/midi";
import { renameFile, RenameFileParams } from "./fsRename";

vi.mock("@/lib/midi", () => ({ renamePath: vi.fn() }));

describe("renameFile command", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls legacy renamePath with correct paths", async () => {
    const params: RenameFileParams = {
      oldPath: "/old.txt",
      newPath: "/new.txt",
    };
    await renameFile(params);
    expect(midi.renamePath).toHaveBeenCalledWith("/old.txt", "/new.txt");
  });
});
