import { describe, it, expect, vi, afterEach } from "vitest";
import * as libMidi from "@/lib/midi";
import { cancelFileTransfer } from "./cancelFileTransfer";

describe("cancelFileTransfer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls legacy cancelFileTransfer with provided id", () => {
    const id = "123";
    const spy = vi
      .spyOn(libMidi, "cancelFileTransfer")
      .mockImplementation(() => {});
    cancelFileTransfer(id);
    expect(spy).toHaveBeenCalledWith(id);
  });
});
