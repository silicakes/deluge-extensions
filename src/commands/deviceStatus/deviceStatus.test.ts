import { describe, it, expect, vi, afterEach } from "vitest";
import { sendSysex } from "@/commands/_shared/transport";
import { getVersion, getFeatures } from "./index";

vi.mock("@/commands/_shared/transport", () => ({
  sendSysex: vi.fn(),
}));

describe("deviceStatus commands", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("getVersion sends correct payload", async () => {
    await getVersion();
    expect(sendSysex).toHaveBeenCalledWith([
      0xf0, 0x7d, 0x03, 0x02, 0x01, 0xf7,
    ]);
  });

  it("getFeatures sends correct payload", async () => {
    await getFeatures();
    expect(sendSysex).toHaveBeenCalledWith([
      0xf0, 0x7d, 0x03, 0x01, 0x01, 0xf7,
    ]);
  });
});
