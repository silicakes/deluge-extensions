import { removeTransferFromList as legacyRemoveTransferFromList } from "@/lib/midi";

/**
 * Remove a file transfer from the list.
 * @param transferId ID of the transfer to remove.
 */
export function removeTransferFromList(transferId: string): void {
  legacyRemoveTransferFromList(transferId);
}
