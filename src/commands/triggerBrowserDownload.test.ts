import { describe, it, expect, vi, afterEach } from "vitest";
import * as libMidi from "@/lib/midi";
import { triggerBrowserDownload } from "./triggerBrowserDownload";

describe("triggerBrowserDownload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls legacy triggerBrowserDownload", () => {
    const buf = new ArrayBuffer(8);
    const name = "file.bin";
    const spy = vi
      .spyOn(libMidi, "triggerBrowserDownload")
      .mockImplementation(() => {});
    triggerBrowserDownload(buf, name);
    expect(spy).toHaveBeenCalledWith(buf, name);
  });
});
