import { describe, it, expect, vi, afterEach } from "vitest";
import { cancelAllFileTransfers } from "./cancelAllFileTransfers";
import { fileTransferQueue, TransferItem } from "@/state";

describe("cancelAllFileTransfers", () => {
  afterEach(() => {
    // Reset queue state
    fileTransferQueue.value = [];
  });

  it("marks all transfers as canceled and aborts controllers", () => {
    const controller1 = { abort: vi.fn() } as unknown as AbortController;
    const controller2 = { abort: vi.fn() } as unknown as AbortController;
    const t1: TransferItem = {
      id: "1",
      kind: "upload",
      src: "/a",
      bytes: 0,
      total: 10,
      status: "active",
      controller: controller1,
    };
    const t2: TransferItem = {
      id: "2",
      kind: "download",
      src: "/b",
      bytes: 0,
      total: 20,
      status: "pending",
      controller: controller2,
    };
    fileTransferQueue.value = [t1, t2];
    cancelAllFileTransfers();
    expect(fileTransferQueue.value).toHaveLength(2);
    fileTransferQueue.value.forEach((t) => {
      expect(t.status).toBe("canceled");
      expect(t.error).toBe("Cancelled by user");
    });
    expect(controller1.abort).toHaveBeenCalled();
    expect(controller2.abort).toHaveBeenCalled();
  });
});
