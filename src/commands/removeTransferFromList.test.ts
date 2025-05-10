import { describe, it, expect, beforeEach } from "vitest";
import { removeTransferFromList } from "./removeTransferFromList";
import { fileTransferQueue, TransferItem } from "@/state";

describe("removeTransferFromList", () => {
  beforeEach(() => {
    // Reset queue state before each test
    fileTransferQueue.value = [];
  });

  it("removes the transfer with the given id", () => {
    const t1: TransferItem = {
      id: "1",
      kind: "upload",
      src: "/a",
      bytes: 0,
      total: 1,
      status: "active",
      controller: undefined,
    };
    const t2: TransferItem = {
      id: "2",
      kind: "download",
      src: "/b",
      bytes: 0,
      total: 1,
      status: "pending",
      controller: undefined,
    };
    fileTransferQueue.value = [t1, t2];

    removeTransferFromList("1");

    expect(fileTransferQueue.value).toEqual([t2]);
  });
});
