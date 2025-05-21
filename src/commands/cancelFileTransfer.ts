import { fileTransferQueue } from "@/state";

/**
 * Cancel a file transfer in progress.
 * @param transferId ID of the transfer to cancel.
 */
export function cancelFileTransfer(transferId: string): void {
  // Clone the queue for immutability
  const queue = [...fileTransferQueue.value];
  const index = queue.findIndex((t) => t.id === transferId);
  if (index === -1) return;
  const transfer = queue[index];
  // Update status and error
  queue[index] = {
    ...transfer,
    status: "canceled",
    error: "Cancelled by user",
  };
  // Abort ongoing operation if controller present
  transfer.controller?.abort();
  // Commit updated queue
  fileTransferQueue.value = queue;
}
