import { describe, it, expect, vi, afterEach } from "vitest";
import { cancelFileTransfer } from "./cancelFileTransfer";
import { fileTransferQueue, TransferItem } from "@/state";

describe("cancelFileTransfer", () => {
  afterEach(() => {
    // Reset queue state
    fileTransferQueue.value = [];
  });

  it("marks the transfer as canceled and aborts its controller", () => {
    const controller = { abort: vi.fn() } as unknown as AbortController;
    const item: TransferItem = {
      id: "123",
      kind: "upload",
      src: "/file",
      dest: "/dest",
      bytes: 0,
      total: 100,
      status: "active",
      controller,
    };
    fileTransferQueue.value = [item];
    cancelFileTransfer("123");
    const updated = fileTransferQueue.value.find((t) => t.id === "123");
    expect(updated).toMatchObject({
      status: "canceled",
      error: "Cancelled by user",
    });
    expect(controller.abort).toHaveBeenCalled();
  });
});
