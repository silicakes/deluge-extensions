import { cancelFileTransfer as legacyCancelFileTransfer } from "@/lib/midi";

/**
 * Cancel a file transfer in progress.
 * @param transferId ID of the transfer to cancel.
 */
export function cancelFileTransfer(transferId: string): void {
  legacyCancelFileTransfer(transferId);
}
