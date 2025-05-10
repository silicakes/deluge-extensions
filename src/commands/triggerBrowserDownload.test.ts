import { describe, it, expect, vi, afterEach } from "vitest";
import * as fileDownload from "@/lib/fileDownload";
import { triggerBrowserDownload } from "./triggerBrowserDownload";

describe("triggerBrowserDownload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls legacy triggerBrowserDownload", () => {
    const buf = new ArrayBuffer(8);
    const name = "file.bin";
    const spy = vi
      .spyOn(fileDownload, "triggerBrowserDownload")
      .mockImplementation(() => {});
    triggerBrowserDownload(buf, name);
    expect(spy).toHaveBeenCalledWith(buf, name);
  });
});
