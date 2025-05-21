/**
 * Trigger browser download of file data
 * @param buf ArrayBuffer containing file data
 * @param name Filename to use for download
 */
export function triggerBrowserDownload(buf: ArrayBuffer, name: string): void {
  const blob = new Blob([buf]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
