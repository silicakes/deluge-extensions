import { describe, it, expect, vi, afterEach } from "vitest";
import * as libMidi from "@/lib/midi";
import { getDebug } from "./getDebug";

describe("getDebug", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when legacy returns true", () => {
    vi.spyOn(libMidi, "getDebug").mockReturnValue(true);
    expect(getDebug()).toBe(true);
  });

  it("returns false when legacy returns false", () => {
    vi.spyOn(libMidi, "getDebug").mockReturnValue(false);
    expect(getDebug()).toBe(false);
  });
});
