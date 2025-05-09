import { cancelAllFileTransfers as legacyCancelAllFileTransfers } from "@/lib/midi";

/**
 * Cancel all file transfers in progress.
 */
export function cancelAllFileTransfers(): void {
  legacyCancelAllFileTransfers();
}
