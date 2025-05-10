import { describe, it, expect, vi, afterEach } from "vitest";
import { writeFile } from "./fsWrite";
import * as uploader from "../uploadFiles";

describe("writeFile command", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls uploadFiles with a File instance and correct directory", async () => {
    const data = new Uint8Array([1, 2, 3]);
    const spy = vi.spyOn(uploader, "uploadFiles").mockResolvedValue();

    await writeFile({ path: "/dir/file.bin", data });

    expect(spy).toHaveBeenCalledTimes(1);
    const callArg = spy.mock.calls[0][0];
    expect(callArg.files).toHaveLength(1);
    const file = callArg.files[0];
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("file.bin");
    expect(callArg.destDir).toBe("/dir");
  });
});
