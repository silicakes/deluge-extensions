import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadFiles } from "./uploadFiles";
import * as uploader from "./fileSystem/uploadFile/uploadFile";

describe("uploadFiles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls uploadFile for each provided file", async () => {
    const spy = vi
      .spyOn(uploader, "uploadFile")
      .mockResolvedValue({ ok: true });
    const files = [new File([], "test.txt")];
    const destDir = "/";
    const maxConcurrent = 5;
    await uploadFiles({ files, destDir, maxConcurrent });
    expect(spy).toHaveBeenCalledTimes(files.length);
  });

  it("works with default concurrency", async () => {
    const spy = vi
      .spyOn(uploader, "uploadFile")
      .mockResolvedValue({ ok: true });
    const files = [new File([], "test.txt")];
    const destDir = "/folder";
    await uploadFiles({ files, destDir });
    expect(spy).toHaveBeenCalledTimes(files.length);
  });
});
