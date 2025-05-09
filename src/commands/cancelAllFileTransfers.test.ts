import { describe, it, expect, vi, afterEach } from "vitest";
import * as libMidi from "@/lib/midi";
import { cancelAllFileTransfers } from "./cancelAllFileTransfers";

describe("cancelAllFileTransfers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls legacy cancelAllFileTransfers", () => {
    const spy = vi
      .spyOn(libMidi, "cancelAllFileTransfers")
      .mockImplementation(() => {});
    cancelAllFileTransfers();
    expect(spy).toHaveBeenCalled();
  });
});
