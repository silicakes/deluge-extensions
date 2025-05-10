import { describe, it, expect, vi, afterEach } from "vitest";
import { cancelAllFileTransfers } from "./cancelAllFileTransfers";
import * as midi from "@/lib/midi";

describe("cancelAllFileTransfers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls legacy cancelAllFileTransfers", () => {
    const spy = vi
      .spyOn(midi, "cancelAllFileTransfers")
      .mockImplementation(() => {});
    cancelAllFileTransfers();
    expect(spy).toHaveBeenCalled();
  });
});
