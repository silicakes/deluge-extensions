import { describe, it, expect, vi, afterEach } from "vitest";
import * as service from "@/lib/checkFirmwareSupport";
import { checkFirmwareSupport } from "./checkFirmwareSupport";

describe("checkFirmwareSupport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves true when service function resolves", async () => {
    vi.spyOn(service, "checkFirmwareSupport").mockResolvedValue(true);
    await expect(checkFirmwareSupport()).resolves.toBe(true);
  });

  it("rejects when service function rejects", async () => {
    vi.spyOn(service, "checkFirmwareSupport").mockRejectedValue(
      new Error("fail"),
    );
    await expect(checkFirmwareSupport()).rejects.toThrow("fail");
  });
});
