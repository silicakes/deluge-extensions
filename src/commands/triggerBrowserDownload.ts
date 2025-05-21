import { triggerBrowserDownload as legacyTriggerBrowserDownload } from "@/lib/fileDownload";

/**
 * Trigger browser download of file data.
 * @param buf ArrayBuffer containing file data.
 * @param name Filename to use.
 */
export function triggerBrowserDownload(buf: ArrayBuffer, name: string): void {
  legacyTriggerBrowserDownload(buf, name);
}
