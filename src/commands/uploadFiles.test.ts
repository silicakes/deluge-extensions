import { describe, it, expect, vi, afterEach } from "vitest";
import * as libMidi from "@/lib/midi";
import { uploadFiles } from "./uploadFiles";

describe("uploadFiles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls legacy uploadFiles with provided params", async () => {
    const spy = vi.spyOn(libMidi, "uploadFiles").mockResolvedValue(undefined);
    const files = [new File([], "test.txt")];
    const destDir = "/";
    const maxConcurrent = 5;
    await uploadFiles({ files, destDir, maxConcurrent });
    expect(spy).toHaveBeenCalledWith(files, destDir, maxConcurrent);
  });

  it("uses default maxConcurrent when not provided", async () => {
    const spy = vi.spyOn(libMidi, "uploadFiles").mockResolvedValue(undefined);
    const files = [new File([], "test.txt")];
    const destDir = "/folder";
    await uploadFiles({ files, destDir });
    expect(spy).toHaveBeenCalledWith(files, destDir, undefined);
  });
});
