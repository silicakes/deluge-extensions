import { describe, it, expect, vi, afterEach } from "vitest";
import * as midi from "@/lib/midi";
import { makeDirectory, MakeDirectoryParams } from "./fsMkdir";

vi.mock("@/lib/midi", () => ({ createDirectory: vi.fn() }));

describe("makeDirectory command", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls legacy createDirectory with correct path", async () => {
    const params: MakeDirectoryParams = { path: "/newdir" };
    await makeDirectory(params);
    expect(midi.createDirectory).toHaveBeenCalledWith("/newdir");
  });
});
