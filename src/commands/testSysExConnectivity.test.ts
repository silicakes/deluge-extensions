import { describe, it, expect, vi, afterEach } from "vitest";
import * as session from "@/commands/session";
import { testSysExConnectivity } from "./testSysExConnectivity";

describe("testSysExConnectivity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when ping resolves", async () => {
    vi.spyOn(session, "ping").mockResolvedValue(undefined);
    const result = await testSysExConnectivity();
    expect(result).toBe(true);
  });

  it("returns false when ping rejects", async () => {
    vi.spyOn(session, "ping").mockRejectedValue(new Error("fail"));
    const result = await testSysExConnectivity();
    expect(result).toBe(false);
  });
});
