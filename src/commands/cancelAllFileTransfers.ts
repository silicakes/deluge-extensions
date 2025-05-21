import { fileTransferQueue } from "@/state";

/**
 * Cancel all file transfers in progress.
 */
export function cancelAllFileTransfers(): void {
  // Clone the queue to maintain immutability and trigger reactivity
  const queue = [...fileTransferQueue.value];
  // Abort controllers and mark each transfer as canceled
  queue.forEach((transfer, idx) => {
    if (transfer.status === "active" || transfer.status === "pending") {
      transfer.controller?.abort();
      queue[idx] = {
        ...transfer,
        status: "canceled",
        error: "Cancelled by user",
      };
    }
  });
  // Commit the updated queue
  fileTransferQueue.value = queue;
}
