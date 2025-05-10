import { fileTransferQueue } from "@/state";

/**
 * Cancel all file transfers in progress.
 */
export function cancelAllFileTransfers(): void {
  // Clone queue
  const queue = [...fileTransferQueue.value];
  // Abort controllers and update each transfer
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
  // Commit updated queue and reset progress flags if any
  fileTransferQueue.value = queue;
}
