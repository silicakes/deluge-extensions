import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { sendSysex } from "@/commands/_shared/transport";
import { builder } from "../_shared/builder";
import { renameFile, RenameFileParams } from "./fsRename";

vi.mock("@/commands/_shared/transport", () => ({ sendSysex: vi.fn() }));

describe("renameFile command", () => {
  beforeEach(() => {
    vi.mocked(sendSysex).mockResolvedValue({ json: { ok: true } });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends rename SysEx command with correct JSON payload", async () => {
    const params: RenameFileParams = {
      oldPath: "/old.txt",
      newPath: "/new.txt",
    };
    await renameFile(params);
    expect(sendSysex).toHaveBeenCalledWith(
      builder.jsonOnly({
        rename: { from: params.oldPath, to: params.newPath },
      }),
    );
  });
});
