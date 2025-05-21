import { fileTransferQueue } from "@/state";

/**
 * Remove a file transfer from the list.
 * @param transferId ID of the transfer to remove.
 */
export function removeTransferFromList(transferId: string): void {
  fileTransferQueue.value = fileTransferQueue.value.filter(
    (t) => t.id !== transferId,
  );
}
