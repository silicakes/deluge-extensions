import { describe, it, expect, vi, afterEach } from "vitest";
import { sendSysex } from "@/commands/_shared/transport";
import { getOLED, get7Seg, flipScreen } from "./index";

vi.mock("@/commands/_shared/transport", () => ({
  sendSysex: vi.fn(),
}));

describe("display commands", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("getOLED sends correct payload", async () => {
    await getOLED();
    expect(sendSysex).toHaveBeenCalledWith([
      0xf0, 0x7d, 0x02, 0x00, 0x01, 0xf7,
    ]);
  });

  it("get7Seg sends correct payload", async () => {
    await get7Seg();
    expect(sendSysex).toHaveBeenCalledWith([
      0xf0, 0x7d, 0x02, 0x01, 0x00, 0xf7,
    ]);
  });

  it("flipScreen sends correct payload", async () => {
    await flipScreen();
    expect(sendSysex).toHaveBeenCalledWith([
      0xf0, 0x7d, 0x02, 0x00, 0x04, 0xf7,
    ]);
  });
});
